import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: transactionId } = await params;
  const body = await req.json();
  const { category, ignored } = body;

  if (typeof ignored === "boolean") {
    await pool.query(
      `INSERT INTO expenses_overrides (transaction_id, ignored)
       VALUES ($1, $2)
       ON CONFLICT (transaction_id) DO UPDATE
       SET ignored = EXCLUDED.ignored,
           modified_date = now()`,
      [transactionId, ignored]
    );
    return NextResponse.json({ ok: true });
  }

  if (!category || typeof category !== "string") {
    return NextResponse.json(
      { error: "category or ignored is required" },
      { status: 400 }
    );
  }

  await pool.query(
    `INSERT INTO expenses_overrides (transaction_id, category, modified_by)
     VALUES ($1, $2, 'MANUAL')
     ON CONFLICT (transaction_id) DO UPDATE
     SET category = EXCLUDED.category,
         modified_by = 'MANUAL',
         modified_date = now()`,
    [transactionId, category]
  );

  return NextResponse.json({ ok: true });
}
