import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    service: "JENIOS PAY",
    version: "1.0",
    status: "online",
    paymentsEnabled: false,
    message: "Backend financeiro iniciado com sucesso"
  });
}
