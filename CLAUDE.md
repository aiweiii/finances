# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository (Lazyledger).

## Build and Validation Commands
**IMPORTANT: After every code change, validate the build succeeds.**

```bash
# Start infrastructure (Postgres on :5432)
docker compose up

# Makefile shortcuts — organized by environment

# LOCAL
make local_preprocess      # PDF → CSV (local)
make local_backend         # go run . local
make local_frontend        # cd frontend && npm run dev:local
make local                 # local_preprocess + local_backend + local_frontend

# DEV
make dev_backend           # go run . dev
make dev_frontend          # cd frontend && npm run dev:dev
make dev                   # dev_backend + dev_frontend

# STG
make stg_preprocess        # PDF → CSV (stg)
make stg_test              # pytest preprocessor/test.py -v
make spt                   # stg_preprocess + stg_test
make stg_backend           # go run . stg
make stg_frontend          # cd frontend && npm run dev:stg
make stg                   # spt + stg_backend + stg_frontend
```

## Architecture

This is a CLI-driven finance ingestion pipeline — it runs once, reads CSVs, and upserts into Postgres. A Next.js frontend provides a spending dashboard.

**Data flow:**
1. **Preprocessor** (Python): `preprocessor/process_document.py` converts PDF bank statements to CSVs, placing output in `preprocessor/scratch/{env}/`.
2. **main.go**: Entry point. Loads env (argument required: local/dev/stg/prd), connects to Postgres, builds the category trie, then iterates over every CSV in `preprocessor/scratch/{env}/`.
3. **app/read.go**: Parses CSVs into `TxnData` structs. Filename encodes bank + date + account type: `<bank>_<mon>_<yyyy>.csv` (credit card) or `<bank>_<mon>_<yyyy>_deposit.csv` (deposit account). UOB, Citi, and Chocolate Finance are supported.
4. **app/trie.go** + **app/categories.go**: Builds a prefix trie from merchant name files in `categories/`. `MatchLongestCategory` does prefix matching against merchant strings to assign a category.
5. **app/db.go**: `MustSetup` creates the `expenses` and `categories` tables (controlled by `SHOULD_DROP_TABLE`/`DROP_TABLES` env vars). `PopulateCategories` upserts category names from the trie into the `categories` table. `InsertIntoDb` bulk-inserts within a transaction. `raw_location` has a UNIQUE constraint to prevent duplicate rows. Schema includes `is_deposit_account` boolean to distinguish credit card vs deposit account transactions.
6. **Frontend** (Next.js): `frontend/` directory. Dashboard at `localhost:3000` with spending trends, category breakdowns, and per-account transaction filtering. API routes under `frontend/app/api/`.

**Environment files:** `.env.local`, `.env.dev`, `.env.stg`, `.env.prd` — selected by passing the env name as the first CLI argument (required; fatals if omitted).

**Key env vars:**
- `DB_DSN`: Postgres connection string (pgx format)
- `SHOULD_DROP_TABLE`: if `true`, drops the tables listed in `DROP_TABLES` on startup
- `DROP_TABLES`: comma-separated list of tables to drop (e.g. `expenses,categories`)

**Transaction ID:** SHA-256 of `<filename>_<rowNumber>`, truncated to 4 bytes hex. Note: IDs depend on filename, so renaming CSVs will generate new IDs.

**Categories:** Plain-text files under `categories/` (e.g. `food`, `groceries`, `transport`). Each line is a merchant name prefix. The filename (without extension) becomes the category label stored in the DB.