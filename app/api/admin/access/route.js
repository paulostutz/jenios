import {getJeniosPayAdmin} from '../../../../lib/jenios-pay-admin';
import {requirePayUser,requirePayToken} from '../../../../lib/pay/auth.mjs';
import {adminPermissions,isMasterAdmin,requireAdminPermission,auditAdmin} from '../../../../lib/admin-access.mjs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store'};
const failure=e=>Response.json({error:e.status?e.message:'Não foi possível verificar o acesso.'},{status:e.status||503,headers});
export async function GET(request){try{requirePayToken(request);const db=getJeniosPayAdmin(),user=await requirePayUser(request,db);const isMaster=isMasterAdmin(user);return Response.json({isMaster,permissions:isMaster?await adminPermissions(db,user):[]},{headers});}catch(e){return failure(e);}}
export async function POST(request){try{requirePayToken(request);const db=getJeniosPayAdmin(),user=await requireAdminPermission(request,db,'permissions.manage');const body=await request.json();
 if(!['reports.run','finance.manage'].includes(body.permission)||typeof body.enabled!=='boolean'||!/^@?[a-zA-Z0-9_.]{3,40}$/.test(body.handle||''))throw Object.assign(Error('Informe o @ e uma permissão válida.'),{status:400});
 const {data:profile,error}=await db.from('profiles').select('id,handle').eq('handle',body.handle.replace(/^@/,'').toLowerCase()).maybeSingle();if(error)throw error;if(!profile)throw Object.assign(Error('Perfil não encontrado.'),{status:404});
 await auditAdmin(db,user,body.enabled?'permission.grant':'permission.revoke',{userId:profile.id,permission:body.permission});
 const result=body.enabled?await db.from('jenios_admin_permissions').upsert({user_id:profile.id,permission:body.permission,granted_by:user.id},{onConflict:'user_id,permission',ignoreDuplicates:true}):await db.from('jenios_admin_permissions').delete().eq('user_id',profile.id).eq('permission',body.permission);
 if(result.error)throw result.error;return Response.json({ok:true,handle:profile.handle},{headers});
 }catch(e){return failure(e);}}
