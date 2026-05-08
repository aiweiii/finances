import csv
import os

import pandas as pd
import pytest

from process_document import extract_chocolate_transactions

# Only for Author's usage 😅

def get_file_path(*args):
    return os.path.join(os.path.dirname(__file__), *args)

def count_csv_rows(path):
    with open(path, "r", newline="") as file:
        reader = csv.reader(file)
        return sum(1 for _ in reader)

def _make_df(rows):
    return pd.DataFrame(rows)


class TestChocolateSplitTransaction:
    """Desc on one row, date+amount on the next (e.g. Smp Parvifolia Pte / Ltd)."""

    def test_split_desc_merged(self):
        df = _make_df([
            ["19 Jul", "Card transaction: SMRT Buses / trains", "", "S$1.19", "S$35.00"],
            ["",       "Card transaction: Smp Parvifolia Pte",  "", "",       ""],
            ["19 Jul", "",                                      "", "S$1.60", "S$33.40"],
            ["",       "Ltd",                                   "", "",       ""],
            ["20 Jul", "Card transaction: SMRT Buses / trains", "", "S$2.00", "S$31.40"],
        ])
        results, _, _ = extract_chocolate_transactions(df)
        assert results[0] == ("19 Jul", "SMRT Buses / trains", "", "1.19")
        assert results[1] == ("19 Jul", "Smp Parvifolia Pte Ltd", "", "1.60")
        assert results[2] == ("20 Jul", "SMRT Buses / trains", "", "2.00")


class TestChocolateContinuationVsNewTxn:
    """Plain continuation vs new Card transaction: prefix on desc-only rows (e.g. Automobile / E-Mart)."""

    def test_continuation_appended_new_txn_buffered(self):
        df = _make_df([
            ["05 Sep", "Card transaction: SMRT Buses / trains", "", "S$3.96", "S$169.68"],
            ["",       "Card transaction: Automobile",          "", "",       ""],
            ["05 Sep", "",                                      "", "S$20.00","S$149.68"],
            ["",       "Association Of",                        "", "",       ""],
            ["",       "Card transaction: E-Mart 24 Seoul",     "", "",       ""],
            ["06 Sep", "",                                      "", "S$2.42", "S$147.27"],
            ["",       "Souther",                               "", "",       ""],
            ["06 Sep", "Card transaction: CU",                  "", "S$1.12", "S$146.15"],
        ])
        results, _, _ = extract_chocolate_transactions(df)
        assert results[0] == ("05 Sep", "SMRT Buses / trains", "", "3.96")
        assert results[1] == ("05 Sep", "Automobile Association Of", "", "20.00")
        assert results[2] == ("06 Sep", "E-Mart 24 Seoul Souther", "", "2.42")
        assert results[3] == ("06 Sep", "CU", "", "1.12")


class TestChocolateFourColumnBalance:
    """4-column table where col 3 is Balance, not Out (e.g. Monthly returns in May)."""

    def test_four_col_inflow_ignores_balance(self):
        df = _make_df([
            ["31 May", "Monthly returns", "S$0.03", "S$8.50"],
        ])
        results, stopped, _ = extract_chocolate_transactions(df)
        assert results[0] == ("31 May", "Monthly returns", "0.03", "")
        assert stopped is True

    def test_four_col_outflow(self):
        df = _make_df([
            ["12 Jan", "Card transaction: Koufu", "", "S$8.50"],
        ])
        results, _, _ = extract_chocolate_transactions(df)
        assert results[0] == ("12 Jan", "Koufu", "", "8.50")


class TestChocolateMonthlyReturnsStopping:
    """Monthly returns signals stop — no further rows processed."""

    def test_stops_after_monthly_returns(self):
        df = _make_df([
            ["30 Dec", "Card transaction: SMRT Buses / trains", "", "S$2.56", "S$206.65"],
            ["31 Dec", "Monthly returns",                       "S$0.29", "", "S$206.94"],
            ["01 Jan", "Card transaction: Something",           "", "S$5.00", "S$201.94"],
        ])
        results, stopped, _ = extract_chocolate_transactions(df)
        assert len(results) == 2
        assert stopped is True
        assert results[1] == ("31 Dec", "Monthly returns", "0.29", "")


@pytest.mark.parametrize("filename, expected", [
    ("uob_nov_2025_deposit", 27),
    ("uob_dec_2025_deposit", 52),
    ("uob_jan_2026_deposit", 65),
    ("uob_feb_2026_deposit", 36),
    ("uob_apr_2025", 15),
    ("uob_may_2025", 43),
    ("uob_jun_2025", 21),
    ("uob_jul_2025", 15),
    ("uob_aug_2025", 27),
    ("uob_sep_2025", 27),
    ("uob_oct_2025", 22),
    ("uob_nov_2025", 31),
    ("uob_dec_2025", 24),
    ("uob_jan_2026", 24),
    ("uob_feb_2026", 1),
    ("citi_jan_2025", 62),
    ("citi_feb_2025", 72),
    ("citi_apr_2025", 57),
    ("citi_aug_2025", 62),
    ("citi_dec_2025", 61),
    ("citi_jan_2026", 34),
    ("citi_feb_2026", 32),
    ("citi_mar_2026", 31),
    ("citi_apr_2026", 67),
    ("chocolate_may_2025", 12),
    ("chocolate_jun_2025", 61),
    ("chocolate_jul_2025", 36),
    ("chocolate_aug_2025", 34),
    ("chocolate_sep_2025", 32),
    ("chocolate_oct_2025", 39),
    ("chocolate_nov_2025", 31),
    ("chocolate_dec_2025", 36),
    ("chocolate_jan_2026", 44),
    ("chocolate_feb_2026", 28),
    ("chocolate_mar_2026", 45),
    ("hsbc_jan_2026", 24),
    ("hsbc_feb_2026", 31),
    ("hsbc_mar_2026", 15),
    ("hsbc_apr_2026", 18),
])
def test_csv_row_count(filename, expected):
    env = os.getenv("ENV")
    path = get_file_path(f"scratch/{env}", f"{filename}.csv")
    if not os.path.exists(path):
        pytest.skip(f"{filename}.csv not found")
    assert count_csv_rows(path) == expected
