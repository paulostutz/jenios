import { NextResponse } from "next/server";
import { getJeniosPayAdmin } from "../../../../lib/jenios-pay-admin";
import { mergeCatalog, productScope } from '../../../../lib/pay/catalog.mjs';
import { gatewayConfig } from '../../../../lib/pay/gateway.mjs';

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const scope = request && new URL(request.url).searchParams.get('scope') === 'platform' ? 'platform' : 'social';
  try {
    const db = getJeniosPayAdmin();
    const { data, error } = await db.from("jenios_pay_products")
      .select("id,code,name,category,description,price_cents,currency,billing_type,active")
      .order("name").limit(100);
    if (error) throw error;
    return NextResponse.json({
      products: mergeCatalog(data).filter(p => productScope(p) === scope).map(p => ({ ...p, configured: Boolean(p.id) })),
      paymentsEnabled: Boolean(gatewayConfig()),
      checkoutReady: Boolean(gatewayConfig()),
      checkoutScope: scope,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ products: mergeCatalog().filter(p => productScope(p) === scope).map(p => ({ ...p, configured: false })), catalogStatus: 'defaults', paymentsEnabled: false, checkoutReady: false, checkoutScope: scope }, { headers: { "Cache-Control": "no-store" } });
  }
}
