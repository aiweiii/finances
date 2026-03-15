# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository (Lazyledger).

## Build and Validation Commands
**IMPORTANT: After every code change, validate the build succeeds.**

```bash
# Start infrastructure (Postgres on :5432)
docker compose up

# Build the Go binary
go build

# Run the app (env options: local, stg, prd)
make run_stg

# Run and test frontend functionalities
make frontend


# Makefile shortcuts
make preprocess            # Run Python preprocessor (PDF → CSV)
make test                  # Run preprocessor tests (pytest)
make pt                    # preprocess + test
make run_stg               # go run . stg
make frontend              # cd frontend && npm run dev
make all                   # pt + run_stg + frontend
```

## Architecture

This is a CLI-driven finance ingestion pipeline — it runs once, reads CSVs, and upserts into Postgres. A Next.js frontend provides a spending dashboard.

**Data flow:**
1. **Preprocessor** (Python): `preprocessor/process_document.py` converts PDF bank statements to CSVs, placing output in `preprocessor/scratch/`. There is also a Jupyter notebook variant at `preprocessor/process_document.ipynb`.
2. **main.go**: Entry point. Loads env, connects to Postgres, builds the category trie, then iterates over every CSV in `preprocessor/scratch/`.
3. **app/read.go**: Parses CSVs into `TxnData` structs. Filename encodes bank + date + account type: `<bank>_<mon>_<yyyy>.csv` (credit card) or `<bank>_<mon>_<yyyy>_deposit.csv` (deposit account). UOB, Citi, and Chocolate Finance are supported.
4. **app/trie.go** + **app/categories.go**: Builds a prefix trie from merchant name files in `categories/`. `MatchLongestCategory` does prefix matching against merchant strings to assign a category.
5. **app/db.go**: `MustSetup` creates the `expenses` table (with `DROP_TABLE` env flag to reset). `InsertIntoDb` bulk-inserts within a transaction. `raw_location` has a UNIQUE constraint to prevent duplicate rows. Schema includes `is_deposit_account` boolean to distinguish credit card vs deposit account transactions.
6. **Frontend** (Next.js): `frontend/` directory. Dashboard at `localhost:3000` with spending trends, category breakdowns, and per-account transaction filtering. API routes under `frontend/app/api/`.

**Environment files:** `.env.local`, `.env.stg`, `.env.prd` — selected by passing the env name as the first CLI argument (defaults to `stg`).

**Key env vars:**
- `DB_DSN`: Postgres connection string (pgx format)
- `DROP_TABLE`: if `true`, drops and recreates the `expenses` table on startup

**Transaction ID:** SHA-256 of `<filename>_<rowNumber>`, truncated to 4 bytes hex. Note: IDs depend on filename, so renaming CSVs will generate new IDs.

**Categories:** Plain-text files under `categories/` (e.g. `food`, `groceries`, `transport`). Each line is a merchant name prefix. The filename (without extension) becomes the category label stored in the DB.