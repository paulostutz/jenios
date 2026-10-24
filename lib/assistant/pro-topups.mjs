/** B146 — private Pro top-ups. Every financial write requires the server gates.
 * No proposed package, user-supplied FX or generic PAY price can authorize a sale.
 * Existing PAY/Pix transport is reused without changing its behavior.
 */
import {requirePayUser} from '../pay/auth.mjs';
import {createGatewayCheckout} from '../pay/gateway.mjs';
import {interPixConfigured,createInterPixClient} from '../pay/inter-pix.mjs';
import {pixStatus} from '../pay/pix-status.mjs';
import {readBoundedJson} from '../platform/bounded-response.mjs';
import {PRO_PRICING_VERSION} from './pro-pricing.mjs';
import {PRO_WALLET_TABLES,PRO_WALLET_RPC,proWalletConfig,approvedProTopupQuote,ledgerInteger} from './pro-wallet-contract.mjs';
import {verifiedPlatformPlan} from './pro-access.mjs';
import {proEligibleSubscription} from './pro-quota-policy.mjs';

export const PRO_TOPUP_PRODUCT='social-ai-pro-credits';
export const PRO_TOPUP_HEADERS=Object.freeze({'Cache-Control':'private, no-store','Vary':'Authorization','X-Content-Type-Options':'nosniff'});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const requestKey=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{16,100}$/.test(value);
const fail=(message,status=503,code='PRO_TOPUP_UNAVAILABLE')=>Object.assign(Error(message),{status,code});
const unavailable=()=>fail('A compra de créditos Pro ainda não está habilitada. O atendimento gratuito continua disponível.',503,'PRO_PAYMENTS_DISABLED');
const productReady=product=>product?.code===PRO_TOPUP_PRODUCT&&product.active===true&&product.category==='other'&&product.currency==='BRL'&&product.billing_type==='one_time';

export function assertProTopupEnvironment(env=process.env){
 if(env.JENIOS_PRO_PAYMENTS_ENABLED!=='true')throw unavailable();
 if(!interPixConfigured(env))throw fail('O pagamento de créditos Pro está temporariamente indisponível.',503,'PRO_PAYMENT_PROVIDER_UNAVAILABLE');
}
export function proTopupsRuntimeReady(config,product,env=process.env){
 return env.JENIOS_PRO_PAYMENTS_ENABLED==='true'&&interPixConfigured(env)&&config?.topupsEnabled===true&&config.pricingVersion===PRO_PRICING_VERSION&&productReady(product);
}
/** Read-only availability for the authenticated Pro access screen. */
export async function proTopupAvailability(db,config,env=process.env){
 const blocked={enabled:false,baseCurrency:null,baseAmountMinor:null,termsVersion:null,settlementCurrency:null,quoteRequired:true};
 if(env.JENIOS_PRO_PAYMENTS_ENABLED!=='true'||!interPixConfigured(env)||config?.topupsEnabled!==true)return blocked;
 const {data:product,error}=await db.from('jenios_pay_products').select('*').eq('code',PRO_TOPUP_PRODUCT).maybeSingle();
 if(error||!proTopupsRuntimeReady(config,product,env))return blocked;
 return {enabled:true,baseCurrency:config.topup.baseCurrency,baseAmountMinor:config.topup.amountMinor,termsVersion:config.topup.termsVersion,settlementCurrency:'BRL',quoteRequired:true};
}
async function readiness(db,env,now){
 assertProTopupEnvironment(env);
 const {data:row,error}=await db.from(PRO_WALLET_TABLES.config).select('*').eq('id',true).maybeSingle();
 if(error)throw unavailable();
 const config=proWalletConfig(row,now);
 if(config.topupsEnabled!==true)throw unavailable();
 const {data:product,error:productError}=await db.from('jenios_pay_products').select('*').eq('code',PRO_TOPUP_PRODUCT).maybeSingle();
 if(productError||!proTopupsRuntimeReady(config,product,env))throw unavailable();
 return {config,product};
}

// Banco Central primary API specification:
// https://www.bcb.gov.br/conteudo/dadosabertos/BCBDepin/gnastportal-dados-abertostaxas-de-cambio---todos-os-boletins-diarios.pdf
// Fixed official origin/path and server-generated OData parameters. No URL, rate,
// currency or date from the caller is passed to this adapter. Redirects are denied.
const PTAX_ENDPOINT='https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoMoedaPeriodo(moeda=@moeda,dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)';
const dateParameter=millis=>{const d=new Date(millis);return `'${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}-${d.getUTCFullYear()}'`;};
function ptaxTime(value){
 // The official dataHoraCotacao is local Brasília time. Quotes supported here
 // are from 2020 onward, when Brasília is UTC-03:00 without seasonal changes.
 const match=typeof value==='string'&&value.match(/^(20[2-9][0-9])-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?$/);
 if(!match)throw fail('Horário da PTAX inválido.',503,'FX_UNAVAILABLE');
 const [year,month,day,hour,minute,second]=match.slice(1,7).map(Number);
 const ms=Number((match[7]||'').padEnd(3,'0').slice(0,3));
 const local=Date.UTC(year,month-1,day,hour,minute,second,ms),check=new Date(local);
 if(check.getUTCFullYear()!==year||check.getUTCMonth()!==month-1||check.getUTCDate()!==day||check.getUTCHours()!==hour||check.getUTCMinutes()!==minute||check.getUTCSeconds()!==second)throw fail('Horário da PTAX inválido.',503,'FX_UNAVAILABLE');
 return new Date(local+3*3600_000).toISOString();
}
export async function loadOfficialProFx({now=Date.now(),fetchImpl=fetch}={}){
 if(!Number.isFinite(now))throw fail('Data de cotação inválida.',503,'FX_UNAVAILABLE');
 const url=new URL(PTAX_ENDPOINT);
 for(const [key,value] of Object.entries({'@moeda':"'USD'",'@dataInicial':dateParameter(now-4*86400_000),'@dataFinalCotacao':dateParameter(now),'$filter':"tipoBoletim eq 'Fechamento'",'$orderby':'dataHoraCotacao desc','$top':'1','$select':'cotacaoVenda,dataHoraCotacao,tipoBoletim','$format':'json'}))url.searchParams.set(key,value);
 // Olinda's OData parser requires percent-encoded spaces; form-style '+'
 // produces a Boolean/String type error for this otherwise valid filter.
 const endpoint=url.toString().replace(/\+/g,'%20');
 try{
  const response=await fetchImpl(endpoint,{method:'GET',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(8000),headers:{accept:'application/json'}});
  if(!response.ok||response.redirected)throw fail('PTAX indisponível.',503,'FX_UNAVAILABLE');
  const payload=await readBoundedJson(response,16384),row=payload?.value?.[0];
  if(!Array.isArray(payload?.value)||payload.value.length!==1||row?.tipoBoletim!=='Fechamento')throw fail('PTAX de fechamento indisponível.',503,'FX_UNAVAILABLE');
  const decimal=String(row.cotacaoVenda),parts=decimal.match(/^(\d{1,3})(?:\.(\d{1,6}))?$/);
  if(!parts)throw fail('PTAX inválida.',503,'FX_UNAVAILABLE');
  const brlMicrosPerUsd=ledgerInteger(Number(BigInt(parts[1])*1_000_000n+BigInt((parts[2]||'').padEnd(6,'0'))),{min:1_000_000,max:100_000_000});
  const sourceAt=ptaxTime(row.dataHoraCotacao),at=Date.parse(sourceAt);
  if(at>now||now-at>72*3600_000)throw fail('PTAX vencida ou ainda não publicada.',503,'FX_UNAVAILABLE');
  return Object.freeze({brlMicrosPerUsd,source:'BCB:PTAX_USD_VENDA',sourceAt});
 }catch{throw fail('Não foi possível verificar o câmbio oficial. Nenhum pedido foi aberto; tente novamente mais tarde.',503,'FX_UNAVAILABLE');}
}

export function projectProTopupQuote(row,userId,now=Date.now(),{allowExpired=false}={}){
 if(!row||row.user_id!==userId||!uuid.test(row.id||''))throw fail('Cotação não encontrada.',404,'QUOTE_NOT_FOUND');
 const created=Date.parse(row.created_at),expires=Date.parse(row.expires_at);
 if(row.currency!=='BRL'||!Number.isFinite(created)||created>now+5000||!Number.isFinite(expires)||expires<=created||expires-created>901000||typeof row.pricing_version!=='string'||row.pricing_version.length<3||row.pricing_version.length>100)throw fail('Não foi possível conferir a cotação.',503,'QUOTE_INVALID');
 let expected;
 try{expected=approvedProTopupQuote({enabled:true,baseCurrency:row.base_currency,amountMinor:row.base_amount_minor,termsVersion:row.terms_version},{brlMicrosPerUsd:row.fx_brl_micros_per_usd,source:row.rate_source,sourceAt:row.rate_at},created);}
 catch{throw fail('Não foi possível conferir a cotação.',503,'QUOTE_INVALID');}
 if(ledgerInteger(row.amount_cents,{min:1,max:100_000_000})!==expected.amountCents||ledgerInteger(row.retail_nano_usd,{min:1})!==expected.retailNanoUsd)throw fail('Não foi possível conferir o valor da cotação.',503,'QUOTE_INVALID');
 if(!allowExpired&&expires<=now)throw fail('A cotação venceu. Solicite uma nova cotação antes de confirmar.',409,'QUOTE_EXPIRED');
 return {id:row.id,productCode:PRO_TOPUP_PRODUCT,currency:'BRL',amountCents:expected.amountCents,retailNanoUsd:expected.retailNanoUsd,baseCurrency:expected.baseCurrency,baseAmountMinor:expected.baseAmountMinor,termsVersion:expected.termsVersion,fxBrlMicrosPerUsd:expected.fxBrlMicrosPerUsd,rateSource:expected.rateSource,rateAt:expected.rateAt,createdAt:new Date(created).toISOString(),expiresAt:new Date(expires).toISOString(),pricingVersion:row.pricing_version};
}
async function quoteBy(db,userId,column,value){
 const {data,error}=await db.from(PRO_WALLET_TABLES.quotes).select('*').eq('user_id',userId).eq(column,value).maybeSingle();
 if(error)throw fail('Não foi possível consultar a cotação. Tente novamente com a mesma solicitação.');
 return data;
}
async function rpc(db,name,args){
 const {data,error}=await db.rpc(name,args);
 if(error||!data||typeof data!=='object')throw fail('Não foi possível confirmar a operação. Retome a mesma solicitação.');
 if(data.ok!==true){
  const messages={QUOTE_NOT_FOUND:['Cotação não encontrada.',404],QUOTE_EXPIRED:['A cotação venceu. Solicite uma nova cotação.',409],IDEMPOTENCY_CONFLICT:['Este identificador já pertence a outra solicitação. Retome o pedido original.',409],ORDER_CLOSED:['Este pedido está encerrado.',409],PRODUCT_UNAVAILABLE:['A compra de créditos Pro ainda não está disponível.',503],PAYMENTS_NOT_APPROVED:['A compra de créditos Pro ainda não foi habilitada.',503]};
  const [message,status]=messages[data.code]||['A operação precisa de conferência. Nenhum crédito foi confirmado.',503];
  throw Object.assign(fail(message,status,/^[A-Z_]{3,60}$/.test(data.code||'')?data.code:'PRO_TOPUP_UNAVAILABLE'),{definitive:true});
 }
 return data;
}
function verifyOrder(order,quote,userId,product,expectedKey){
 let meta;try{meta=JSON.parse(order?.external_reference||'null');}catch{}
 if(!order||!uuid.test(order.id||'')||order.user_id!==userId||order.product_id!==product.id||order.provider!=='inter_pix'||order.currency!=='BRL'||ledgerInteger(order.amount_cents,{min:1,max:100_000_000})!==quote.amountCents||meta?.productCode!==PRO_TOPUP_PRODUCT||meta?.scope!=='social'||meta?.proQuoteId!==quote.id||meta?.fingerprint!=='pro:'+quote.id||!['pending','awaiting_payment','paid','cancelled','expired','refunded'].includes(order.status)||(expectedKey&&order.idempotency_key!=='pro:'+userId+':'+expectedKey))throw fail('O pedido não corresponde à cotação confirmada.',503,'ORDER_QUOTE_MISMATCH');
}
async function readOwnerOrder(db,userId,id){
 const {data,error}=await db.from('jenios_pay_orders').select('*').eq('id',id).eq('user_id',userId).maybeSingle();
 if(error)throw fail('Não foi possível conferir o pedido.');
 if(!data)throw fail('Pedido não encontrado.',404,'ORDER_NOT_FOUND');
 return data;
}
async function readInput(request,action){
 if(action==='status'){
  if(request.method!=='GET')throw fail('Método não permitido.',405,'METHOD_NOT_ALLOWED');
  const params=new URL(request.url).searchParams;
  if(params.size===1&&uuid.test(params.get('orderId')||''))return {orderId:params.get('orderId')};
  if(params.size===2&&uuid.test(params.get('quoteId')||'')&&requestKey(params.get('requestKey')))
   return {quoteId:params.get('quoteId'),requestKey:params.get('requestKey')};
  throw fail('Informe um pedido válido ou a referência original da sua compra.',400,'INVALID_ORDER');
 }
 if(!['quote','checkout'].includes(action)||request.method!=='POST')throw fail('Método não permitido.',405,'METHOD_NOT_ALLOWED');
 if(!/^application\/json(?:;|$)/i.test(request.headers.get('content-type')||''))throw fail('Use JSON nesta solicitação.',415,'INVALID_CONTENT_TYPE');
 let body;try{body=await readBoundedJson(request,4096);}catch{throw fail('Solicitação inválida ou acima do limite.',400,'INVALID_INPUT');}
 const allowed=action==='quote'?['requestKey']:['quoteId','requestKey','acceptTerms','amountCents','currency','termsVersion'];
 if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(key=>!allowed.includes(key))||!requestKey(body.requestKey))throw fail('Solicitação inválida. Valores e câmbio são definidos pelo servidor.',400,'INVALID_INPUT');
 if(action==='checkout'&&(!uuid.test(body.quoteId||'')||body.acceptTerms!==true||!Number.isSafeInteger(body.amountCents)||body.amountCents<1||body.currency!=='BRL'||typeof body.termsVersion!=='string'||body.termsVersion.length>100))throw fail('Confirme o valor, a moeda e os termos desta cotação.',400,'CONSENT_REQUIRED');
 return body;
}

export async function handleProTopups(request,{action,db,env=process.env,authorize=requirePayUser,planResolver=verifiedPlatformPlan,fxLoader=loadOfficialProFx,gateway=createGatewayCheckout,paymentStatus=pixStatus,pixClientFactory=createInterPixClient,now=Date.now()}={}){
 let orderId,quoteId,key,preparing=false,resolvingReference=false;
 const respond=(body,status=200)=>Response.json(body,{status,headers:PRO_TOPUP_HEADERS});
 try{
  // Disabled deployments never read the DB, contact the bank/BCB or create funds.
  assertProTopupEnvironment(env);
  const user=await authorize(request,db);
  if(!user?.id||user.is_anonymous)throw fail('Entre na sua conta JENIOS.',401,'AUTH_REQUIRED');
  const body=await readInput(request,action),{config,product}=await readiness(db,env,now);
  // Additional consumption remains tied to an eligible subscription. Reading
  // and reconciling an already-owned order stays available after its expiry.
  if(action!=='status'&&!proEligibleSubscription(await planResolver(db,user.id,now),now))
   throw fail('O adicional de IA exige um plano Global Crypto ou Internacional Pro vigente.',402,'ADVANCED_PLAN_REQUIRED');
  key=body.requestKey;
  resolvingReference=action==='status'&&!body.orderId;
  if(resolvingReference)quoteId=body.quoteId;
  if(action==='quote'){
   const previous=await quoteBy(db,user.id,'quote_key',key);
   if(previous)return respond({ok:true,quote:projectProTopupQuote(previous,user.id,now),replayed:true,credited:false});
   const fx=await fxLoader({now});
   approvedProTopupQuote({enabled:true,...config.topup},fx,now);
   let result;
   try{result=await rpc(db,PRO_WALLET_RPC.quote,{p_user_id:user.id,p_quote_key:key,p_fx_brl_micros_per_usd:fx.brlMicrosPerUsd,p_rate_source:fx.source,p_rate_at:fx.sourceAt});}
   catch(error){
    // A concurrent request (or a lost RPC response) may have committed the same
    // owner/key. Replay that immutable snapshot rather than issuing another one.
    const saved=await quoteBy(db,user.id,'quote_key',key);
    if(saved)return respond({ok:true,quote:projectProTopupQuote(saved,user.id,now),replayed:true,credited:false});
    throw error;
   }
   return respond({ok:true,quote:projectProTopupQuote(result.quote,user.id,now),replayed:result.replayed===true,credited:false});
  }
  if(action==='checkout'){
   quoteId=body.quoteId;
   const quote=projectProTopupQuote(await quoteBy(db,user.id,'id',quoteId),user.id,now,{allowExpired:true});
   if(body.amountCents!==quote.amountCents||body.currency!==quote.currency||body.termsVersion!==quote.termsVersion)throw fail('A confirmação não corresponde à cotação apresentada.',409,'CONSENT_MISMATCH');
   preparing=true;
   const prepared=await rpc(db,PRO_WALLET_RPC.prepareTopup,{p_user_id:user.id,p_quote_id:quote.id,p_order_key:key});
   const confirmedQuote=projectProTopupQuote(prepared.quote,user.id,now,{allowExpired:true});
   if(confirmedQuote.id!==quote.id||confirmedQuote.amountCents!==quote.amountCents||confirmedQuote.termsVersion!==quote.termsVersion)throw fail('A cotação do pedido precisa de conferência.',503,'QUOTE_INVALID');
   let order=prepared.order;verifyOrder(order,confirmedQuote,user.id,product,key);orderId=order.id;
   const checkoutUrl='/social/pagamento?pedido='+encodeURIComponent(order.id);
   if(order.status==='pending'){
    // A pause between preparation and bank dispatch preserves the bound order.
    await readiness(db,env,now);
    const payment=await gateway({orderId:order.id,userId:user.id,productCode:PRO_TOPUP_PRODUCT,amount_cents:quote.amountCents,currency:'BRL',billing_type:'one_time',scope:'social',target:{proQuoteId:quote.id}},{db,env});
    if(payment?.checkoutUrl!==checkoutUrl)throw fail('Não foi possível confirmar o endereço de pagamento. Retome o mesmo pedido.',502,'PAYMENT_RESPONSE_INVALID');
    const {data:updated,error}=await db.from('jenios_pay_orders').update({status:'awaiting_payment',updated_at:new Date(now).toISOString()}).eq('id',order.id).eq('user_id',user.id).eq('status','pending').select('*').maybeSingle();
    if(error)throw fail('O pedido foi preservado. Consulte novamente antes de pagar.',503,'ORDER_UPDATE_UNCONFIRMED');
    order=updated||await readOwnerOrder(db,user.id,order.id);
    verifyOrder(order,confirmedQuote,user.id,product,key);
   }
   const closed=['cancelled','expired','refunded'].includes(order.status);
   return respond({ok:true,orderId:order.id,quoteId:quote.id,requestKey:key,status:order.status,state:order.status==='paid'?'paid_pending_credit':closed?'closed':'awaiting_payment',checkoutUrl:order.status==='paid'||closed?null:checkoutUrl,credited:false,replayed:prepared.replayed===true});
  }
  let order,quote,binding;
  if(resolvingReference){
   // Recover only an existing immutable binding after a lost checkout reply.
   // This path cannot quote, prepare an order, fetch FX or create a bank charge.
   quote=projectProTopupQuote(await quoteBy(db,user.id,'id',body.quoteId),user.id,now,{allowExpired:true});
   const found=await db.from(PRO_WALLET_TABLES.quoteOrders).select('quote_id,order_id').eq('quote_id',quote.id).maybeSingle();
   if(found.error)throw fail('Não foi possível conferir a referência original. Preserve-a e consulte novamente.',503,'BOUND_QUOTE_REQUIRED');
   binding=found.data;
   if(!binding)throw fail('Nenhum pedido foi confirmado para esta referência. Ela foi preservada; consulte novamente antes de iniciar outra compra.',404,'ORDER_REFERENCE_NOT_FOUND');
   order=await readOwnerOrder(db,user.id,binding.order_id);
  }else{
   order=await readOwnerOrder(db,user.id,body.orderId);
   const found=await db.from(PRO_WALLET_TABLES.quoteOrders).select('quote_id,order_id').eq('order_id',order.id).maybeSingle();
   if(found.error||!found.data)throw fail('Não foi possível conferir a cotação deste pedido.',503,'BOUND_QUOTE_REQUIRED');
   binding=found.data;
   quote=projectProTopupQuote(await quoteBy(db,user.id,'id',binding.quote_id),user.id,now,{allowExpired:true});
  }
  if(binding.order_id!==order.id||binding.quote_id!==quote.id)throw fail('O pedido não corresponde à referência original.',503,'BOUND_QUOTE_REQUIRED');
  verifyOrder(order,quote,user.id,product,resolvingReference?key:undefined);
  orderId=order.id;quoteId=quote.id;
  const recoveredReference=resolvingReference?{requestKey:key,resolvedExistingOrder:true}:{};
  await readiness(db,env,now);
  const payment=await paymentStatus({db,user,id:order.id,env,client:pixClientFactory({env})});
  if((payment?.orderId||payment?.id)!==order.id||payment.currency!=='BRL'||payment.amount_cents!==quote.amountCents||!['pending','awaiting_payment','paid','cancelled','expired','refunded'].includes(payment.status))throw fail('O retorno do pagamento precisa de conferência.',503,'PAYMENT_RESPONSE_INVALID');
  if(payment.status!=='paid')return respond({ok:true,orderId:order.id,quoteId:quote.id,...recoveredReference,status:payment.status,state:['cancelled','expired','refunded'].includes(payment.status)?'closed':'awaiting_payment',credited:false,...(payment.pixCode?{pixCode:payment.pixCode,expiresAt:payment.expiresAt}:{})});
  // pixStatus reconciles only bank-verified receipts. Funding independently
  // checks the durable paid order + exact receipt + owner + immutable binding.
  try{
   await readiness(db,env,now);
   const funded=await rpc(db,PRO_WALLET_RPC.fund,{p_user_id:user.id,p_quote_id:quote.id,p_order_id:order.id});
   return respond({ok:true,orderId:order.id,quoteId:quote.id,...recoveredReference,status:'paid',state:'credited',credited:true,creditedNanoUsd:quote.retailNanoUsd,replayed:funded.replayed===true});
  }catch{return respond({ok:false,orderId:order.id,quoteId:quote.id,...recoveredReference,status:'paid',state:'paid_pending_credit',credited:false,code:'FUNDING_PENDING',error:'O pagamento e a liberação dos créditos estão em conferência. Consulte este pedido novamente, sem fazer outro pagamento.'},202);}
 }catch(error){
  const status=[400,401,402,403,404,405,409,413,415,422,429,502,503].includes(error.status)?error.status:503;
  const recoverable=preparing&&!error.definitive;
  return respond({ok:false,state:orderId?'order_preserved':recoverable||resolvingReference?'order_unconfirmed':'not_started',credited:false,error:error.status?error.message:'Não foi possível concluir a solicitação de créditos Pro.',code:error.code||'PRO_TOPUP_UNAVAILABLE',...(orderId?{orderId}:{}),...(quoteId?{quoteId}:{}),...(preparing||resolvingReference?{requestKey:key}:{}),...(resolvingReference?{referencePreserved:true,retrySameOrder:false}:recoverable?{retrySameOrder:true}:{})},status);
 }
}
