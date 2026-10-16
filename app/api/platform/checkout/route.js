import { getJeniosPayAdmin } from '../../../../lib/jenios-pay-admin';
import { requirePayUser, requirePayToken } from '../../../../lib/pay/auth.mjs';
import { checkoutService } from '../../../../lib/pay/checkout.mjs';

export const dynamic = 'force-dynamic';
export async function POST(request) {
  try {
    requirePayToken(request);
    const db = getJeniosPayAdmin();
    const user = await requirePayUser(request, db);
    const result = await checkoutService({ db, user, body: await request.json(), scope: 'platform', key: request.headers.get('idempotency-key') });
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return Response.json({ error: error.status ? error.message : 'Não foi possível contratar este plano.' }, { status: error.status || 400, headers: { 'Cache-Control': 'no-store' } });
  }
}
