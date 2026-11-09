package main

import (
	"context"
	"finance/app"
	"fmt"
	"log"
	"os"

	"github.com/jackc/pgx/v5"
	"github.com/joho/godotenv"
)

var (
	inputFilePath = "./preprocessor/scratch/"
)

func main() {
	var env string
	args := os.Args
	if len(args) > 1 {
		env = args[1]
	} else {
		log.Fatalf("please provide an environment: local/dev/stg/prd")
	}
	fmt.Println("deploying for env:", env)

	inputFilePath = inputFilePath + env + "/"

	err := godotenv.Load(".env." + env)
	if err != nil {
		log.Fatalf("error reading .env file: %v", err)
	}

	ctx := context.Background()
	conn, err := pgx.Connect(ctx, os.Getenv("DB_DSN"))
	if err != nil {
		log.Fatalf("error connecting to database: %v", err)
	}
	if _, err := conn.Exec(ctx, "SET timezone = 'Asia/Singapore'"); err != nil {
		log.Fatalf("error setting timezone: %v", err)
	}

	err = app.MustSetup(ctx, conn)
	if err != nil {
		log.Fatalf("error setting up db: %v", err)
	}

	entries, err := os.ReadDir(inputFilePath)
	if err != nil {
		log.Fatalf("error reading the directory %s: %v", inputFilePath, err)
	}

	// build trie on a list of known merchants to help obtain category from merchant name later
	trie, categoryNames, err := app.BuildTrieOnKnownMerchants()
	if err != nil {
		log.Fatalf("error building trie: %v", err)
	}

	err = app.PopulateCategories(ctx, conn, categoryNames)
	if err != nil {
		log.Fatalf("error populating categories: %v", err)
	}

	allTxns := []app.TxnData{}
	statements := []app.StatementImport{}
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}

		fmt.Println("reading file: ", entry.Name())

		txns, err := app.GetTransactions(inputFilePath+entry.Name(), trie)
		if err != nil {
			log.Fatalf("error getting transactions: %v", err)
		}

		stmt, err := app.ParseStatementFilename(entry.Name())
		if err != nil {
			log.Fatalf("error parsing statement filename: %v", err)
		}
		statements = append(statements, app.StatementImport{StatementFile: stmt, TxnCount: len(txns)})

		allTxns = append(allTxns, txns...)
	}

	if len(allTxns) == 0 {
		log.Fatalf("no transactions parsed from %s; refusing to deactivate existing transactions", inputFilePath)
	}

	err = app.UpsertTransactions(ctx, conn, allTxns, statements)
	if err != nil {
		log.Fatalf("error inserting transactions into db: %v", err)
	}
}
