import { getJeniosPayAdmin } from '../../../../lib/jenios-pay-admin';
import { requirePayToken, requirePayUser } from '../../../../lib/pay/auth.mjs';
import { requirePaidPurchase } from '../../../../lib/pay/access.mjs';

export const dynamic = 'force-dynamic';
export async function POST(request) {
  const headers = { 'Cache-Control': 'no-store' };
  try {
    requirePayToken(request);
    const db = getJeniosPayAdmin();
    const user = await requirePayUser(request, db);
    let body;
    try { body = await request.json(); } catch { throw Object.assign(new Error('Requisição inválida.'), { status: 400 }); }
    if (!body || typeof body !== 'object') throw Object.assign(new Error('Requisição inválida.'), { status: 400 });
    const result = await requirePaidPurchase({ db, user, orderId: body.orderId, productCode: body.productCode, target: body.target });
    return Response.json(result, { headers });
  } catch (error) {
    return Response.json({ error: error.status ? error.message : 'Não foi possível verificar o acesso.' }, { status: error.status || 503, headers });
  }
}
