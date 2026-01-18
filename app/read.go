package app

import (
	"fmt"
	"path/filepath"
	"regexp"
	"strings"
	"time"
)

type TxnData struct {
	Date     time.Time
	Bank     string
	TxnType  string // credit or debit only
	Value    int64
	Category string
	Merchant string
}

var (
	transactions            []TxnData
	merchantsUnaccountedFor []string
)

func GetTransactions(inputFilePath string, merchantToCategoryMap map[string]string) ([]TxnData, error) {
	funcName := "GetTransactions"

	transactions = []TxnData{}

	fileNameWithExt := filepath.Base(inputFilePath)
	fileName := strings.TrimSuffix(fileNameWithExt, filepath.Ext(fileNameWithExt))
	parts := strings.Split(fileName, "_")
	bank := strings.ToUpper(parts[0])
	year := parts[2]

	isDepositAccTxn := false
	if len(parts) > 3 {
		isDepositAccTxn = true
	}

	txns, err := readCsvFile(inputFilePath)
	if err != nil {
		return nil, fmt.Errorf("[%s] error opening csv file: %w", funcName, err)
	}

	for _, row := range txns {

		// skip row if there's no txn date as it's usually misc rows like 'PREVIOUS BALANCE', 'SUB TOTAL' etc.
		if row[1] == "" {
			continue
		}

		txn := TxnData{}
		if isDepositAccTxn {
			txn, err = getTransactionsForUobDepositAcc(row, year)
			if err != nil {
				return nil, fmt.Errorf("[%s] error getting transactions for UOB deposit acc: %w", funcName, err)
			}
		} else {
			txn, err = getTransactionsForUobCreditCard(row, year)
			if err != nil {
				return nil, fmt.Errorf("[%s] error getting transactions for UOB credit card: %w", funcName, err)
			}
		}

		// match merchants to an expected category
		// TODO: implement trie-based prefix search
		category, ok := merchantToCategoryMap[strings.ToUpper(txn.Merchant)]
		if !ok {
			// TODO: log out/ save in db merchants unaccounted for to manually re-categorise
			merchantsUnaccountedFor = append(merchantsUnaccountedFor, txn.Merchant)
		}
		txn.Category = category
		txn.Bank = bank

		transactions = append(transactions, txn)
	}

	return transactions, nil
}

func getTransactionsForUobCreditCard(row []string, year string) (TxnData, error) {
	funcName := "getTransactionsForUobCreditCard"

	trimmedDate := strings.ReplaceAll(row[1], " ", "")
	date, err := stringToDate(trimmedDate, year)
	if err != nil {
		return TxnData{}, fmt.Errorf("[%s] error converting stringified date in raw stmt to expected date format: %w", funcName, err)
	}

	merchant := row[2]
	removeRefNoRegex := regexp.MustCompile("^(.*)\\s*Ref\\s*No\\b")
	matches := removeRefNoRegex.FindStringSubmatch(merchant)
	if len(matches) > 0 {
		merchant = matches[1]
	}

	amt := row[3]
	txnType := "DEBIT"
	if strings.Contains(amt, "CR") {
		amt = strings.TrimSuffix(strings.TrimSpace(amt), "CR")
		txnType = "CREDIT"
	}
	amtInCents, err := convertToCents(amt)
	if err != nil {
		return TxnData{}, fmt.Errorf("[%s] error converting amount to cents: %w", funcName, err)
	}

	return TxnData{
		Date:     date,
		Bank:     "",
		TxnType:  txnType,
		Value:    amtInCents,
		Category: "",
		Merchant: merchant,
	}, nil

}

func getTransactionsForUobDepositAcc(row []string, year string) (TxnData, error) {
	funcName := "getTransactionsForUobDepositAcc"

	trimmedDate := strings.ReplaceAll(row[0], " ", "")
	date, err := stringToDate(trimmedDate, year)
	if err != nil {
		return TxnData{}, fmt.Errorf("[%s] error converting stringified-date in raw stmt to expected date format: %w", funcName, err)
	}

	merchant := row[1]
	if row[2] != "" && row[3] != "" {
		return TxnData{}, fmt.Errorf("[%s] unexpected row in uob_deposit file, check in file for merchant: %s", funcName, merchant)
	}

	amt := ""
	txnType := ""

	if row[2] != "" {
		amt = row[2]
		txnType = "CREDIT"

	} else if row[3] != "" {
		amt = row[3]
		txnType = "DEBIT"
	}

	amtInCents, err := convertToCents(amt)
	if err != nil {
		return TxnData{}, fmt.Errorf("[%s] error converting amount to cents: %w", funcName, err)
	}

	return TxnData{
		Date:     date,
		Bank:     "",
		TxnType:  txnType,
		Value:    amtInCents,
		Category: "",
		Merchant: merchant,
	}, nil
}
