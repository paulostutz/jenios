import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request) {
  const expected = process.env.JENIOS_PAY_ADMIN_TOKEN;
  const supplied = request.headers.get("x-jenios-admin-token");
  if (!expected || !supplied) return false;
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(supplied, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request) {
  const headers = { "Cache-Control": "no-store" };
  if (!authorized(request)) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401, headers });
  }
  const required = [
    "JENIOS_PAY_ADMIN_TOKEN", "INTER_CLIENT_ID", "INTER_CLIENT_SECRET",
    "INTER_CERTIFICATE", "INTER_PRIVATE_KEY"
  ];
  const configured = Object.fromEntries(required.map((key) => [key, Boolean(process.env[key]?.trim())]));
  return NextResponse.json({
    service: "JENIOS PAY", stage: "diagnostic_preview",
    configurationPresent: configured,
    oauthVerifiedInThisRequest: false,
    paymentsEnabled: false,
    transfersEnabled: false,
    webhookProcessingEnabled: false,
    note: "Presenca de variaveis nao comprova validade de credenciais ou homologacao financeira"
  }, { headers });
}
