import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(req: NextRequest) {
  const month = req.nextUrl.searchParams.get("month"); // YYYY-MM or "all" for full year
  const year = req.nextUrl.searchParams.get("year"); // YYYY

  let dateFilter: string;
  let prevDateFilter: string;
  let params: string[] = [];

  if (month && month !== "all") {
    // Specific month
    dateFilter = `TO_CHAR(txn_date, 'YYYY-MM') = $1`;
    params = [month];

    // Previous month
    const [y, m] = month.split("-").map(Number);
    const prevDate = new Date(y, m - 2, 1);
    const prevKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;
    prevDateFilter = `TO_CHAR(txn_date, 'YYYY-MM') = '${prevKey}'`;
  } else if (year) {
    dateFilter = `TO_CHAR(txn_date, 'YYYY') = $1`;
    params = [year];
    const prevYear = String(Number(year) - 1);
    prevDateFilter = `TO_CHAR(txn_date, 'YYYY') = '${prevYear}'`;
  } else {
    return NextResponse.json({ error: "month or year required" }, { status: 400 });
  }

  const [statsResult, prevResult, topCatResult, daysResult, creditResult] = await Promise.all([
    pool.query(
      `SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count
       FROM expenses WHERE txn_type = 'DEBIT' AND ${dateFilter}`,
      params
    ),
    pool.query(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM expenses WHERE txn_type = 'DEBIT' AND ${prevDateFilter}`
    ),
    pool.query(
      `SELECT category, SUM(amount) as total
       FROM expenses WHERE txn_type = 'DEBIT' AND ${dateFilter}
       GROUP BY category ORDER BY total DESC LIMIT 1`,
      params
    ),
    pool.query(
      `SELECT COUNT(DISTINCT DATE(txn_date)) as days
       FROM expenses WHERE txn_type = 'DEBIT' AND ${dateFilter}`,
      params
    ),
    pool.query(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM expenses WHERE txn_type = 'CREDIT' AND ${dateFilter}`,
      params
    ),
  ]);

  const total = parseFloat(statsResult.rows[0].total);
  const count = parseInt(statsResult.rows[0].count);
  const prevTotal = parseFloat(prevResult.rows[0].total);
  const topCat = topCatResult.rows[0];
  const days = parseInt(daysResult.rows[0].days) || 1;
  const totalCredited = parseFloat(creditResult.rows[0].total);

  return NextResponse.json({
    total_spent: total,
    total_credited: totalCredited,
    transaction_count: count,
    top_category: topCat?.category || "N/A",
    top_category_amount: topCat ? parseFloat(topCat.total) : 0,
    avg_daily_spend: Math.round((total / days) * 100) / 100,
    prev_month_total: prevTotal,
  });
}
