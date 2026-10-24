import { getJeniosPayAdmin } from '../../../../lib/jenios-pay-admin';
import {requireReportBuyer,guestEnabled} from '../../../../lib/pay/buyer.mjs';
import { checkoutService } from '../../../../lib/pay/checkout.mjs';
import {assertCheckoutRelease,readCheckoutBody} from '../../../../lib/pay/checkout-release.mjs';
import {isPrelaunchReport,prelaunchReportHref} from '../../../../lib/reports/prelaunch.mjs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;
export async function POST(request) {
  try {
    const body = await readCheckoutBody(request);
    if(isPrelaunchReport(body?.productCode))return Response.json({error:'Este relatório está gratuito no pré-lançamento. Entre na Social para acessar sem pagar.',reportUrl:prelaunchReportHref(body.productCode,body.target)},{status:409,headers:{'Cache-Control':'no-store'}});
    assertCheckoutRelease('social',process.env);
    const db = getJeniosPayAdmin();
    const user = await requireReportBuyer(request, db);
    if(!user.id&&!guestEnabled())throw Object.assign(Error('Compra sem cadastro ainda indisponível.'),{status:503});
    const result = await checkoutService({ db, user, body, scope: 'social', key: request.headers.get('idempotency-key') });
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return Response.json({ error: error.status ? error.message : 'Não foi possível iniciar esta contratação. Confira o produto e os dados informados.' }, { status: error.status || 400, headers: { 'Cache-Control': 'no-store' } });
  }
}
