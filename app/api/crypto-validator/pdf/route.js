import { validateCrypto } from '../../../../lib/crypto-validator.mjs';
import { createCryptoReportPdf } from '../../../../lib/crypto/report-pdf.mjs';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request) {
  try {
    const report=await validateCrypto(await request.json());
    const bytes=await createCryptoReportPdf(report);
    return new Response(bytes,{headers:{'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="jenios-validacao-'+report.network+'.pdf"','Cache-Control':'no-store'}});
  } catch(error) {return Response.json({ok:false,error:error?.message||'Não foi possível gerar o PDF.'},{status:400});}
}
