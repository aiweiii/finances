package main

import (
	"context"
	"finance/app"
	"fmt"
	"log"
	"os"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
)

var (
	inputFilePath = "./preprocessor/scratch/"
)

func main() {
	env := "stg"
	args := os.Args
	if len(args) > 1 {
		env = args[1]
	}
	fmt.Println("deploying for env:", env)

	err := godotenv.Load(".env." + env)
	if err != nil {
		log.Fatalf("error reading .env file: %v", err)
	}

	ctx := context.Background()
	conn, err := pgx.Connect(ctx, os.Getenv("DB_DSN"))
	if err != nil {
		log.Fatalf("error connecting to database: %v", err)
	}

	err = app.MustSetup(ctx, conn)
	if err != nil {
		log.Fatalf("error setting up db: %v", err)
	}

	fmt.Println("completed setting up database ...")

	entries, err := os.ReadDir(inputFilePath)
	if err != nil {
		log.Fatalf("error reading the directory %s: %v", inputFilePath, err)
	}

	// build trie on a list of known merchants to help obtain category from merchant name later
	trie, err := app.BuildTrieOnKnownMerchants()
	if err != nil {
		log.Fatalf("error building trie: %v", err)
	}

	allTxns := []app.TxnData{}

	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}

		fmt.Println("reading file: ", entry)

		txns, err := app.GetTransactions(inputFilePath+entry.Name(), trie)
		if err != nil {
			log.Fatalf("error getting transactions: %v", err)
		}

		allTxns = append(allTxns, txns...)
	}

	// Step 1: Read manual merchant overrides from DB (from previous runs)
	manualOverrides, err := app.GetManualMerchantCategories(ctx, conn)
	if err != nil {
		log.Printf("warning: could not read manual overrides: %v", err)
		manualOverrides = map[string]string{}
	}
	if len(manualOverrides) > 0 {
		fmt.Printf("applying %d manual merchant overrides from DB ...\n", len(manualOverrides))
		for i := range allTxns {
			if cat, ok := manualOverrides[allTxns[i].Merchant]; ok {
				allTxns[i].Category = cat
			}
		}
	}

	// Step 2: Collect unique uncategorised merchants for AI classification
	uncategorised := map[string]bool{}
	for _, txn := range allTxns {
		if txn.Category == "" {
			uncategorised[txn.Merchant] = true
		}
	}

	if len(uncategorised) > 0 {
		merchants := make([]string, 0, len(uncategorised))
		for m := range uncategorised {
			merchants = append(merchants, m)
		}

		fmt.Printf("categorising %d merchants with AI ...\n", len(merchants))

		aiCategories, err := app.CategoriseWithAI(merchants)
		if err != nil {
			log.Printf("warning: AI categorisation failed: %v (continuing without)", err)
		} else {
			for i := range allTxns {
				if allTxns[i].Category == "" {
					if cat, ok := aiCategories[allTxns[i].Merchant]; ok {
						allTxns[i].Category = cat
					}
				}
			}
			fmt.Println("AI categorisation complete")
		}
	}

	// Step 3: Insert/upsert all transactions into DB (new rows only, skips existing)
	err = app.InsertIntoDb(ctx, conn, allTxns)
	if err != nil {
		log.Fatalf("error inserting transactions into db: %v", err)
	}

	// Close single connection, create a pool for concurrent HTTP requests
	conn.Close(ctx)

	pool, err := pgxpool.New(ctx, os.Getenv("DB_DSN"))
	if err != nil {
		log.Fatalf("error creating connection pool: %v", err)
	}
	defer pool.Close()

	// Start HTTP server for frontend + API
	app.StartServer(pool)
}
