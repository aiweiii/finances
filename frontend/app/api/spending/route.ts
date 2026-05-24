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
      excludeClause = ` AND COALESCE(eo.category, 'N/A') NOT IN (${placeholders})`;
      params.push(...excludeCategories);
    }

    const result = await pool.query(
      `SELECT DATE(e.txn_date) as date, SUM(e.amount) as amount
       FROM expenses e
       LEFT JOIN expenses_overrides eo ON e.transaction_id = eo.transaction_id
       WHERE e.active = TRUE
         AND e.txn_type = 'DEBIT'
         AND COALESCE(eo.ignored, FALSE) = FALSE
         AND TO_CHAR(e.txn_date, 'YYYY-MM') = $1${excludeClause}
       GROUP BY DATE(e.txn_date)
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
      excludeClause = ` AND COALESCE(eo.category, 'N/A') NOT IN (${placeholders})`;
      params.push(...excludeCategories);
    }

    const result = await pool.query(
      `SELECT TO_CHAR(e.txn_date, 'YYYY-MM') as month,
              TO_CHAR(e.txn_date, 'Mon') as label,
              SUM(e.amount) as amount
       FROM expenses e
       LEFT JOIN expenses_overrides eo ON e.transaction_id = eo.transaction_id
       WHERE e.active = TRUE
         AND e.txn_type = 'DEBIT'
         AND COALESCE(eo.ignored, FALSE) = FALSE
         AND TO_CHAR(e.txn_date, 'YYYY') = $1${excludeClause}
       GROUP BY TO_CHAR(e.txn_date, 'YYYY-MM'), TO_CHAR(e.txn_date, 'Mon')
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
