package app

import (
	"testing"
	"time"
)

// Why: the Statement Coverage page is built from what ParseStatementFilename extracts
// from each CSV name (<bank>_<mon>_<yyyy>[_deposit].csv). If bank, month or the deposit
// flag were parsed wrongly, a statement would show up under the wrong column or month.
func TestParseStatementFilename(t *testing.T) {
	tests := []struct {
		path        string
		wantBank    string
		wantMonth   time.Time
		wantDeposit bool
	}{
		{"citi_jan_2026.csv", "CITI", time.Date(2026, time.January, 1, 0, 0, 0, 0, time.UTC), false},
		{"chocolate_oct_2026.csv", "CHOCOLATE", time.Date(2026, time.October, 1, 0, 0, 0, 0, time.UTC), false},
		{"uob_dec_2025_deposit.csv", "UOB", time.Date(2025, time.December, 1, 0, 0, 0, 0, time.UTC), true},
		// directories in the path must be ignored
		{"./preprocessor/scratch/stg/uob_may_2026.csv", "UOB", time.Date(2026, time.May, 1, 0, 0, 0, 0, time.UTC), false},
		// month name casing must not matter
		{"HSBC_FEB_2026.csv", "HSBC", time.Date(2026, time.February, 1, 0, 0, 0, 0, time.UTC), false},
	}

	for _, tt := range tests {
		got, err := ParseStatementFilename(tt.path)
		if err != nil {
			t.Fatalf("%s: unexpected error: %v", tt.path, err)
		}
		if got.Bank != tt.wantBank || !got.Month.Equal(tt.wantMonth) || got.IsDepositAccount != tt.wantDeposit {
			t.Errorf("%s: got bank=%s month=%v deposit=%v, want bank=%s month=%v deposit=%v",
				tt.path, got.Bank, got.Month, got.IsDepositAccount, tt.wantBank, tt.wantMonth, tt.wantDeposit)
		}
	}
}

// Why: a misnamed CSV must stop the import with an error instead of being recorded
// under a bogus month in statement_imports.
func TestParseStatementFilenameRejectsBadNames(t *testing.T) {
	for _, path := range []string{"notes.csv", "uob_xyz_2026.csv", "uob_jan_abcd.csv"} {
		if _, err := ParseStatementFilename(path); err == nil {
			t.Errorf("%s: expected an error, got none", path)
		}
	}
}
