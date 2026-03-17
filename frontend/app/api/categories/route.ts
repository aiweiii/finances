import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET() {
  const result = await pool.query(
    `SELECT name FROM categories ORDER BY name`
  );

  return NextResponse.json(result.rows.map((r) => r.name));
}
