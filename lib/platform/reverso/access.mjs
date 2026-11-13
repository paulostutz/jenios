/** Reverso plan/read model. It never issues a charge or writes an entitlement.
 * readSource is a trusted server adapter, with an independently resolved payer /
 * Platform binding and fresh revocation state. Never pass browser JSON to it.
 * CB006 still admits only its existing products; these offers do not extend it.
 */
import {assertReceipt, paidPeriod} from '../../pay/central-billing-client.mjs';
import {DEFAULT_PRODUCTS} from '../../pay/catalog.mjs';

export const REVERSO_OFFER_VERSION='reverso-offer-2026-11-12-v1';
export const REVERSO_ACCESS_SOURCE_SCHEMA='JENIOS_REVERSO_ACCESS_SOURCE_V1';
export const REVERSO_ACCESS_SCHEMA='JENIOS_REVERSO_ACCESS_V1';
export const REVERSO_OFFERS=Object.freeze([
 ['month','platform-reverso-monthly',1],['year','platform-reverso-annual',12],
].map(([interval,code,months])=>{
 const p=DEFAULT_PRODUCTS.find(product=>product.code===code);
 return Object.freeze({planId:code,productCode:code,planName:p.name,robotId:'reverso',interval,amountCents:p.price_cents,currency:p.currency,months,singlePayment:interval==='year',performanceRate:20,startsAt:'payment_confirmation',checkoutEnabled:false,offerVersion:REVERSO_OFFER_VERSION});
}));
const fail=code=>{throw Object.assign(Error(code),{code});};
const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const identifier=v=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,159}$/.test(v);
const text=v=>typeof v==='string'&&v.trim().length>0&&v.length<=160&&!/[\u0000-\u001f]/.test(v);
const check=(v,code='REVERSO_ACCESS_SOURCE_INVALID')=>{if(!v)fail(code);};
function instant(value){
 check(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value));
 const n=Date.parse(value);check(Number.isFinite(n)&&new Date(n).toISOString()===(value.includes('.')?value:value.replace('Z','.000Z')));return n;
}
const iso=n=>new Date(n).toISOString();
const canonical=v=>Array.isArray(v)?v.map(canonical):plain(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const same=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));

export function reversoOffer(interval){
 const offer=REVERSO_OFFERS.find(o=>o.interval===interval);check(offer,'REVERSO_INTERVAL_INVALID');return offer;
}

/** G47 / CB014 calendar convention: calendar months in Brasilia with end-day
 * clamping, preserving local time. Projection only, never a renewal decision.
 * The same calendar algorithm is used by subscriptions-v3/consumer-contract.mjs.
 */
export function reversoPeriodFromConfirmation(confirmedAt,interval){
 const months=reversoOffer(interval).months,start=instant(confirmedAt),zone='America/Sao_Paulo';
 const parts=n=>Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(n).filter(x=>x.type!=='literal').map(x=>[x.type,Number(x.value)]));
 const wall=p=>Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,p.second);
 const p=parts(start),m=new Date(Date.UTC(p.year,p.month-1+months,1));
 const target={...p,year:m.getUTCFullYear(),month:m.getUTCMonth()+1,day:Math.min(p.day,new Date(Date.UTC(m.getUTCFullYear(),m.getUTCMonth()+1,0)).getUTCDate())};
 const targetWall=wall(target);let end=targetWall;
 for(let i=0;i<4;i++)end+=targetWall-wall(parts(end));
 check(wall(parts(end))===targetWall,'REVERSO_CALENDAR_UNRESOLVED');end+=start%1000;
 return Object.freeze({periodStart:iso(start),periodEnd:iso(end),months,timeZone:zone});
}

function empty(reason='SOURCE_UNAVAILABLE'){
 return {schema:REVERSO_ACCESS_SCHEMA,robotId:'reverso',planId:null,planName:null,status:'unavailable',paymentStatus:'unavailable',accessGranted:false,accessObserved:false,periodStart:null,periodEnd:null,performanceRate:null,interval:null,amountCents:null,currency:'BRL',cancelAtPeriodEnd:null,reason,mode:null,source:null,evidence:[],periods:[],offers:REVERSO_OFFERS,actualExecutionAuthorized:false,realBillingAuthorized:false};
}
function validateSource(source,subject,now){
 check(identifier(subject),'REVERSO_SUBJECT_REQUIRED');check(Number.isFinite(now),'REVERSO_CLOCK_INVALID');
 check(plain(source)&&source.schema===REVERSO_ACCESS_SOURCE_SCHEMA&&source.platform==='jenios'&&source.subject===subject&&source.robotId==='reverso','REVERSO_SOURCE_IDENTITY_MISMATCH');
 check(['live','demo'].includes(source.mode)&&identifier(source.revision));
 const observed=instant(source.observedAt),expiry=instant(source.validUntil);
 check(observed<=now&&now-observed<=60000&&expiry>now&&expiry-observed<=60000,'REVERSO_SOURCE_STALE');
 const i=source.identity;
 check(plain(i)&&i.subject===subject&&[i.customerId,i.bindingId,i.revision].every(identifier),'REVERSO_PAYER_BINDING_REQUIRED');
 check(Array.isArray(source.contracts)&&source.contracts.length<=100);
 return i;
}
function policyRate(contract){
 const p=contract.policy;
 if(!plain(p)||p.approved!==true||p.revoked!==false||p.robotId!=='reverso'||!identifier(p.reference)||p.planId!==contract.planId||p.productCode!==contract.productCode||p.termsVersion!==contract.termsVersion)return null;
 if(contract.kind==='entry')return p.performanceRate===20?20:null;
 if(contract.kind==='included')return p.performanceRate===10?10:null;
 // Existing rights never acquire a new performance condition by inference.
 return [10,20].includes(p.performanceRate)?p.performanceRate:null;
}
function projectContract(c,{subject,identity,now}){
 check(plain(c)&&[c.id,c.orderId,c.planId,c.productCode,c.termsVersion].every(identifier)&&text(c.planName));
 check(c.robotId==='reverso'&&['entry','included','historical'].includes(c.kind),'REVERSO_CONTRACT_SCOPE_MISMATCH');
 check(['month','year','contract'].includes(c.interval)&&Number.isSafeInteger(c.amountCents)&&c.amountCents>0&&c.amountCents<=100000000&&c.currency==='BRL');
 check(typeof c.cancelAtPeriodEnd==='boolean'&&typeof c.revoked==='boolean');
 check(['pending','awaiting_payment','uncertain','paid','cancelled','refunded'].includes(c.orderStatus));
 const accepted=instant(c.acceptedAt);check(accepted<=now,'REVERSO_ACCEPTANCE_INVALID');
 if(c.kind==='entry'){
  const offer=reversoOffer(c.interval);
  check(c.offerVersion===REVERSO_OFFER_VERSION&&c.planId===offer.planId&&c.productCode===offer.productCode&&c.amountCents===offer.amountCents,'REVERSO_ACCEPTED_OFFER_MISMATCH');
 }else if(c.kind==='historical')check(identifier(c.legacyRightsReference),'REVERSO_HISTORICAL_RIGHTS_REQUIRED');
 const expected=c.expectedReceipt;
 check(plain(expected)&&expected.product==='jenios'&&expected.customer_id===identity.customerId&&expected.external_invoice_id===c.orderId&&expected.currency===c.currency&&expected.amount_cents===c.amountCents&&['jenios_subscription','jenios_platform_subscription'].includes(expected.purpose),'REVERSO_RECEIPT_SCOPE_MISMATCH');
 check([expected.company_id,expected.receiver_id,expected.legal_entity_id].every(identifier));
 check(instant(expected.period_start)<instant(expected.period_end));
 const result={planId:c.planId,planName:c.planName,status:'pending',paymentStatus:'pending',accessObserved:false,periodStart:null,periodEnd:null,performanceRate:policyRate(c),interval:c.interval,amountCents:c.amountCents,currency:c.currency,cancelAtPeriodEnd:c.cancelAtPeriodEnd,reason:'PAYMENT_PENDING',evidence:[c.id,c.termsVersion],orderId:c.orderId};
 const access=c.accessBinding;
 if(access!==null&&access!==undefined){
  check(plain(access)&&[access.id,access.revision].every(identifier)&&access.subject===subject&&access.robotId==='reverso'&&access.orderId===c.orderId&&access.productCode===c.productCode&&['granted','pending','revoked'].includes(access.state),'REVERSO_ACCESS_BINDING_MISMATCH');
  check(instant(access.periodStart)<instant(access.periodEnd));
 }
 const receipt=c.receipt===null||c.receipt===undefined?null:assertReceipt(c.receipt,expected);
 const confirmedPayment=receipt?.state==='paid'&&receipt.verified_paid===true;
 if(confirmedPayment){
  const confirmed=instant(receipt.confirmed_at);check(confirmed<=now&&confirmed>=accepted,'REVERSO_CONFIRMATION_INVALID');
  result.paymentStatus='confirmed';result.evidence.push(receipt.id);
  if(access){result.periodStart=iso(instant(access.periodStart));result.periodEnd=iso(instant(access.periodEnd));}
 }
 if(c.revoked||c.orderStatus==='refunded'||access?.state==='revoked')return {...result,status:'revoked',paymentStatus:c.orderStatus==='refunded'?'refunded':confirmedPayment?'confirmed':'unavailable',reason:'CONTRACT_REVOKED'};
 if(c.orderStatus==='cancelled')return {...result,status:'cancelled',paymentStatus:confirmedPayment?'confirmed':'cancelled',reason:'ORDER_CANCELLED'};
 if(!receipt){
  if(c.orderStatus==='paid'||c.orderStatus==='uncertain')return {...result,status:'uncertain',paymentStatus:'uncertain',reason:'PAYMENT_RECONCILIATION_REQUIRED'};
  return result;
 }
 if(['closed','void'].includes(receipt.state))return {...result,status:'cancelled',paymentStatus:'cancelled',reason:'CENTRAL_ORDER_CLOSED'};
 if(receipt.state!=='paid'||receipt.verified_paid!==true){
  if(c.orderStatus==='paid'||c.orderStatus==='uncertain'||['sending','submitted','uncertain','paid'].includes(receipt.state))return {...result,status:'uncertain',paymentStatus:'uncertain',reason:'PAYMENT_RECONCILIATION_REQUIRED'};
  return result;
 }
 if(c.orderStatus!=='paid')return {...result,status:'uncertain',reason:'NATIVE_PAYMENT_RECONCILIATION_REQUIRED'};
 if(!access||access.state!=='granted')return {...result,reason:'ACCESS_NOT_CONFIRMED'};
 if(c.kind==='included'&&result.performanceRate===null)return {...result,reason:'APPROVED_REVERSO_MAPPING_REQUIRED'};
 const start=instant(access.periodStart),end=instant(access.periodEnd);
 if(c.kind==='entry'){
  const period=reversoPeriodFromConfirmation(receipt.confirmed_at,c.interval);
  check(start===Date.parse(period.periodStart)&&end===Date.parse(period.periodEnd),'REVERSO_CONFIRMATION_PERIOD_MISMATCH');
 }else{
  // Existing paid competence is preserved; a new price/calendar never rewrites it.
  check(start===instant(expected.period_start)&&end===instant(expected.period_end),'REVERSO_EXISTING_PERIOD_MISMATCH');
  if(start<=now&&now<end)check(paidPeriod(receipt,expected,now)!==null,'REVERSO_EXISTING_PAYMENT_UNVERIFIED');
 }
 result.periodStart=iso(start);result.periodEnd=iso(end);result.evidence.push(access.id,access.revision);
 result.status=now<start?'scheduled':now>=end?'expired':'active';result.accessObserved=result.status==='active';
 result.reason=result.status==='active'?(result.performanceRate===null?'ACTIVE_PERFORMANCE_POLICY_PENDING':'PAID_ACCESS_CONFIRMED'):result.status==='expired'?'PAID_PERIOD_ENDED':'PAID_PERIOD_SCHEDULED';
 return result;
}

/** Validate a read-only snapshot. Source authentication/current revocations belong
 * to readSource. A matching JSON object alone is never payment provenance.
 * accessGranted reflects an existing verified grant; it is not a grant command.
 */
export function projectReversoAccess({subject,source,now=Date.now()}={}){
 if(!source)return empty();
 let validatedMeta=null;
 try{
  const identity=validateSource(source,subject,now),byId=new Map(),orders=new Map(),proofs=new Map();
  validatedMeta={mode:source.mode,source:{kind:'authorized_read',revision:source.revision,observedAt:source.observedAt,validUntil:source.validUntil,bindingRevision:identity.revision}};
  const periods=[];
  for(const c of source.contracts){
   if(byId.has(c?.id)){check(same(byId.get(c.id),c),'REVERSO_CONTRACT_REVISION_CONFLICT');continue;}
   check(!orders.has(c?.orderId),'REVERSO_ORDER_REUSED');
   const view=projectContract(c,{subject,identity,now});
   const proof=c.receipt?.verified_paid===true?c.receipt.proof_sha256:null;
   if(proof){check(!proofs.has(proof),'REVERSO_PAYMENT_PROOF_REUSED');proofs.set(proof,c.id);}
   byId.set(c.id,c);orders.set(c.orderId,c.id);periods.push(view);
  }
  const active=periods.filter(p=>p.status==='active');
  check(active.length<=1,'REVERSO_PAID_PERIODS_OVERLAP');
  const priority=['active','uncertain','pending','scheduled','expired','revoked','cancelled'];
  const selected=[...periods].sort((a,b)=>priority.indexOf(a.status)-priority.indexOf(b.status)||(Date.parse(b.periodEnd??'')||0)-(Date.parse(a.periodEnd??'')||0))[0];
  const base=empty('NO_CONFIRMED_REVERSO_CONTRACT');
  const result={...base,...selected,status:selected?.status??'pending',paymentStatus:selected?.paymentStatus??'not_started',mode:source.mode,accessGranted:selected?.accessObserved===true&&source.mode==='live',source:{kind:'authorized_read',revision:source.revision,observedAt:source.observedAt,validUntil:source.validUntil,bindingRevision:identity.revision},periods:periods.map(({orderId,...p})=>p)};
  delete result.orderId;return Object.freeze(result);
 }catch(e){
  const code=typeof e.code==='string'&&e.code.startsWith('REVERSO_')?e.code:'REVERSO_RECEIPT_INVALID';
  const uncertain=['REVERSO_CONTRACT_REVISION_CONFLICT','REVERSO_ORDER_REUSED','REVERSO_PAYMENT_PROOF_REUSED','REVERSO_PAID_PERIODS_OVERLAP'].includes(code);
  return Object.freeze({...empty(code),...(uncertain&&validatedMeta?validatedMeta:{}),status:uncertain?'uncertain':'unavailable'});
 }
}

export async function readReversoAccess({subject,readSource,now=Date.now,timeoutMs=3000}={}){
 const time=()=>typeof now==='function'?now():now;
 if(typeof readSource!=='function')return Object.freeze(empty('SOURCE_NOT_CONFIGURED'));
 if(!identifier(subject))return Object.freeze(empty('REVERSO_SUBJECT_REQUIRED'));
 if(!Number.isFinite(timeoutMs)||timeoutMs<=0||timeoutMs>10000)return Object.freeze(empty('REVERSO_SOURCE_DEADLINE_INVALID'));
 let timer;
 try{
  const source=await Promise.race([Promise.resolve().then(()=>readSource({platform:'jenios',subject,robotId:'reverso'})),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('SOURCE_TIMEOUT')),timeoutMs);})]);
  return projectReversoAccess({subject,source:structuredClone(source),now:time()});
 }catch{return Object.freeze(empty('SOURCE_UNAVAILABLE'));}
 finally{clearTimeout(timer);}
}
