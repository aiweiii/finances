import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(req: NextRequest) {
  const month = req.nextUrl.searchParams.get("month"); // YYYY-MM or "all"
  const year = req.nextUrl.searchParams.get("year"); // YYYY

  if (month && month !== "all") {
    // Daily spending for a specific month
    const result = await pool.query(
      `SELECT DATE(txn_date) as date, SUM(amount) as amount
       FROM expenses
       WHERE txn_type = 'DEBIT' AND TO_CHAR(txn_date, 'YYYY-MM') = $1
       GROUP BY DATE(txn_date)
       ORDER BY date`,
      [month]
    );

    return NextResponse.json(
      result.rows.map((r) => ({
        date: r.date.toISOString().split("T")[0],
        amount: parseFloat(r.amount),
      }))
    );
  } else if (year) {
    // Monthly spending for a full year
    const result = await pool.query(
      `SELECT TO_CHAR(txn_date, 'YYYY-MM') as month,
              TO_CHAR(txn_date, 'Mon') as label,
              SUM(amount) as amount
       FROM expenses
       WHERE txn_type = 'DEBIT' AND TO_CHAR(txn_date, 'YYYY') = $1
       GROUP BY TO_CHAR(txn_date, 'YYYY-MM'), TO_CHAR(txn_date, 'Mon')
       ORDER BY month`,
      [year]
    );

    return NextResponse.json(
      result.rows.map((r) => ({
        date: r.label,
        amount: parseFloat(r.amount),
      }))
    );
  }

  return NextResponse.json({ error: "month or year required" }, { status: 400 });
}
