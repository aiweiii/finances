import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(req: NextRequest) {
  const month = req.nextUrl.searchParams.get("month"); // YYYY-MM or "all"
  const year = req.nextUrl.searchParams.get("year"); // YYYY
  const excludeParam = req.nextUrl.searchParams.get("excludeCategories");
  const excludeCategories = excludeParam ? excludeParam.split(",").filter(Boolean) : [];

  if (month && month !== "all") {
    const params: string[] = [month];
    let excludeClause = "";
    if (excludeCategories.length > 0) {
      const placeholders = excludeCategories.map((_, i) => `$${2 + i}`).join(", ");
      excludeClause = ` AND category NOT IN (${placeholders})`;
      params.push(...excludeCategories);
    }

    const result = await pool.query(
      `SELECT DATE(txn_date) as date, SUM(amount) as amount
       FROM expenses
       WHERE txn_type = 'DEBIT' AND ignored = FALSE AND TO_CHAR(txn_date, 'YYYY-MM') = $1${excludeClause}
       GROUP BY DATE(txn_date)
       ORDER BY date`,
      params
    );

    return NextResponse.json(
      result.rows.map((r) => ({
        date: r.date.toISOString().split("T")[0],
        amount: parseFloat(r.amount),
      }))
    );
  } else if (year) {
    const params: string[] = [year];
    let excludeClause = "";
    if (excludeCategories.length > 0) {
      const placeholders = excludeCategories.map((_, i) => `$${2 + i}`).join(", ");
      excludeClause = ` AND category NOT IN (${placeholders})`;
      params.push(...excludeCategories);
    }

    const result = await pool.query(
      `SELECT TO_CHAR(txn_date, 'YYYY-MM') as month,
              TO_CHAR(txn_date, 'Mon') as label,
              SUM(amount) as amount
       FROM expenses
       WHERE txn_type = 'DEBIT' AND ignored = FALSE AND TO_CHAR(txn_date, 'YYYY') = $1${excludeClause}
       GROUP BY TO_CHAR(txn_date, 'YYYY-MM'), TO_CHAR(txn_date, 'Mon')
       ORDER BY month`,
      params
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
