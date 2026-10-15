import { getJeniosPayAdmin } from '../../../../../lib/jenios-pay-admin';
import { bankscoreTarget, loadBankscoreCoverage } from '../../../../../lib/bankscore/coverage.mjs';
import { createReportPdf } from '../../laudo/pdf/route';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request) {
  const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
  try {
    const params = new URL(request.url).searchParams;
    const target = bankscoreTarget({ codigo: params.get('codigo'), periodo: params.get('periodo') });
    const report = await loadBankscoreCoverage({ db: getJeniosPayAdmin(), target });
    return new Response(await createReportPdf(report), { headers: { ...headers, 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="jenios-bankscore-cobertura.pdf"' } });
  } catch (error) { return Response.json({ error: error.status ? error.message : 'Não foi possível gerar o diagnóstico PDF.' }, { status: error.status || 503, headers }); }
}
