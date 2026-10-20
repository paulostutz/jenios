/** Server-side entitlement: a paid order alone is not enough.
 * Requires a confirmed, amount-matching provider receipt and one active entitlement per order.
 */
export const UNIVERSITY_PASS_DAYS=30;
const fail=(message,status=503)=>Object.assign(Error(message),{status});
/** A paid status is not a receipt. Both grant and access checks use the same
 * confirmed payment window; replaying a payment never restarts the 30 days. */
export function universityPaymentWindow(order,receipts,now=Date.now()){
 const created=Date.parse(order?.created_at);
 if(!order?.id||order.status!=='paid'||order.currency!=='BRL'||
  !Number.isSafeInteger(order.amount_cents)||order.amount_cents<=0||
  !Number.isFinite(created)||created>now||!Array.isArray(receipts))return null;
 const receipt=receipts.filter(p=>{
  const confirmed=Date.parse(p?.confirmed_at);
  return p?.order_id===order.id&&p.status==='confirmed'&&p.amount_cents===order.amount_cents&&
   typeof p.provider_payment_id==='string'&&p.provider_payment_id.trim().length>0&&
   Number.isFinite(confirmed)&&confirmed>=created-300000&&confirmed<=now;
 }).sort((a,b)=>Date.parse(a.confirmed_at)-Date.parse(b.confirmed_at)||a.provider_payment_id.localeCompare(b.provider_payment_id))[0];
 if(!receipt)return null;
 const paidAt=Date.parse(receipt.confirmed_at),expiresAt=paidAt+UNIVERSITY_PASS_DAYS*86400000;
 return expiresAt>now?{paidAt,expiresAt}:null;
}
export async function claimVerifiedUniversityPass(db,userId,now=Date.now()){
 if(!userId)throw fail('Entre na conta JENIOS.',401);
 const {data:products,error:ep}=await db.from('jenios_pay_products').select('id,code,category')
  .eq('code','social-university-pass').limit(1);
 if(ep)throw fail('Catálogo educacional temporariamente indisponível.');
 const sku=products?.find(p=>p.code==='social-university-pass'&&p.category==='other');
 if(!sku)return false;
 const orders=await db.from('jenios_pay_orders')
  .select('id,user_id,product_id,amount_cents,currency,status,created_at')
  .eq('user_id',userId).eq('product_id',sku.id).eq('status','paid')
  .order('created_at',{ascending:false}).limit(20);
 if(orders.error)throw fail('Não foi possível conferir suas cobranças.');
 const candidates=(orders.data||[]).filter(o=>o.user_id===userId&&o.product_id===sku.id&&o.status==='paid'
   &&o.currency==='BRL'&&Number.isSafeInteger(o.amount_cents)&&o.amount_cents>0);
 if(!candidates.length)return false;
 const receipts=await db.from('jenios_pay_payments')
  .select('order_id,amount_cents,status,confirmed_at,provider_payment_id')
  .in('order_id',candidates.map(o=>o.id)).eq('status','confirmed').limit(30);
 if(receipts.error)throw fail('Não foi possível verificar o comprovante.');
 let granted=false;
 for(const order of candidates){
  const window=universityPaymentWindow(order,receipts.data||[],now);
  if(!window)continue;
  const {paidAt,expiresAt}=window;
  const existing=await db.from('jenios_pay_entitlements').select('id,status')
   .eq('order_id',order.id).maybeSingle();
  if(existing.error)throw fail('Não foi possível consultar o acesso.');
  if(existing.data)continue; // revoked/expired order must never be reactivated
  const write=await db.from('jenios_pay_entitlements')
   .upsert({user_id:userId,order_id:order.id,product_id:sku.id,status:'active',
    granted_at:new Date(paidAt).toISOString(),expires_at:new Date(expiresAt).toISOString()},
    {onConflict:'order_id',ignoreDuplicates:true});
  if(write.error)throw fail('O comprovante foi confirmado, mas não foi possível liberar a Universidade.');
  granted=true;
 }
 return granted;
}
