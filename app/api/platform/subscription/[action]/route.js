import {getJeniosPayAdmin} from '../../../../../lib/jenios-pay-admin';
import {getJeniosPlatformAdmin} from '../../../../../lib/platform/admin-db.mjs';
import {handlePlatformMonthly,BILLING_HEADERS} from '../../../../../lib/platform/monthly-billing.mjs';
import {requirePayToken} from '../../../../../lib/pay/auth.mjs';
export const dynamic='force-dynamic';
export const runtime='nodejs';
async function handle(request,context){
 try{
  requirePayToken(request);
  const {action}=await context.params;
  return await handlePlatformMonthly(request,{action,db:getJeniosPayAdmin(),platformDb:getJeniosPlatformAdmin()});
 }catch(error){return Response.json({ok:false,error:error.status===401?'Entre na sua conta JENIOS.':'A assinatura está temporariamente indisponível.'},{status:error.status===401?401:503,headers:BILLING_HEADERS});}
}
export const GET=handle;
export const POST=handle;
