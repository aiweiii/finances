package main

import (
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/dlclark/regexp2"
	"rsc.io/pdf"
)

type TxnData struct {
	Date     time.Time
	Category string
	Merchant string
	Value    string
}

var (
	inputFile               = "uob_mar_2025.pdf"
	outputFile              = OutputFilename
	merchantsToCategoryMap  = MapMerchantToCategory()
	merchantsUnaccountedFor []string
	costPerCategory         = map[string]int64{
		"food":      0,
		"groceries": 0,
		"lifestyle": 0,
		"misc":      0,
		"transport": 0,
		"travel":    0,
	}

	uobDebitRegex = regexp2.MustCompile("\\d{2}[A-Z]{3}(\\d{2}[A-Z]{3})((?:(?!\\d{2}[A-Z]{3}\\d{2}[A-Z]{3}).)*?)RefNo\\.:\\d{23}(?:\\w{3}\\d*,*\\d+\\.\\d{2})?(\\d*,*\\d+\\.\\d{2})(?!CR)", 0)

	/*
		{1} in the middle = to avoid capturing a group with CR if it does not have a REF NO. before it.
			- e.g., PAYMT THRU E-BANK/HOMEB/CYBERB (EP58)
	*/
	// TODO: update to get DATE
	uobCreditRegex = regexp2.MustCompile("(?:\\d{23}){1}(\\d*,*\\d+\\.\\d{2})CR", 0)
)

func main() {

	doc, err := pdf.Open(inputFile)
	if err != nil {
		log.Fatalf("Failed to open PDF: %v", err)
	}

	var totalToDebit int64 // stored in cents, instead of float to avoid rounding errors
	var totalToCredit int64
	var transactions []TxnData

	for pageNum := 1; pageNum <= doc.NumPage(); pageNum++ {
		page := doc.Page(pageNum)
		content := page.Content()

		var concatPageContent string
		for _, text := range content.Text {
			concatPageContent += text.S
		}

		//fmt.Println(concatPageContent)

		/* ---------- Find debit transactions ---------- */
		match, _ := uobDebitRegex.FindStringMatch(concatPageContent)
		for match != nil {
			dateStr := match.GroupByNumber(1).String()
			merchant := match.GroupByNumber(2).String()
			txnAmountStr := match.GroupByNumber(3).String()

			// Transform date
			date, err := stringToDate(dateStr, "2024")
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
				Category: category,
				Merchant: merchant,
				Value:    txnAmountStr,
			})

			// Convert to int64
			txnAmountInCents, _ := convertToCents(txnAmountStr)
			totalToDebit += txnAmountInCents

			// Look for the next match
			match, _ = uobDebitRegex.FindNextMatch(match)
		}

		/* ---------- Find credit transactions ---------- */
		matchCredit, _ := uobCreditRegex.FindStringMatch(concatPageContent)
		for matchCredit != nil {
			txnCreditAmount := matchCredit.GroupByNumber(1).String()
			txnAmountCreditInCents, _ := convertToCents(txnCreditAmount)
			totalToCredit += txnAmountCreditInCents
			matchCredit, _ = uobCreditRegex.FindNextMatch(matchCredit)
		}

	}

	/* ---------- Write to output file ---------- */
	writeToTsv(outputFile, transactions)

	/* ---------- Write to db ---------- */
	fmt.Println("Setting up database ...")
	MustSetup()
	fmt.Println("Completed setting up database ...")

	//fmt.Println("Total Amount to Debit: ", totalToDebit)
	//fmt.Println("Total Amount to Credit: ", totalToCredit)
	//fmt.Println("Total Amount to Pay: ", totalToDebit-totalToCredit)
	//
	//fmt.Println("costPerCategory: ", costPerCategory)
	//fmt.Println("merchantsUnaccountedFor: ", merchantsUnaccountedFor)

}
