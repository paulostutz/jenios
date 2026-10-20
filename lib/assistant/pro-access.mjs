import {isMasterAdmin} from '../admin-access.mjs';
import {universityPaymentWindow} from './university-pass.mjs';
import {verifiedMonthlyUniversity} from './university-monthly-access.mjs';
export const PLATFORM_PAID_TIERS=Object.freeze(['platform-global-crypto','platform-internacional-pro']);
export const PLATFORM_OTHER_TIER='platform-nacional';
export const UNIVERSITY_PASS_PRODUCT='social-university-pass';
/* Proposed included PRO retail balances. Separately configurable; global provider budget applies always.
 * No unlimited provider spending is ever implied by a subscription.
 */
export const PRO_MONTHLY_INCLUDED_MICRO_USD=Object.freeze({
 'platform-global-crypto':2_000_000,
 'platform-internacional-pro':4_000_000
});
export const KNOWN_PLATFORM_PRODUCTS=Object.freeze([PLATFORM_OTHER_TIER,...PLATFORM_PAID_TIERS]);
const failure=(message,status=503)=>Object.assign(Error(message),{status});
export function classifyVerifiedPlan(subscriptions,products,now=Date.now()){
 if(!Array.isArray(subscriptions)||!Array.isArray(products))throw failure('Não foi possível verificar o plano.');
 const found=subscriptions.flatMap(row=>{
  const product=products.find(p=>p.id===row.product_id&&p.category==='platform'&&KNOWN_PLATFORM_PRODUCTS.includes(p.code));
  if(!product||!['active','trialing'].includes(row.status))return [];
  const start=Date.parse(row.current_period_start),end=Date.parse(row.current_period_end);
  if(!Number.isFinite(start)||!Number.isFinite(end)||start>now||end<=now)return [];
  return [{code:product.code,validUntil:row.current_period_end,
   periodStart:row.current_period_start,periodEnd:row.current_period_end,
   subscriptionId:row.id,productId:product.id}];
 });
 const priority=code=>PLATFORM_PAID_TIERS.indexOf(code)>=0?10+PLATFORM_PAID_TIERS.indexOf(code):0;
 return found.sort((a,b)=>priority(b.code)-priority(a.code)||Date.parse(b.validUntil)-Date.parse(a.validUntil)
  ||Date.parse(b.periodStart)-Date.parse(a.periodStart)||String(a.subscriptionId).localeCompare(String(b.subscriptionId)))[0]||null;
}
export async function verifiedPlatformPlan(db,userId,now=Date.now()){
 if(!userId)throw failure('Entre na conta JENIOS.',401);
 const [s,p]=await Promise.all([
  db.from('jenios_pay_subscriptions').select('id,product_id,status,current_period_start,current_period_end')
   .eq('user_id',userId).order('created_at',{ascending:false}).limit(50),
  db.from('jenios_pay_products').select('id,code,category')
   .in('code',KNOWN_PLATFORM_PRODUCTS).limit(10)
 ]);
 if(s.error||p.error)throw failure('Não foi possível verificar o plano contratado.');
 return classifyVerifiedPlan(s.data||[],p.data||[],now);
}
export function proPlanAccess(plan,user,env=process.env){
 if(user&&isMasterAdmin(user,env))return {master:true,proIncluded:true,universityIncluded:true,allowanceMicroUsd:0,periodStart:null,periodEnd:null};
 const included=Boolean(plan&&PLATFORM_PAID_TIERS.includes(plan.code));
 return {master:false,proIncluded:included,universityIncluded:included,allowanceMicroUsd:included?PRO_MONTHLY_INCLUDED_MICRO_USD[plan.code]:0,
   periodStart:included?plan.periodStart:null,periodEnd:included?plan.periodEnd:null,
   planCode:plan?.code||null};
}
export async function verifiedUniversityPass(db,userId,now=Date.now()){
 if(!userId)throw failure('Entre na conta JENIOS.',401);
 const {data:products,error:productsError}=await db.from('jenios_pay_products').select('id,code,category')
  .eq('code',UNIVERSITY_PASS_PRODUCT).limit(1);
 if(productsError)throw failure('Não foi possível verificar o acesso à Universidade.');
 const product=(products||[]).find(p=>p.code===UNIVERSITY_PASS_PRODUCT&&p.category==='other');
 if(!product)return verifiedMonthlyUniversity(db,userId,now);
 const result=await db.from('jenios_pay_entitlements')
  .select('id,user_id,status,granted_at,expires_at,order_id,product_id').eq('user_id',userId).eq('product_id',product.id).order('created_at',{ascending:false}).limit(20);
 if(result.error)throw failure('Não foi possível verificar seu acesso educacional.');
 const valid=(result.data||[]).filter(e=>e.user_id===userId&&e.status==='active'&&e.product_id===product.id&&
  Number.isFinite(Date.parse(e.granted_at))&&Date.parse(e.granted_at)<=now&&
  Number.isFinite(Date.parse(e.expires_at))&&Date.parse(e.expires_at)>now)
  .sort((a,b)=>Date.parse(b.expires_at)-Date.parse(a.expires_at)||String(a.id).localeCompare(String(b.id)));
 // A stale/refunded recent order must not hide another independently paid pass.
 for(const entitlement of valid){
  const order=await db.from('jenios_pay_orders').select('id,user_id,status,product_id,amount_cents,currency,created_at')
   .eq('id',entitlement.order_id).eq('user_id',userId).maybeSingle();
  if(order.error)throw failure('Não foi possível confirmar a compra educacional.');
  if(!(order.data?.status==='paid'&&order.data?.user_id===userId&&order.data?.product_id===product.id))continue;
  const receipts=await db.from('jenios_pay_payments')
   .select('order_id,amount_cents,status,confirmed_at,provider_payment_id')
   .eq('order_id',entitlement.order_id).eq('status','confirmed').limit(10);
  if(receipts.error)throw failure('Não foi possível verificar o comprovante educacional.');
  const window=universityPaymentWindow(order.data,receipts.data||[],now);
  if(!window||Date.parse(entitlement.granted_at)<window.paidAt)continue;
  const expiresAt=Math.min(Date.parse(entitlement.expires_at),window.expiresAt);
  if(expiresAt>now)return {kind:'purchased-pass',validUntil:new Date(expiresAt).toISOString(),orderId:entitlement.order_id};
 }
 return verifiedMonthlyUniversity(db,userId,now);
}
