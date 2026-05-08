# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository (Lazyledger).

## Build and Validation Commands
**IMPORTANT: After every code change, validate the build succeeds.**

```bash
# Start infrastructure (Postgres on :5432)
docker compose up

# Makefile shortcuts — organized by environment

# LOCAL
make local_preprocess               # PDF → CSV (local, non-HSBC banks)
make local_preprocess_hsbc          # HSBC PDF → CSV using Claude OCR (local)
make local_preprocess_hsbc_ollama   # HSBC PDF → CSV using Ollama OCR (local)
make local_backend                  # go run . local
make local_frontend                 # cd frontend && npm run dev:local (port 3000)
make local                          # local_preprocess + local_backend + local_frontend

# DEV
make dev_backend           # go run . dev
make dev_frontend          # cd frontend && npm run dev:dev (port 3001)
make dev                   # dev_backend + dev_frontend

# STG
make stg_preprocess                  # PDF → CSV (stg, non-HSBC banks)
make stg_preprocess_hsbc_sagemaker   # HSBC PDF → CSV using SageMaker OCR (stg)
make stg_preprocess_hsbc_ollama      # HSBC PDF → CSV using Ollama OCR (stg)
make stg_test                        # ENV=stg pytest preprocessor/test.py -v
make spt                             # stg_preprocess + stg_test
make stg_backend                     # go run . stg
make stg_frontend                    # cd frontend && npm run dev:stg (port 3002)
make stg                             # spt + stg_backend + stg_frontend
```

## Architecture

This is a CLI-driven finance ingestion pipeline — it runs once, reads CSVs, and upserts into Postgres. A Next.js frontend provides a spending dashboard.

**Data flow:**
1. **Preprocessor** (Python): Converts PDF bank statements to CSVs, placing output in `preprocessor/scratch/{env}/`.
   - `preprocessor/process_document.py`: UOB, Citi, Chocolate Finance (text-based PDFs via Camelot).
   - `preprocessor/process_hsbc.py`: HSBC scanned statements via vision OCR (Claude API, Ollama, or SageMaker).
2. **main.go**: Entry point. Loads env (argument required: local/dev/stg/prd), connects to Postgres, builds the category trie, then iterates over every CSV in `preprocessor/scratch/{env}/`.
3. **app/read.go**: Parses CSVs into `TxnData` structs. Filename encodes bank + date + account type: `<bank>_<mon>_<yyyy>.csv` (credit card) or `<bank>_<mon>_<yyyy>_deposit.csv` (deposit account). Supported banks: UOB, Citi, Chocolate Finance, HSBC.
4. **app/trie.go** + **app/categories.go**: Builds a prefix trie from merchant name files in `categories/`. `MatchLongestCategory` does longest-prefix matching against merchant strings to assign a category.
5. **app/db.go**: `MustSetup` creates the `expenses` and `categories` tables (controlled by `SHOULD_DROP_TABLE`/`DROP_TABLES` env vars). `PopulateCategories` upserts category names from the trie into the `categories` table. `InsertIntoDb` bulk-inserts within a transaction using ON CONFLICT (raw_location) DO UPDATE — updates category and modified_date only if the new category is non-empty and different. `raw_location` has a UNIQUE constraint to prevent duplicate rows. Schema includes `is_deposit_account` boolean to distinguish credit card vs deposit account transactions.
6. **Frontend** (Next.js): `frontend/` directory. Dashboard at `localhost:3000` with spending trends, category breakdowns, and per-account transaction filtering. API routes under `frontend/app/api/`.

**Environment files:** `.env.local`, `.env.dev`, `.env.stg`, `.env.prd` — selected by passing the env name as the first CLI argument (required; fatals if omitted).

**Key env vars:**
- `DB_DSN`: Postgres/CockroachDB connection string (pgx format)
- `SHOULD_DROP_TABLE`: if `true`, drops the tables listed in `DROP_TABLES` on startup (true for local/dev, false for stg/prd)
- `DROP_TABLES`: comma-separated list of tables to drop (e.g. `expenses,categories`)
- `ANTHROPIC_API_KEY`: Claude API key — required for HSBC OCR via Claude (local + stg)
- `SAGEMAKER_QWEN_2_5_VL_ENDPOINT_NAME`: AWS SageMaker endpoint name for HSBC OCR (stg only)
- `OCR_MODEL`: injected by Makefile targets — `"claude"` (default), `"qwen2.5vl:3b"` (Ollama), or `"sagemaker"`

**Transaction ID:** SHA-256 of `<filename>_<rowNumber>`, truncated to 4 bytes hex. Note: IDs depend on filename, so renaming CSVs will generate new IDs.

**Categories:** Plain-text files under `categories/` (e.g. `food`, `groceries`, `transport`). Each line is a merchant name prefix. The filename (without extension) becomes the category label stored in the DB.

## HSBC OCR Pipeline

HSBC statements are scanned images (not text PDFs), so `preprocessor/process_hsbc.py` uses vision-based OCR. Three backends are supported, selected via the `OCR_MODEL` env var:

| `OCR_MODEL` value | Backend | Notes |
|---|---|---|
| `claude` (default) | Claude Sonnet 4 API | Requires `ANTHROPIC_API_KEY`. High accuracy. |
| `qwen2.5vl:3b` | Local Ollama | Requires Ollama running locally with model pulled. No API key needed. |
| `sagemaker` | AWS SageMaker | Requires `SAGEMAKER_QWEN_2_5_VL_ENDPOINT_NAME`. Used in stg. |

The script converts PDF pages to images at 300 DPI, sends them to the selected backend with a structured extraction prompt, parses the JSON response, and writes to CSV.

## Infrastructure

- **Database (local/dev):** Postgres 17 via Docker (`compose.yaml`), port 5432. DB: `main`, user: `admin`.
- **Database (stg):** CockroachDB serverless on AWS ap-southeast-1.
- **Frontend ports:** local=3000, dev=3001, stg=3002.
- **PDF inputs:** Place PDFs in `preprocessor/statements/` before running preprocess targets.
- **CSV outputs:** Written to `preprocessor/scratch/{env}/` — consumed by the Go backend.
