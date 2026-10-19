import {getJeniosPayAdmin} from '../../../../lib/jenios-pay-admin';
import {requirePayToken,requirePayUser} from '../../../../lib/pay/auth.mjs';
import {isMasterAdmin} from '../../../../lib/admin-access.mjs';
import {getJeniosPlatformAdmin} from '../../../../lib/platform/admin-db.mjs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
async function count(db,table){const {count,error}=await db.from(table).select('user_id',{head:true,count:'exact'});
 if(error||!Number.isSafeInteger(count)||count<0)throw Error('AGGREGATE_UNAVAILABLE');return count;}
export async function GET(request){try{
 requirePayToken(request);const social=getJeniosPayAdmin(),user=await requirePayUser(request,social);
 if(!isMasterAdmin(user))return Response.json({error:'Acesso exclusivo do Master.'},{status:403,headers});
 let platform;try{platform=getJeniosPlatformAdmin();}catch{return Response.json({status:'unavailable',source:'platform_dedicated_database'},{headers});}
 try{const [diagnostics,riskEvents,adminPermissions]=await Promise.all([
  count(platform,'jenios_platform_diagnostics'),count(platform,'jenios_platform_risk_events'),
  count(platform,'jenios_platform_admin_permissions')]);
  return Response.json({status:'ready',source:'platform_dedicated_database',diagnostics,riskEvents,adminPermissions,updatedAt:new Date().toISOString()},{headers});
 }catch{return Response.json({status:'unavailable',source:'platform_dedicated_database'},{headers});}
}catch(e){return Response.json({error:e.status?e.message:'Não foi possível verificar o acesso.'},{status:e.status||503,headers});}}
