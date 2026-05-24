import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { monthRange, yearRange } from "@/lib/date";

export async function GET(req: NextRequest) {
  const month = req.nextUrl.searchParams.get("month"); // YYYY-MM or "all"
  const year = req.nextUrl.searchParams.get("year"); // YYYY

  let dateFilter: string;
  let params: string[] = [];

  if (month && month !== "all") {
    const [start, end] = monthRange(month);
    dateFilter = `e.txn_date >= $1 AND e.txn_date < $2`;
    params = [start, end];
  } else if (year) {
    const [start, end] = yearRange(year);
    dateFilter = `e.txn_date >= $1 AND e.txn_date < $2`;
    params = [start, end];
  } else {
    return NextResponse.json({ error: "month or year required" }, { status: 400 });
  }

  const result = await pool.query(
    `SELECT e.transaction_id,
            e.transaction_base_id,
            e.occurrence_index,
            e.txn_date,
            e.txn_type,
            COALESCE(eo.category, '') as category,
            e.merchant,
            e.amount,
            e.bank,
            e.is_deposit_account,
            COALESCE(eo.ignored, FALSE) as ignored,
            COUNT(*) OVER (PARTITION BY e.transaction_base_id) as duplicate_count
     FROM expenses e
     LEFT JOIN expenses_overrides eo ON e.transaction_id = eo.transaction_id
     WHERE e.active = TRUE AND ${dateFilter}
     ORDER BY e.txn_date DESC, e.merchant, e.amount, e.occurrence_index`,
    params
  );

  return NextResponse.json(
    result.rows.map((r) => ({
      ...r,
      category: r.category || "N/A",
      amount: parseFloat(r.amount),
      duplicate_count: parseInt(r.duplicate_count, 10),
      txn_date: r.txn_date,
    }))
  );
}
