import {getJeniosPayAdmin} from '../../../../../../lib/jenios-pay-admin';
import {requirePayToken} from '../../../../../../lib/pay/auth.mjs';
import {assertProTopupEnvironment,handleProTopups,PRO_TOPUP_HEADERS} from '../../../../../../lib/assistant/pro-topups.mjs';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export async function GET(request){
 try{
  requirePayToken(request);assertProTopupEnvironment();
  return await handleProTopups(request,{action:'status',db:getJeniosPayAdmin()});
 }catch(error){
  return Response.json({ok:false,state:'not_started',credited:false,code:error.code||'PRO_TOPUP_UNAVAILABLE',error:error.status?error.message:'A compra de créditos Pro está temporariamente indisponível.'},{status:error.status||503,headers:PRO_TOPUP_HEADERS});
 }
}
