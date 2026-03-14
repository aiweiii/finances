import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET() {
  const result = await pool.query(`
    SELECT DISTINCT
      TO_CHAR(txn_date, 'YYYY-MM') as month_key,
      TO_CHAR(txn_date, 'Mon YYYY') as label
    FROM expenses
    WHERE txn_type = 'DEBIT'
    ORDER BY month_key DESC
  `);

  return NextResponse.json(result.rows);
}
