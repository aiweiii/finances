package app

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"regexp"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Patterns that should be stripped from merchant names (IDs, card numbers, reference codes)
// These are applied in order; earlier patterns match first.
var merchantIDPatterns = []*regexp.Regexp{
	regexp.MustCompile(`\s*PIB\d{8,}\S*`),                                                // PAYNOW-FAST PIB251209849594981
	regexp.MustCompile(`\s*mBK-[\w\s]+CC\s*\d+`),                                         // Bill Payment mBK-Citi CC 5425...
	regexp.MustCompile(`\s*mBK-\S+`),                                                     // Bill Payment mBK-UOB Cards 55...
	regexp.MustCompile(`\s+Cards?\s+\d{4,}\S*`),                                          // Cards 5521632022...
	regexp.MustCompile(`\s+x{3,}\d+`),                                                    // xxxxxx0162
	regexp.MustCompile(`\s+B\d{6,}\S*`),                                                  // B00009800
	regexp.MustCompile(`\s+(?:[A-Za-z]+\d+[A-Za-z0-9]*|\d+[A-Za-z]+[A-Za-z0-9]*){1}\S*`), // mixed letter+digit IDs
	regexp.MustCompile(`\s+\d{8,}\S*`),                                                   // standalone long numbers
	regexp.MustCompile(`\s+[\w]+-[\w]+-[\w]+-\d+`),                                       // dash-delimited codes
}

func cleanMerchant(m string) string {
	// Preserve Bill Payment descriptions entirely
	if strings.HasPrefix(m, "Bill Payment") {
		return m
	}
	for _, re := range merchantIDPatterns {
		m = re.ReplaceAllString(m, "")
	}
	m = strings.TrimRight(m, " .…")
	return strings.TrimSpace(m)
}

type Transaction struct {
	ID       string  `json:"id"`
	Date     string  `json:"date"`
	TxnType  string  `json:"txn_type"`
	Category string  `json:"category"`
	Merchant string  `json:"merchant"`
	Amount   float64 `json:"amount"`
	Bank     string  `json:"bank"`
	Voided   bool    `json:"voided"`
}

type MonthlySummary struct {
	Month string  `json:"month"`
	Total float64 `json:"total"`
	Count int     `json:"count"`
}

type CategorySummary struct {
	Category string  `json:"category"`
	Total    float64 `json:"total"`
	Count    int     `json:"count"`
}

type DailySummary struct {
	Date  string  `json:"date"`
	Total float64 `json:"total"`
	Count int     `json:"count"`
}

type MonthlyCategorySummary struct {
	Month    string  `json:"month"`
	Category string  `json:"category"`
	Total    float64 `json:"total"`
}

func StartServer(pool *pgxpool.Pool) {
	mux := http.NewServeMux()

	mux.HandleFunc("/api/transactions", func(w http.ResponseWriter, r *http.Request) {
		handleTransactions(r.Context(), pool, w, r)
	})
	mux.HandleFunc("/api/transactions/credits", func(w http.ResponseWriter, r *http.Request) {
		handleCreditTransactions(r.Context(), pool, w, r)
	})
	mux.HandleFunc("/api/summary/monthly", func(w http.ResponseWriter, r *http.Request) {
		handleMonthlySummary(r.Context(), pool, w, r)
	})
	mux.HandleFunc("/api/summary/category", func(w http.ResponseWriter, r *http.Request) {
		handleCategorySummary(r.Context(), pool, w, r)
	})
	mux.HandleFunc("/api/summary/daily", func(w http.ResponseWriter, r *http.Request) {
		handleDailySummary(r.Context(), pool, w, r)
	})
	mux.HandleFunc("/api/summary/monthly-categories", func(w http.ResponseWriter, r *http.Request) {
		handleMonthlyCategorySummary(r.Context(), pool, w, r)
	})
	mux.HandleFunc("/api/transactions/update-category", func(w http.ResponseWriter, r *http.Request) {
		handleUpdateCategory(r.Context(), pool, w, r)
	})
	mux.HandleFunc("/api/transactions/void", func(w http.ResponseWriter, r *http.Request) {
		handleVoidTransaction(r.Context(), pool, w, r)
	})
	mux.HandleFunc("/api/categories", func(w http.ResponseWriter, r *http.Request) {
		handleCategories(r.Context(), pool, w, r)
	})

	// Serve frontend static files (Vite build output)
	mux.Handle("/", http.FileServer(http.Dir("frontend/dist")))

	fmt.Println("server running on http://localhost:8080")
	log.Fatal(http.ListenAndServe(":8080", mux))
}

func handleTransactions(ctx context.Context, pool *pgxpool.Pool, w http.ResponseWriter, r *http.Request) {
	month := r.URL.Query().Get("month") // optional: YYYY-MM

	query := `SELECT id, txn_date, txn_type, COALESCE(category, ''), merchant, amount, bank, COALESCE(voided, false)
		FROM expenses WHERE txn_type = 'DEBIT'`
	args := []any{}

	if month != "" {
		query += ` AND to_char(txn_date, 'YYYY-MM') = $1`
		args = append(args, month)
	}

	query += ` ORDER BY txn_date DESC`

	rows, err := pool.Query(ctx, query, args...)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	txns := []Transaction{}
	for rows.Next() {
		var t Transaction
		var date interface{}
		if err := rows.Scan(&t.ID, &date, &t.TxnType, &t.Category, &t.Merchant, &t.Amount, &t.Bank, &t.Voided); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		// Format date
		if d, ok := date.(interface{ Format(string) string }); ok {
			t.Date = d.Format("2006-01-02")
		}
		t.Merchant = cleanMerchant(t.Merchant)
		txns = append(txns, t)
	}

	writeJSON(w, txns)
}

func handleCreditTransactions(ctx context.Context, pool *pgxpool.Pool, w http.ResponseWriter, r *http.Request) {
	month := r.URL.Query().Get("month")

	query := `SELECT id, txn_date, txn_type, COALESCE(category, ''), merchant, amount, bank, COALESCE(voided, false)
		FROM expenses WHERE txn_type = 'CREDIT'`
	args := []any{}

	if month != "" {
		query += ` AND to_char(txn_date, 'YYYY-MM') = $1`
		args = append(args, month)
	}

	query += ` ORDER BY txn_date DESC`

	rows, err := pool.Query(ctx, query, args...)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	txns := []Transaction{}
	for rows.Next() {
		var t Transaction
		var date interface{}
		if err := rows.Scan(&t.ID, &date, &t.TxnType, &t.Category, &t.Merchant, &t.Amount, &t.Bank, &t.Voided); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		if d, ok := date.(interface{ Format(string) string }); ok {
			t.Date = d.Format("2006-01-02")
		}
		t.Merchant = cleanMerchant(t.Merchant)
		txns = append(txns, t)
	}

	writeJSON(w, txns)
}

func handleMonthlySummary(ctx context.Context, pool *pgxpool.Pool, w http.ResponseWriter, r *http.Request) {
	query := `SELECT to_char(txn_date, 'YYYY-MM') AS month, SUM(amount) AS total, COUNT(*) AS count
		FROM expenses WHERE txn_type = 'DEBIT' AND COALESCE(voided, false) = false
		GROUP BY month ORDER BY month`

	rows, err := pool.Query(ctx, query)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	summaries := []MonthlySummary{}
	for rows.Next() {
		var s MonthlySummary
		if err := rows.Scan(&s.Month, &s.Total, &s.Count); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		summaries = append(summaries, s)
	}

	writeJSON(w, summaries)
}

func handleCategorySummary(ctx context.Context, pool *pgxpool.Pool, w http.ResponseWriter, r *http.Request) {
	month := r.URL.Query().Get("month")

	query := `SELECT COALESCE(NULLIF(category, ''), 'uncategorised') AS cat, SUM(amount) AS total, COUNT(*) AS count
		FROM expenses WHERE txn_type = 'DEBIT' AND COALESCE(voided, false) = false`
	args := []any{}

	if month != "" {
		query += ` AND to_char(txn_date, 'YYYY-MM') = $1`
		args = append(args, month)
	}

	query += ` GROUP BY cat ORDER BY total DESC`

	rows, err := pool.Query(ctx, query, args...)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	summaries := []CategorySummary{}
	for rows.Next() {
		var s CategorySummary
		if err := rows.Scan(&s.Category, &s.Total, &s.Count); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		summaries = append(summaries, s)
	}

	writeJSON(w, summaries)
}

func handleDailySummary(ctx context.Context, pool *pgxpool.Pool, w http.ResponseWriter, r *http.Request) {
	month := r.URL.Query().Get("month")

	query := `SELECT to_char(txn_date, 'YYYY-MM-DD') AS day, SUM(amount) AS total, COUNT(*) AS count
		FROM expenses WHERE txn_type = 'DEBIT' AND COALESCE(voided, false) = false`
	args := []any{}

	if month != "" {
		query += ` AND to_char(txn_date, 'YYYY-MM') = $1`
		args = append(args, month)
	}

	query += ` GROUP BY day ORDER BY day`

	rows, err := pool.Query(ctx, query, args...)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	summaries := []DailySummary{}
	for rows.Next() {
		var s DailySummary
		if err := rows.Scan(&s.Date, &s.Total, &s.Count); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		summaries = append(summaries, s)
	}

	writeJSON(w, summaries)
}

func handleMonthlyCategorySummary(ctx context.Context, pool *pgxpool.Pool, w http.ResponseWriter, r *http.Request) {
	query := `SELECT to_char(txn_date, 'YYYY-MM') AS month,
		COALESCE(NULLIF(category, ''), 'uncategorised') AS cat,
		SUM(amount) AS total
		FROM expenses WHERE txn_type = 'DEBIT' AND COALESCE(voided, false) = false
		GROUP BY month, cat ORDER BY month, total DESC`

	rows, err := pool.Query(ctx, query)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	summaries := []MonthlyCategorySummary{}
	for rows.Next() {
		var s MonthlyCategorySummary
		if err := rows.Scan(&s.Month, &s.Category, &s.Total); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		summaries = append(summaries, s)
	}

	writeJSON(w, summaries)
}

func handleUpdateCategory(ctx context.Context, pool *pgxpool.Pool, w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		ID       string `json:"id"`
		Category string `json:"category"`
		Remember bool   `json:"remember"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	// Validate category: check hardcoded + custom categories
	validCat := false
	for _, c := range validCategories {
		if c == req.Category {
			validCat = true
			break
		}
	}
	if !validCat {
		// Check custom categories
		var exists bool
		pool.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM custom_categories WHERE name = $1)", req.Category).Scan(&exists)
		validCat = exists
	}
	if !validCat {
		http.Error(w, "invalid category", http.StatusBadRequest)
		return
	}

	// Get previous category for undo support
	var prevCategory string
	pool.QueryRow(ctx, "SELECT COALESCE(category, '') FROM expenses WHERE id = $1", req.ID).Scan(&prevCategory)

	if req.Remember {
		// "Remember All" — update ALL transactions with this merchant in DB
		var merchant string
		err := pool.QueryRow(ctx, "SELECT merchant FROM expenses WHERE id = $1", req.ID).Scan(&merchant)
		if err != nil {
			http.Error(w, "transaction not found", http.StatusNotFound)
			return
		}

		_, err = pool.Exec(ctx, "UPDATE expenses SET category = $1, category_source = 'manual' WHERE merchant = $2", req.Category, merchant)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
	} else {
		// "This Only" — update single transaction in DB
		_, err := pool.Exec(ctx, "UPDATE expenses SET category = $1, category_source = 'manual' WHERE id = $2", req.Category, req.ID)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
	}

	writeJSON(w, map[string]string{"status": "ok", "prev_category": prevCategory})
}

func handleVoidTransaction(ctx context.Context, pool *pgxpool.Pool, w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		ID     string `json:"id"`
		Voided bool   `json:"voided"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	_, err := pool.Exec(ctx, "UPDATE expenses SET voided = $1 WHERE id = $2", req.Voided, req.ID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	writeJSON(w, map[string]string{"status": "ok"})
}

func handleCategories(ctx context.Context, pool *pgxpool.Pool, w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodPost {
		// Create a new custom category
		var req struct {
			Name  string `json:"name"`
			Color string `json:"color"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}
		req.Name = strings.TrimSpace(strings.ToLower(req.Name))
		if req.Name == "" || req.Color == "" {
			http.Error(w, "name and color required", http.StatusBadRequest)
			return
		}

		_, err := pool.Exec(ctx, `INSERT INTO custom_categories (name, color) VALUES ($1, $2)
			ON CONFLICT (name) DO UPDATE SET color = $2`, req.Name, req.Color)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		writeJSON(w, map[string]string{"status": "ok"})
		return
	}

	// GET: return default + custom categories
	type CatResponse struct {
		Name    string `json:"name"`
		Color   string `json:"color"`
		Builtin bool   `json:"builtin"`
	}

	defaultColors := map[string]string{
		"food": "#f97316", "drinks": "#a855f7", "travel": "#3b82f6",
		"transport": "#22c55e", "groceries": "#eab308", "lifestyle": "#ec4899",
		"subscriptions": "#14b8a6", "education": "#8b5cf6", "investment": "#6366f1",
		"insurance": "#0ea5e9", "transfers": "#f43f5e", "misc": "#64748b",
	}

	cats := []CatResponse{}
	for _, name := range validCategories {
		cats = append(cats, CatResponse{Name: name, Color: defaultColors[name], Builtin: true})
	}

	// Append custom categories
	rows, err := pool.Query(ctx, "SELECT name, color FROM custom_categories ORDER BY name")
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var c CatResponse
			if err := rows.Scan(&c.Name, &c.Color); err == nil {
				c.Builtin = false
				cats = append(cats, c)
			}
		}
	}

	writeJSON(w, cats)
}

func writeJSON(w http.ResponseWriter, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(data)
}
