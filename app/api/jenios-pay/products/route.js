import { NextResponse } from "next/server";
import { getJeniosPayAdmin } from "../../../../lib/jenios-pay-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = getJeniosPayAdmin();
    const { data, error } = await db.from("jenios_pay_products")
      .select("id,code,name,category,description,price_cents,currency,billing_type")
      .eq("active", true).order("name").limit(100);
    if (error) throw error;
    return NextResponse.json({
      products: data || [],
      paymentsEnabled: process.env.JENIOS_PAY_PAYMENTS_ENABLED === "true",
      checkoutReady: false,
      checkoutScope: "social",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Não foi possível consultar o catálogo JENIOS PAY.", paymentsEnabled: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
