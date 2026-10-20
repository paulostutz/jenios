/** Private monthly education ledger. Payment and ownership are rechecked on every access. */
export const UNIVERSITY_MONTHLY_PRODUCT='social-university-monthly';
export const UNIVERSITY_MONTHLY_PRICE_CENTS=4990;
export const UNIVERSITY_MONTHLY_TERMS='university-monthly-2026-10-20';
export const UNIVERSITY_MONTHLY_TABLE='jenios_university_invoices_b147';
export const UNIVERSITY_MONTHLY_RPC=Object.freeze({prepare:'jenios_university_prepare_b147',confirm:'jenios_university_confirm_b147'});
const fail=message=>Object.assign(Error(message),{status:503,code:'UNIVERSITY_UNAVAILABLE'});
const instant=value=>typeof value==='string'?Date.parse(value):NaN;
export const monthlyProductReady=product=>product?.code===UNIVERSITY_MONTHLY_PRODUCT&&product.category==='other'&&product.currency==='BRL'&&product.billing_type==='monthly'&&product.price_cents===4990&&product.active===true;
export async function monthlyUniversityProduct(db){
 const {data,error}=await db.from('jenios_pay_products').select('id,code,category,currency,billing_type,price_cents,active').eq('code',UNIVERSITY_MONTHLY_PRODUCT).limit(1);
 if(error)throw fail('Não foi possível verificar a mensalidade da Universidade.');
 return (data||[]).find(product=>product.code===UNIVERSITY_MONTHLY_PRODUCT&&product.category==='other')||null;
}
/** A calendar month is anchored to the original local billing day in Brasília.
 * Pure mirror for validation/tests; PostgreSQL remains the writer of paid periods. */
export function universityMonthEnd(start,anchorDay,anchorTime){
 const at=instant(start),match=typeof anchorTime==='string'&&anchorTime.match(/^(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?$/);
 if(!Number.isFinite(at)||!Number.isInteger(anchorDay)||anchorDay<1||anchorDay>31||!match)throw fail('Período mensal inválido.');
 const [h,m,s]=match.slice(1,4).map(Number);if(h>23||m>59||s>59)throw fail('Horário mensal inválido.');
 const local=new Date(at-3*3600000),year=local.getUTCFullYear(),month=local.getUTCMonth()+1;
 const lastDay=new Date(Date.UTC(year,month+1,0)).getUTCDate();
 return new Date(Date.UTC(year,month,Math.min(anchorDay,lastDay),h+3,m,s,Number((match[4]||'').padEnd(3,'0').slice(0,3)))).toISOString();
}
function monthlyPeriodsFromEvidence(invoices,orders,receipts,userId,productId,now=Date.now()){
 const valid=[];
 for(const invoice of invoices||[]){
  if(invoice.user_id!==userId||invoice.status!=='active'||invoice.amount_cents!==4990||invoice.currency!=='BRL'||invoice.terms_version!==UNIVERSITY_MONTHLY_TERMS)continue;
  const start=instant(invoice.period_start),end=instant(invoice.period_end),paid=instant(invoice.paid_at);
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start||!Number.isFinite(paid)||paid>now||start<paid||end<=now)continue;
  let expected;try{expected=universityMonthEnd(invoice.period_start,invoice.anchor_day,invoice.anchor_time);}catch{continue;}
  if(instant(expected)!==end)continue;
  const order=(orders||[]).find(o=>o.id===invoice.order_id&&o.user_id===userId&&o.product_id===productId&&o.status==='paid'&&o.provider==='inter_pix'&&o.currency==='BRL'&&o.amount_cents===4990);
  if(!order||!Number.isFinite(instant(order.created_at))||paid<instant(order.created_at)-300000)continue;
  const receipt=(receipts||[]).find(p=>p.id===invoice.receipt_id&&p.order_id===invoice.order_id&&p.status==='confirmed'&&p.provider==='inter_pix'&&p.payment_method==='pix'&&p.amount_cents===4990&&p.provider_payment_id===invoice.order_id.replaceAll('-','').toLowerCase()&&instant(p.confirmed_at)===paid);
  if(!receipt)continue;
  valid.push({start,end,orderId:order.id});
 }
 return valid.sort((a,b)=>a.start-b.start||a.end-b.end);
}
export function monthlyAccessFromEvidence(invoices,orders,receipts,userId,productId,now=Date.now()){
 const valid=monthlyPeriodsFromEvidence(invoices,orders,receipts,userId,productId,now);
 let end=now,found=false,orderId=null;
 for(const period of valid){if(period.start<=end&&period.end>end){end=period.end;found=true;orderId=period.orderId;}}
 return found?{kind:'university-monthly',active:true,validUntil:new Date(end).toISOString(),productCode:UNIVERSITY_MONTHLY_PRODUCT,orderId}:null;
}
export function monthlyScheduledFromEvidence(invoices,orders,receipts,userId,productId,now=Date.now()){
 if(monthlyAccessFromEvidence(invoices,orders,receipts,userId,productId,now))return null;
 const valid=monthlyPeriodsFromEvidence(invoices,orders,receipts,userId,productId,now),first=valid.find(period=>period.start>now);
 if(!first)return null;
 let end=first.end;for(const period of valid){if(period.start<=end&&period.end>end)end=period.end;}
 return {kind:'university-monthly',productCode:UNIVERSITY_MONTHLY_PRODUCT,startsAt:new Date(first.start).toISOString(),validUntil:new Date(end).toISOString(),orderId:first.orderId};
}
async function monthlyEvidence(db,userId,now,product){
 if(!userId)throw Object.assign(Error('Entre na conta JENIOS.'),{status:401});
 product=product===undefined?await monthlyUniversityProduct(db):product;
 if(!product)return null;
 const result=await db.from(UNIVERSITY_MONTHLY_TABLE).select('*').eq('user_id',userId).eq('status','active')
  .gt('period_end',new Date(now).toISOString()).order('period_start',{ascending:true}).limit(100);
 if(result.error)throw fail('Não foi possível conferir seu período educacional.');
 const invoices=(result.data||[]).filter(i=>i.user_id===userId&&i.status==='active'&&instant(i.period_end)>now);
 if(!invoices.length)return null;
 const ids=invoices.map(i=>i.order_id);
 const [orders,receipts]=await Promise.all([
  db.from('jenios_pay_orders').select('id,user_id,product_id,status,amount_cents,currency,provider,created_at').eq('user_id',userId).in('id',ids).limit(100),
  db.from('jenios_pay_payments').select('id,order_id,status,provider,payment_method,amount_cents,provider_payment_id,confirmed_at').in('order_id',ids).eq('status','confirmed').limit(100)
 ]);
 if(orders.error||receipts.error)throw fail('Não foi possível conferir o comprovante da mensalidade.');
 return {invoices,orders:orders.data,receipts:receipts.data,productId:product.id};
}
export async function verifiedMonthlyUniversity(db,userId,now=Date.now(),product){
 const e=await monthlyEvidence(db,userId,now,product);
 return e?monthlyAccessFromEvidence(e.invoices,e.orders,e.receipts,userId,e.productId,now):null;
}
export async function scheduledMonthlyUniversity(db,userId,now=Date.now(),product,orderId){
 const e=await monthlyEvidence(db,userId,now,product);
 return e?monthlyScheduledFromEvidence(orderId?e.invoices.filter(i=>i.order_id===orderId):e.invoices,e.orders,e.receipts,userId,e.productId,now):null;
}
/** Reconcile a confirmed payment after a lost response, without contacting the bank. */
export async function claimVerifiedMonthlyUniversity(db,userId,now=Date.now(),product){
 product=product===undefined?await monthlyUniversityProduct(db):product;
 if(!product)return false;
 const invoices=await db.from(UNIVERSITY_MONTHLY_TABLE).select('order_id,user_id,status').eq('user_id',userId).in('status',['pending','closed']).order('created_at',{ascending:false}).limit(20);
 if(invoices.error)throw fail('Não foi possível conferir a liberação da mensalidade.');
 const ids=(invoices.data||[]).filter(i=>i.user_id===userId).map(i=>i.order_id);if(!ids.length)return false;
 const orders=await db.from('jenios_pay_orders').select('id,user_id,product_id,status').eq('user_id',userId).eq('product_id',product.id).in('id',ids).eq('status','paid').limit(20);
 if(orders.error)throw fail('Não foi possível conferir a liberação da mensalidade.');
 let granted=false;
 for(const order of orders.data||[]){
  if(order.user_id!==userId||order.status!=='paid'||order.product_id!==product.id)continue;
  const result=await db.rpc(UNIVERSITY_MONTHLY_RPC.confirm,{p_user_id:userId,p_order_id:order.id});
  if(result.error)throw fail('O pagamento está em conferência. Consulte novamente sem pagar outra vez.');
  if(result.data?.ok===true)granted=true;
 }
 return granted;
}
