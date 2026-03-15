package app

import (
	"fmt"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"
)

type TxnData struct {
	Id          string // Just a hash of RawLocation for lookup purposes
	Date        time.Time
	Bank        string
	TxnType     string // CREDIT/DEBIT
	Value       int64
	Category    string
	Merchant    string
	RawLocation string
}

var (
	transactions            []TxnData
	merchantsUnaccountedFor []string
)

func GetTransactions(inputFilePath string, trie *Trie) ([]TxnData, error) {
	funcName := "GetTransactions"

	transactions = []TxnData{}

	fileNameWithExt := filepath.Base(inputFilePath)
	fileName := strings.TrimSuffix(fileNameWithExt, filepath.Ext(fileNameWithExt))
	parts := strings.Split(fileName, "_")
	bank := strings.ToUpper(parts[0])
	year := parts[2]

	// Parse statement month from filename to detect cross-year transactions
	stmtMonthTime, err := time.Parse("Jan", strings.Title(strings.ToLower(parts[1])))
	if err != nil {
		return nil, fmt.Errorf("[%s] error parsing statement month from filename: %w", funcName, err)
	}
	stmtMonth := stmtMonthTime.Month()

	isDepositAccTxn := false
	if len(parts) > 3 {
		isDepositAccTxn = true
	}

	txns, err := readCsvFile(inputFilePath)
	if err != nil {
		return nil, fmt.Errorf("[%s] error opening csv file: %w", funcName, err)
	}

	for rowNo, row := range txns {

		txn := TxnData{}
		if bank == "UOB" && isDepositAccTxn {
			txn, err = getTransactionsForUobDepositAcc(row, year)
			if err != nil {
				return nil, fmt.Errorf("[%s] error getting transactions for UOB deposit acc: %w", funcName, err)
			}
		} else if bank == "UOB" {
			txn, err = getTransactionsForUobCreditCard(row, year)
			if err != nil {
				return nil, fmt.Errorf("[%s] error getting transactions for UOB credit card: %w", funcName, err)
			}
		} else if bank == "CITI" {
			txn, err = getTransactionsForCitiCreditCard(row, year)
			if err != nil {
				return nil, fmt.Errorf("[%s] error getting transactions for CITI credit card: %w", funcName, err)
			}
		} else if bank == "CHOCOLATE" {
			txn, err = getTransactionsForChocolateAcc(row, year)
			if err != nil {
				return nil, fmt.Errorf("[%s] error getting transactions for Chocolate acc: %w", funcName, err)
			}
		}

		if txn.Merchant == "" {
			continue
		}

		// Fix cross-year transactions (e.g., Dec txn in a Jan statement should be previous year)
		if stmtMonth == time.January && txn.Date.Month() == time.December {
			txn.Date = txn.Date.AddDate(-1, 0, 0)
		}

		// match merchants to an expected category
		// TODO: implement trie-based prefix search
		category := trie.MatchLongestCategory(txn.Merchant)
		if category == "" {
			// TODO: log out/ save in db merchants unaccounted for to manually re-categorise
			merchantsUnaccountedFor = append(merchantsUnaccountedFor, txn.Merchant)
		}
		txn.Category = category
		txn.Bank = bank
		txn.RawLocation = fileName + "_" + strconv.Itoa(rowNo)
		txn.Id = generateTxnId(txn.RawLocation)

		transactions = append(transactions, txn)
	}

	return transactions, nil
}

func getTransactionsForUobCreditCard(row []string, year string) (TxnData, error) {
	funcName := "getTransactionsForUobCreditCard"

	trimmedDate := strings.ReplaceAll(row[0], " ", "")
	date, err := stringToDate(trimmedDate, year)
	if err != nil {
		return TxnData{}, fmt.Errorf("[%s] error converting stringified date in raw stmt to expected date format: %w", funcName, err)
	}

	merchant := row[1]
	removeRefNoRegex := regexp.MustCompile("^(.*)\\s*Ref\\s*No\\b")
	matches := removeRefNoRegex.FindStringSubmatch(merchant)
	if len(matches) > 0 {
		merchant = matches[1]
	}

	amt := row[2]
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
		txnType = "DEBIT"

	} else if row[3] != "" {
		amt = row[3]
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

func getTransactionsForChocolateAcc(row []string, year string) (TxnData, error) {
	funcName := "getTransactionsForChocolateAcc"

	if row[0] == "" {
		return TxnData{}, nil
	}

	trimmedDate := strings.ReplaceAll(row[0], " ", "")
	date, err := stringToDate(trimmedDate, year)
	if err != nil {
		return TxnData{}, fmt.Errorf("[%s] error converting stringified-date in raw stmt to expected date format: %w", funcName, err)
	}

	merchant := row[1]
	if row[2] != "" && row[3] != "" {
		return TxnData{}, fmt.Errorf("[%s] unexpected row in chocolate file, check in file for merchant: %s", funcName, merchant)
	}

	amt := ""
	txnType := ""

	// Col 2 = In (credit), Col 3 = Out (debit)
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

func getTransactionsForCitiCreditCard(row []string, year string) (TxnData, error) {
	funcName := "getTransactionsForCitiCreditCard"

	trimmedDate := strings.ReplaceAll(row[0], " ", "")
	date, err := stringToDate(trimmedDate, year)
	if err != nil {
		return TxnData{}, fmt.Errorf("[%s] error converting stringified date in raw stmt to expected date format: %w", funcName, err)
	}

	amt := row[2]
	txnType := "DEBIT"
	if strings.HasPrefix(amt, "(") {
		amt = strings.Trim(amt, "()")
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
		Merchant: row[1],
	}, nil
}
