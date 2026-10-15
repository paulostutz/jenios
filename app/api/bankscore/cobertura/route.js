import { getJeniosPayAdmin } from '../../../../lib/jenios-pay-admin';
import { bankscoreTarget, loadBankscoreCoverage } from '../../../../lib/bankscore/coverage.mjs';
export const dynamic = 'force-dynamic';
export async function GET(request) {
  const headers = { 'Cache-Control': 'no-store' };
  try {
    const params = new URL(request.url).searchParams;
    const target = bankscoreTarget({ codigo: params.get('codigo'), periodo: params.get('periodo') });
    return Response.json(await loadBankscoreCoverage({ db: getJeniosPayAdmin(), target }), { headers });
  } catch (error) { return Response.json({ error: error.status ? error.message : 'Diagnóstico de cobertura indisponível.' }, { status: error.status || 503, headers }); }
}
