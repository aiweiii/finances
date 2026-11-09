import type { CoverageResponse } from "./types";

// Fixed column order. HSBC is listed even though its statements are not
// processed yet, so it shows as "not uploaded" for every month.
export const COVERAGE_COLUMNS = [
  { key: "CITI|false", label: "CITI" },
  { key: "CHOCOLATE|false", label: "CHOC." },
  { key: "UOB|false", label: "UOB CC" },
  { key: "UOB|true", label: "UOB DEP." },
  { key: "HSBC|false", label: "HSBC" },
];

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export interface StatementImportRow {
  bank: string;
  is_deposit_account: boolean;
  month_key: string; // YYYY-MM
}

export function buildCoverage(
  rows: StatementImportRow[],
  requestedYear?: string | null
): CoverageResponse {
  const imported = new Set<string>(
    rows.map((r) => `${r.bank}|${r.is_deposit_account}|${r.month_key}`)
  );
  const monthKeys = [...new Set(rows.map((r) => r.month_key))].sort();

  if (monthKeys.length === 0) {
    return { years: [], year: null, columns: COVERAGE_COLUMNS, months: [] };
  }

  const earliest = monthKeys[0];
  const latest = monthKeys[monthKeys.length - 1];
  const years = [...new Set(monthKeys.map((k) => k.slice(0, 4)))].sort().reverse();
  const year = requestedYear && years.includes(requestedYear) ? requestedYear : years[0];

  // Only show months between the first and last imported statement, so
  // trailing future months are not listed as missing.
  const months = [];
  for (let m = 12; m >= 1; m--) {
    const monthKey = `${year}-${String(m).padStart(2, "0")}`;
    if (monthKey < earliest || monthKey > latest) continue;

    months.push({
      month_key: monthKey,
      label: `${MONTH_LABELS[m - 1]} ${year}`,
      imported: Object.fromEntries(
        COVERAGE_COLUMNS.map((c) => [c.key, imported.has(`${c.key}|${monthKey}`)])
      ),
    });
  }

  return { years, year, columns: COVERAGE_COLUMNS, months };
}
