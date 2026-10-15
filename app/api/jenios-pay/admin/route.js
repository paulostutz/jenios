import { getJeniosPayAdmin } from '../../../../lib/jenios-pay-admin';
import { requirePayUser, requirePayToken } from '../../../../lib/pay/auth.mjs';
import { DEFAULT_PRODUCTS, mergeCatalog, priceUpdate, SPECIALIST_COMMISSION_BPS } from '../../../../lib/pay/catalog.mjs';
import { listAdminOrders } from '../../../../lib/pay/admin-orders.mjs';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'no-store' };
const failure = error => Response.json({ error: error.status ? error.message : 'Não foi possível consultar ou salvar a gestão financeira.' }, { status: error.status || 503, headers });

export async function GET(request) {
  try {
    requirePayToken(request);
    const db = getJeniosPayAdmin();
    await requirePayUser(request, db, true);
    const params = new URL(request.url).searchParams;
    const [{ data: products, error: productError }, statement] = await Promise.all([
      db.from('jenios_pay_products').select('id,code,name,category,description,price_cents,currency,billing_type,active,updated_at').order('name'),
      listAdminOrders(db, { customer: params.get('cliente') || '', status: params.get('status') || '' }),
    ]);
    if (productError) throw productError;
    return Response.json({ products: mergeCatalog(products), ...statement, specialistCommissionBps: SPECIALIST_COMMISSION_BPS }, { headers });
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

// Install approved defaults once without overwriting existing prices/availability.
export async function POST(request) {
  try {
    requirePayToken(request);const db=getJeniosPayAdmin();await requirePayUser(request,db,true);
    let body;try{body=await request.json();}catch{throw Object.assign(new Error('Requisição inválida.'),{status:400});}
    if(body?.action!=='initialize_catalog')throw Object.assign(new Error('Ação inválida.'),{status:400});
    const {data,error}=await db.from('jenios_pay_products').upsert(DEFAULT_PRODUCTS.map(product=>({...product})),{onConflict:'code',ignoreDuplicates:true}).select('code');
    if(error)throw error;
    return Response.json({initialized:data?.length||0},{headers});
  }catch(error){return failure(error);}
}
