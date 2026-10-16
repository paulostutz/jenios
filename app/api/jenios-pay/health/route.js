import { NextResponse } from "next/server";
import { getJeniosPayAdmin } from "../../../../lib/jenios-pay-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { error } = await getJeniosPayAdmin().from("jenios_pay_products").select("id").limit(1);
    if (error) throw error;
    return NextResponse.json({ service: "JENIOS PAY", database: "connected", paymentsEnabled: process.env.JENIOS_PAY_PAYMENTS_ENABLED === "true" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ service: "JENIOS PAY", database: "unavailable", paymentsEnabled: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
