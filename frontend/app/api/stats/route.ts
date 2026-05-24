import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { monthRange, yearRange, prevMonthRange } from "@/lib/date";

export async function GET(req: NextRequest) {
  const month = req.nextUrl.searchParams.get("month"); // YYYY-MM or "all" for full year
  const year = req.nextUrl.searchParams.get("year"); // YYYY
  const excludeParam = req.nextUrl.searchParams.get("excludeCategories");

  let dateFilter: string;
  let prevDateFilter: string;
  let params: string[];
  let prevParams: string[];

  if (month && month !== "all") {
    const [start, end] = monthRange(month);
    dateFilter = `e.txn_date >= $1 AND e.txn_date < $2`;
    params = [start, end];

    const [prevStart, prevEnd] = prevMonthRange(month);
    prevDateFilter = `e.txn_date >= $1 AND e.txn_date < $2`;
    prevParams = [prevStart, prevEnd];
  } else if (year) {
    const [start, end] = yearRange(year);
    dateFilter = `e.txn_date >= $1 AND e.txn_date < $2`;
    params = [start, end];

    const prevYear = String(Number(year) - 1);
    const [prevStart, prevEnd] = yearRange(prevYear);
    prevDateFilter = `e.txn_date >= $1 AND e.txn_date < $2`;
    prevParams = [prevStart, prevEnd];
  } else {
    return NextResponse.json({ error: "month or year required" }, { status: 400 });
  }

  let excludeClause = "";
  let prevExcludeClause = "";
  const excludeCategories = excludeParam ? excludeParam.split(",").filter(Boolean) : [];
  if (excludeCategories.length > 0) {
    const placeholders = excludeCategories.map((_, i) => `$${3 + i}`).join(", ");
    excludeClause = ` AND COALESCE(eo.category, 'N/A') NOT IN (${placeholders})`;
    const prevPlaceholders = excludeCategories.map((_, i) => `$${3 + i}`).join(", ");
    prevExcludeClause = ` AND COALESCE(eo.category, 'N/A') NOT IN (${prevPlaceholders})`;
  }
  const allParams = [...params, ...excludeCategories];
  const allPrevParams = [...prevParams, ...excludeCategories];

  const joinClause = `FROM expenses e LEFT JOIN expenses_overrides eo ON e.transaction_id = eo.transaction_id`;
  const activeClause = `e.active = TRUE AND COALESCE(eo.ignored, FALSE) = FALSE`;

  const [statsResult, prevResult, topCatResult, daysResult, creditResult] = await Promise.all([
    pool.query(
      `SELECT COALESCE(SUM(e.amount), 0) as total, COUNT(*) as count
       ${joinClause} WHERE ${activeClause} AND e.txn_type = 'DEBIT' AND ${dateFilter}${excludeClause}`,
      allParams
    ),
    pool.query(
      `SELECT COALESCE(SUM(e.amount), 0) as total
       ${joinClause} WHERE ${activeClause} AND e.txn_type = 'DEBIT' AND ${prevDateFilter}${prevExcludeClause}`,
      allPrevParams
    ),
    pool.query(
      `SELECT eo.category, SUM(e.amount) as total
       ${joinClause} WHERE ${activeClause} AND e.txn_type = 'DEBIT' AND ${dateFilter}${excludeClause}
       GROUP BY eo.category ORDER BY total DESC LIMIT 3`,
      allParams
    ),
    pool.query(
      `SELECT COUNT(DISTINCT DATE(e.txn_date)) as days
       ${joinClause} WHERE ${activeClause} AND e.txn_type = 'DEBIT' AND ${dateFilter}${excludeClause}`,
      allParams
    ),
    pool.query(
      `SELECT COALESCE(SUM(e.amount), 0) as total
       ${joinClause} WHERE ${activeClause} AND e.txn_type = 'CREDIT' AND ${dateFilter}${excludeClause}`,
      allParams
    ),
  ]);

  const total = parseFloat(statsResult.rows[0].total);
  const count = parseInt(statsResult.rows[0].count);
  const prevTotal = parseFloat(prevResult.rows[0].total);
  const topCat = topCatResult.rows[0];
  const topCategories = topCatResult.rows.map((r: { category: string; total: string }) => ({
    category: r.category || "N/A",
    amount: parseFloat(r.total),
  }));
  const days = parseInt(daysResult.rows[0].days) || 1;
  const totalCredited = parseFloat(creditResult.rows[0].total);

  return NextResponse.json({
    total_spent: total,
    total_credited: totalCredited,
    transaction_count: count,
    top_category: topCat?.category || "N/A",
    top_category_amount: topCat ? parseFloat(topCat.total) : 0,
    top_categories: topCategories,
    avg_daily_spend: Math.round((total / days) * 100) / 100,
    prev_month_total: prevTotal,
  });
}
