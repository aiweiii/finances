// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";

// Why: the app runs in Asia/Singapore (UTC+8). The pg driver turns a Postgres DATE into a
// JS Date at *local* midnight, and calling toISOString() on that shifted every transaction
// one day earlier on the Transactions page and the daily spending chart
// (a 3 Oct transaction showed as 2 Oct). lib/db.ts now returns DATE columns as plain
// "YYYY-MM-DD" strings. This test fails if that parser is removed.
process.env.TZ = "Asia/Singapore"; // must be set before any Date is created

const PG_DATE_OID = 1082;

test("DATE columns come back as the exact YYYY-MM-DD string, not a shifted Date", async () => {
  const { types } = await import("pg");
  const { default: pool } = await import("../lib/db.ts");

  const parse = types.getTypeParser(PG_DATE_OID);
  assert.equal(parse("2026-10-03"), "2026-10-03");
  assert.equal(parse("2026-08-31"), "2026-08-31");

  await pool.end();
});

test("sanity check: the default conversion really would have shifted the day in Singapore", () => {
  // Documents the bug itself so the test above is not vacuous: local midnight 3 Oct in
  // UTC+8 is 2 Oct 16:00 UTC.
  const defaultParsed = new Date(2026, 9, 3); // what pg's default DATE parser builds
  assert.equal(defaultParsed.toISOString().split("T")[0], "2026-10-02");
});
