package app

import (
	"context"
	"fmt"
	"os"
	"strconv"

	"github.com/jackc/pgx/v5"
	_ "github.com/lib/pq"
)

func MustSetup(ctx context.Context, conn *pgx.Conn) error {

	// Drop table if exist
	dropTable, _ := strconv.ParseBool(os.Getenv("DROP_TABLE"))
	if dropTable {
		_, err := conn.Exec(ctx, "DROP TABLE IF EXISTS expenses")
		if err != nil {
			return fmt.Errorf("error dropping table: %w", err)
		}
		fmt.Println("dropped table")
	}

	// Create table
	_, err := conn.Exec(ctx, `
	CREATE TABLE IF NOT EXISTS expenses (
	    id VARCHAR(255) PRIMARY KEY,
	    txn_date TIMESTAMPTZ,
	    txn_type VARCHAR(255),
	    category VARCHAR(255),
	    merchant VARCHAR(255),
	    amount DECIMAL(10,2),
	    bank VARCHAR(255),
	    raw_location VARCHAR(255) UNIQUE
	)`)
	if err != nil {
		return fmt.Errorf("error creating table: %w", err)
	}

	return nil
}

func InsertIntoDb(ctx context.Context, conn *pgx.Conn, txns []TxnData) error {
	tx, err := conn.Begin(ctx)
	if err != nil {
		return fmt.Errorf("error beginning transaction: %w", err)
	}
	defer tx.Rollback(ctx) // Auto-rollback if not committed

	sqlStmt := `INSERT INTO expenses (id, txn_date, txn_type, category, merchant, amount, bank, raw_location) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`

	for _, txn := range txns {
		amountInFloat := fmt.Sprintf("%.2f", float64(txn.Value)/100)
		_, err = tx.Exec(ctx, sqlStmt, txn.Id, txn.Date, txn.TxnType, txn.Category, txn.Merchant, amountInFloat, txn.Bank, txn.RawLocation)
		if err != nil {
			return fmt.Errorf("error executing statement: %w", err)
		}
	}

	return tx.Commit(ctx)
}
