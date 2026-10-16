import {requirePayUser} from '../../../../lib/pay/auth.mjs';
import {isPrelaunchReport} from '../../../../lib/reports/prelaunch.mjs';
import {requirePrelaunchReportAccess} from '../../../../lib/reports/prelaunch-access.mjs';
import {loadBankscoreCoverage} from '../../../../lib/bankscore/coverage.mjs';
import { getJeniosPayAdmin } from '../../../../lib/jenios-pay-admin';
import {requireReportBuyer} from '../../../../lib/pay/buyer.mjs';
import { deliverBankscoreReport } from '../../../../lib/pay/bankscore-delivery.mjs';
import { createReportPdf } from '../laudo/pdf/route';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request){
 const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
 try{
  const db=getJeniosPayAdmin();
  const prelaunch=isPrelaunchReport('social-bankscore-report');
  const user=await (prelaunch?requirePayUser(request,db):requireReportBuyer(request,db));
  let body;try{body=await request.json();}catch{throw Object.assign(Error('Requisição inválida.'),{status:400});}
  if(!body||typeof body!=='object'||!['json','pdf'].includes(body.format||'json'))throw Object.assign(Error('Formato inválido.'),{status:400});
  const report=await deliverBankscoreReport({db,user,orderId:body.orderId,target:body.target,authorize:prelaunch?requirePrelaunchReportAccess:undefined});
  try { const detail=await loadBankscoreCoverage({db,target:body.target});report.coverage=detail.coverage; } catch { report.coverageNotice='Não foi possível conferir os indicadores complementares nesta emissão.'; }
  if(body.format==='pdf')return new Response(await createReportPdf(report),{headers:{...headers,'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="jenios-bankscore-detalhado.pdf"'}});
  return Response.json({ok:true,report},{headers});
 }catch(error){return Response.json({error:error.status?error.message:'Não foi possível emitir o laudo. Tente novamente.'},{status:error.status||503,headers});}
}
