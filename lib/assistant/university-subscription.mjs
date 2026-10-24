/** B147 — paid monthly education, using the existing PAY Pix transport.
 * Each month needs explicit consent. This module never schedules automatic debits.
 */
import {requirePayUser} from '../pay/auth.mjs';
import {isMasterAdmin} from '../admin-access.mjs';
import {createGatewayCheckout} from '../pay/gateway.mjs';
import {interPixConfigured,createInterPixClient} from '../pay/inter-pix.mjs';
import {loadJeniosInterServerEnv} from '../pay/inter-vault.mjs';
import {pixStatus} from '../pay/pix-status.mjs';
import {readBoundedJson} from '../platform/bounded-response.mjs';
import {verifiedPlatformPlan,proPlanAccess,verifiedUniversityPass} from './pro-access.mjs';
import {UNIVERSITY_MONTHLY_PRODUCT,UNIVERSITY_MONTHLY_PRICE_CENTS,UNIVERSITY_MONTHLY_TERMS,UNIVERSITY_MONTHLY_TABLE,UNIVERSITY_MONTHLY_RPC,monthlyProductReady,monthlyUniversityProduct,scheduledMonthlyUniversity,claimVerifiedMonthlyUniversity} from './university-monthly-access.mjs';

export const UNIVERSITY_HEADERS=Object.freeze({'Cache-Control':'private, no-store','Vary':'Authorization','X-Content-Type-Options':'nosniff'});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const validKey=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{16,100}$/.test(value);
const fail=(message,status=503,code='UNIVERSITY_UNAVAILABLE')=>Object.assign(Error(message),{status,code});
const financial=Object.freeze({productCode:UNIVERSITY_MONTHLY_PRODUCT,amountCents:UNIVERSITY_MONTHLY_PRICE_CENTS,currency:'BRL',termsVersion:UNIVERSITY_MONTHLY_TERMS});
const emptyAccess=()=>({kind:'none',active:false,included:false,validUntil:null});
const chargesEnabled=env=>env.JENIOS_PAY_PAYMENTS_ENABLED==='true'&&env.JENIOS_INTER_CHARGES_ENABLED==='true';
async function universityInterEnv(db,env,operation='charge'){
 if(env.JENIOS_PAY_PROVIDER!=='inter_pix'||(operation!=='read'&&!chargesEnabled(env)))return null;
 try{
  // Resolve only after authentication (and ownership for status). Never mutate process.env.
  const source={...env};
  const runtimeEnv=interPixConfigured(source)?source:await loadJeniosInterServerEnv(db,source);
  // A read of an owned pending charge can reconcile payment while new charges are paused.
  return env.JENIOS_PAY_PROVIDER==='inter_pix'&&interPixConfigured(runtimeEnv)&&
   (operation==='read'||(chargesEnabled(env)&&chargesEnabled(runtimeEnv)))?runtimeEnv:null;
 }catch{return null;}
}
async function accessFor(db,user,now,env){
 if(isMasterAdmin(user,env))return {kind:'admin-preview',active:true,included:true,validUntil:null};
 const plan=await verifiedPlatformPlan(db,user.id,now),rights=proPlanAccess(plan,user,env);
 if(rights.universityIncluded)return {kind:'subscription',active:true,included:true,productCode:plan.code,validUntil:plan.validUntil};
 const pass=await verifiedUniversityPass(db,user.id,now);
 return pass?{...pass,active:true,included:false}:emptyAccess();
}
function verifyBinding(invoice,order,userId,product){
 let meta;try{meta=JSON.parse(order?.external_reference||'null');}catch{}
 if(!invoice||!order||!uuid.test(order.id||'')||invoice.user_id!==userId||order.user_id!==userId||invoice.order_id!==order.id||order.product_id!==product?.id
  ||invoice.amount_cents!==4990||order.amount_cents!==4990||invoice.currency!=='BRL'||order.currency!=='BRL'||order.provider!=='inter_pix'
  ||invoice.terms_version!==UNIVERSITY_MONTHLY_TERMS||!validKey(invoice.request_key)||order.idempotency_key!=='university:'+userId+':'+invoice.request_key
  ||meta?.productCode!==UNIVERSITY_MONTHLY_PRODUCT||meta?.scope!=='social'||meta?.billingType!=='monthly'||meta?.renewalMode!=='manual_pix'
  ||meta?.termsVersion!==UNIVERSITY_MONTHLY_TERMS||meta?.fingerprint!=='university:'+userId+':'+invoice.request_key
  ||!['pending','active','closed'].includes(invoice.status)||!['pending','awaiting_payment','paid','cancelled','expired','refunded'].includes(order.status))
  throw fail('Não foi possível conferir o vínculo desta mensalidade.',503,'ORDER_MISMATCH');
}
async function ownerOrder(db,userId,orderId,product){
 const [i,o]=await Promise.all([
  db.from(UNIVERSITY_MONTHLY_TABLE).select('*').eq('user_id',userId).eq('order_id',orderId).maybeSingle(),
  db.from('jenios_pay_orders').select('*').eq('user_id',userId).eq('id',orderId).maybeSingle()
 ]);
 if(i.error||o.error)throw fail('Não foi possível consultar a mensalidade.');
 if(!i.data||!o.data)throw fail('Mensalidade não encontrada.',404,'ORDER_NOT_FOUND');
 verifyBinding(i.data,o.data,userId,product);return {invoice:i.data,order:o.data};
}
function orderProjection(invoice,order){
 const closed=invoice.status==='closed'||['cancelled','expired','refunded'].includes(order.status);
 const status=closed&&['pending','awaiting_payment'].includes(order.status)?invoice.closed_status||'expired':order.status;
 return {...financial,orderId:order.id,requestKey:invoice.request_key,status,
  state:order.status==='paid'?'paid_pending_access':closed?'closed':'awaiting_payment',checkoutUrl:order.status==='paid'||closed?null:'/social/pagamento?pedido='+encodeURIComponent(order.id)};
}
async function pendingOrder(db,userId,product){
 if(!product)return null;
 const i=await db.from(UNIVERSITY_MONTHLY_TABLE).select('*').eq('user_id',userId).eq('status','pending').limit(1);
 if(i.error)throw fail('Não foi possível recuperar a mensalidade em andamento.');
 const invoice=(i.data||[]).find(row=>row.user_id===userId&&row.status==='pending');
 if(!invoice)return null;
 const binding=await ownerOrder(db,userId,invoice.order_id,product);
 return orderProjection(binding.invoice,binding.order);
}
async function rpc(db,name,args){
 const result=await db.rpc(name,args);
 if(result.error||!result.data||typeof result.data!=='object')throw fail('Não foi possível confirmar a mensalidade. Retome o mesmo pedido.');
 if(result.data.ok!==true){
  const messages={FUTURE_PAID_PERIOD:['Você já possui um período futuro pago. Confira as datas antes de contratar outra mensalidade.',409],UNIVERSITY_INCLUDED:['A Universidade já está incluída no seu plano atual.',409],PRODUCT_UNAVAILABLE:['A contratação mensal está temporariamente indisponível.',503],INVALID_CONSENT:['Confirme a mensalidade e seus termos.',400],PAYMENT_NOT_CONFIRMED:['A confirmação do pagamento ainda está em conferência.',503],ORDER_NOT_FOUND:['Mensalidade não encontrada.',404],ORDER_CLOSED:['Este pedido está encerrado.',409]};
  const [message,status]=messages[result.data.code]||['A mensalidade precisa de conferência.',503];
  throw Object.assign(fail(message,status,result.data.code||'UNIVERSITY_UNAVAILABLE'),{definitive:true});
 }
 return result.data;
}
async function input(request,action){
 const params=new URL(request.url).searchParams;
 if(action==='access'){
  if(request.method!=='GET'||params.size)throw fail('Solicitação inválida.',400,'INVALID_INPUT');return {};
 }
 if(action==='status'){
  if(request.method!=='GET'||params.size!==1||!uuid.test(params.get('orderId')||''))throw fail('Informe um pedido válido.',400,'INVALID_ORDER');
  return {orderId:params.get('orderId')};
 }
 if(action!=='checkout'||request.method!=='POST'||params.size)throw fail('Método não permitido.',405,'METHOD_NOT_ALLOWED');
 if(!/^application\/json(?:;|$)/i.test(request.headers.get('content-type')||''))throw fail('Use JSON nesta solicitação.',415,'INVALID_CONTENT_TYPE');
 let body;try{body=await readBoundedJson(request,2048);}catch{throw fail('Solicitação inválida.',400,'INVALID_INPUT');}
 const keys=['requestKey','acceptTerms','amountCents','currency','termsVersion'];
 if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(key=>!keys.includes(key))||!validKey(body.requestKey))throw fail('Solicitação inválida.',400,'INVALID_INPUT');
 if(body.acceptTerms!==true||body.amountCents!==4990||body.currency!=='BRL'||body.termsVersion!==UNIVERSITY_MONTHLY_TERMS)throw fail('Confirme a contratação mensal de R$ 49,90 em reais e os termos apresentados.',400,'CONSENT_REQUIRED');
 return body;
}
export async function handleUniversitySubscription(request,{action,db,env=process.env,authorize=requirePayUser,gateway=createGatewayCheckout,paymentStatus=pixStatus,pixClientFactory=createInterPixClient,now=Date.now()}={}){
 let orderId,requestKey,preparing=false;
 const respond=(body,status=200)=>Response.json({...body,serverTime:new Date(now).toISOString()},{status,headers:UNIVERSITY_HEADERS});
 try{
  const user=await authorize(request,db);if(!user?.id||user.is_anonymous)throw fail('Entre na sua conta JENIOS.',401,'AUTH_REQUIRED');
  const body=await input(request,action),product=await monthlyUniversityProduct(db);
  if(action==='access'){
   if(product)await claimVerifiedMonthlyUniversity(db,user.id,now,product);
   const access=await accessFor(db,user,now,env);
   const runtimeEnv=monthlyProductReady(product)?await universityInterEnv(db,env):null;
   const available=Boolean(runtimeEnv);
   const scheduled=access.active?null:await scheduledMonthlyUniversity(db,user.id,now,product);
   const canPurchase=available&&!access.included&&access.kind!=='purchased-pass'&&!scheduled;
   return respond({ok:true,offer:{...financial,name:'Universidade JENIOS',billingType:'monthly',renewalMode:'manual_pix',available},access,scheduled,canPurchase,canRenew:canPurchase&&access.kind==='university-monthly',order:await pendingOrder(db,user.id,product)});
  }
  if(action==='checkout'){
   requestKey=body.requestKey;
   const runtimeEnv=monthlyProductReady(product)?await universityInterEnv(db,env):null;
   if(!runtimeEnv)throw fail('A contratação mensal da Universidade está temporariamente indisponível.',503,'UNIVERSITY_PAYMENTS_UNAVAILABLE');
   await claimVerifiedMonthlyUniversity(db,user.id,now,product);
   const access=await accessFor(db,user,now,env);
   if(access.included)throw fail('A Universidade já está incluída no seu acesso atual.',409,'UNIVERSITY_INCLUDED');
   if(access.kind==='purchased-pass')throw fail('Você já possui um período educacional pago. A mensalidade poderá ser contratada após o vencimento.',409,'UNIVERSITY_ALREADY_ACTIVE');
   if(!access.active&&await scheduledMonthlyUniversity(db,user.id,now,product))throw fail('Você já possui um período futuro pago. Confira as datas antes de contratar outra mensalidade.',409,'FUTURE_PAID_PERIOD');
   preparing=true;
   const prepared=await rpc(db,UNIVERSITY_MONTHLY_RPC.prepare,{p_user_id:user.id,p_request_key:requestKey,p_terms_version:UNIVERSITY_MONTHLY_TERMS});
   let {invoice,order}=prepared;verifyBinding(invoice,order,user.id,product);orderId=order.id;requestKey=invoice.request_key;
   if(invoice.status==='pending'&&order.status==='pending'){
    const dispatchAccess=await accessFor(db,user,now,env);
    if(dispatchAccess.included)throw fail('A Universidade já está incluída no seu acesso atual. Este pedido foi preservado para conferência.',409,'UNIVERSITY_INCLUDED');
    if(!dispatchAccess.active&&await scheduledMonthlyUniversity(db,user.id,now,product))throw fail('Você já possui um período futuro pago. Este pedido foi preservado para conferência.',409,'FUTURE_PAID_PERIOD');
    // One Pix settles one calendar month. No automatic recurring instruction is
    // sent to the provider, whose existing adapter accepts one-time payments.
    const payment=await gateway({orderId:order.id,userId:user.id,productCode:UNIVERSITY_MONTHLY_PRODUCT,amount_cents:4990,currency:'BRL',billing_type:'one_time',scope:'social',target:{universityInvoiceId:invoice.id,termsVersion:UNIVERSITY_MONTHLY_TERMS}},{db,env:runtimeEnv});
    if(payment?.checkoutUrl!=='/social/pagamento?pedido='+encodeURIComponent(order.id))throw fail('Não foi possível confirmar o endereço do pagamento. Retome este pedido.',502,'PAYMENT_RESPONSE_INVALID');
    const updated=await db.from('jenios_pay_orders').update({status:'awaiting_payment',updated_at:new Date(now).toISOString()}).eq('id',order.id).eq('user_id',user.id).eq('status','pending').select('*').maybeSingle();
    if(updated.error)throw fail('O pedido foi preservado. Consulte novamente antes de pagar.',503,'ORDER_UPDATE_UNCONFIRMED');
    ({invoice,order}=await ownerOrder(db,user.id,order.id,product));
   }
   if(order.status!=='paid')return respond({ok:true,...orderProjection(invoice,order),replayed:prepared.replayed===true,access});
   // A retry of an already-paid request goes through the same receipt checks as status.
   body.orderId=order.id;
  }
  const binding=await ownerOrder(db,user.id,body.orderId,product);orderId=binding.order.id;requestKey=binding.invoice.request_key;
  let {invoice,order}=binding;
  if(['cancelled','expired','refunded'].includes(order.status))return respond({ok:true,...orderProjection(invoice,order),state:'closed',access:await accessFor(db,user,now,env)});
  if(order.status!=='paid'){
   const runtimeEnv=await universityInterEnv(db,env,'read');
   if(!runtimeEnv)throw fail('A consulta do Pix está temporariamente indisponível. O pedido foi preservado.',503,'UNIVERSITY_PAYMENTS_UNAVAILABLE');
   const payment=await paymentStatus({db,user,id:order.id,env:runtimeEnv,client:pixClientFactory({env:runtimeEnv})});
   if((payment?.orderId||payment?.id)!==order.id||payment.amount_cents!==4990||payment.currency!=='BRL'||!['pending','awaiting_payment','paid','cancelled','expired','refunded'].includes(payment.status))throw fail('O retorno do banco precisa de conferência.',503,'PAYMENT_RESPONSE_INVALID');
   if(payment.status!=='paid'){
    const closed=['cancelled','expired','refunded'].includes(payment.status);
    if(closed){const saved=await db.from(UNIVERSITY_MONTHLY_TABLE).update({status:'closed',closed_status:payment.status,updated_at:new Date(now).toISOString()}).eq('id',invoice.id).eq('user_id',user.id).eq('status','pending');if(saved.error)throw fail('O encerramento da mensalidade está em conferência.');}
    return respond({ok:true,...financial,orderId,requestKey,status:payment.status,state:closed?'closed':'awaiting_payment',checkoutUrl:closed?null:'/social/pagamento?pedido='+encodeURIComponent(orderId),...(payment.pixCode?{pixCode:payment.pixCode,expiresAt:payment.expiresAt}:{}),access:await accessFor(db,user,now,env)});
   }
  }
  try{
   await rpc(db,UNIVERSITY_MONTHLY_RPC.confirm,{p_user_id:user.id,p_order_id:orderId});
   const access=await accessFor(db,user,now,env);
   const scheduled=access.active?null:await scheduledMonthlyUniversity(db,user.id,now,product,orderId);
   return respond({ok:true,...financial,orderId,requestKey,status:'paid',state:access.active?'active':scheduled?'scheduled':'closed',checkoutUrl:null,access,scheduled});
  }catch{return respond({ok:false,...financial,orderId,requestKey,status:'paid',state:'paid_pending_access',checkoutUrl:null,code:'ACCESS_PENDING',error:'O pagamento foi recebido e a liberação da Universidade está em conferência. Consulte este pedido novamente, sem pagar outra vez.'},202);}
 }catch(error){
  const status=[400,401,403,404,405,409,413,415,422,429,502,503].includes(error.status)?error.status:503;
  return respond({ok:false,...financial,state:orderId?'order_preserved':preparing?'order_unconfirmed':'not_started',code:error.code||'UNIVERSITY_UNAVAILABLE',error:error.status?error.message:'Não foi possível concluir a solicitação da Universidade.',...(orderId?{orderId}:{}),...(requestKey?{requestKey}:{}),...(preparing&&!error.definitive?{retrySameOrder:true}:{})},status);
 }
}
