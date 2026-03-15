import csv
import os

import pytest


def get_file_path(*args):
    return os.path.join(os.path.dirname(__file__), *args)

def count_csv_rows(filename):
    path = get_file_path("scratch", f"{filename}.csv")
    with open(path, "r", newline="") as file:
        reader = csv.reader(file)
        return sum(1 for _ in reader)


@pytest.mark.parametrize("filename, expected", [
    ("uob_nov_2025_deposit", 27),
    ("uob_dec_2025_deposit", 52),
    ("uob_jan_2026_deposit", 65),
    ("uob_mar_2025", 15),
    ("uob_aug_2025", 27),
    ("uob_dec_2025", 24),
    ("citi_nov_2025", 61),
    ("citi_dec_2025", 34),
    ("citi_jan_2026", 32),
    ("chocolate_nov_2025", 31),
    ("chocolate_dec_2025", 36),
    ("chocolate_jan_2026", 44),
])
def test_csv_row_count(filename, expected):
    path = get_file_path("scratch", f"{filename}.csv")
    if not os.path.exists(path):
        pytest.skip(f"{filename}.csv not found")
    assert count_csv_rows(filename) == expected
