package app

import (
	"fmt"
	"strings"
	"time"
)

func stringToDate(ddMmm string, yyyy string) (time.Time, error) {
	ddMmmYyyy := strings.ToUpper(ddMmm) + yyyy

	loc, _ := time.LoadLocation("Asia/Singapore")
	t, err := time.ParseInLocation(
		"02Jan2006", // Strictly referencing layout: Mon Jan 2 15:04:05 MST 2006  (aka 1 2 3 4 5 6 -7)
		ddMmmYyyy,
		loc)
	if err != nil {
		return time.Time{}, fmt.Errorf("Error parsing time: %w", err)
	}

	return t, err
}

//
//func convertToCents(input string) (int64, error) {
//	amount, err := decimal.NewFromString(input)
//	if err != nil {
//		return 0, err
//	}
//
//	cents := amount.Mul(decimal.NewFromInt(100))
//	return cents.IntPart(), nil
//}

//func writeToTsv(outputFileName string, transactions []TxnData) {
//	outputFile, _ := os.Create(outputFileName)
//	defer outputFile.Close()
//
//	writer := csv.NewWriter(outputFile)
//	writer.Comma = '\t'
//	defer writer.Flush()
//
//	writer.Write([]string{"txn_date", "category", "merchant", "amount", "bank"})
//
//	for _, txn := range transactions {
//		row := []string{
//			txn.Date.Format("2006-01-02"),
//			txn.Category,
//			txn.Merchant,
//			txn.Value,
//			txn.Bank,
//		}
//		if err := writer.Write(row); err != nil {
//			fmt.Errorf("failed to write row: %w", err)
//		}
//	}
//}

//func readCsvFile(filePath string) ([][]string, error) {
//	file, err := os.Open(filePath)
//	if err != nil {
//		return nil, fmt.Errorf("Error opening file %s: %v", filePath, err)
//	}
//	defer file.Close()
//
//	csvReader := csv.NewReader(file)
//	records, err := csvReader.ReadAll()
//	if err != nil {
//		return nil, fmt.Errorf("Error parsing file %s as CSV: %v", filePath, err)
//	}
//
//	return records[1:], nil
//}
