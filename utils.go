package main

import (
	"encoding/csv"
	"fmt"
	"os"

	"github.com/shopspring/decimal"
)

func convertToCents(input string) (int64, error) {
	amount, err := decimal.NewFromString(input)
	if err != nil {
		return 0, err
	}

	cents := amount.Mul(decimal.NewFromInt(100))
	return cents.IntPart(), nil
}

func writeToTsv(outputFileName string, transactions []TxnData) {
	outputFile, _ := os.Create(outputFileName)
	defer outputFile.Close()

	writer := csv.NewWriter(outputFile)
	writer.Comma = '\t'
	defer writer.Flush()

	writer.Write([]string{"date", "category", "merchant", "amount"})

	for _, txn := range transactions {
		row := []string{
			txn.Date,
			txn.Category,
			txn.Merchant,
			txn.Value,
		}
		if err := writer.Write(row); err != nil {
			fmt.Errorf("failed to write row: %w", err)
		}
	}
}
