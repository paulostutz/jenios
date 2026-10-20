const EMAIL=/^[^\s@]{1,64}@[^\s@]{1,190}$/;
const UID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const MAX_USERS_PAGE=50;
export const allowedAdminRoles=Object.freeze(['user','master']);
export function normalizeInvite(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['email','role'].includes(k)))throw Object.assign(Error('Convite inválido.'),{status:400});
 const email=String(input.email||'').trim().toLowerCase(),role=input.role;
 if(!EMAIL.test(email)||email.length>254||!allowedAdminRoles.includes(role))throw Object.assign(Error('Informe e-mail válido e selecione Usuário ou Master.'),{status:400});
 return {email,role};
}
export function normalizeMasterChange(input,actorId){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['userId','enabled'].includes(k)))throw Object.assign(Error('Alteração inválida.'),{status:400});
 const userId=String(input.userId||''),enabled=input.enabled;
 if(!UID.test(userId)||typeof enabled!=='boolean')throw Object.assign(Error('Usuário ou operação inválida.'),{status:400});
 if(!enabled&&userId===actorId)throw Object.assign(Error('Você não pode revogar seu próprio acesso Master.'),{status:403});
 return {userId,enabled};
}
export function safeUser(user,env={}){
 const ids=String(env.JENIOS_ADMIN_MASTER_USER_IDS||'').split(',').map(x=>x.trim()).filter(Boolean);
 const isMaster=user.app_metadata?.role==='master'||ids.includes(user.id);
 return {id:user.id,email:String(user.email||''),isMaster,confirmed:Boolean(user.email_confirmed_at),createdAt:user.created_at||null};
}
export function noCrossOriginMutation(request){
 const origin=request.headers.get('origin');
 if(origin&&origin!==new URL(request.url).origin)throw Object.assign(Error('Origem não autorizada.'),{status:403});
}
