/** G47: manual monthly billing. Both identities are verified by their own Auth
 * provider; bank receipts, never browser state, grant paid access. */
import {requirePayUser} from '../pay/auth.mjs';
import {readPlatformJson} from './request-limit.mjs';
import {interPixConfigured,createInterPixClient,verifyPixCharge,pixTxid} from '../pay/inter-pix.mjs';
import {pixStatus} from '../pay/pix-status.mjs';

import {PLATFORM_MONTHLY_TERMS} from './monthly-billing-contract.mjs';
export {PLATFORM_MONTHLY_TERMS};
export const PLATFORM_MONTHLY_CODES=Object.freeze(['platform-nacional','platform-global-crypto','platform-internacional-pro']);
export const BILLING_HEADERS=Object.freeze({'Cache-Control':'private, no-store','Vary':'Authorization, X-Platform-Authorization','X-Content-Type-Options':'nosniff'});
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
const key=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{16,100}$/.test(x);
const fail=(message,status=503,code='BILLING_UNAVAILABLE')=>Object.assign(Error(message),{status,code});
const messages={PAYMENTS_PAUSED:'A cobrança mensal está em homologação.',LINK_REQUIRED:'Confirme o vínculo com sua conta da Platform.',LINK_CONFLICT:'Uma dessas contas já possui outro vínculo. Procure o atendimento.',
 ACTIVE_PERIOD:'Seu mês já está pago. A renovação fica disponível no vencimento.',PRICE_CHANGED:'O preço mudou. Atualize a página e confira o valor antes de continuar.',
 IDEMPOTENCY_CONFLICT:'Este pedido já foi usado com outras condições. Retome o pedido existente.',PENDING_ORDER_EXISTS:'Há um Pix em andamento. Consulte o mesmo pedido antes de trocar de plano.',
 PAID_REVIEW_REQUIRED:'O pagamento foi recebido e precisa de conferência. Não faça outro pagamento.'};
async function rpc(db,name,args){
 const result=await db.rpc(name,args);
 if(result.error||!result.data)throw fail('Não foi possível confirmar a operação. Retome o mesmo pedido.');
 if(result.data.ok!==true)throw fail(messages[result.data.code]||'Não foi possível validar as condições.',409,result.data.code);
 return result.data;
}
export async function billingIdentities(request,{db,platformDb,both=false,authorize=requirePayUser}){
 const user=await authorize(request,db);
 if(!uuid(user?.id)||user.is_anonymous)throw fail('Entre na sua conta JENIOS.',401,'AUTH_REQUIRED');
 let platform=null;
 if(both){
  const token=request.headers.get('x-platform-authorization');
  if(!/^Bearer [^\s]+$/i.test(token||''))throw fail('Entre também no acesso da Platform para confirmar o vínculo.',401,'PLATFORM_AUTH_REQUIRED');
  platform=await authorize(new Request(request.url,{headers:{authorization:token}}),platformDb);
  if(!uuid(platform?.id)||platform.is_anonymous)throw fail('Confirme seu acesso da Platform.',401,'PLATFORM_AUTH_REQUIRED');
 }
 return {user,platform};
}
export function verifyMonthlyBinding(invoice,order,userId,link){
 let meta;try{meta=JSON.parse(order?.external_reference||'null');}catch{}
 if(!invoice||!order||!uuid(order.id)||invoice.user_id!==userId||order.user_id!==userId||link?.user_id!==userId||invoice.link_id!==link.id
 ||invoice.order_id!==order.id||invoice.product_id!==order.product_id||!PLATFORM_MONTHLY_CODES.includes(invoice.product_code)
 ||!Number.isSafeInteger(invoice.amount_cents)||invoice.amount_cents<1||invoice.amount_cents>100000000||order.amount_cents!==invoice.amount_cents
 ||invoice.currency!=='BRL'||order.currency!=='BRL'||order.provider!=='inter_pix'||invoice.terms_version!==PLATFORM_MONTHLY_TERMS
 ||!key(invoice.request_key)||order.idempotency_key!=='platform:'+userId+':'+invoice.request_key
 ||meta?.scope!=='platform'||meta?.linkId!==link.id||meta?.productCode!==invoice.product_code||meta?.termsVersion!==PLATFORM_MONTHLY_TERMS
 ||meta?.billingType!=='monthly'||meta?.renewalMode!=='manual_pix'||meta?.fingerprint!==order.idempotency_key)
 throw fail('O vínculo da mensalidade precisa de conferência.',503,'ORDER_MISMATCH');
 return true;
}
async function ownerOrder(db,userId,id,link){
 const [i,o]=await Promise.all([
  db.from('jenios_platform_invoices_g47').select('*').eq('user_id',userId).eq('order_id',id).maybeSingle(),
  db.from('jenios_pay_orders').select('*').eq('user_id',userId).eq('id',id).maybeSingle()
 ]);
 if(i.error||o.error)throw fail('Não foi possível consultar a mensalidade.');
 if(!i.data||!o.data)throw fail('Mensalidade não encontrada.',404,'ORDER_NOT_FOUND');
 verifyMonthlyBinding(i.data,o.data,userId,link);return {invoice:i.data,order:o.data};
}
const projectOrder=(invoice,order)=>({orderId:order.id,requestKey:invoice.request_key,productCode:invoice.product_code,amountCents:invoice.amount_cents,
 currency:'BRL',status:invoice.status==='review'?'paid_pending_access':order.status,closed:invoice.status==='closed',termsVersion:invoice.terms_version});
export async function platformMonthlyState(db,userId,{env=process.env,now=Date.now()}={}){
 const [c,p,l,i]=await Promise.all([
  db.from('jenios_platform_billing_config_g47').select('payments_enabled,terms_version').eq('singleton',true).maybeSingle(),
  db.from('jenios_pay_products').select('id,code,name,category,description,price_cents,currency,billing_type,active').in('code',PLATFORM_MONTHLY_CODES),
  db.from('jenios_platform_payers_g47').select('*').eq('user_id',userId).maybeSingle(),
  db.from('jenios_platform_invoices_g47').select('*').eq('user_id',userId).order('created_at',{ascending:false}).limit(50)
 ]);
 if(c.error||p.error||l.error||i.error)throw fail('Não foi possível conferir a assinatura agora.');
 const available=c.data?.payments_enabled===true&&c.data.terms_version===PLATFORM_MONTHLY_TERMS&&env.JENIOS_PAY_PAYMENTS_ENABLED==='true'&&interPixConfigured(env);
 const invoices=i.data||[],link=l.data;let access=null,pending=null,review=false;
 for(const invoice of invoices){
  if(invoice.status==='review')review=true;
  if(invoice.status==='pending'){
   const bound=await ownerOrder(db,userId,invoice.order_id,link);pending=projectOrder(bound.invoice,bound.order);
  }
  if(invoice.status!=='active'||Date.parse(invoice.period_start)>now||Date.parse(invoice.period_end)<=now)continue;
  const bound=await ownerOrder(db,userId,invoice.order_id,link);
  const [receipt,sub]=await Promise.all([
   db.from('jenios_pay_payments').select('*').eq('id',invoice.receipt_id).eq('order_id',invoice.order_id).maybeSingle(),
   db.from('jenios_pay_subscriptions').select('*').eq('id',invoice.subscription_id).eq('user_id',userId).maybeSingle()
  ]);
  if(receipt.error||sub.error)throw fail('Não foi possível conferir o comprovante.');
  const r=receipt.data,s=sub.data;
  if(bound.order.status==='paid'&&r?.status==='confirmed'&&r.provider==='inter_pix'&&r.payment_method==='pix'&&r.amount_cents===invoice.amount_cents
   &&r.provider_payment_id===pixTxid(invoice.order_id)&&Date.parse(r.confirmed_at)===Date.parse(invoice.paid_at)
   &&s?.status==='active'&&s.latest_order_id===invoice.order_id&&s.product_id===invoice.product_id
   &&Date.parse(s.current_period_start)===Date.parse(invoice.period_start)&&Date.parse(s.current_period_end)===Date.parse(invoice.period_end))
   access={active:true,productCode:invoice.product_code,startsAt:invoice.period_start,validUntil:invoice.period_end,cancelAtPeriodEnd:s.cancel_at_period_end};
 }
 return {ok:true,available,linked:Boolean(link),link,termsVersion:PLATFORM_MONTHLY_TERMS,renewalMode:'manual_pix',renewalOpens:'at_expiry',
 products:p.data||[],access,pending,review,canPurchase:available&&Boolean(link)&&!access&&!review};
}
async function readInput(request,action){
 const params=new URL(request.url).searchParams;
 if(action==='access'){if(request.method!=='GET'||params.size)throw fail('Solicitação inválida.',400);return {};}
 if(action==='status'){
  if(request.method!=='GET'||params.size!==1||!uuid(params.get('orderId')))throw fail('Pedido inválido.',400);
  return {orderId:params.get('orderId')};
 }
 if(request.method!=='POST'||params.size)throw fail('Método não permitido.',405);
 const b=await readPlatformJson(request);
 const allowed=action==='link'?['acceptLink']:action==='reminders'?['cancelAtPeriodEnd']:['productCode','amountCents','currency','termsVersion','acceptTerms','requestKey'];
 if(!b||typeof b!=='object'||Array.isArray(b)||Object.keys(b).some(k=>!allowed.includes(k)))throw fail('Solicitação inválida.',400);
 if(action==='link'&&b.acceptLink!==true)throw fail('Confirme as duas contas que deseja vincular.',400,'CONSENT_REQUIRED');
 if(action==='reminders'&&typeof b.cancelAtPeriodEnd!=='boolean')throw fail('Preferência inválida.',400);
 if(action==='checkout'&&(!PLATFORM_MONTHLY_CODES.includes(b.productCode)||!Number.isSafeInteger(b.amountCents)||b.amountCents<1||b.currency!=='BRL'
 ||b.termsVersion!==PLATFORM_MONTHLY_TERMS||b.acceptTerms!==true||!key(b.requestKey)))throw fail('Confirme o preço em reais e a renovação manual.',400,'CONSENT_REQUIRED');
 return b;
}
export async function handlePlatformMonthly(request,{action,db,platformDb,env=process.env,authorize=requirePayUser,clientFactory=createInterPixClient,paymentStatus=pixStatus}={}){
 let orderId,requestKey;
 const respond=(body,status=200)=>Response.json(body,{status,headers:BILLING_HEADERS});
 try{
  if(!['access','link','checkout','status','reminders'].includes(action))throw fail('Operação inválida.',400);
  const {user,platform}=await billingIdentities(request,{db,platformDb,both:action==='link'||action==='checkout',authorize});
  const body=await readInput(request,action);
  if(action==='link')return respond({ok:true,linked:Boolean((await rpc(db,'jenios_platform_link_g47',{p_user_id:user.id,p_platform_user_id:platform.id})).link)});
  const state=await platformMonthlyState(db,user.id,{env});
  if(action==='access'){const {link,...publicState}=state;return respond(publicState);}
  if(!state.linked)throw fail(messages.LINK_REQUIRED,409,'LINK_REQUIRED');
  if(action==='reminders'){
   // Manual billing never debits automatically. Stop renewal reminders while
   // preserving the already-paid month; the existing dunning worker honors it.
   const ids=await db.from('jenios_platform_invoices_g47').select('subscription_id').eq('user_id',user.id).limit(50);
   if(ids.error)throw fail('Não foi possível conferir a assinatura.');
   const subscriptions=[...new Set((ids.data||[]).map(i=>i.subscription_id))];
   if(subscriptions.length){const result=await db.from('jenios_pay_subscriptions').update({cancel_at_period_end:body.cancelAtPeriodEnd,updated_at:new Date().toISOString()}).eq('user_id',user.id).in('id',subscriptions);if(result.error)throw fail('Não foi possível salvar a preferência.');}
   return respond({ok:true,cancelAtPeriodEnd:body.cancelAtPeriodEnd});
  }
  if(action==='checkout'){
   requestKey=body.requestKey;
   if(!state.available)throw fail(messages.PAYMENTS_PAUSED,503,'PAYMENTS_PAUSED');
   if(state.link.platform_user_id!==platform.id)throw fail(messages.LINK_CONFLICT,403,'LINK_CONFLICT');
   const prepared=await rpc(db,'jenios_platform_prepare_g47',{p_user_id:user.id,p_platform_user_id:platform.id,p_product_code:body.productCode,p_amount:body.amountCents,p_request_key:body.requestKey,p_terms:body.termsVersion});
   const {invoice,order}=prepared;verifyMonthlyBinding(invoice,order,user.id,state.link);orderId=order.id;requestKey=invoice.request_key;
   if(invoice.status==='pending'&&order.status==='pending'){
    const txid=pixTxid(orderId);
    const saved=await db.from('jenios_pay_payments').upsert({order_id:orderId,provider:'inter_pix',provider_payment_id:txid,payment_method:'pix',amount_cents:invoice.amount_cents,status:'pending'},{onConflict:'provider,provider_payment_id',ignoreDuplicates:true});
    if(saved.error)throw fail('O pedido foi preservado. Consulte novamente.');
    const charge=await clientFactory({env}).create({orderId,amount_cents:invoice.amount_cents,currency:'BRL'});
    verifyPixCharge(charge,order,{env});
    const updated=await db.from('jenios_pay_orders').update({status:'awaiting_payment',updated_at:new Date().toISOString()}).eq('id',orderId).eq('user_id',user.id).eq('status','pending');
    if(updated.error)throw fail('O pedido foi preservado. Consulte novamente.');
   }
   return respond({ok:true,...projectOrder(invoice,order),replayed:prepared.replayed});
  }
  orderId=body.orderId;
  const binding=await ownerOrder(db,user.id,orderId,state.link);requestKey=binding.invoice.request_key;
  if(binding.invoice.status==='review')return respond({ok:false,...projectOrder(binding.invoice,binding.order),code:'PAID_REVIEW_REQUIRED',error:messages.PAID_REVIEW_REQUIRED},202);
  const payment=await paymentStatus({db,user,id:orderId,env,client:clientFactory({env})});
  if(payment.orderId!==orderId||payment.amount_cents!==binding.invoice.amount_cents||payment.currency!=='BRL')throw fail('Retorno do pagamento inválido.');
  if(['expired','cancelled'].includes(payment.status)){
   const closed=await db.from('jenios_platform_invoices_g47').update({status:'closed'}).eq('order_id',orderId).eq('user_id',user.id).eq('status','pending');
   if(closed.error)throw fail('Não foi possível confirmar o encerramento do Pix.');
  }
  const {link,...latest}=await platformMonthlyState(db,user.id,{env});
  return respond({ok:true,...projectOrder(binding.invoice,binding.order),status:payment.status,
   ...(payment.pixCode?{pixCode:payment.pixCode,expiresAt:payment.expiresAt}:{}),access:latest.access,review:latest.review});
 }catch(e){return respond({ok:false,code:e.code||'BILLING_UNAVAILABLE',error:e.status?e.message:'Não foi possível conferir a mensalidade.',
  ...(orderId?{orderId}:{}),...(requestKey?{requestKey,retrySameOrder:true}:{})},[400,401,403,404,405,409,413,415,429,502,503].includes(e.status)?e.status:503);}
}
