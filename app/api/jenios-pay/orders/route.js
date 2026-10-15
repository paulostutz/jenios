import { getJeniosPayAdmin } from '../../../../lib/jenios-pay-admin';
import { requirePayUser, requirePayToken } from '../../../../lib/pay/auth.mjs';
import { publicOrder } from '../../../../lib/pay/orders.mjs';

export const dynamic = 'force-dynamic';
export async function GET(request) {
  try {
    requirePayToken(request);
    const db = getJeniosPayAdmin();
    const user = await requirePayUser(request, db);
    const id = new URL(request.url).searchParams.get('id');
    if (id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw Object.assign(new Error('Pedido inválido.'), { status: 400 });
    let query = db.from('jenios_pay_orders').select('id,product_id,amount_cents,currency,status,provider,created_at,external_reference').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50);
    if (id) query = query.eq('id', id);
    const { data, error } = await query;
    if (error) throw error;
    return Response.json({ orders: (data || []).map(publicOrder) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return Response.json({ error: error.status ? error.message : 'Não foi possível consultar suas cobranças.' }, { status: error.status || 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
