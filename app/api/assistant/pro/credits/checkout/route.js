/** G45 — explicit additional usage; prices and bank confirmation remain gated. */
import {getJeniosPayAdmin} from '../../../../../../lib/jenios-pay-admin';
import {requirePayToken} from '../../../../../../lib/pay/auth.mjs';
import {assertProTopupEnvironment,handleProTopups,PRO_TOPUP_HEADERS} from '../../../../../../lib/assistant/pro-topups.mjs';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export const maxDuration=60;
export async function POST(request){
 try{
  assertProTopupEnvironment(process.env);
  requirePayToken(request);
  return await handleProTopups(request,{action:'checkout',db:getJeniosPayAdmin()});
 }catch(error){
  return Response.json({ok:false,state:'not_started',credited:false,code:error.code||'PRO_TOPUP_UNAVAILABLE',
   error:error.status?error.message:'A contratação adicional de IA está temporariamente indisponível.'},
   {status:[400,401,402,403,503].includes(error.status)?error.status:503,headers:PRO_TOPUP_HEADERS});
 }
}
