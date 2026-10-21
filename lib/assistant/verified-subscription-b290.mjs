/** JENIOS B290: optional strict, read-only financial evidence gate for QA.
 * An 'active' subscription row alone never proves a bank settlement. This gate
 * is enabled only when JENIOS_QA_STRICT_SUBSCRIPTION_PROOF=true (Preview QA).
 * No writes, simulated receipt insertion, bank calls or production activation.
 */
import {SALES_PLANS} from './sales-policy.mjs';
const fail=message=>Object.assign(Error(message),{status:503,code:'FINANCIAL_PROOF_UNAVAILABLE'});
const validInstant=value=>typeof value==='string'&&Number.isFinite(Date.parse(value));
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const day=86400000;
export const B290_STRICT_QA_FLAG='JENIOS_QA_STRICT_SUBSCRIPTION_PROOF';
export function attestVerifiedPlatformB290({subscription,order,receipts,product,userId,now=Date.now()}={}){
 if(!uuid(userId)||!Number.isSafeInteger(now)||!subscription||!order||!product||!Array.isArray(receipts))
  return Object.freeze({verified:false,code:'MISSING_SERVER_EVIDENCE'});
 const plan=SALES_PLANS.find(p=>p.code===product.code);
 if(!plan||product.category!=='platform'||product.id!==subscription.product_id||
  order.product_id!==product.id||!uuid(subscription.id)||!uuid(order.id)||
  subscription.user_id!==userId||order.user_id!==userId||
  subscription.latest_order_id!==order.id||
  subscription.status!=='active'||order.status!=='paid'||order.provider!=='inter_pix'||
  order.currency!=='BRL'||Number(order.amount_cents)!==plan.priceCents)
  return Object.freeze({verified:false,code:'SUBSCRIPTION_PAYMENT_BINDING_FAILED'});
 const start=Date.parse(subscription.current_period_start),end=Date.parse(subscription.current_period_end);
 if(!validInstant(subscription.current_period_start)||!validInstant(subscription.current_period_end)||
  start>now||end<=now||end<=start||end-start>36*day)
  return Object.freeze({verified:false,code:'SUBSCRIPTION_PERIOD_NOT_ACTIVE'});
 if(!validInstant(order.created_at)||Date.parse(order.created_at)>now+300000||
   Date.parse(order.created_at)<start-7*day)
  return Object.freeze({verified:false,code:'ORDER_TOO_OLD_OR_FUTURE'});
 const expectedTxid=order.id.replaceAll('-','').toLowerCase();
 const witnessed=receipts.some(p=>{
  const paidAt=Date.parse(p?.confirmed_at);
  return p?.order_id===order.id&&p?.status==='confirmed'&&p.provider==='inter_pix'&&
   p.payment_method==='pix'&&Number(p.amount_cents)===Number(order.amount_cents)&&
   p.provider_payment_id===expectedTxid&&
   /^E[a-zA-Z0-9]{31}$/.test(p.bank_end_to_end_id||'')&&
   validInstant(p.confirmed_at)&&paidAt<=now+300000&&paidAt>=start-7*day&&
   paidAt>=Date.parse(order.created_at)-300000;
 });
 if(!witnessed)return Object.freeze({verified:false,code:'CONFIRMED_BANK_RECEIPT_NOT_FOUND'});
 return Object.freeze({verified:true,code:'CONFIRMED_BANK_RECEIPT_AND_ACTIVE_PERIOD',
  planCode:plan.code,validUntil:subscription.current_period_end,
  userId,subscriptionId:subscription.id,bankChargeReplayed:false,
  realBankAuthenticatedByThisCheck:false,subscriptionWritten:false,
  ordersSent:0,chargesCreated:0});
}
export async function verifiedPlatformEvidenceB290(db,userId,plan,now=Date.now()){
 if(!db||!uuid(userId)||!plan?.productId||!uuid(plan?.subscriptionId))
  throw fail('Não foi possível confirmar o vínculo financeiro do plano.');
 let s,o,p;
 try{
  s=await db.from('jenios_pay_subscriptions')
   .select('id,user_id,product_id,latest_order_id,status,current_period_start,current_period_end,cancel_at_period_end')
   .eq('id',plan.subscriptionId).eq('user_id',userId).maybeSingle();
  if(s.error||!s.data?.latest_order_id)return null;
  o=await db.from('jenios_pay_orders')
   .select('id,user_id,product_id,status,provider,currency,amount_cents,created_at')
   .eq('id',s.data.latest_order_id).eq('user_id',userId).maybeSingle();
  if(o.error||!o.data)return null;
  p=await db.from('jenios_pay_payments')
   .select('id,order_id,provider,status,provider_payment_id,payment_method,amount_cents,confirmed_at,bank_end_to_end_id')
   .eq('order_id',o.data.id).eq('status','confirmed').limit(10);
 }catch{throw fail('Não foi possível consultar o vínculo financeiro do plano.');}
 if(s.error||o.error||p.error)throw fail('Não foi possível validar a confirmação financeira.');
 const evidence=attestVerifiedPlatformB290({subscription:s.data,order:o.data,receipts:p.data||[],
  product:{id:plan.productId,code:plan.code,category:'platform'},userId,now});
 return evidence.verified===true?evidence:null;
}
