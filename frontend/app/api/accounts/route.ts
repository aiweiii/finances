import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET() {
  const result = await pool.query(
    `SELECT DISTINCT bank, is_deposit_account FROM expenses ORDER BY bank`
  );

  return NextResponse.json(
    result.rows.map((r) => ({
      bank: r.bank,
      is_deposit_account: r.is_deposit_account,
    }))
  );
}
