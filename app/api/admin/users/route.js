import {getJeniosPayAdmin} from '../../../../lib/jenios-pay-admin';
import {requirePayToken} from '../../../../lib/pay/auth.mjs';
import {requireAdminPermission,auditAdmin} from '../../../../lib/admin-access.mjs';
import {normalizeInvite,normalizeMasterChange,safeUser,noCrossOriginMutation,MAX_USERS_PAGE} from '../../../../lib/admin-users.mjs';
export const dynamic='force-dynamic';export const runtime='nodejs';
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
const fail=e=>Response.json({error:e.status?e.message:'Não foi possível concluir a gestão de usuários.'},{status:e.status||503,headers});
async function context(request){
 requirePayToken(request);
 const db=getJeniosPayAdmin(),actor=await requireAdminPermission(request,db,'permissions.manage');
 return {db,actor};
}
export async function GET(request){
 try{
  const {db}=await context(request);
  const n=Number(new URL(request.url).searchParams.get('page')||1);
  if(!Number.isSafeInteger(n)||n<1||n>100)throw Object.assign(Error('Página inválida.'),{status:400});
  const {data,error}=await db.auth.admin.listUsers({page:n,perPage:MAX_USERS_PAGE});
  if(error)throw error;
  return Response.json({users:(data?.users||[]).map(user=>safeUser(user)),page:n,hasNext:(data?.users||[]).length===MAX_USERS_PAGE},{headers});
 }catch(e){return fail(e);}
}
export async function POST(request){
 try{
  noCrossOriginMutation(request);
  const {db,actor}=await context(request);
  const {email,role}=normalizeInvite(await request.json());
  await auditAdmin(db,actor,'user.invite.request',{email,role});
  const {data,error}=await db.auth.admin.inviteUserByEmail(email,{data:{origin:'jenios-master-office'}});
  if(error)throw Object.assign(Error(error.code==='email_exists'?'Este e-mail já possui conta. Use a gestão de permissões.':'Não foi possível enviar o convite; confira o serviço de e-mail.'),{status:error.code==='email_exists'?409:503});
  const invited=data?.user;
  if(!invited?.id)throw Error('O serviço de identidade não confirmou o convite.');
  if(role==='master'){
   const app_metadata={...(invited.app_metadata||{}),role:'master'};
   const result=await db.auth.admin.updateUserById(invited.id,{app_metadata});
   if(result.error){
    // The incomplete invite was created in this request; do not leave it elevated.
    await db.auth.admin.deleteUser(invited.id).catch(()=>{});
    throw Object.assign(Error('Não foi possível concluir o acesso Master; revise o convite antes de tentar novamente.'),{status:503});
   }
  }
  await auditAdmin(db,actor,'user.invite.created',{userId:invited.id,role});
  return Response.json({ok:true,inviteSent:true,user:{id:invited.id,email,role}},{status:201,headers});
 }catch(e){return fail(e);}
}
export async function PATCH(request){
 try{
  noCrossOriginMutation(request);
  const {db,actor}=await context(request);
  const {userId,enabled}=normalizeMasterChange(await request.json(),actor.id);
  const {data,error}=await db.auth.admin.getUserById(userId);
  if(error||!data?.user)throw Object.assign(Error('Conta não encontrada.'),{status:404});
  const target=data.user;
  if(!enabled&&String(process.env.JENIOS_ADMIN_MASTER_USER_IDS||'').split(',').map(v=>v.trim()).includes(userId))
   throw Object.assign(Error('Este Master está protegido pela configuração principal e não pode ser revogado nesta tela.'),{status:403});
  if(Boolean(target.app_metadata?.role==='master')===enabled)
   return Response.json({ok:true,unchanged:true,user:safeUser(target,process.env)},{headers});
  await auditAdmin(db,actor,enabled?'master.grant.request':'master.revoke.request',{userId});
  const app_metadata={...(target.app_metadata||{}),role:enabled?'master':'user'};
  const updated=await db.auth.admin.updateUserById(userId,{app_metadata});
  if(updated.error||!updated.data?.user)throw Error('O servidor não confirmou a atualização do Master.');
  await auditAdmin(db,actor,enabled?'master.granted':'master.revoked',{userId});
  return Response.json({ok:true,user:safeUser(updated.data.user,process.env)},{headers});
 }catch(e){return fail(e);}
}
