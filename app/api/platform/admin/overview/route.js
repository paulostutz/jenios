import {getJeniosPlatformAdmin} from '../../../../../lib/platform/admin-db.mjs';
import {requirePlatformAdmin} from '../../../../../lib/platform/admin-permissions.mjs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store'};

/**
 * Números totais do projeto EXCLUSIVO da Platform.
 * Apenas totais agregados; não expõe e-mails, nomes ou dados de negociações.
 */
async function count(db,table){
 const {count,error}=await db.from(table).select('user_id',{count:'exact',head:true});
 if(error || !Number.isSafeInteger(count) || count<0)
  throw Object.assign(Error('Indicadores administrativos indisponíveis.'),{status:503});
 return count;
}
export async function GET(request){
 try{
  const db=getJeniosPlatformAdmin();
  await requirePlatformAdmin(request,db,'platform.admin');
  const [diagnostics,riskEvents,adminPermissions]=await Promise.all([
    count(db,'jenios_platform_diagnostics'),
    count(db,'jenios_platform_risk_events'),
    count(db,'jenios_platform_admin_permissions')
  ]);
  return Response.json({
    verified:true,
    source:'platform_dedicated_database',
    updatedAt:new Date().toISOString(),
    diagnostics,riskEvents,adminPermissions
  },{headers});
 }catch(e){
  return Response.json({error:e?.status?e.message:'Não foi possível consultar a Platform.'},
   {status:e?.status||503,headers});
 }
}
