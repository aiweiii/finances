import csv
import logging
import os
import re
import shutil
import time
from pathlib import Path

import camelot

_log = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)


def get_file_path(*args):
    return os.path.join(os.path.dirname(__file__), *args)


BANK_PATTERNS = {
    "UOB": r"^{date}\s*({date})\s*({merchant})\s*({amt_uob}).*$",
    "CITI": r"^({date})({merchant})({amt_citi}).*$",
}


def _build_regex(pattern: str) -> str:
    date = r"[0-9]{1,2}\s*[a-zA-Z]{3}"
    merchant = r".+?"
    return pattern.format(
        date=date,
        merchant=merchant,
        amt_uob=r"\d+(?:,\d{3})*\.\d{2}(?:\sCR)?",
        amt_citi=r"\(?\d+(?:,\d{3})*\.\d{2}\)?",
    )


_DATE_RE = re.compile(r"[0-9]{1,2}\s*[A-Za-z]{3}")
_AMT_RE = re.compile(r"\d+(?:,\d{3})*\.\d{2}")
_SGD_AMT_RE = re.compile(r"S?\$(\d+(?:,\d{3})*\.\d{2})")


def extract_uob_deposit_transactions(df) -> list[tuple]:
    """Column-based extraction for UOB deposit statements.

    Camelot columns: Date(0) | Description(1) | Withdrawals(2) | Deposits(3) | Balance(4)
    Output tuples:   (date,    merchant,         withdrawal,       deposit)
    One of withdrawal/deposit will be empty string.
    """
    results = []

    for _, row in df.iterrows():
        date_cell = str(row.iloc[0]).strip() if len(row) > 0 else ""
        desc_cell = str(row.iloc[1]).strip() if len(row) > 1 else ""
        withdrawal = str(row.iloc[2]).strip() if len(row) > 2 else ""
        deposit = str(row.iloc[3]).strip() if len(row) > 3 else ""

        if (_DATE_RE.fullmatch(date_cell) and
                (_AMT_RE.fullmatch(withdrawal) or
                 _AMT_RE.fullmatch(deposit)
                )
        ):
            # New transaction row
            results.append((date_cell, desc_cell, withdrawal, deposit))
        elif results and desc_cell:
            # Continuation row: append description to previous transaction
            prev = list(results[-1])
            prev[1] = prev[1] + " " + desc_cell
            results[-1] = tuple(prev)
    return results


def extract_chocolate_transactions(df) -> list[tuple]:
    """Column-based extraction for Chocolate Finance statements.

    Camelot columns: Date(0) | Transaction(1) | In(2) | Out(3) | Balance(4)
    Output tuples:   (date,    merchant,         in_amt,  out_amt)
    One of in_amt/out_amt will be empty string. S$ prefix is stripped.
    """
    results = []

    for _, row in df.iterrows():
        if len(row) > 5:
            continue

        date_cell = str(row.iloc[0]).strip() if len(row) > 0 else ""
        desc_cell = str(row.iloc[1]).strip() if len(row) > 1 else ""
        in_raw = str(row.iloc[2]).strip() if len(row) > 2 else ""
        out_raw = str(row.iloc[3]).strip() if len(row) > 3 else ""

        desc_match = re.match(r"(?:Card transaction:)?\s(.+)", desc_cell)
        desc_cell = desc_match.group(1).strip() if desc_match else desc_cell

        # Strip S$ prefix
        in_match = _SGD_AMT_RE.search(in_raw)
        out_match = _SGD_AMT_RE.search(out_raw)
        in_amt = in_match.group(1) if in_match else ""
        out_amt = out_match.group(1) if out_match else ""

        if _DATE_RE.fullmatch(date_cell) and \
                not _DATE_RE.fullmatch(desc_cell) and \
                (in_amt or out_amt):
            results.append((date_cell, desc_cell, in_amt, out_amt))
    return results


def extract_transactions(df, bank_key: str) -> list[tuple]:
    regex = _build_regex(BANK_PATTERNS[bank_key])
    results = []

    for _, row in df.iterrows():
        line = " ".join(str(cell) for cell in row)
        matches = re.findall(regex, line, re.DOTALL | re.MULTILINE)
        if len(matches) > 1:
            _log.warning("detected a column with more than one match")
        elif len(matches) == 1:
            results.append(matches[0])
    return results


def write_to_csv(lst: list[tuple], filename):
    path = get_file_path("scratch", f"{filename}.csv")
    cleaned = []
    for row in lst:
        cleaned_row = list(row)
        # merchant is always the second field
        cleaned_row[1] = cleaned_row[1].replace("\n", " ").strip()
        cleaned.append(cleaned_row)

    with open(path, "w", newline="") as file:
        writer = csv.writer(file)
        writer.writerows(cleaned)


def main():
    # Delete and recreate `/scratch` directory
    output_dir = get_file_path("scratch")
    shutil.rmtree(output_dir, ignore_errors=True)
    os.makedirs(output_dir, exist_ok=True)

    for file in sorted(os.listdir(get_file_path("statements"))):
        if not str(file).endswith(".pdf"):
            continue

        bank = Path(file).stem.split("_")[0].upper()
        is_deposit = "deposit" in str(file)

        start_time = time.time()
        _log.info(f"Processing {file}")

        tables = camelot.read_pdf(get_file_path("statements", str(file)), pages="all", flavor="stream")
        filename_without_extension = Path(file).stem

        all_transactions = []

        for table_ix, table in enumerate(tables):
            df = table.df
            df.columns = range(len(df.columns))

            # Apply bank-specific row filtering
            if bank == "UOB" and is_deposit:
                all_transactions.extend(extract_uob_deposit_transactions(df))
            elif bank == "UOB":
                all_transactions.extend(extract_transactions(df, "UOB"))
            elif bank == "CITI":
                all_transactions.extend(extract_transactions(df, "CITI"))
            elif bank == "CHOCOLATE":
                all_transactions.extend(extract_chocolate_transactions(df))

        write_to_csv(all_transactions, filename=filename_without_extension)

        elapsed = time.time() - start_time
        _log.info(f"Done processing {file} in {elapsed:.2f} seconds.")


if __name__ == "__main__":
    main()
