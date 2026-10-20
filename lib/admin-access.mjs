import {requirePayUser} from './pay/auth.mjs';
export const ADMIN_PERMISSIONS=['reports.run','finance.manage','permissions.manage'];
/** Operational grants never give access to the Master administrative office. */
export function isMasterAdmin(user,env=process.env){
 if(!user?.id||user.is_anonymous)return false;
 if(user.app_metadata?.role==='master')return true;
 return String(env.JENIOS_ADMIN_MASTER_USER_IDS||'').split(',').map(v=>v.trim()).filter(Boolean).includes(user.id);
}
export async function adminPermissions(db,user,env=process.env){
 if(!user?.id||user.is_anonymous)return [];
 if(isMasterAdmin(user,env)||user.app_metadata?.role==='admin'||String(env.JENIOS_PAY_ADMIN_USER_IDS||'').split(',').map(x=>x.trim()).includes(user.id))return [...ADMIN_PERMISSIONS];
 const granted=new Set((Array.isArray(user.app_metadata?.permissions)?user.app_metadata.permissions:[]).filter(p=>ADMIN_PERMISSIONS.includes(p)));
 if(user.app_metadata?.role==='finance_admin')granted.add('finance.manage');
 const {data,error}=await db.from('jenios_admin_permissions').select('permission').eq('user_id',user.id);
 if(error)throw Object.assign(Error('Não foi possível verificar suas permissões.'),{status:503});
 for(const row of data||[])if(ADMIN_PERMISSIONS.includes(row.permission))granted.add(row.permission);
 return [...granted];
}
export async function requireAdminPermission(request,db,permission){
 const user=await requirePayUser(request,db);
 if(!isMasterAdmin(user))throw Object.assign(Error('A Central Administrativa é exclusiva do usuário Master.'),{status:403});
 if(!(await adminPermissions(db,user)).includes(permission))throw Object.assign(Error('Sua conta não possui autorização para esta operação.'),{status:403});
 return user;
}
export async function auditAdmin(db,user,action,target){
 const {error}=await db.from('jenios_admin_audit').insert({actor_id:user.id,action,target});
 if(error)throw Object.assign(Error('Não foi possível registrar a operação administrativa.'),{status:503});
}
