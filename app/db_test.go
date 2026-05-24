package app

import "testing"

func TestAssignTransactionIDsFromExistingKeepsExistingRawLocationOccurrences(t *testing.T) {
	const transactionBaseID = "base"

	txns := []TxnData{
		{TransactionBaseID: transactionBaseID, RawLocation: "sep_2026_0"},
		{TransactionBaseID: transactionBaseID, RawLocation: "oct_2026_0"},
		{TransactionBaseID: transactionBaseID, RawLocation: "nov_2026_0"},
	}
	existing := map[string][]existingTransactionOccurrence{
		transactionBaseID: {
			{TransactionBaseID: transactionBaseID, OccurrenceIndex: 0, RawLocation: "sep_2026_0"},
			{TransactionBaseID: transactionBaseID, OccurrenceIndex: 1, RawLocation: "nov_2026_0"},
		},
	}

	got := assignTransactionIDsFromExisting(txns, existing)

	assertOccurrence(t, got[0], 0)
	assertOccurrence(t, got[1], 2)
	assertOccurrence(t, got[2], 1)
}

func TestAssignTransactionIDsFromExistingReusesExistingWhenNoRawLocationsMatch(t *testing.T) {
	const transactionBaseID = "base"

	txns := []TxnData{
		{TransactionBaseID: transactionBaseID, RawLocation: "renamed_0"},
		{TransactionBaseID: transactionBaseID, RawLocation: "renamed_1"},
	}
	existing := map[string][]existingTransactionOccurrence{
		transactionBaseID: {
			{TransactionBaseID: transactionBaseID, OccurrenceIndex: 0, RawLocation: "old_0"},
			{TransactionBaseID: transactionBaseID, OccurrenceIndex: 1, RawLocation: "old_1"},
		},
	}

	got := assignTransactionIDsFromExisting(txns, existing)

	assertOccurrence(t, got[0], 0)
	assertOccurrence(t, got[1], 1)
}

func TestAssignTransactionIDsFromExistingStartsNewGroupsAtZero(t *testing.T) {
	const transactionBaseID = "base"

	txns := []TxnData{
		{TransactionBaseID: transactionBaseID, RawLocation: "new_0"},
		{TransactionBaseID: transactionBaseID, RawLocation: "new_1"},
	}

	got := assignTransactionIDsFromExisting(txns, nil)

	assertOccurrence(t, got[0], 0)
	assertOccurrence(t, got[1], 1)
}

func assertOccurrence(t *testing.T, txn TxnData, expected int) {
	t.Helper()

	if txn.OccurrenceIndex != expected {
		t.Fatalf("expected occurrence %d, got %d", expected, txn.OccurrenceIndex)
	}

	expectedID := getTransactionID(txn.TransactionBaseID, expected)
	if txn.TransactionID != expectedID {
		t.Fatalf("expected transaction id %s, got %s", expectedID, txn.TransactionID)
	}
}
