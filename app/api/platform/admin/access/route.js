import {getJeniosPlatformAdmin} from '../../../../../lib/platform/admin-db.mjs';
import {platformAdminPermissions} from '../../../../../lib/platform/admin-permissions.mjs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store'};
export async function GET(request){
 try{
  const token=(request.headers.get('authorization')||'').match(/^Bearer ([^\s]+)$/i)?.[1];
  if(!token)return Response.json({error:'Entre na sua conta da Platform.'},{status:401,headers});
  const db=getJeniosPlatformAdmin();
  const {data,error}=await db.auth.getUser(token);
  if(error||!data?.user?.id||data.user.is_anonymous)
   return Response.json({error:'Sessão da Platform inválida.'},{status:401,headers});
  const permissions=await platformAdminPermissions(db,data.user);
  return Response.json({permissions},{headers});
 }catch(e){
  return Response.json({error:e?.status?e.message:'Não foi possível verificar as permissões da Platform.'},
   {status:e?.status||503,headers});
 }
}
