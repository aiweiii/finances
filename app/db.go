package app

import (
	"database/sql"
	"fmt"
	"log"
	"strconv"

	_ "github.com/go-sql-driver/mysql"
)

func MustSetup(db *sql.DB) {
	// Drop table first (to ensure a fresh start)
	_, err := db.Exec(`DROP TABLE IF EXISTS expenses`)
	if err != nil {
		log.Fatalf("Error dropping table: %v", err)
	}

	// Create a fresh table
	_, err = db.Exec(`
	CREATE TABLE IF NOT EXISTS expenses (
	    txn_date DATETIME,
	    category VARCHAR(255),
	    merchant VARCHAR(255),
	    amount DECIMAL(10,2),
	    bank VARCHAR(255)
	)`)
	if err != nil {
		log.Fatalf("Error creating table: %v", err)
	}
}

func InsertIntoDb(db *sql.DB, txns []TxnData) error {
	dbTxn, err := db.Begin()
	if err != nil {
		return fmt.Errorf("error starting sql transaction: %w", err)
	}
	defer dbTxn.Rollback()

	stmt, err := dbTxn.Prepare("INSERT INTO expenses (txn_date, category, merchant, amount, bank) VALUES (?, ?, ?, ?, ?)")
	if err != nil {
		return fmt.Errorf("error preparing statement: %w", err)
	}
	defer stmt.Close()

	for _, txn := range txns {
		amountInFloat, _ := strconv.ParseFloat(txn.Value, 64)
		_, err = stmt.Exec(txn.Date, txn.Category, txn.Merchant, amountInFloat, txn.Bank)
		if err != nil {
			return fmt.Errorf("error executing statement: %w", err)
		}
	}

	dbTxn.Commit()

	return nil
}
