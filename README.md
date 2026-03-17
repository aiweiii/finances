# Lazyledger

> Drop a bank statement. Get a dashboard. That's it.

PDF bank statements → structured data → categorised expenses → spending dashboard.

No APIs. No manual data entry. Just automation for the financially-savvy 🤔 yet lazy (me).

**Tech Stack:**
![Go](https://img.shields.io/badge/Go-00ADD8?logo=go&logoColor=white)
![Python](https://img.shields.io/badge/Python-3776AB?logo=python&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-000000?logo=nextdotjs&logoColor=white)
![shadcn/ui](https://img.shields.io/badge/shadcn%2Fui-000000?logo=shadcnui&logoColor=white)

**Supported Banks:**
![UOB](https://img.shields.io/badge/UOB-0B3B8F?logoColor=white)
![Citi](https://img.shields.io/badge/Citi-003EA4?logoColor=white)
![Chocolate Finance](https://img.shields.io/badge/Chocolate_Finance-3C1A0E?logoColor=white)

![Overview](assets/overview.png)
![Transactions](assets/transactions.png)
*Image taken via a screenshot tool - which explains the cutoff on the sidebar and two Next.js logo*

## Why

I’ve been tracking finances since school.
No app out there reliably combines expenses across banks, account types, credit and deposit.

So I built my own.

## How it works

```
PDF bank statements
  → preprocessor (Python/Camelot) extracts tables → CSV
    → Go CLI parses CSV, categorises via trie → Postgres
      → Next.js dashboard visualises spending
```

| Stage         | What happens                                                            |
|---------------|-------------------------------------------------------------------------|
| **Extract**   | Python reads PDFs, pulls out transaction tables                         |
| **Ingest**    | Go parses CSVs, categorises via prefix trie, bulk-inserts into Postgres |
| **Visualise** | Next.js dashboard — trends, categories, daily averages                  |

## Caveats

- **Bank-specific parsing** — each bank's PDF differs and needs its own extraction logic. With <20 banks in SG, I think
  it's work-able.
- **Manual categories** — the app doesn’t auto-categorise yet.
    - You define categories under `./categories/` (filename = category, contents = merchant prefixes). Trie matching
      handles the rest. E.g., `AIRBNB` in `travel` matches
      `AIRBNB * HMS922XSAR 653-163-1004 Ref No. : 51972375084209692168650`.
    - You can also manually categorise each transaction in the UI.

## Upcoming Features

- Automatically detect bank and year from PDFs (no need to change name)
- HSBC Bank Statements are image-based/scanned documents, need to use OCR afterall ... 😭
- AI-powered categorisation

## Quick start

### Option 1: Try it instantly (mock data available)

```bash
docker compose up  # setup Postgres database
make dev           # run dev environment (against readily-available mock data)
```

### Option 2: Run with your own bank statements
For the curious cat ₍^. .^₎Ⳋ

1. Rename pdf in this format: `<bank>_<mmm>_<yyyy>.pdf`
   - For **CITI** credit card statements: `citi_jan_2026.pdf`
   - For **CHOCOLATE** card statements:   `chocolate_jan_2026.pdf`
   - For **UOB** credit card statements:  `uob_jan_2026.pdf`
   - For **UOB** deposit statements:      `uob_jan_2026_deposit.pdf`
2. Drop PDFs into `preprocessor/statements/`

```bash
docker compose up
make local
```

Open to collaboration.