import { getJeniosPayAdmin } from '../../../../lib/jenios-pay-admin';
import {requireReportBuyer} from '../../../../lib/pay/buyer.mjs';
import { deliverCryptoReport } from '../../../../lib/pay/crypto-delivery.mjs';
import { createCryptoReportPdf } from '../../../../lib/crypto/report-pdf.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request) {
  const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
  try {
    
    const db = getJeniosPayAdmin();
    const user = await requireReportBuyer(request, db);
    let body;
    try { body = await request.json(); } catch { throw Object.assign(new Error('Requisição inválida.'), { status: 400 }); }
    if (!body || typeof body !== 'object' || !['json', 'pdf'].includes(body.format || 'json')) throw Object.assign(new Error('Formato inválido.'), { status: 400 });
    const report = await deliverCryptoReport({ db, user, orderId: body.orderId, target: body.target });
    if (body.format === 'pdf') return new Response(await createCryptoReportPdf(report), { headers: { ...headers, 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="jenios-crypto-detalhado.pdf"' } });
    return Response.json({ ok: true, report }, { headers });
  } catch (error) {
    return Response.json({ ok: false, error: error.status ? error.message : 'Não foi possível emitir a consulta detalhada. Tente novamente.' }, { status: error.status || 503, headers });
  }
}
