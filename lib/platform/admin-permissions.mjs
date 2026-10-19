/** Authorizations from JENIOS Platform dedicated Supabase only. */
export const PLATFORM_PERMISSIONS=Object.freeze(['platform.admin','platform.reports']);
const grantTable='jenios_platform_admin_permissions';
function unauthorized(status,message){
 return Object.assign(new Error(message),{status});
}
export async function platformAdminPermissions(db,user,env=process.env){
 if(!user?.id || user.is_anonymous)return [];
 const ids=String(env.PLATFORM_ADMIN_USER_IDS||'').split(',').map(v=>v.trim()).filter(Boolean);
 if(ids.includes(user.id) || user.app_metadata?.platform_role==='admin')
   return [...PLATFORM_PERMISSIONS];
 const {data,error}=await db.from(grantTable).select('permission').eq('user_id',user.id);
 if(error)throw unauthorized(503,'Não foi possível conferir as permissões da Platform.');
 const granted=(data||[]).map(row=>row.permission).filter(p=>PLATFORM_PERMISSIONS.includes(p) && p==='platform.reports');
 return [...new Set(granted)];
}
export async function requirePlatformAdmin(request,db,permission){
 const auth=request.headers.get('authorization')||'';
 const token=auth.match(/^Bearer ([^\s]+)$/i)?.[1];
 if(!token)throw unauthorized(401,'Entre com sua conta da Platform.');
 const {data,error}=await db.auth.getUser(token);
 const user=data?.user;
 if(error||!user?.id||user.is_anonymous)throw unauthorized(401,'Sessão inválida da Platform.');
 const permissions=await platformAdminPermissions(db,user);
 if(!permissions.includes(permission))throw unauthorized(403,'Conta sem autorização administrativa na Platform.');
 return {user,permissions};
}
