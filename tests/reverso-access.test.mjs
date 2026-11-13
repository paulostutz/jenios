import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_PRODUCTS,normalizePurchase,priceUpdate} from '../lib/pay/catalog.mjs';
import {REVERSO_OFFERS,REVERSO_OFFER_VERSION,REVERSO_ACCESS_SOURCE_SCHEMA,reversoOffer,reversoPeriodFromConfirmation,projectReversoAccess,readReversoAccess} from '../lib/platform/reverso/access.mjs';

const SUBJECT='platform-owner-a',PAYER='social-payer-a',NOW=Date.parse('2026-11-12T20:00:00Z');
const copy=structuredClone;
function contract({interval='month',confirmedAt='2026-11-01T12:00:00Z',id='contract-1',orderId='order-1'}={}){
 const offer=reversoOffer(interval),period=reversoPeriodFromConfirmation(confirmedAt,interval);
 const expectedReceipt={product:'jenios',company_id:'letter-franqueadora',purpose:'jenios_platform_subscription',external_invoice_id:orderId,customer_id:PAYER,receiver_id:'receiver-a',legal_entity_id:'br:cnpj:synthetic-only',amount_cents:offer.amountCents,currency:'BRL',period_start:'2026-10-25T12:00:00Z',period_end:interval==='month'?'2026-11-25T12:00:00Z':'2027-10-25T12:00:00Z'};
 return {id,orderId,robotId:'reverso',planId:offer.planId,planName:offer.planName,productCode:offer.productCode,kind:'entry',interval,amountCents:offer.amountCents,currency:'BRL',acceptedAt:'2026-10-25T12:00:00Z',termsVersion:'synthetic-reverso-terms-1',offerVersion:REVERSO_OFFER_VERSION,cancelAtPeriodEnd:false,revoked:false,orderStatus:'paid',policy:{approved:true,revoked:false,robotId:'reverso',reference:'synthetic-reverso-policy-1',performanceRate:20,planId:offer.planId,productCode:offer.productCode,termsVersion:'synthetic-reverso-terms-1'},expectedReceipt,
  receipt:{...expectedReceipt,schema_version:1,id:'central-'+id,state:'paid',verified_paid:true,proof_sha256:'a'.repeat(64),confirmed_at:confirmedAt},
  accessBinding:{id:'grant-'+id,revision:'grant-revision-1',subject:SUBJECT,robotId:'reverso',orderId,productCode:offer.productCode,state:'granted',periodStart:period.periodStart,periodEnd:period.periodEnd}};
}
function snapshot(contracts=[contract()],{mode='live',now=NOW}={}){
 return {schema:REVERSO_ACCESS_SOURCE_SCHEMA,platform:'jenios',subject:SUBJECT,robotId:'reverso',mode,observedAt:new Date(now-1000).toISOString(),validUntil:new Date(now+10000).toISOString(),revision:'snapshot-1',identity:{subject:SUBJECT,customerId:PAYER,bindingId:'verified-binding-a',revision:'binding-revision-1'},contracts};
}
const project=(source,now=NOW)=>projectReversoAccess({subject:SUBJECT,source,now});
function historical({included=false}={}){
 const c=contract();
 Object.assign(c,{kind:included?'included':'historical',planId:'existing-plan',planName:'Plano contratado anteriormente',productCode:'platform-nacional',amountCents:1499,legacyRightsReference:'existing-terms-decision-1',offerVersion:null,interval:'contract'});
 Object.assign(c.expectedReceipt,{amount_cents:1499,period_start:'2026-10-25T12:00:00Z',period_end:'2026-11-25T12:00:00Z'});
 Object.assign(c.receipt,c.expectedReceipt);
 Object.assign(c.accessBinding,{productCode:c.productCode,periodStart:c.expectedReceipt.period_start,periodEnd:c.expectedReceipt.period_end});
 c.policy=included?{approved:true,revoked:false,robotId:'reverso',reference:'explicit-inclusion-decision-1',performanceRate:10,planId:c.planId,productCode:c.productCode,termsVersion:c.termsVersion}:null;
 return c;
}

test('Reverso offers reuse inactive Pay products at approved prices; annual is one payment for 12 months',()=>{
 assert.equal(REVERSO_OFFERS.length,2);
 for(const offer of REVERSO_OFFERS){
  const product=DEFAULT_PRODUCTS.find(p=>p.code===offer.productCode);
  assert.equal(product.active,false);assert.equal(product.price_cents,offer.amountCents);
  assert.equal(offer.performanceRate,20);assert.equal(offer.checkoutEnabled,false);
  assert.throws(()=>normalizePurchase({}, {...product,active:true},'platform'));
  assert.throws(()=>priceUpdate({code:product.code,active:true,price_cents:product.price_cents}));
  assert.throws(()=>priceUpdate({code:product.code,active:false,price_cents:product.price_cents+1}));
  assert.equal(priceUpdate({code:product.code,active:false,price_cents:product.price_cents}).active,false);
 }
 assert.equal(reversoOffer('month').amountCents,1990);assert.equal(reversoOffer('month').months,1);
 assert.equal(reversoOffer('year').amountCents,19900);assert.equal(reversoOffer('year').months,12);assert.equal(reversoOffer('year').singlePayment,true);
 assert.equal(DEFAULT_PRODUCTS.find(p=>p.code==='platform-nacional').price_cents,9990);
 assert.equal(DEFAULT_PRODUCTS.find(p=>p.code==='platform-internacional-pro').active,true);
 assert.throws(()=>reversoOffer('quarter'));
});

test('monthly and annual access start at verified confirmation, independently of invoice preparation',()=>{
 for(const interval of ['month','year']){
  const c=contract({interval}),v=project(snapshot([c]));
  assert.equal(v.status,'active');assert.equal(v.paymentStatus,'confirmed');assert.equal(v.accessGranted,true);
  assert.equal(v.periodStart,'2026-11-01T12:00:00.000Z');
  assert.equal(v.periodEnd,interval==='month'?'2026-12-01T12:00:00.000Z':'2027-11-01T12:00:00.000Z');
  assert.equal(v.performanceRate,20);assert.equal(v.actualExecutionAuthorized,false);assert.equal(v.realBillingAuthorized,false);
 }
});

test('calendar months clamp month-end and leap day while preserving Brasilia time and milliseconds',()=>{
 assert.equal(reversoPeriodFromConfirmation('2027-01-31T15:10:11.123Z','month').periodEnd,'2027-02-28T15:10:11.123Z');
 assert.equal(reversoPeriodFromConfirmation('2028-02-29T15:10:00Z','year').periodEnd,'2029-02-28T15:10:00.000Z');
 // 01 March UTC is still 28 February locally; a UTC-month implementation is wrong here.
 assert.equal(reversoPeriodFromConfirmation('2027-03-01T01:00:00Z','month').periodEnd,'2027-03-29T01:00:00.000Z');
 assert.throws(()=>reversoPeriodFromConfirmation('2027-02-30T15:00:00Z','month'));
});

test('access window includes the first instant and excludes the exact ending instant',()=>{
 const c=contract(),start=Date.parse(c.accessBinding.periodStart),end=Date.parse(c.accessBinding.periodEnd);
 assert.equal(project(snapshot([c],{now:start}),start).status,'active');
 assert.equal(project(snapshot([c],{now:end-1}),end-1).status,'active');
 const v=project(snapshot([c],{now:end}),end);assert.equal(v.status,'expired');assert.equal(v.paymentStatus,'confirmed');assert.equal(v.accessGranted,false);
});

test('unpaid, uncertain and paid-but-unverified evidence never creates access or a received-payment label',()=>{
 for(const state of ['prepared','issued','sending','submitted','uncertain','paid']){
  const c=contract();c.orderStatus='awaiting_payment';Object.assign(c.receipt,{state,verified_paid:false,proof_sha256:null,confirmed_at:null});c.accessBinding=null;
  const v=project(snapshot([c]));assert.equal(v.accessGranted,false);assert.notEqual(v.paymentStatus,'confirmed');
  assert.equal(v.status,['prepared','issued'].includes(state)?'pending':'uncertain');
 }
 const paid=contract();paid.receipt=null;assert.equal(project(snapshot([paid])).status,'uncertain');
});

test('payment confirmation is independent from confirmation of the access grant',()=>{
 const c=contract();c.accessBinding.state='pending';
 const v=project(snapshot([c]));assert.equal(v.paymentStatus,'confirmed');assert.equal(v.status,'pending');assert.equal(v.accessGranted,false);assert.equal(v.reason,'ACCESS_NOT_CONFIRMED');
 c.accessBinding=null;assert.equal(project(snapshot([c])).accessGranted,false);
 c.orderStatus='awaiting_payment';assert.equal(project(snapshot([c])).status,'uncertain');
});

test('turning off renewal reminders preserves the entire already-paid period',()=>{
 const c=contract(),before=project(snapshot([c]));c.cancelAtPeriodEnd=true;const after=project(snapshot([c]));
 assert.equal(after.status,'active');assert.equal(after.accessGranted,true);assert.equal(after.cancelAtPeriodEnd,true);
 assert.equal(after.periodStart,before.periodStart);assert.equal(after.periodEnd,before.periodEnd);
});

test('refund and revocation remove only the corresponding observed right; cancellation stays distinct',()=>{
 for(const mutation of [c=>c.revoked=true,c=>c.accessBinding.state='revoked',c=>c.orderStatus='refunded']){
  const c=contract();mutation(c);const v=project(snapshot([c]));assert.equal(v.status,'revoked');assert.equal(v.accessGranted,false);
 }
 const c=contract();c.orderStatus='cancelled';const v=project(snapshot([c]));assert.equal(v.status,'cancelled');assert.equal(v.paymentStatus,'confirmed');assert.equal(v.accessGranted,false);
 c.receipt=null;assert.equal(project(snapshot([c])).paymentStatus,'cancelled');
});

test('other plans require an explicit approved Reverso mapping and receive 10 percent only from that mapping',()=>{
 const c=historical({included:true});let v=project(snapshot([c]));assert.equal(v.accessGranted,true);assert.equal(v.performanceRate,10);
 for(const policy of [null,{...c.policy,approved:false},{...c.policy,revoked:true},{...c.policy,robotId:'ultra'},{...c.policy,performanceRate:20},{...c.policy,planId:'another-plan'},{...c.policy,termsVersion:'unaccepted-terms'}]){
  const v=project(snapshot([{...c,policy}]));assert.equal(v.accessGranted,false);assert.equal(v.performanceRate,null);assert.equal(v.reason,'APPROVED_REVERSO_MAPPING_REQUIRED');
 }
});

test('historical explicit rights retain accepted price and dates without acquiring a retroactive performance rate',()=>{
 const c=historical(),v=project(snapshot([c]));
 assert.equal(v.status,'active');assert.equal(v.amountCents,1499);assert.equal(v.periodStart,'2026-10-25T12:00:00.000Z');assert.equal(v.periodEnd,'2026-11-25T12:00:00.000Z');
 assert.equal(v.performanceRate,null);assert.equal(v.reason,'ACTIVE_PERFORMANCE_POLICY_PENDING');
 const missing=copy(c);delete missing.legacyRightsReference;assert.equal(project(snapshot([missing])).accessGranted,false);
});

test('a later unpaid or uncertain purchase cannot hide an existing paid right',()=>{
 const old=historical(),next=contract({id:'next-contract',orderId:'next-order'});next.receipt=null;next.accessBinding=null;next.orderStatus='pending';
 let v=project(snapshot([next,old]));assert.equal(v.status,'active');assert.equal(v.planId,old.planId);assert.equal(v.periods.length,2);
 next.orderStatus='uncertain';v=project(snapshot([next,old]));assert.equal(v.status,'active');assert.equal(v.periods.find(p=>p.planId===next.planId).status,'uncertain');
});

test('exact record replay is deduplicated while conflicting revisions and reused orders or proofs remain uncertain',()=>{
 const c=contract(),s=snapshot([c,copy(c)]);assert.equal(project(s).periods.length,1);
 assert.deepEqual(project(s),project(s));
 const conflicting=copy(c);conflicting.cancelAtPeriodEnd=true;const conflict=project(snapshot([c,conflicting]));assert.equal(conflict.reason,'REVERSO_CONTRACT_REVISION_CONFLICT');
 assert.equal(conflict.source.observedAt,snapshot().observedAt);assert.equal(conflict.mode,'live');assert.equal(conflict.accessGranted,false);
 const other=contract({id:'contract-2'});assert.equal(project(snapshot([c,other])).reason,'REVERSO_ORDER_REUSED');
 other.orderId='order-2';other.expectedReceipt.external_invoice_id='order-2';other.receipt.external_invoice_id='order-2';other.accessBinding.orderId='order-2';
 assert.equal(project(snapshot([c,other])).reason,'REVERSO_PAYMENT_PROOF_REUSED');
 other.receipt.proof_sha256='b'.repeat(64);assert.equal(project(snapshot([c,other])).reason,'REVERSO_PAID_PERIODS_OVERLAP');
});

test('receipt and entitlement are bound to exact owner, payer, robot, product, amount and approved terms',()=>{
 const edits=[
  s=>s.subject='other-platform-owner',s=>s.identity.subject='other-platform-owner',s=>s.identity.customerId='other-payer',s=>s.robotId='ultra',
  s=>s.contracts[0].robotId='ultra',s=>s.contracts[0].accessBinding.robotId='ultra',s=>s.contracts[0].accessBinding.subject='other-platform-owner',
  s=>s.contracts[0].productCode='platform-ultra-monthly',s=>s.contracts[0].accessBinding.productCode='platform-ultra-monthly',
  s=>s.contracts[0].amountCents=1,s=>s.contracts[0].receipt.amount_cents=1,s=>s.contracts[0].receipt.receiver_id='other-receiver',
  s=>s.contracts[0].receipt.customer_id='other-payer',s=>s.contracts[0].receipt.product='kivoryn_flow',
  s=>s.contracts[0].receipt.proof_sha256='not-proof',s=>s.contracts[0].offerVersion='unapproved-offer',
  s=>s.contracts[0].receipt.confirmed_at='2026-11-13T12:00:00Z',s=>s.contracts[0].acceptedAt='2026-11-02T12:00:00Z',
  s=>s.contracts[0].accessBinding.periodStart='2026-10-25T12:00:00Z',s=>s.contracts[0].accessBinding.periodEnd='2026-12-02T12:00:00Z',
 ];
 for(const edit of edits){const s=snapshot();edit(s);const v=project(s);assert.equal(v.accessGranted,false,edit.toString());assert.equal(v.status,'unavailable',edit.toString());}
});

test('synthetic snapshots cannot grant real access, trading or billing permissions',()=>{
 const v=project(snapshot([contract()],{mode:'demo'}));assert.equal(v.status,'active');assert.equal(v.accessObserved,true);assert.equal(v.accessGranted,false);assert.equal(v.mode,'demo');assert.equal(v.actualExecutionAuthorized,false);assert.equal(v.realBillingAuthorized,false);
});

test('missing, stale and failed sources keep values unavailable and reveal no private receipt or payer data',async()=>{
 assert.equal((await readReversoAccess({subject:SUBJECT})).reason,'SOURCE_NOT_CONFIGURED');
 const missing=project(null);assert.equal(missing.status,'unavailable');assert.equal(missing.amountCents,null);
 const stale=snapshot();stale.validUntil=new Date(NOW).toISOString();assert.equal(project(stale).reason,'REVERSO_SOURCE_STALE');
 const future=snapshot();future.observedAt=new Date(NOW+1).toISOString();assert.equal(project(future).accessGranted,false);
 const failed=await readReversoAccess({subject:SUBJECT,readSource:async()=>{throw Error('private secret and PII');},now:NOW});assert.equal(failed.reason,'SOURCE_UNAVAILABLE');assert.doesNotMatch(JSON.stringify(failed),/private secret/);
 const v=project(snapshot());const wire=JSON.stringify(v);assert.doesNotMatch(wire,/social-payer-a|receiver-a|proof_sha256|legal_entity_id|customer_id|expectedReceipt|verified-binding-a/);
});

test('server reader receives the fixed robot and authenticated subject, recovers after failure and validates expiry after waiting',async()=>{
 let calls=0;
 const readSource=async context=>{assert.deepEqual(context,{platform:'jenios',subject:SUBJECT,robotId:'reverso'});calls++;return snapshot();};
 const first=await readReversoAccess({subject:SUBJECT,readSource,now:NOW});assert.equal(first.status,'active');assert.equal(calls,1);
 const second=await readReversoAccess({subject:SUBJECT,readSource,now:NOW+10001});assert.equal(second.status,'unavailable');
 const unavailable=await readReversoAccess({subject:SUBJECT,readSource:async()=>{throw Error();},now:NOW});assert.equal(unavailable.status,'unavailable');
 assert.equal((await readReversoAccess({subject:SUBJECT,readSource,now:NOW})).status,'active');
});

test('a fresh empty source reports no contracted Reverso without inferring an included plan',()=>{
 const v=project(snapshot([]));assert.equal(v.status,'pending');assert.equal(v.paymentStatus,'not_started');assert.equal(v.planId,null);assert.equal(v.performanceRate,null);assert.equal(v.accessGranted,false);
});
