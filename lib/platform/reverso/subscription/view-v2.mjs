/** Public candidate protocol, shared with Web. No payer, receipt or key. */
const plain=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
const exact=(v,names)=>plain(v)&&Object.keys(v).sort().join()===[...names].sort().join();
const check=(v,code='REVERSO_SUBSCRIPTION_VIEW_INVALID')=>{if(!v)throw Object.assign(Error(code),{code});};
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v);
const instant=v=>typeof v==='string'&&Number.isFinite(Date.parse(v));
const offerKeys=['product_code','amount_cents','currency','terms_version','version','producer_version','robot_id','interval','access_basis','access_months','access_timezone','payment_count','installments','performance_rate','auto_renew','automatic_debit','terms_text','terms_sha256','synthetic_only','production_enabled','period_start','period_end'];
export const REVERSO_SUBSCRIPTION_CAPABILITIES_V2=Object.freeze({candidateActionsAllowed:true,realBillingAllowed:false,realDebitAuthorized:false,actualExecutionAuthorized:false});
export function validateReversoSubscriptionOfferV2(o){
 check(exact(o,offerKeys));const monthly=o.interval==='month';check(monthly||o.interval==='year');
 check(o.product_code===(monthly?'platform-reverso-monthly':'platform-reverso-annual')&&o.amount_cents===(monthly?1990:19900));
 check(o.currency==='BRL'&&o.robot_id==='reverso'&&o.performance_rate===20&&o.access_months===(monthly?1:12));
 check(o.access_basis==='central_confirmed_period'&&o.access_timezone==='America/Sao_Paulo'&&o.payment_count===1&&o.installments===1);
 check(o.auto_renew===false&&o.automatic_debit===false&&o.synthetic_only===true&&o.production_enabled===false);
 check(o.version==='reverso-offer-2026-11-12-v1'&&o.producer_version==='reverso-native-subscription-revfin001-v1'&&o.terms_version==='reverso-subscription-revfin001-v1');
 check(typeof o.terms_text==='string'&&o.terms_text.length>20&&o.terms_text.length<=4000&&/^[a-f0-9]{64}$/.test(o.terms_sha256));
 check(instant(o.period_start)&&instant(o.period_end)&&Date.parse(o.period_end)>Date.parse(o.period_start));return structuredClone(o);
}
export function validateReversoSubscriptionInputV2(v){
 check(plain(v),'REVERSO_SUBSCRIPTION_REQUEST_INVALID');
 const fields=v.action==='status'?['action']:v.action==='quote'?['action','interval']:v.action==='lookup'?['action','requestKey']:v.action==='prepare'?['action','requestKey','offer','accept']:['action','orderId'];
 check(exact(v,fields),'REVERSO_SUBSCRIPTION_REQUEST_INVALID');
 if(v.action==='quote')check(['month','year'].includes(v.interval),'REVERSO_SUBSCRIPTION_REQUEST_INVALID');
 else if(v.action==='prepare'){check(uuid(v.requestKey)&&v.accept===true,'REVERSO_SUBSCRIPTION_REQUEST_INVALID');validateReversoSubscriptionOfferV2(v.offer);}
 else if(v.action==='lookup')check(uuid(v.requestKey),'REVERSO_SUBSCRIPTION_REQUEST_INVALID');
 else if(v.action!=='status')check(['read','refresh','cancel','void_unsent'].includes(v.action)&&uuid(v.orderId),'REVERSO_SUBSCRIPTION_REQUEST_INVALID');
 return structuredClone(v);
}
export function validateReversoSubscriptionViewV2(v,{subject,now=Date.now()}={}){
 check(exact(v,['schema','kind','platform','robotId','subject','mode','observedAt','validUntil','capabilities','offer','order','replayed']));
 check(v.schema==='REVERSO_SUBSCRIPTION_VIEW_V2'&&v.platform==='jenios'&&v.robotId==='reverso'&&uuid(subject)&&v.subject===subject&&v.mode==='demo');
 check(instant(v.observedAt)&&instant(v.validUntil)&&Number.isFinite(now));const start=Date.parse(v.observedAt),end=Date.parse(v.validUntil);
 check(start<=now+1000&&end>now&&end>start&&end-start<=30000);
 check(exact(v.capabilities,Object.keys(REVERSO_SUBSCRIPTION_CAPABILITIES_V2))&&Object.entries(REVERSO_SUBSCRIPTION_CAPABILITIES_V2).every(([k,x])=>v.capabilities[k]===x));
 check(typeof v.replayed==='boolean'&&['status','quote','order'].includes(v.kind));
 if(v.kind==='status')check(v.offer===null&&v.order===null);
 else if(v.kind==='quote'){check(v.order===null);validateReversoSubscriptionOfferV2(v.offer);}
 else {
  check(v.offer===null);const o=v.order;
  check(exact(o,['id','productCode','interval','amountCents','currency','status','paymentStatus','cancelled','cancelAtPeriodEnd','periodStart','periodEnd']));
  const monthly=o.interval==='month';check(uuid(o.id)&&(monthly||o.interval==='year')&&o.productCode===(monthly?'platform-reverso-monthly':'platform-reverso-annual')&&o.amountCents===(monthly?1990:19900)&&o.currency==='BRL');
  check(['prepared','sending','submitted','uncertain','issued','paid','closed','void','refunded','cancelled'].includes(o.status));
  check(['pending','recorded_in_test','uncertain','refunded','cancelled'].includes(o.paymentStatus)&&typeof o.cancelled==='boolean'&&typeof o.cancelAtPeriodEnd==='boolean');
  check(o.paymentStatus!=='recorded_in_test'||o.status==='paid'||o.status==='cancelled'&&o.cancelled===true);
  check(o.periodStart===null&&o.periodEnd===null||instant(o.periodStart)&&instant(o.periodEnd)&&Date.parse(o.periodEnd)>Date.parse(o.periodStart));
 }
 return Object.freeze(structuredClone(v));
}
