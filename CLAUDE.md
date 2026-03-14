# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Validation Commands
**IMPORTANT: After every code change, validate the build succeeds.**

```bash
# Start infrastructure (Postgres on :5432, Grafana on :3000)
docker compose up

# Build the Go binary
go build

# Run the app (env options: local, stg, prd)
go run . local

# Run all Go tests
go test ./...

# Run tests for a specific package
go test ./app/...

# Run a single test
go test ./app/ -run TestName
```

## Architecture

This is a CLI-driven finance ingestion pipeline with no REST API — it runs once, reads CSVs, and upserts into Postgres.

**Data flow:**
1. **Preprocessor** (Python/Jupyter): `preprocessor/process_document.ipynb` converts PDF bank statements to CSVs, placing output in `preprocessor/scratch/`.
2. **main.go**: Entry point. Loads env, connects to Postgres, builds the category trie, then iterates over every CSV in `preprocessor/scratch/`.
3. **app/read.go**: Parses CSVs into `TxnData` structs. Filename encodes bank + date + account type: `<bank>_<mon>_<yyyy>.csv` (credit card) or `<bank>_<mon>_<yyyy>_deposit.csv` (deposit account). Only UOB is fully implemented; Citi is a stub.
4. **app/trie.go** + **app/categories.go**: Builds a prefix trie from merchant name files in `categories/`. `MatchLongestCategory` does prefix matching against merchant strings to assign a category.
5. **app/db.go**: `MustSetup` creates the `expenses` table (with `DROP_TABLE` env flag to reset). `InsertIntoDb` bulk-inserts within a transaction. `raw_location` has a UNIQUE constraint to prevent duplicate rows.

**Environment files:** `.env.local`, `.env.stg`, `.env.prd` — selected by passing the env name as the first CLI argument (defaults to `stg`).

**Key env vars:**
- `DB_DSN`: Postgres connection string (pgx format)
- `DROP_TABLE`: if `true`, drops and recreates the `expenses` table on startup

**Transaction ID:** SHA-256 of `<filename>_<rowNumber>`, truncated to 4 bytes hex. Note: IDs depend on filename, so renaming CSVs will generate new IDs.

**Categories:** Plain-text files under `categories/` (e.g. `food`, `groceries`, `travel`). Each line is a merchant name prefix. The filename (without extension) becomes the category label stored in the DB.

**Visualization:** Grafana at `localhost:3000`, pointed at the local Postgres instance.