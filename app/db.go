package app

import (
	"context"
	"fmt"
	"os"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5"
	_ "github.com/lib/pq"
)

func MustSetup(ctx context.Context, conn *pgx.Conn) error {
	if err := dropTables(ctx, conn); err != nil {
		return fmt.Errorf("error dropping table: %w", err)
	}

	// Create `expenses` table
	_, err := conn.Exec(ctx, `
	CREATE TABLE IF NOT EXISTS expenses (
	    id VARCHAR(255) PRIMARY KEY,
	    txn_date DATE,
	    txn_type VARCHAR(255),
	    category VARCHAR(255),
	    merchant VARCHAR(255),
	    amount DECIMAL(10,2),
	    bank VARCHAR(255),
	    is_deposit_account BOOLEAN DEFAULT FALSE,
	    raw_location VARCHAR(255) UNIQUE,
	    ignored BOOLEAN DEFAULT FALSE,
	    modified_date TIMESTAMPTZ DEFAULT now()
	)`)
	if err != nil {
		return fmt.Errorf("error creating table: %w", err)
	}

	// Create `categories` table
	_, err = conn.Exec(ctx, `
	CREATE TABLE IF NOT EXISTS categories (
	    name VARCHAR(255) PRIMARY KEY
	)`)
	if err != nil {
		return fmt.Errorf("error creating categories table: %w", err)
	}

	return nil
}

func PopulateCategories(ctx context.Context, conn *pgx.Conn, categoryNames []string) error {
	for _, name := range categoryNames {
		// CommandTag is the returned metadata about the SQL command
		cmdTag, err := conn.Exec(ctx, `INSERT INTO categories (name) VALUES ($1) ON CONFLICT DO NOTHING`, name)
		if err != nil {
			return fmt.Errorf("error inserting category %s: %w", name, err)
		}

		if cmdTag.RowsAffected() == 0 {
			fmt.Printf("ignoring existing category: %s\n", name)
		} else {
			fmt.Printf("inserted new category: %s\n", name)
		}
	}
	return nil
}

func InsertIntoDb(ctx context.Context, conn *pgx.Conn, txns []TxnData) error {
	tx, err := conn.Begin(ctx)
	if err != nil {
		return fmt.Errorf("error beginning transaction: %w", err)
	}
	defer tx.Rollback(ctx) // Auto-rollback if not committed

	sqlStmt := `INSERT INTO expenses (id, txn_date, txn_type, category, merchant, amount, bank, is_deposit_account, raw_location)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
				ON CONFLICT (raw_location) DO UPDATE
				SET category = EXCLUDED.category,
				    modified_date = now()`

	for _, txn := range txns {
		amountInFloat := fmt.Sprintf("%.2f", float64(txn.Value)/100)
		_, txErr := tx.Exec(ctx, sqlStmt, txn.Id, txn.Date, txn.TxnType, txn.Category, txn.Merchant, amountInFloat, txn.Bank, txn.IsDepositAccount, txn.RawLocation)
		if txErr != nil {
			return fmt.Errorf("error executing statement: %w", err)
		}

		// if cmdTag.RowsAffected() > 0 {
		// 	fmt.Printf("inserted new transaction: %s, %s, %s", txn.RawLocation, txn.Date, txn.Merchant)
		// }
	}

	return tx.Commit(ctx)
}

func dropTables(ctx context.Context, conn *pgx.Conn) error {
	shouldDropTables, _ := strconv.ParseBool(os.Getenv("SHOULD_DROP_TABLE"))
	if !shouldDropTables {
		return nil
	}

	var tablesToDrop []string
	tablesEnv := os.Getenv("DROP_TABLES")

	if tablesEnv == "" {
		fmt.Printf("drop tables: no tables specified")
	}

	tablesToDrop = strings.Split(tablesEnv, ",")

	for _, table := range tablesToDrop {
		_, err := conn.Exec(ctx, fmt.Sprintf("DROP TABLE IF EXISTS %s", table))
		if err != nil {
			return err
		}

		fmt.Printf("dropped table: %s\n", table)
	}

	return nil
}
