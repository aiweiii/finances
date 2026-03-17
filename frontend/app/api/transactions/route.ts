import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(req: NextRequest) {
  const month = req.nextUrl.searchParams.get("month"); // YYYY-MM or "all"
  const year = req.nextUrl.searchParams.get("year"); // YYYY

  let dateFilter: string;
  let params: string[] = [];

  if (month && month !== "all") {
    dateFilter = `TO_CHAR(txn_date, 'YYYY-MM') = $1`;
    params = [month];
  } else if (year) {
    dateFilter = `TO_CHAR(txn_date, 'YYYY') = $1`;
    params = [year];
  } else {
    return NextResponse.json({ error: "month or year required" }, { status: 400 });
  }

  const result = await pool.query(
    `SELECT id, txn_date, txn_type, category, merchant, amount, bank, is_deposit_account, ignored
     FROM expenses
     WHERE ${dateFilter}
     ORDER BY txn_date DESC`,
    params
  );

  return NextResponse.json(
    result.rows.map((r) => ({
      ...r,
      category: r.category || "N/A",
      amount: parseFloat(r.amount),
      txn_date: r.txn_date.toISOString().split("T")[0],
    }))
  );
}
