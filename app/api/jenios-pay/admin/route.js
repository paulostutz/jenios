import { getJeniosPayAdmin } from '../../../../lib/jenios-pay-admin';
import { requirePayUser, requirePayToken } from '../../../../lib/pay/auth.mjs';
import { mergeCatalog, priceUpdate, SPECIALIST_COMMISSION_BPS } from '../../../../lib/pay/catalog.mjs';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'no-store' };
const failure = error => Response.json({ error: error.status ? error.message : 'Não foi possível consultar ou salvar a gestão financeira.' }, { status: error.status || 503, headers });

export async function GET(request) {
  try {
    requirePayToken(request);
    const db = getJeniosPayAdmin();
    await requirePayUser(request, db, true);
    const [{ data: products, error: productError }, { data: orders, error: orderError }] = await Promise.all([
      db.from('jenios_pay_products').select('id,code,name,category,description,price_cents,currency,billing_type,active,updated_at').order('name'),
      db.from('jenios_pay_orders').select('id,product_id,amount_cents,currency,status,provider,created_at').order('created_at', { ascending: false }).limit(100),
    ]);
    if (productError || orderError) throw productError || orderError;
    return Response.json({ products: mergeCatalog(products), orders: orders || [], orderLimit: 100, specialistCommissionBps: SPECIALIST_COMMISSION_BPS }, { headers });
  } catch (error) { return failure(error); }
}

export async function PATCH(request) {
  try {
    requirePayToken(request);
    const db = getJeniosPayAdmin();
    await requirePayUser(request, db, true);
    const body = await request.json();
    let product;
    try { product = priceUpdate(body); } catch (error) { error.status = 400; throw error; }
    let query;
    if (body.updated_at) {
      query = db.from('jenios_pay_products').update({ price_cents: product.price_cents, active: product.active, updated_at: new Date().toISOString() }).eq('code', product.code).eq('updated_at', body.updated_at).select('*').maybeSingle();
    } else {
      query = db.from('jenios_pay_products').insert(product).select('*').single();
    }
    const { data, error } = await query;
    if (error?.code === '23505' || (!error && !data)) throw Object.assign(new Error('O catálogo foi alterado por outra sessão. Atualize antes de salvar.'), { status: 409 });
    if (error) throw error;
    return Response.json({ product: data }, { headers });
  } catch (error) { return failure(error); }
}
