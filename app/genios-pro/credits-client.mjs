/** Presentation checks only; the server authorizes every quote, order and credit. */
import {nanoAmount} from './pro-client.mjs';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const integer=(value,min,max)=>Number.isSafeInteger(value)&&value>=min&&value<=max;
const knownStatuses=new Set(['pending','awaiting_payment','paid','cancelled','expired','refunded']);
export function creditOfferReady(offer){
 return offer?.enabled===true&&['USD','BRL'].includes(offer.baseCurrency)&&integer(offer.baseAmountMinor,1,10_000_000)&&
  typeof offer.termsVersion==='string'&&offer.termsVersion.length>=3&&offer.termsVersion.length<=100&&offer.settlementCurrency==='BRL'&&offer.quoteRequired===true;
}
export function formatBrlCents(value){
 if(!integer(value,0,100_000_000))return 'Valor não disponível';
 const number=BigInt(value),whole=(number/100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g,'.');
 return 'R$\u00a0'+whole+','+(number%100n).toString().padStart(2,'0');
}
export function formatFxMicros(value){
 if(!integer(value,1_000_000,100_000_000))return 'Cotação não disponível';
 const number=BigInt(value),fraction=(number%1_000_000n).toString().padStart(6,'0').replace(/0+$/,'').padEnd(2,'0');
 return 'R$\u00a0'+(number/1_000_000n).toString()+','+fraction;
}
export function validCreditQuote(quote,{offer,now=Date.now(),allowExpired=false}={}){
 if(!quote||!uuid.test(quote.id||'')||quote.currency!=='BRL'||!integer(quote.amountCents,1,100_000_000)||
  nanoAmount(quote.retailNanoUsd)===null||nanoAmount(quote.retailNanoUsd)<1||!['USD','BRL'].includes(quote.baseCurrency)||
  !integer(quote.baseAmountMinor,1,10_000_000)||typeof quote.termsVersion!=='string'||quote.termsVersion.length<3||quote.termsVersion.length>100||
  typeof quote.pricingVersion!=='string'||quote.pricingVersion.length<3||quote.pricingVersion.length>100||
  !integer(quote.fxBrlMicrosPerUsd,1_000_000,100_000_000)||quote.rateSource!=='BCB:PTAX_USD_VENDA')return false;
 const created=Date.parse(quote.createdAt),expires=Date.parse(quote.expiresAt),rate=Date.parse(quote.rateAt);
 if(!Number.isFinite(created)||!Number.isFinite(expires)||!Number.isFinite(rate)||created>now+5000||rate>created||created-rate>72*3600_000||expires<=created||expires-created>901000||!allowExpired&&expires<=now)return false;
 if(offer&&(!creditOfferReady(offer)||quote.baseCurrency!==offer.baseCurrency||quote.baseAmountMinor!==offer.baseAmountMinor||quote.termsVersion!==offer.termsVersion))return false;
 const base=BigInt(quote.baseAmountMinor),fx=BigInt(quote.fxBrlMicrosPerUsd);
 const expectedCredit=quote.baseCurrency==='USD'?base*10_000_000n:base*10_000_000_000_000n/fx;
 const expectedCents=quote.baseCurrency==='BRL'?base:(expectedCredit*fx+9_999_999_999_999n)/10_000_000_000_000n;
 return BigInt(quote.retailNanoUsd)===expectedCredit&&BigInt(quote.amountCents)===expectedCents;
}
export function safeCreditCheckoutUrl(value,orderId){
 if(!uuid.test(orderId||''))return null;
 const expected='/social/pagamento?pedido='+orderId;
 return value===expected?expected:null;
}
export function validCreditAttempt(value,now=Date.now()){
 // A device clock adjustment must not erase an already approved purchase
 // reference. Every resumed operation is still revalidated by the server.
 const created=Date.parse(value?.quote?.createdAt),referenceTime=Number.isFinite(created)?Math.max(now,created):now;
 return Boolean(value&&uuid.test(value.requestKey||'')&&validCreditQuote(value.quote,{now:referenceTime,allowExpired:true})&&
  (value.orderId===null||uuid.test(value.orderId||''))&&(value.statusOnly===undefined||typeof value.statusOnly==='boolean'));
}
export function creditAttemptStorageKey(userId){
 return typeof userId==='string'&&userId.length>0?'jenios:pro:credits:'+userId:null;
}
export function restoreCreditAttempt(saved,{userId,now=Date.now()}={}){
 if(!creditAttemptStorageKey(userId)||!validCreditAttempt(saved,now)||saved.ownerId!=null&&saved.ownerId!==userId)return null;
 return {requestKey:saved.requestKey,quote:saved.quote,orderId:saved.orderId,state:'restored',status:null,
  statusOnly:saved.statusOnly===true,retrySameOrder:!saved.orderId&&saved.statusOnly!==true,checkoutUrl:null,pixCode:null,pixExpiresAt:null};
}
/** Status lookup never opens an order, including when checkout lost its reply. */
export function creditStatusPath(attempt){
 if(uuid.test(attempt?.orderId||''))return 'status?orderId='+encodeURIComponent(attempt.orderId);
 if(attempt?.orderId!==null||!uuid.test(attempt?.quote?.id||'')||!uuid.test(attempt?.requestKey||''))return null;
 return 'status?quoteId='+encodeURIComponent(attempt.quote.id)+'&requestKey='+encodeURIComponent(attempt.requestKey);
}
export function projectCreditCheckout(result,attempt){
 if(result?.ok!==true||!uuid.test(result.orderId||'')||attempt?.orderId&&result.orderId!==attempt.orderId||result.quoteId!==attempt?.quote?.id||result.requestKey!==attempt.requestKey||
  !knownStatuses.has(result.status)||!['awaiting_payment','paid_pending_credit','closed'].includes(result.state)||result.credited!==false)return null;
 if(result.state==='paid_pending_credit'&&result.status!=='paid'||result.state==='closed'&&!['cancelled','expired','refunded'].includes(result.status)||result.state==='awaiting_payment'&&!['pending','awaiting_payment'].includes(result.status))return null;
 return {...attempt,orderId:result.orderId,status:result.status,state:result.state,retrySameOrder:false,
  checkoutUrl:result.state==='awaiting_payment'?safeCreditCheckoutUrl(result.checkoutUrl,result.orderId):null,pixCode:null,pixExpiresAt:null};
}
export function projectCreditStatus(result,attempt){
 if(!validCreditAttempt(attempt))return null;
 if(attempt.orderId===null&&result?.orderId==null&&result?.ok===false&&result.referencePreserved===true&&result.quoteId===attempt.quote.id&&result.requestKey===attempt.requestKey&&result.credited===false&&result.retrySameOrder===false&&result.state==='order_unconfirmed'&&['ORDER_REFERENCE_NOT_FOUND','QUOTE_NOT_FOUND'].includes(result.code)){
  return {...attempt,state:'order_unconfirmed',status:null,statusOnly:true,code:result.code,retrySameOrder:false,pixCode:null,pixExpiresAt:null,checkoutUrl:null};
 }
 const resolved=attempt?.orderId===null&&result?.resolvedExistingOrder===true&&result.requestKey===attempt.requestKey;
 if(!uuid.test(result?.orderId||'')||(!resolved&&result.orderId!==attempt?.orderId)||result.quoteId!==attempt?.quote?.id||!knownStatuses.has(result.status))return null;
 const next={...attempt,orderId:result.orderId,status:result.status,state:result.state,pixCode:null,pixExpiresAt:null,checkoutUrl:null};
 if(result.state==='credited')return result.ok===true&&result.status==='paid'&&result.credited===true&&result.creditedNanoUsd===attempt.quote.retailNanoUsd?{...next,retrySameOrder:false}:null;
 if(result.state==='paid_pending_credit')return result.status==='paid'&&result.credited===false?{...next,retrySameOrder:false}:null;
 if(result.ok!==true||result.credited!==false)return null;
 if(result.state==='closed')return ['cancelled','expired','refunded'].includes(result.status)?{...next,retrySameOrder:false}:null;
 if(result.state!=='awaiting_payment'||!['pending','awaiting_payment'].includes(result.status))return null;
 const pix=typeof result.pixCode==='string'&&result.pixCode.length>=20&&result.pixCode.length<=4096&&Number.isFinite(Date.parse(result.expiresAt));
 return {...next,retrySameOrder:result.status==='pending'&&attempt.statusOnly!==true,checkoutUrl:safeCreditCheckoutUrl(attempt.checkoutUrl,result.orderId),
  ...(pix?{pixCode:result.pixCode,pixExpiresAt:result.expiresAt}:{})};
}
export function preserveCreditAttempt(attempt,result){
 const sameQuote=result?.quoteId===attempt.quote.id,sameKey=result?.requestKey===attempt.requestKey;
 if(sameQuote&&sameKey&&result.referencePreserved===true)return {...attempt,state:attempt.orderId?'order_preserved':'order_unconfirmed',statusOnly:true,code:result.code,retrySameOrder:false,checkoutUrl:null,pixCode:null,pixExpiresAt:null};
 if(sameQuote&&sameKey&&result.state==='not_started'&&result.retrySameOrder!==true&&['QUOTE_EXPIRED','ORDER_CLOSED'].includes(result.code))return {...attempt,state:'closed',status:null,code:result.code,retrySameOrder:false,checkoutUrl:null,pixCode:null,pixExpiresAt:null};
 if(sameQuote&&sameKey&&result.state==='not_started'&&result.retrySameOrder!==true&&result.code==='IDEMPOTENCY_CONFLICT')return {...attempt,state:'reference_conflict',code:result.code,retrySameOrder:false,checkoutUrl:null,pixCode:null,pixExpiresAt:null};
 const knownOrder=sameQuote&&uuid.test(result?.orderId||'')&&(!attempt.orderId||result.orderId===attempt.orderId)?result.orderId:attempt.orderId;
 return {...attempt,orderId:knownOrder,state:knownOrder?'order_preserved':'order_unconfirmed',retrySameOrder:attempt.statusOnly!==true&&(sameQuote&&sameKey&&result.retrySameOrder===true||!knownOrder),
  checkoutUrl:null,pixCode:null,pixExpiresAt:null};
}
