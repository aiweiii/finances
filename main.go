package main

import (
	"database/sql"
	"finance/app"
	"fmt"
	"log"
	"os"
)

var (
	inputFilePath = "./bank_statements/"
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

	for _, entry := range entries {
		if entry.Name() != "uob_nov_2025.pdf" {
			continue
		}
		log.Println("reading file: ", entry)
		txns := app.GetTransactions(inputFilePath + entry.Name())
		err = app.InsertIntoDb(db, txns)
		if err != nil {
			log.Fatalf("error inserting transactions into db: %v", err)
		}

	}

}
