package app

import (
	"database/sql"
	"fmt"
	"log"

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
	    id VARCHAR(255) PRIMARY KEY,
	    txn_date DATETIME,
	    txn_type VARCHAR(255),
	    category VARCHAR(255),
	    merchant VARCHAR(255),
	    amount DECIMAL(10,2),
	    bank VARCHAR(255),
	    raw_location VARCHAR(255) UNIQUE
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

	stmt, err := dbTxn.Prepare("INSERT INTO expenses (id, txn_date, txn_type, category, merchant, amount, bank, raw_location) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
	if err != nil {
		return fmt.Errorf("error preparing statement: %w", err)
	}
	defer stmt.Close()

	for _, txn := range txns {
		amountInFloat := fmt.Sprintf("%.2f", float64(txn.Value)/100)
		_, err = stmt.Exec(txn.Id, txn.Date, txn.TxnType, txn.Category, txn.Merchant, amountInFloat, txn.Bank, txn.RawLocation)
		if err != nil {
			return fmt.Errorf("error executing statement: %w", err)
		}
	}

	dbTxn.Commit()

	return nil
}
