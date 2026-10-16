import {getJeniosPayAdmin} from '../../../../lib/jenios-pay-admin';
import {requirePayToken} from '../../../../lib/pay/auth.mjs';
import {requireAdminPermission,auditAdmin} from '../../../../lib/admin-access.mjs';
import {adminReportTarget,issueAdminReport} from '../../../../lib/admin-reports.mjs';
import {createReportPdf} from '../../bankscore/laudo/pdf/route';
import {createCryptoReportPdf} from '../../../../lib/crypto/report-pdf.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=60;
export async function POST(request){const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};try{
 requirePayToken(request);const db=getJeniosPayAdmin(),user=await requireAdminPermission(request,db,'reports.run'),body=await request.json();
 if(!['json','pdf'].includes(body.format||'json'))throw Object.assign(Error('Formato inválido.'),{status:400});
 let target;try{target=adminReportTarget(body.kind,body.target);}catch(e){throw Object.assign(e,{status:400});}
 await auditAdmin(db,user,'report.'+body.kind,{target,format:body.format||'json'});
 const report=await issueAdminReport(db,body.kind,target);
 if(body.format==='pdf')return new Response(await (body.kind==='bankscore'?createReportPdf(report):createCryptoReportPdf(report)),{headers:{...headers,'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="jenios-consulta-admin.pdf"'}});
 return Response.json({ok:true,report},{headers});
 }catch(e){return Response.json({error:e.status?e.message:'Não foi possível emitir a consulta administrativa.'},{status:e.status||503,headers});}}
