package app

import (
	"crypto/sha256"
	"encoding/csv"
	"encoding/hex"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/shopspring/decimal"
)

func readCsvFile(filePath string) ([][]string, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return nil, fmt.Errorf("error opening file %s: %v", filePath, err)
	}
	defer file.Close()

	csvReader := csv.NewReader(file)
	records, err := csvReader.ReadAll()
	if err != nil {
		return nil, fmt.Errorf("error parsing file %s as CSV: %v", filePath, err)
	}

	return records, nil
}

func stringToDate(ddMmm string, yyyy string) (time.Time, error) {
	ddMmmYyyy := strings.ToUpper(ddMmm) + yyyy

	t, err := time.ParseInLocation(
		"02Jan2006", // Strictly referencing layout: Mon Jan 2 15:04:05 MST 2006  (aka 1 2 3 4 5 6 -7)
		ddMmmYyyy,
		time.UTC)
	if err != nil {
		return time.Time{}, fmt.Errorf("error parsing time: %w", err)
	}

	return t, err
}

func convertToCents(input string) (int64, error) {
	input = strings.ReplaceAll(input, ",", "")
	input = strings.TrimSpace(input)

	amount, err := decimal.NewFromString(input)
	if err != nil {
		return 0, err
	}

	cents := amount.Mul(decimal.NewFromInt(100))
	return cents.IntPart(), nil
}

func transactionBaseKey(txn TxnData) string {
	return txn.Date.Format("2006-01-02") + "|" + txn.TxnType + "|" +
		txn.Merchant + "|" + strconv.FormatInt(txn.Value, 10) + "|" +
		txn.Bank + "|" + strconv.FormatBool(txn.IsDepositAccount)
}

func getTransactionBaseID(txn TxnData) string {
	sum := sha256.Sum256([]byte(transactionBaseKey(txn)))
	return hex.EncodeToString(sum[:16])
}

func getTransactionID(transactionBaseID string, occurrenceIndex int) string {
	input := transactionBaseID + "|" + strconv.Itoa(occurrenceIndex)
	sum := sha256.Sum256([]byte(input))
	return hex.EncodeToString(sum[:16])
}
