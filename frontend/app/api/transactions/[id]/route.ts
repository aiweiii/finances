import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const { category, ignored } = body;

  if (typeof ignored === "boolean") {
    await pool.query(`UPDATE expenses SET ignored = $1 WHERE id = $2`, [
      ignored,
      id,
    ]);
    return NextResponse.json({ ok: true });
  }

  if (!category || typeof category !== "string") {
    return NextResponse.json(
      { error: "category or ignored is required" },
      { status: 400 }
    );
  }

  await pool.query(`UPDATE expenses SET category = $1 WHERE id = $2`, [
    category,
    id,
  ]);

  return NextResponse.json({ ok: true });
}
