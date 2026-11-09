package app

import (
	"testing"
	"time"
)

// Why: while chasing the "transactions appear one day early" bug, we confirmed the Go
// importer was correct and the shift happened in the frontend. This pins that: statement
// dates must be parsed as UTC midnight of the exact day written in the CSV, so a
// DATE column never receives a neighbouring day.
func TestStringToDateKeepsExactCalendarDay(t *testing.T) {
	got, err := stringToDate("31AUG", "2026") // callers strip spaces first
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	want := time.Date(2026, time.August, 31, 0, 0, 0, 0, time.UTC)
	if !got.Equal(want) {
		t.Errorf("got %v, want %v", got, want)
	}
}
