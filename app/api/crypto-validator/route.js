import { NextResponse } from "next/server";
import { validateCrypto } from "../../../lib/crypto-validator.mjs";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const body = await request.json();
    const report = await validateCrypto(body);
    return NextResponse.json({ ok: true, report }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error?.message || "Consulta inválida." }, { status: 400 });
  }
}
