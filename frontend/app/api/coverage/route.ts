import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { buildCoverage } from "@/lib/coverage";

export async function GET(request: NextRequest) {
  const result = await pool.query(
    `SELECT bank, is_deposit_account, TO_CHAR(statement_month, 'YYYY-MM') AS month_key
     FROM statement_imports`
  );

  return NextResponse.json(
    buildCoverage(result.rows, request.nextUrl.searchParams.get("year"))
  );
}
