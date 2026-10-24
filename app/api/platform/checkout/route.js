import { getJeniosPayAdmin } from '../../../../lib/jenios-pay-admin';
import { requirePayUser, requirePayToken } from '../../../../lib/pay/auth.mjs';
import { checkoutService } from '../../../../lib/pay/checkout.mjs';
import {assertCheckoutRelease,readCheckoutBody} from '../../../../lib/pay/checkout-release.mjs';

export const dynamic = 'force-dynamic';
export async function POST(request) {
  try {
    requirePayToken(request);
    assertCheckoutRelease('platform',process.env);
    const db = getJeniosPayAdmin();
    const user = await requirePayUser(request, db);
    const result = await checkoutService({ db, user, body: await readCheckoutBody(request), scope: 'platform', key: request.headers.get('idempotency-key') });
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return Response.json({ error: error.status ? error.message : 'Não foi possível contratar este plano.' }, { status: error.status || 400, headers: { 'Cache-Control': 'no-store' } });
  }
}
