import { getJeniosPayAdmin } from '../../../../lib/jenios-pay-admin';
import { requirePayToken, requirePayUser } from '../../../../lib/pay/auth.mjs';
import { specialistOrdersEnabled, listSpecialistOrders, updateSpecialistOrder } from '../../../../lib/social/specialist-orders.mjs';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'no-store' };
async function context(request) {
  requirePayToken(request);
  const db = getJeniosPayAdmin();
  const user = await requirePayUser(request, db);
  if (!specialistOrdersEnabled()) throw Object.assign(new Error('A gestão de atendimentos aguarda a instalação da extensão e sua ativação no servidor.'), { status: 503 });
  return { db, user };
}
function failure(error) { return Response.json({ error: error.status ? error.message : 'Não foi possível consultar ou atualizar o atendimento.' }, { status: error.status || 503, headers }); }
export async function GET(request) {
  try {
    const params = new URL(request.url).searchParams;
    return Response.json(await listSpecialistOrders({ ...await context(request), role: params.get('role') || 'buyer', page: Number(params.get('page') || 1) }), { headers });
  } catch (error) { return failure(error); }
}
export async function PATCH(request) {
  try {
    const ctx = await context(request);
    let body;
    try { body = await request.json(); } catch { throw Object.assign(new Error('Requisição inválida.'), { status: 400 }); }
    return Response.json({ order: await updateSpecialistOrder({ ...ctx, body }) }, { headers });
  } catch (error) { return failure(error); }
}
