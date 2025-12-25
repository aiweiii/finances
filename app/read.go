package app

import (
	"log"
	"path/filepath"
	"strings"
	"time"

	"github.com/dlclark/regexp2"
	"rsc.io/pdf"
)

type TxnData struct {
	Date     time.Time
	Bank     string
	TxnType  string // credit or debit only
	Value    string
	Category string
	Merchant string
}

var (
	transactions            []TxnData
	merchantsToCategoryMap  = MapMerchantToCategory()
	merchantsUnaccountedFor []string
	uobDebitRegex           = regexp2.MustCompile("\\d{2}[A-Z]{3}(\\d{2}[A-Z]{3})((?:(?!\\d{2}[A-Z]{3}\\d{2}[A-Z]{3}).)*?)RefNo\\.:\\d{23}(?:\\w{3}\\d*,*\\d+\\.\\d{2})?(\\d*,*\\d+\\.\\d{2})(?!CR)", 0)

	// {1} in the middle = to avoid capturing a group with CR if it does not have a REF NO. before it
	//  e.g., PAYMT THRU E-BANK/HOMEB/CYBERB (EP58)
	uobCreditRegex = regexp2.MustCompile("\\d{2}[A-Z]{3}(\\d{2}[A-Z]{3})((?:(?!\\d{2}[A-Z]{3}\\d{2}[A-Z]{3}).)*?)RefNo\\.:(?:\\d{23}){1}(\\d*,*\\d+\\.\\d{2})CR", 0)
)

func GetTransactions(inputFilePath string) []TxnData {
	fileNameWithExt := filepath.Base(inputFilePath)
	fileName := strings.TrimSuffix(fileNameWithExt, filepath.Ext(fileNameWithExt))
	parts := strings.Split(fileName, "_")
	bank := strings.ToUpper(parts[0])
	year := parts[2]

	doc, err := pdf.Open(inputFilePath)
	if err != nil {
		log.Fatalf("error opening PDF: %v", err)
	}

	for pageNum := 1; pageNum <= doc.NumPage(); pageNum++ {
		page := doc.Page(pageNum)
		content := page.Content()

		var concatPageContent string
		for _, text := range content.Text {
			concatPageContent += text.S
		}

		matchAndAppendTransactions(uobDebitRegex, concatPageContent, "DEBIT", bank, year)
		matchAndAppendTransactions(uobCreditRegex, concatPageContent, "CREDIT", bank, year)

	}
	log.Println("merchants unaccounted for: ", merchantsUnaccountedFor)
	return transactions
}

func matchAndAppendTransactions(regex *regexp2.Regexp,
	pageContent string,
	txnType string,
	bank string,
	year string) {

	match, _ := regex.FindStringMatch(pageContent)
	for match != nil {
		dateStr := match.GroupByNumber(1).String()
		merchant := match.GroupByNumber(2).String()
		txnAmountStr := match.GroupByNumber(3).String()

		// Transform date
		date, err := stringToDate(dateStr, year)
		if err != nil {
			log.Fatal("Error parsing date", err)
		}

		// Look for category of merchant
		category, ok := merchantsToCategoryMap[strings.ToUpper(merchant)]
		if !ok {
			merchantsUnaccountedFor = append(merchantsUnaccountedFor, merchant)
		}

		transactions = append(transactions, TxnData{
			Date:     date,
			Bank:     bank,
			TxnType:  txnType,
			Value:    txnAmountStr,
			Category: category,
			Merchant: merchant,
		})

		// Look for the next match
		match, _ = regex.FindNextMatch(match)
	}
}
