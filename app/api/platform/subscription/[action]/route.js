import {getJeniosPayAdmin} from '../../../../../lib/jenios-pay-admin';
import {getJeniosPlatformAdmin} from '../../../../../lib/platform/admin-db.mjs';
import {handlePlatformMonthly,BILLING_HEADERS} from '../../../../../lib/platform/monthly-billing.mjs';
export const dynamic='force-dynamic';
export const runtime='nodejs';
async function handle(request,context){
 try{
  const {action}=await context.params;
  return await handlePlatformMonthly(request,{action,db:getJeniosPayAdmin(),platformDb:getJeniosPlatformAdmin()});
 }catch{return Response.json({ok:false,error:'A assinatura está temporariamente indisponível.'},{status:503,headers:BILLING_HEADERS});}
}
export const GET=handle;
export const POST=handle;
