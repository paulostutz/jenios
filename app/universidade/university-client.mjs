export const UNIVERSITY_MONTHLY = Object.freeze({
 productCode:'social-university-monthly',amountCents:4990,currency:'BRL',billingType:'monthly',
 renewalMode:'manual_pix',termsVersion:'university-monthly-2026-10-20'
});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const requestKey=/^[A-Za-z0-9_-]{16,100}$/;
const date=value=>typeof value==='string'&&Number.isFinite(Date.parse(value));
const priceMatches=value=>value?.productCode===UNIVERSITY_MONTHLY.productCode&&value.amountCents===4990&&value.currency==='BRL'&&value.termsVersion===UNIVERSITY_MONTHLY.termsVersion;

export function validUniversityOffer(offer){
 return Boolean(priceMatches(offer)&&offer.billingType==='monthly'&&offer.renewalMode==='manual_pix'&&typeof offer.available==='boolean');
}
export function validUniversityAccess(access){
 if(!access||typeof access.active!=='boolean'||typeof access.included!=='boolean')return false;
 if(access.kind==='none')return access.active===false&&access.included===false&&(access.validUntil===null||access.validUntil===undefined);
 if(access.kind==='admin-preview')return access.active===true&&access.included===true;
 if(!['subscription','university-monthly','purchased-pass'].includes(access.kind)||!date(access.validUntil))return false;
 return access.active===true&&access.included===(access.kind==='subscription');
}
export function validUniversityScheduled(period){
 return Boolean(period?.kind==='university-monthly'&&period.productCode===UNIVERSITY_MONTHLY.productCode&&uuid.test(period.orderId||'')&&
  date(period.startsAt)&&date(period.validUntil)&&Date.parse(period.validUntil)>Date.parse(period.startsAt));
}
export function canStartUniversityPurchase(account){
 const data=account?.data,access=data?.access;
 return Boolean(account?.kind==='ready'&&validUniversityOffer(data?.offer)&&data.offer.available&&validUniversityAccess(access)&&
  data.canPurchase===true&&!data.scheduled&&access.included===false&&(!access.active||access.kind==='university-monthly'&&data.canRenew===true));
}
export function validUniversityAttempt(value){
 return Boolean(priceMatches(value)&&requestKey.test(value.requestKey||'')&&(value.orderId===null||uuid.test(value.orderId||'')));
}
export function universityCheckoutUrl(value,orderId){
 const expected='/social/pagamento?pedido='+orderId;
 return uuid.test(orderId||'')&&value===expected?expected:null;
}
export function projectUniversityOrder(result,current=null){
 if(!priceMatches(result)||!uuid.test(result.orderId||'')||!requestKey.test(result.requestKey||'')||
  current?.orderId&&(current.orderId!==result.orderId||current.requestKey!==result.requestKey))return null;
 const common={productCode:result.productCode,amountCents:result.amountCents,currency:result.currency,termsVersion:result.termsVersion,
  requestKey:result.requestKey,orderId:result.orderId,status:result.status,state:result.state,
  checkoutUrl:null,pixCode:null,pixExpiresAt:null,retrySameOrder:false,access:null,scheduled:null};
 if(result.state==='active')return result.ok!==false&&result.status==='paid'&&validUniversityAccess(result.access)&&result.access.active===true?{...common,access:result.access}:null;
 if(result.state==='scheduled')return result.ok!==false&&result.status==='paid'&&validUniversityAccess(result.access)&&result.access.active===false&&
  validUniversityScheduled(result.scheduled)&&result.scheduled.orderId===result.orderId?{...common,access:result.access,scheduled:{kind:result.scheduled.kind,productCode:result.scheduled.productCode,orderId:result.scheduled.orderId,startsAt:result.scheduled.startsAt,validUntil:result.scheduled.validUntil}}:null;
 if(result.state==='paid_pending_access')return result.status==='paid'?common:null;
 if(result.ok===false)return null;
 if(result.state==='closed')return ['cancelled','expired','refunded'].includes(result.status)||result.status==='paid'&&validUniversityAccess(result.access)?common:null;
 if(result.state!=='awaiting_payment'||!['pending','awaiting_payment'].includes(result.status))return null;
 const pix=typeof result.pixCode==='string'&&result.pixCode.length>=20&&result.pixCode.length<=4096&&date(result.expiresAt);
 return {...common,retrySameOrder:result.status==='pending',checkoutUrl:universityCheckoutUrl(result.checkoutUrl,result.orderId),
  ...(pix?{pixCode:result.pixCode,pixExpiresAt:result.expiresAt}:{})};
}
export function restoreUniversityAttempt(saved){
 if(!validUniversityAttempt(saved))return null;
 return {productCode:saved.productCode,amountCents:saved.amountCents,currency:saved.currency,termsVersion:saved.termsVersion,
  requestKey:saved.requestKey,orderId:saved.orderId,status:null,state:'restored',retrySameOrder:!saved.orderId,
  checkoutUrl:null,pixCode:null,pixExpiresAt:null,access:null};
}
export function preserveUniversityAttempt(current,result){
 // An uncertain response never discards the original reference or reuses a
 // previously displayed Pix. Only a matching, verified order replaces it.
 const verified=projectUniversityOrder(result,current);
 if(verified)return verified;
 const identified=priceMatches(result)&&requestKey.test(result.requestKey||'');
 if(!current.orderId&&identified&&result.requestKey===current.requestKey&&result.state==='not_started'&&result.retrySameOrder!==true)
  return {...current,state:'not_started',code:result.code,retrySameOrder:false,checkoutUrl:null,pixCode:null,pixExpiresAt:null,access:null};
 const recovered=identified&&uuid.test(result.orderId||'')&&(!current.orderId||current.orderId===result.orderId&&current.requestKey===result.requestKey);
 const orderId=recovered?result.orderId:current.orderId,canonicalKey=recovered?result.requestKey:current.requestKey;
 return {...current,orderId,requestKey:canonicalKey,state:orderId?'order_preserved':'order_unconfirmed',retrySameOrder:!orderId||recovered&&result.retrySameOrder===true,
  checkoutUrl:null,pixCode:null,pixExpiresAt:null,access:null};
}
export function universityAttemptReference(attempt){
 if(!validUniversityAttempt(attempt))return null;
 return {productCode:attempt.productCode,amountCents:attempt.amountCents,currency:attempt.currency,termsVersion:attempt.termsVersion,
  requestKey:attempt.requestKey,orderId:attempt.orderId};
}
export function universityDate(value){
 return date(value)?new Intl.DateTimeFormat('pt-BR',{dateStyle:'medium',timeStyle:'short',timeZone:'America/Bahia'}).format(new Date(value))+' (Brasília)':'Data em conferência';
}
