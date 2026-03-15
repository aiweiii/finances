import logging
import time
from pathlib import Path

import camelot
import pandas as pd
from IPython.display import display

_log = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

output_dir = Path("scratch")

def is_float(x):
    cleaned = x.replace(",", "").replace("(", "").replace(")", "").replace("CR", "").strip()
    try:
        float(cleaned)
        return True
    except:
        return False


def clean_newlines(df):
    """Replace newlines within cell values with spaces."""
    return df.apply(lambda col: col.str.replace("\n", " ", regex=False) if col.dtype == object else col)


def merge_continuation_rows(df):
    """Merge multi-line descriptions: rows where col 0 (date) is empty are
    continuation lines whose description should be appended to the previous row."""
    merged = []
    for _, row in df.iterrows():
        if row[0].strip() == "" and merged:
            # Append description text to the previous row's description column
            merged[-1][1] = (merged[-1][1] + " " + row[1]).strip()
        else:
            merged.append(list(row))
    return pd.DataFrame(merged, columns=df.columns)


def filter_uob_deposit(df):
    """Keep rows where date is non-empty and at least one of col 2/3 is a float."""
    drop_idx = []
    for index, row in df.iterrows():
        if len(row[0].strip()) == 0 or (not is_float(row[2]) and not is_float(row[3])):
            drop_idx.append(index)
    return df.drop(drop_idx)


def filter_uob_cc(df):
    """Keep rows where trans date (col 1) is non-empty and amount (col 3) is a float."""
    drop_idx = []
    for index, row in df.iterrows():
        if row[1].strip() == "" or not is_float(row[3]):
            drop_idx.append(index)
    return df.drop(drop_idx)


def filter_citi(df):
    """Keep rows where date (col 0) is non-empty and amount (last col) is a float."""
    drop_idx = []
    last_column = expected_cols - 1 # TODO: this should be expected col
    for index, row in df.iterrows():
        print(f"index: {index}, row[0]: {row[0]}, row[1]: {row[1]}, row[2]: {row[2]}, last_col: {row[last_column]}")
        if (row[0].strip() == "" or
            not is_float(row[last_column])
        ):
            drop_idx.append(index)
    return df.drop(drop_idx)


for file in sorted(Path("./statements").iterdir()):
    if not str(file).endswith(".pdf"):
        continue

    bank = Path(file).stem.split("_")[0].upper()
    is_deposit = "deposit" in str(file)

    if str(file) != "statements/citi_jan_2026.pdf":
        continue

    # Determine expected column count for transaction tables
    if bank == "UOB" and is_deposit:
        expected_cols = 5  # date, desc, withdrawal, deposit, balance
    elif bank == "UOB":
        expected_cols = 4  # post_date, trans_date, description, amount
    elif bank == "CITI":
        expected_cols = 3  # date, description, (overflow), amount
    else:
        _log.warning(f"Skipping unsupported bank: {bank} ({file})")
        continue

    start_time = time.time()
    _log.info(f"Processing {file}")

    tables = camelot.read_pdf(str(file), pages="all", flavor="stream")
    output_dir.mkdir(parents=True, exist_ok=True)
    doc_filename = Path(file).stem

    frames = []

    for table_ix, table in enumerate(tables):
        df = table.df
        df.columns = range(len(df.columns))

        # TODO remove: this is incorrect, we might skip legitimate transactions
        # Skip non-transaction tables by column count
        # if len(df.columns) != expected_cols:
        #     continue

        # Clean newlines within cells, then merge continuation rows
        df = clean_newlines(df)
        df = merge_continuation_rows(df)

        # Apply bank-specific row filtering
        if bank == "UOB" and is_deposit:
            df = filter_uob_deposit(df)
        elif bank == "UOB":
            df = filter_uob_cc(df)
        elif bank == "CITI":
            df = filter_citi(df)

        df = df.reset_index(drop=True)
        print("displaying the dataframe ...")
        display(df)
        frames.append(df)

    if frames:
        mainframe = pd.concat(frames, ignore_index=True)
        element_csv_filename = output_dir / f"{doc_filename}.csv"
        _log.info(f"Saving CSV table to {element_csv_filename}")
        mainframe.to_csv(element_csv_filename, index=False)
    else:
        _log.warning(f"No transaction tables found for {file}")

    elapsed = time.time() - start_time
    _log.info(f"Done processing {file} in {elapsed:.2f} seconds.")
