import base64
import csv
import io
import json
import logging
import os
import re
import time
from pathlib import Path

import anthropic
from pdf2image import convert_from_path
from dotenv import load_dotenv

_log = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

load_dotenv()

env = os.getenv("ENV")
_log.info(f"processing scanned HSBC pdf files for env: {env}")

load_dotenv(f".env.{env}")

def get_file_path(*args):
    return os.path.join(os.path.dirname(__file__), *args)


EXTRACTION_PROMPT = """Extract all credit card transactions from these HSBC bank statement pages.

For each transaction, extract exactly these fields:
1. TRAN DATE (the transaction date, NOT the post date) - format as "DD Mon" (e.g. "28 Jan", "02 Feb")
2. DESCRIPTION - the full merchant/transaction description. If a description spans multiple lines, join them with a single space.
3. AMOUNT(SGD) - the numeric amount with exactly 2 decimal places. If the amount has "CR" suffix, keep it (e.g. "7.21CR"). If no CR suffix, just the number (e.g. "13.20"). Remove any commas from amounts over 1,000.

Rules:
- Only extract actual transactions. Skip headers, subtotals, totals, balance lines, "Previous Statement Balance", and "Continued on next page".
- Dates must have leading zeros for single-digit days (e.g. "02 Feb" not "2 Feb").
- Scanned text often misreads "/" as "I". When two words appear joined by "I" and don't form a recognizable word (e.g. "BUSIMRT", "COMPUTERISUPPLIES"), the "I" is likely a "/" and should be corrected (e.g. "BUS/MRT", "COMPUTER/SUPPLIES").

Return ONLY a JSON array of arrays, where each inner array has exactly 3 strings: [tran_date, description, amount].
Example: [["28 Jan", "SHENG SIONG SUPERMARKE SINGAPORE SG", "13.20"], ["28 Jan", "PAYMENT VIA UOB VISA DIRECT SG", "7.21CR"]]

No other text, explanation, or markdown formatting. Just the raw JSON array."""


def pdf_to_images(pdf_path: str):
    return convert_from_path(pdf_path, dpi=300)


def image_to_base64(image) -> str:
    buf = io.BytesIO()
    image.save(buf, format="PNG")
    return base64.standard_b64encode(buf.getvalue()).decode("utf-8")


def _call_claude(images):
    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

    content = []
    for image in images:
        content.append({
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": "image/png",
                "data": image_to_base64(image),
            },
        })
    content.append({"type": "text", "text": EXTRACTION_PROMPT})

    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=4096,
        messages=[{"role": "user", "content": content}],
    )
    return message.content[0].text.strip(), message.usage


def _call_ollama(images, model: str):
    import ollama

    _log.info(f"ensuring model '{model}' is available...")
    # ollama.pull(model)

    image_bytes_list = []
    for image in images:
        buf = io.BytesIO()
        image.save(buf, format="PNG")
        image_bytes_list.append(buf.getvalue())

    response = ollama.chat(
        model=model,
        messages=[{
            "role": "user",
            "content": EXTRACTION_PROMPT,
            "images": image_bytes_list,
        }],
    )
    return response["message"]["content"].strip(), None


def extract_transactions_from_pages(images) -> list[tuple]:
    ocr_model = os.getenv("OCR_MODEL", "claude")
    _log.info(f"Using OCR model: {ocr_model}")

    if ocr_model == "claude":
        response_text, usage = _call_claude(images)
    else:
        response_text, usage = _call_ollama(images, model=ocr_model)

    # Strip accidental markdown fencing
    if response_text.startswith("```"):
        response_text = response_text.split("\n", 1)[1].rsplit("```", 1)[0].strip()

    rows = json.loads(response_text)
    results = []
    for row in rows:
        if len(row) != 3:
            _log.warning(f"Skipping malformed row: {row}")
            continue
        date, merchant, amount = row[0].strip(), row[1].strip(), row[2].strip()
        if not re.match(r"\d{2}\s[A-Z][a-z]{2}", date):
            _log.warning(f"Skipping row with invalid date: {date}")
            continue
        if not re.match(r"\d+\.?\d*(CR)?$", amount):
            _log.warning(f"Skipping row with invalid amount: {amount}")
            continue
        results.append((date, merchant, amount))

    return results, usage


def write_to_csv(lst: list[tuple], filename: str):
    path = get_file_path(f"scratch/{env}", f"{filename}.csv")
    cleaned = [("date", "merchant", "amount")]  # header row (skipped by Go's readCsvFile)
    for row in lst:
        cleaned_row = list(row)
        cleaned_row[1] = cleaned_row[1].replace("\n", " ").strip()
        cleaned.append(cleaned_row)

    with open(path, "w", newline="") as file:
        writer = csv.writer(file)
        writer.writerows(cleaned)


def main():
    output_dir = get_file_path(f"scratch/{env}")
    os.makedirs(output_dir, exist_ok=True)

    statements_dir = get_file_path("statements")
    hsbc_files = sorted(
        f for f in os.listdir(statements_dir)
        if f.startswith("hsbc") and f.endswith(".pdf")
    )

    if not hsbc_files:
        _log.info("No HSBC PDF files found in statements/")
        return

    for file in hsbc_files:
        start_time = time.time()
        _log.info(f"Processing {file}")

        try:
            images = pdf_to_images(get_file_path("statements", file))
            _log.info(f"Converted {file} to {len(images)} page image(s)")

            transactions, usage = extract_transactions_from_pages(images)
            _log.info(f"Extracted {len(transactions)} transactions from {file}")

            filename_without_extension = Path(file).stem
            write_to_csv(transactions, filename=filename_without_extension)

            if usage is not None:
                # Token usage and cost estimate (Sonnet: $3/1M input, $15/1M output)
                input_cost = usage.input_tokens * 3 / 1_000_000
                output_cost = usage.output_tokens * 15 / 1_000_000
                total_cost = input_cost + output_cost
                _log.info(f"  Tokens — input: {usage.input_tokens:,}, output: {usage.output_tokens:,}")
                _log.info(f"  Est. cost: ${total_cost:.4f} (input: ${input_cost:.4f}, output: ${output_cost:.4f})")

            elapsed = time.time() - start_time
            _log.info(f"Done processing {file} in {elapsed:.2f} seconds.")
        except Exception as e:
            _log.error(f"Failed to process {file}: {e}")
            continue


if __name__ == "__main__":
    main()
