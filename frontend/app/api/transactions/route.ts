import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(req: NextRequest) {
  const month = req.nextUrl.searchParams.get("month"); // YYYY-MM or "all"
  const year = req.nextUrl.searchParams.get("year"); // YYYY

  let dateFilter: string;
  let params: string[] = [];

  if (month && month !== "all") {
    dateFilter = `TO_CHAR(e.txn_date, 'YYYY-MM') = $1`;
    params = [month];
  } else if (year) {
    dateFilter = `TO_CHAR(e.txn_date, 'YYYY') = $1`;
    params = [year];
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
      txn_date: r.txn_date.toISOString().split("T")[0],
    }))
  );
}
