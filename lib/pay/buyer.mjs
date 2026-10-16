import {createHash, randomBytes} from 'node:crypto';
import {requirePayUser} from './auth.mjs';
export const GUEST_PRODUCTS = new Set(['social-bankscore-report','social-crypto-validator']);
const COOKIE='jenios_report_buyer';
export const guestEnabled=()=>process.env.JENIOS_GUEST_REPORTS_ENABLED==='true';
export function guestHash(token){if(!/^[a-f0-9]{64}$/.test(token||''))return null;return createHash('sha256').update(token).digest('hex');}
export function guestToken(request){return (request.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='))?.slice(COOKIE.length+1)||'';}
export function sameOrigin(request){const origin=request.headers.get('origin');if(!origin||origin!==new URL(request.url).origin)throw Object.assign(Error('Origem da requisição inválida.'),{status:403});}
export function newGuestCookie(request){sameOrigin(request);const token=guestHash(guestToken(request))?guestToken(request):randomBytes(32).toString('hex');return `${COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=15552000${new URL(request.url).protocol==='https:'?'; Secure':''}`;}
export async function requireReportBuyer(request,db){
 if(request.headers.get('authorization'))return requirePayUser(request,db);
 if(request.method!=='GET')sameOrigin(request);
 const hash=guestHash(guestToken(request));
 if(!hash)throw Object.assign(Error('Abra a consulta no navegador usado na compra ou entre na conta que contratou.'),{status:401});
 return {id:null,guestHash:hash};
}
export function buyerKey(user){return user?.id|| (guestHash(user?.guestHash)?'guest:'+user.guestHash:null);}
export function filterBuyer(query,user){if(user?.id)return query.eq('user_id',user.id);if(/^[a-f0-9]{64}$/.test(user?.guestHash||''))return query.is('user_id',null).eq('guest_buyer_hash',user.guestHash);throw Object.assign(Error('Comprador não identificado.'),{status:401});}
export function ownsOrder(order,user){return user?.id?order?.user_id===user.id:order?.user_id===null&&/^[a-f0-9]{64}$/.test(user?.guestHash||'')&&order?.guest_buyer_hash===user.guestHash;}
