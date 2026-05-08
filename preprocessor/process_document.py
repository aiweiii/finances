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

env = os.environ.get("ENV", "local")
_log.info(f"processing pdf files for env: {env}")

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


def extract_chocolate_transactions(df, prev_balance: float | None = None) -> tuple[list[tuple], bool, float | None]:
    """Column-based extraction for Chocolate Finance statements.

    Camelot's column placement is unreliable across pages: column widths shift
    and empty columns get collapsed, producing 3-, 4-, or 5-column rows. We
    therefore determine In vs Out independently of which camelot column the
    amount landed in, using:
      1. balance direction (when a balance value is detected)
      2. "Card transaction:" prefix → Out (fallback when no balance)
    Output tuples: (date, merchant, in_amt, out_amt); one of in_amt/out_amt is "".
    """
    results = []
    pending_desc = ""

    for _, row in df.iterrows():
        if len(row) > 5:
            continue

        date_cell = str(row.iloc[0]).strip() if len(row) > 0 else ""
        desc_cell = str(row.iloc[1]).strip() if len(row) > 1 else ""

        is_new_txn_desc = desc_cell.startswith("Card transaction:")
        desc_match = re.match(r"(?:Card transaction:)?\s(.+)", desc_cell)
        desc_cell = desc_match.group(1).strip() if desc_match else desc_cell

        in_raw = str(row.iloc[2]).strip() if len(row) > 2 else ""
        out_raw = str(row.iloc[3]).strip() if len(row) > 3 else ""
        balance_raw = str(row.iloc[4]).strip() if len(row) > 4 else ""

        in_match = _SGD_AMT_RE.search(in_raw)
        out_match = _SGD_AMT_RE.search(out_raw)
        balance_match = _SGD_AMT_RE.search(balance_raw)

        in_amt = in_match.group(1) if in_match else ""
        out_amt = out_match.group(1) if out_match else ""

        # Camelot is unreliable about which column an amount lands in: column
        # widths/positions shift across pages, and entirely-empty columns get
        # collapsed (can produce 3, 4, or 5 column rows). Determine the In/Out
        # direction independently of camelot's column placement, using:
        #   1. balance direction (most reliable when balance is detected)
        #   2. "Card transaction:" prefix → always Out (fallback)
        actual_amt = in_amt or out_amt
        direction: str | None = None

        if balance_match:
            cur_balance = float(balance_match.group(1).replace(",", ""))
            if actual_amt and prev_balance is not None:
                direction = "out" if cur_balance < prev_balance else "in"
            prev_balance = cur_balance
        elif len(row) == 4 and in_amt and out_amt:
            # 4-column row: col 2 = amount, col 3 = balance (no col 4).
            actual_amt = in_amt
            cur_balance = float(out_amt.replace(",", ""))
            in_amt, out_amt = "", ""
            if prev_balance is not None:
                direction = "out" if cur_balance < prev_balance else "in"
            prev_balance = cur_balance

        # Fall back to description heuristic when balance can't tell us
        if actual_amt and direction is None:
            direction = "out" if is_new_txn_desc else "in"

        if direction == "out":
            in_amt, out_amt = "", actual_amt
        elif direction == "in":
            in_amt, out_amt = actual_amt, ""

        # print(f"{date_cell}, {desc_cell}, in:{in_amt}, out:{out_amt}")

        if _DATE_RE.fullmatch(date_cell) and (in_amt or out_amt):
            if not desc_cell:
                desc_cell = pending_desc
            elif pending_desc and results:
                prev = list(results[-1])
                prev[1] += " " + pending_desc
                results[-1] = tuple(prev)
            pending_desc = ""
            if desc_cell:
                results.append((date_cell, desc_cell, in_amt, out_amt))
        elif desc_cell:
            if is_new_txn_desc:
                # Flush any existing pending as continuation of previous transaction
                if pending_desc and results:
                    prev = list(results[-1])
                    prev[1] += " " + pending_desc
                    results[-1] = tuple(prev)
                pending_desc = desc_cell
            else:
                # Continuation of pending or previous transaction
                if pending_desc:
                    pending_desc = pending_desc + " " + desc_cell
                elif results:
                    prev = list(results[-1])
                    prev[1] += " " + desc_cell
                    results[-1] = tuple(prev)

        if desc_cell.upper() == "MONTHLY RETURNS":
            return results, True, prev_balance

    return results, False, prev_balance


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
    path = get_file_path(f"scratch/{env}", f"{filename}.csv")
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
    # Delete and recreate `/scratch/{env}` directory
    output_dir = get_file_path(f"scratch/{env}")
    shutil.rmtree(output_dir, ignore_errors=True)
    os.makedirs(output_dir, exist_ok=True)

    for file in sorted(os.listdir(get_file_path("statements"))):
        if not str(file).endswith(".pdf"):
            continue

        # Flags
        should_stop_iterating = False

        bank = Path(file).stem.split("_")[0].upper()
        is_deposit = "deposit" in str(file)

        start_time = time.time()
        _log.info(f"Processing {file}")

        tables = camelot.read_pdf(get_file_path("statements", str(file)), pages="all", flavor="stream")
        filename_without_extension = Path(file).stem

        all_transactions = []

        if bank == "CHOCOLATE":
            # Camelot can return multiple overlapping detections for the same page.
            # Group by page so every detection of a given page sees the same starting
            # balance, and only advance the running balance using the best detection.
            tables_by_page: dict[int, list] = {}
            for table in tables:
                tables_by_page.setdefault(table.page, []).append(table)

            choc_prev_balance: float | None = None
            for page in sorted(tables_by_page):
                if should_stop_iterating: break
                page_start_balance = choc_prev_balance
                best_extracted: list[tuple] = []
                best_ending_balance = page_start_balance
                for table in tables_by_page[page]:
                    df = table.df
                    df.columns = range(len(df.columns))
                    extracted, page_should_stop, ending_balance = extract_chocolate_transactions(df, page_start_balance)
                    if len(extracted) > len(best_extracted):
                        best_extracted = extracted
                        best_ending_balance = ending_balance
                        if page_should_stop:
                            should_stop_iterating = True
                all_transactions.extend(best_extracted)
                choc_prev_balance = best_ending_balance
        else:
            for table_ix, table in enumerate(tables):
                if should_stop_iterating: break

                df = table.df
                df.columns = range(len(df.columns))

                if bank == "UOB" and is_deposit:
                    all_transactions.extend(extract_uob_deposit_transactions(df))
                elif bank == "UOB":
                    all_transactions.extend(extract_transactions(df, "UOB"))
                elif bank == "CITI":
                    all_transactions.extend(extract_transactions(df, "CITI"))

        write_to_csv(all_transactions, filename=filename_without_extension)

        elapsed = time.time() - start_time
        _log.info(f"Done processing {file} in {elapsed:.2f} seconds.")


if __name__ == "__main__":
    main()
