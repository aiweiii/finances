package app

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"sort"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5"
	_ "github.com/lib/pq"
)

func MustSetup(ctx context.Context, conn *pgx.Conn) error {
	if err := dropTables(ctx, conn); err != nil {
		return fmt.Errorf("error dropping table: %w", err)
	}

	_, err := conn.Exec(ctx, `
	CREATE TABLE IF NOT EXISTS expenses (
	    transaction_id VARCHAR(255) PRIMARY KEY,
	    transaction_base_id VARCHAR(255) NOT NULL,
	    occurrence_index INT NOT NULL,
	    txn_date DATE,
	    txn_type VARCHAR(255), 
	    merchant VARCHAR(255),
	    amount DECIMAL(10,2),
	    bank VARCHAR(255),
	    is_deposit_account BOOLEAN DEFAULT FALSE,
	    raw_location VARCHAR(255),
	    active BOOLEAN DEFAULT TRUE,
	    last_seen_at TIMESTAMPTZ DEFAULT now(),
	    modified_date TIMESTAMPTZ DEFAULT now()
	)`)
	if err != nil {
		return fmt.Errorf("error creating expenses table: %w", err)
	}

	_, err = conn.Exec(ctx, `
	CREATE UNIQUE INDEX IF NOT EXISTS expenses_transaction_base_occurrence_idx
	ON expenses (transaction_base_id, occurrence_index)`)
	if err != nil {
		return fmt.Errorf("error creating expenses transaction occurrence index: %w", err)
	}

	_, err = conn.Exec(ctx, `
	CREATE TABLE IF NOT EXISTS expenses_overrides (
	    transaction_id VARCHAR(255) PRIMARY KEY REFERENCES expenses(transaction_id) ON DELETE CASCADE,
	    category VARCHAR(255),
	    ignored BOOLEAN DEFAULT FALSE,
	    modified_date TIMESTAMPTZ DEFAULT now(),
	    modified_by VARCHAR(50)
	)`)
	if err != nil {
		return fmt.Errorf("error creating expenses_overrides table: %w", err)
	}

	_, err = conn.Exec(ctx, `
	CREATE TABLE IF NOT EXISTS categories (
	    name VARCHAR(255) PRIMARY KEY
	)`)
	if err != nil {
		return fmt.Errorf("error creating categories table: %w", err)
	}

	_, err = conn.Exec(ctx, `
	CREATE TABLE IF NOT EXISTS statement_imports (
	    bank VARCHAR(255) NOT NULL,
	    is_deposit_account BOOLEAN NOT NULL DEFAULT FALSE,
	    statement_month DATE NOT NULL,
	    source_file VARCHAR(255),
	    txn_count INT NOT NULL DEFAULT 0,
	    imported_at TIMESTAMPTZ DEFAULT now(),
	    PRIMARY KEY (bank, is_deposit_account, statement_month)
	)`)
	if err != nil {
		return fmt.Errorf("error creating statement_imports table: %w", err)
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

func UpsertTransactions(ctx context.Context, conn *pgx.Conn, txns []TxnData, statements []StatementImport) error {
	tx, err := conn.Begin(ctx)
	if err != nil {
		return fmt.Errorf("error beginning transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	txnsWithIDs, err := assignTransactionIDs(ctx, tx, txns)
	if err != nil {
		return fmt.Errorf("error assigning transaction ids: %w", err)
	}

	seenTransactionIDs := make([]string, 0, len(txnsWithIDs))
	for _, txn := range txnsWithIDs {
		if err := upsertExpense(ctx, tx, txn); err != nil {
			return fmt.Errorf("error upserting expense: %w", err)
		}

		if err := upsertExpenseOverride(ctx, tx, txn.TransactionID, txn.Category); err != nil {
			return fmt.Errorf("error upserting override: %w", err)
		}

		seenTransactionIDs = append(seenTransactionIDs, txn.TransactionID)
	}

	if err := deactivateMissingTransactions(ctx, tx, seenTransactionIDs); err != nil {
		return fmt.Errorf("error deactivating missing transactions: %w", err)
	}

	if err := syncStatementImports(ctx, tx, statements); err != nil {
		return fmt.Errorf("error syncing statement imports: %w", err)
	}

	return tx.Commit(ctx)
}

// StatementImport records that a statement CSV was part of the current full import.
type StatementImport struct {
	StatementFile
	TxnCount int
}

// syncStatementImports mirrors the current full import: the table always
// reflects exactly the CSVs that were just processed.
func syncStatementImports(ctx context.Context, tx pgx.Tx, statements []StatementImport) error {
	if _, err := tx.Exec(ctx, `DELETE FROM statement_imports`); err != nil {
		return fmt.Errorf("error clearing statement imports: %w", err)
	}

	for _, s := range statements {
		if _, err := tx.Exec(ctx, `
			INSERT INTO statement_imports (bank, is_deposit_account, statement_month, source_file, txn_count)
			VALUES ($1, $2, $3, $4, $5)
			ON CONFLICT (bank, is_deposit_account, statement_month) DO UPDATE
			SET source_file = EXCLUDED.source_file,
			    txn_count = EXCLUDED.txn_count,
			    imported_at = now()`,
			s.Bank, s.IsDepositAccount, s.Month, s.FileName, s.TxnCount,
		); err != nil {
			return fmt.Errorf("error inserting statement import %s: %w", s.FileName, err)
		}
	}

	return nil
}

type existingTransactionOccurrence struct {
	TransactionBaseID string
	OccurrenceIndex   int
	RawLocation       string
}

func assignTransactionIDs(ctx context.Context, tx pgx.Tx, txns []TxnData) ([]TxnData, error) {
	transactionBaseIDs := make([]string, 0)
	seenBaseIDs := map[string]bool{}

	for i := range txns {
		if txns[i].TransactionBaseID == "" {
			txns[i].TransactionBaseID = getTransactionBaseID(txns[i])
		}

		if !seenBaseIDs[txns[i].TransactionBaseID] {
			transactionBaseIDs = append(transactionBaseIDs, txns[i].TransactionBaseID)
			seenBaseIDs[txns[i].TransactionBaseID] = true
		}
	}

	existingByBaseID := map[string][]existingTransactionOccurrence{}
	if len(transactionBaseIDs) == 0 {
		return assignTransactionIDsFromExisting(txns, existingByBaseID), nil
	}

	rows, err := tx.Query(ctx, `
		SELECT transaction_base_id, occurrence_index, raw_location
		FROM expenses
		WHERE transaction_base_id = ANY($1)
		ORDER BY transaction_base_id, occurrence_index`, transactionBaseIDs)
	if err != nil {
		return nil, fmt.Errorf("error querying existing transaction occurrences: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var occurrence existingTransactionOccurrence
		var rawLocation sql.NullString
		if err := rows.Scan(&occurrence.TransactionBaseID, &occurrence.OccurrenceIndex, &rawLocation); err != nil {
			return nil, fmt.Errorf("error scanning existing transaction occurrence: %w", err)
		}
		if rawLocation.Valid {
			occurrence.RawLocation = rawLocation.String
		}

		existingByBaseID[occurrence.TransactionBaseID] = append(existingByBaseID[occurrence.TransactionBaseID], occurrence)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating existing transaction occurrences: %w", err)
	}

	return assignTransactionIDsFromExisting(txns, existingByBaseID), nil
}

func assignTransactionIDsFromExisting(txns []TxnData, existingByBaseID map[string][]existingTransactionOccurrence) []TxnData {
	groupedTxnIndexes := map[string][]int{}
	for i := range txns {
		groupedTxnIndexes[txns[i].TransactionBaseID] = append(groupedTxnIndexes[txns[i].TransactionBaseID], i)
	}

	for transactionBaseID, txnIndexes := range groupedTxnIndexes {
		existingOccurrences := existingByBaseID[transactionBaseID]
		sort.Slice(existingOccurrences, func(i, j int) bool {
			return existingOccurrences[i].OccurrenceIndex < existingOccurrences[j].OccurrenceIndex
		})

		rawLocationMatches := map[string][]int{}
		maxExistingOccurrence := -1
		for i, occurrence := range existingOccurrences {
			if occurrence.OccurrenceIndex > maxExistingOccurrence {
				maxExistingOccurrence = occurrence.OccurrenceIndex
			}
			if occurrence.RawLocation == "" {
				continue
			}
			rawLocationMatches[occurrence.RawLocation] = append(rawLocationMatches[occurrence.RawLocation], i)
		}

		usedExistingRows := map[int]bool{}
		usedOccurrenceIndexes := map[int]bool{}
		remainingTxnIndexes := make([]int, 0, len(txnIndexes))
		rawMatchedCount := 0

		for _, txnIndex := range txnIndexes {
			matchingRows := rawLocationMatches[txns[txnIndex].RawLocation]
			if len(matchingRows) > 0 {
				existingRowIndex := matchingRows[0]
				rawLocationMatches[txns[txnIndex].RawLocation] = matchingRows[1:]

				occurrenceIndex := existingOccurrences[existingRowIndex].OccurrenceIndex
				txns[txnIndex].OccurrenceIndex = occurrenceIndex
				txns[txnIndex].TransactionID = getTransactionID(transactionBaseID, occurrenceIndex)
				usedExistingRows[existingRowIndex] = true
				usedOccurrenceIndexes[occurrenceIndex] = true
				rawMatchedCount++
				continue
			}

			remainingTxnIndexes = append(remainingTxnIndexes, txnIndex)
		}

		// If there were no source-row matches at all, reuse existing indexes first.
		// This preserves IDs for legacy rows or wholesale filename/source changes.
		if rawMatchedCount == 0 {
			remainingAfterReuse := make([]int, 0, len(remainingTxnIndexes))
			for _, txnIndex := range remainingTxnIndexes {
				reused := false
				for existingRowIndex, occurrence := range existingOccurrences {
					if usedExistingRows[existingRowIndex] || usedOccurrenceIndexes[occurrence.OccurrenceIndex] {
						continue
					}

					txns[txnIndex].OccurrenceIndex = occurrence.OccurrenceIndex
					txns[txnIndex].TransactionID = getTransactionID(transactionBaseID, occurrence.OccurrenceIndex)
					usedExistingRows[existingRowIndex] = true
					usedOccurrenceIndexes[occurrence.OccurrenceIndex] = true
					reused = true
					break
				}

				if !reused {
					remainingAfterReuse = append(remainingAfterReuse, txnIndex)
				}
			}
			remainingTxnIndexes = remainingAfterReuse
		}

		nextOccurrenceIndex := maxExistingOccurrence + 1
		for _, txnIndex := range remainingTxnIndexes {
			for usedOccurrenceIndexes[nextOccurrenceIndex] {
				nextOccurrenceIndex++
			}

			txns[txnIndex].OccurrenceIndex = nextOccurrenceIndex
			txns[txnIndex].TransactionID = getTransactionID(transactionBaseID, nextOccurrenceIndex)
			usedOccurrenceIndexes[nextOccurrenceIndex] = true
			nextOccurrenceIndex++
		}
	}

	return txns
}

func upsertExpense(ctx context.Context, tx pgx.Tx, txn TxnData) error {
	_, err := tx.Exec(ctx, `
		INSERT INTO expenses (
		    transaction_id,
		    transaction_base_id,
		    occurrence_index,
		    txn_date,
		    txn_type,
		    merchant,
		    amount,
		    bank,
		    is_deposit_account,
		    raw_location,
		    active,
		    last_seen_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7::numeric / 100, $8, $9, $10, TRUE, now())
		ON CONFLICT (transaction_id) DO UPDATE
		SET transaction_base_id = EXCLUDED.transaction_base_id,
		    occurrence_index = EXCLUDED.occurrence_index,
		    txn_date = EXCLUDED.txn_date,
		    txn_type = EXCLUDED.txn_type,
		    merchant = EXCLUDED.merchant,
		    amount = EXCLUDED.amount,
		    bank = EXCLUDED.bank,
		    is_deposit_account = EXCLUDED.is_deposit_account,
		    raw_location = EXCLUDED.raw_location,
		    active = TRUE,
		    last_seen_at = now(),
		    modified_date = CASE
		        WHEN expenses.transaction_base_id IS DISTINCT FROM EXCLUDED.transaction_base_id
		            OR expenses.occurrence_index IS DISTINCT FROM EXCLUDED.occurrence_index
		            OR expenses.txn_date IS DISTINCT FROM EXCLUDED.txn_date
		            OR expenses.txn_type IS DISTINCT FROM EXCLUDED.txn_type
		            OR expenses.merchant IS DISTINCT FROM EXCLUDED.merchant
		            OR expenses.amount IS DISTINCT FROM EXCLUDED.amount
		            OR expenses.bank IS DISTINCT FROM EXCLUDED.bank
		            OR expenses.is_deposit_account IS DISTINCT FROM EXCLUDED.is_deposit_account
		            OR expenses.raw_location IS DISTINCT FROM EXCLUDED.raw_location
		            OR expenses.active IS DISTINCT FROM TRUE
		        THEN now()
		        ELSE expenses.modified_date
		    END`,
		txn.TransactionID,
		txn.TransactionBaseID,
		txn.OccurrenceIndex,
		txn.Date,
		txn.TxnType,
		txn.Merchant,
		txn.Value,
		txn.Bank,
		txn.IsDepositAccount,
		txn.RawLocation,
	)
	if err != nil {
		return fmt.Errorf("error upserting expense: %w", err)
	}

	return nil
}

func upsertExpenseOverride(ctx context.Context, tx pgx.Tx, transactionID string, category string) error {
	category = strings.TrimSpace(category)

	if category == "" {
		_, err := tx.Exec(ctx, `
			INSERT INTO expenses_overrides (transaction_id)
			VALUES ($1)
			ON CONFLICT (transaction_id) DO UPDATE
			SET category = NULL,
			    modified_by = NULL,
			    modified_date = now()
			WHERE expenses_overrides.modified_by IS DISTINCT FROM 'MANUAL'
			    AND (expenses_overrides.category IS NOT NULL
			        OR expenses_overrides.modified_by IS NOT NULL)`, transactionID)
		if err != nil {
			return fmt.Errorf("error inserting empty override: %w", err)
		}
		return nil
	}

	_, err := tx.Exec(ctx, `
		INSERT INTO expenses_overrides (transaction_id, category, modified_by)
		VALUES ($1, $2, 'TRIE')
		ON CONFLICT (transaction_id) DO UPDATE
		SET category = EXCLUDED.category,
		    modified_by = 'TRIE',
		    modified_date = now()
		WHERE expenses_overrides.modified_by IS DISTINCT FROM 'MANUAL'
		    AND expenses_overrides.category IS DISTINCT FROM EXCLUDED.category`,
		transactionID, category,
	)
	if err != nil {
		return fmt.Errorf("error upserting non-empty override: %w", err)
	}

	return nil
}

func deactivateMissingTransactions(ctx context.Context, tx pgx.Tx, seenTransactionIDs []string) error {
	if len(seenTransactionIDs) == 0 {
		if _, err := tx.Exec(ctx, `
			UPDATE expenses
			SET active = FALSE,
			    modified_date = now()
			WHERE active = TRUE`); err != nil {
			return fmt.Errorf("error deactivating all transactions: %w", err)
		}
		return nil
	}

	if _, err := tx.Exec(ctx, `
		UPDATE expenses
		SET active = FALSE,
		    modified_date = now()
		WHERE active = TRUE
		    AND NOT (transaction_id = ANY($1))`, seenTransactionIDs); err != nil {
		return fmt.Errorf("error deactivating missing transactions: %w", err)
	}

	return nil
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
		table = strings.TrimSpace(table)
		if table == "" {
			continue
		}

		_, err := conn.Exec(ctx, fmt.Sprintf("DROP TABLE IF EXISTS %s", pgx.Identifier{table}.Sanitize()))
		if err != nil {
			return err
		}

		fmt.Printf("dropped table: %s\n", table)
	}

	return nil
}
