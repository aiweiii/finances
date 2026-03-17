import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET() {
  const result = await pool.query(
    `SELECT name FROM categories ORDER BY name`
  );

  const names = result.rows.map((r: { name: string }) => r.name);
  names.push("N/A");
  return NextResponse.json(names);
}
