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

	// Create expenses table
	_, err := conn.Exec(ctx, `
	CREATE TABLE IF NOT EXISTS expenses (
	    id VARCHAR(255) PRIMARY KEY,
	    txn_date TIMESTAMPTZ,
	    txn_type VARCHAR(255),
	    category VARCHAR(255),
	    category_source VARCHAR(20) DEFAULT 'auto',
	    merchant VARCHAR(255),
	    amount DECIMAL(10,2),
	    bank VARCHAR(255),
	    raw_location VARCHAR(255) UNIQUE,
	    voided BOOLEAN DEFAULT FALSE
	)`)
	if err != nil {
		return fmt.Errorf("error creating table: %w", err)
	}

	// Create custom_categories table
	_, err = conn.Exec(ctx, `
	CREATE TABLE IF NOT EXISTS custom_categories (
	    name VARCHAR(100) PRIMARY KEY,
	    color VARCHAR(7) NOT NULL
	)`)
	if err != nil {
		return fmt.Errorf("error creating custom_categories table: %w", err)
	}

	// Migrations for existing DBs
	_, _ = conn.Exec(ctx, `ALTER TABLE expenses ADD COLUMN IF NOT EXISTS category_source VARCHAR(20) DEFAULT 'auto'`)
	_, _ = conn.Exec(ctx, `ALTER TABLE expenses ADD COLUMN IF NOT EXISTS voided BOOLEAN DEFAULT FALSE`)

	return nil
}

func InsertIntoDb(ctx context.Context, conn *pgx.Conn, txns []TxnData) error {
	tx, err := conn.Begin(ctx)
	if err != nil {
		return fmt.Errorf("error beginning transaction: %w", err)
	}
	defer tx.Rollback(ctx) // Auto-rollback if not committed

	// Upsert: insert new rows, skip duplicates. Don't overwrite manually-set categories.
	sqlStmt := `INSERT INTO expenses (id, txn_date, txn_type, category, category_source, merchant, amount, bank, raw_location)
		VALUES ($1, $2, $3, $4, 'auto', $5, $6, $7, $8)
		ON CONFLICT (raw_location) DO NOTHING`

	var inserted, skipped int

	for _, txn := range txns {
		amountInFloat := fmt.Sprintf("%.2f", float64(txn.Value)/100)
		ct, err := tx.Exec(ctx, sqlStmt, txn.Id, txn.Date, txn.TxnType, txn.Category, txn.Merchant, amountInFloat, txn.Bank, txn.RawLocation)
		if err != nil {
			return fmt.Errorf("error executing statement: %w", err)
		}
		if ct.RowsAffected() == 0 {
			skipped++
		} else {
			inserted++
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return err
	}

	fmt.Printf("transactions: %d total, %d new, %d existing\n", len(txns), inserted, skipped)

	return nil
}

// GetManualMerchantCategories returns merchant->category mappings from manually categorised transactions.
func GetManualMerchantCategories(ctx context.Context, conn *pgx.Conn) (map[string]string, error) {
	rows, err := conn.Query(ctx, `
		SELECT DISTINCT merchant, category FROM expenses
		WHERE category_source = 'manual' AND category != ''
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make(map[string]string)
	for rows.Next() {
		var merchant, category string
		if err := rows.Scan(&merchant, &category); err != nil {
			return nil, err
		}
		result[merchant] = category
	}
	return result, nil
}

// CategoryDef represents a category with its display color.
type CategoryDef struct {
	Name  string `json:"name"`
	Color string `json:"color"`
}

// GetCustomCategories loads user-created categories from the DB.
func GetCustomCategories(ctx context.Context, conn *pgx.Conn) ([]CategoryDef, error) {
	rows, err := conn.Query(ctx, `SELECT name, color FROM custom_categories ORDER BY name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var cats []CategoryDef
	for rows.Next() {
		var c CategoryDef
		if err := rows.Scan(&c.Name, &c.Color); err != nil {
			return nil, err
		}
		cats = append(cats, c)
	}
	return cats, nil
}
