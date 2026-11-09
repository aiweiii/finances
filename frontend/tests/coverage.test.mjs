// Run with: npm test  (uses Node's built-in test runner; Node 22.18+ can import .ts directly)
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCoverage } from "../lib/coverage.ts";

const row = (bank, deposit, month_key) => ({ bank, is_deposit_account: deposit, month_key });

// Why: the Statement Coverage grid is derived purely from the statement_imports table.
// These tests pin the rules that decide a green tick vs "not uploaded" so the page
// can't silently misreport which statements have been imported.

test("marks only the imported bank/account/month combinations as imported", () => {
  const res = buildCoverage([
    row("CITI", false, "2026-01"),
    row("UOB", true, "2026-01"),
    row("UOB", false, "2026-02"),
  ]);

  const jan = res.months.find((m) => m.month_key === "2026-01");
  assert.equal(jan.imported["CITI|false"], true);
  assert.equal(jan.imported["UOB|true"], true);
  assert.equal(jan.imported["UOB|false"], false);
  assert.equal(jan.imported["CHOCOLATE|false"], false);
});

test("UOB credit card and UOB deposit are separate columns", () => {
  // Same bank + month, but only the deposit statement was imported.
  const res = buildCoverage([row("UOB", true, "2026-03")]);
  const mar = res.months.find((m) => m.month_key === "2026-03");
  assert.equal(mar.imported["UOB|true"], true);
  assert.equal(mar.imported["UOB|false"], false);
});

test("HSBC column is always present and shows not uploaded when nothing was imported", () => {
  // Why: HSBC statements are intentionally not processed yet, but the column must still render.
  const res = buildCoverage([row("CITI", false, "2026-01"), row("CITI", false, "2026-02")]);
  assert.ok(res.columns.some((c) => c.key === "HSBC|false"));
  for (const m of res.months) assert.equal(m.imported["HSBC|false"], false);
});

test("lists months newest first and only between first and last imported statement", () => {
  // Why: months after the latest import (e.g. future months) must not be listed as "missing",
  // and a gap in the middle (Feb) must still appear as missing.
  const res = buildCoverage([row("CITI", false, "2026-01"), row("CITI", false, "2026-03")]);
  assert.deepEqual(
    res.months.map((m) => m.month_key),
    ["2026-03", "2026-02", "2026-01"]
  );
  assert.equal(res.months[1].imported["CITI|false"], false);
});

test("defaults to the latest year and falls back to it when the requested year is unknown", () => {
  const rows = [row("CITI", false, "2025-12"), row("CITI", false, "2026-01")];
  assert.equal(buildCoverage(rows).year, "2026");
  assert.equal(buildCoverage(rows, "1999").year, "2026");
  assert.equal(buildCoverage(rows, "2025").year, "2025");
  assert.deepEqual(buildCoverage(rows).years, ["2026", "2025"]);
});

test("a year view only shows months inside that year", () => {
  const rows = [row("CITI", false, "2025-11"), row("CITI", false, "2026-02")];
  const res = buildCoverage(rows, "2025");
  assert.deepEqual(res.months.map((m) => m.month_key), ["2025-12", "2025-11"]);
});

test("returns an empty grid when nothing has been imported", () => {
  const res = buildCoverage([]);
  assert.equal(res.year, null);
  assert.deepEqual(res.months, []);
});
