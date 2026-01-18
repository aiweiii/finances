package main

import (
	"database/sql"
	"finance/app"
	"fmt"
	"log"
	"os"
)

var (
	inputFilePath = "./preprocessor/scratch/"
)

func main() {

	db, err := sql.Open("mysql", "admin:admin@tcp(localhost:3306)/finance?parseTime=true")
	if err != nil {
		log.Fatalf("error opening database: %v", err)
	}
	defer db.Close()

	app.MustSetup(db)
	fmt.Println("completed setting up database ...")

	entries, err := os.ReadDir(inputFilePath)
	if err != nil {
		log.Fatalf("error reading the directory %s: %v", inputFilePath, err)
	}

	// map merchants to categorise
	merchantToCategoryMap, err := app.MapMerchantToCategory()
	if err != nil {
		log.Fatalf("error mapping merchants to categories: %v", err)
	}

	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}

		log.Println("reading file: ", entry)
		//if !strings.Contains(entry.Name(), "mar") {
		//	continue
		//}

		txns, err := app.GetTransactions(inputFilePath+entry.Name(), merchantToCategoryMap)
		if err != nil {
			log.Fatalf("error getting transactions: %v", err)
		}

		err = app.InsertIntoDb(db, txns)
		if err != nil {
			log.Fatalf("error inserting transactions into db: %v", err)
		}
	}
}
