import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign,createHash} from 'node:crypto';
import {canonical} from '../lib/platform/pilot-prep/contracts.mjs';
import {captureB297OriginalDecisions} from '../lib/platform/research/b297-private-readonly-audit.mjs';
import {
 B298_SCHEMA,B298_KINDS,inspectB298SignedReadEnvelope,
 auditB298SignedOrderPair,auditB298SignedPositionPair,
 auditB298SignedSignalDelivery,auditB298SignedOperatorIntent,
 auditB298SignedOperatorLifecycle,computeB298LossometerHypotheses,
 assessB298ExternalIntegrationGate
} from '../lib/platform/research/b298-signed-evidence-audit.mjs';
const {privateKey,publicKey}=generateKeyPairSync('ed25519');
const trustedKeys={collector_1:publicKey.export({type:'spki',format:'pem'}).toString('utf8')};
const T=Date.parse('2026-10-21T20:30:00Z');
const NOW=T+90000;
const scope=Object.freeze({ownerDigest:'a'.repeat(64),accountDigest:'b'.repeat(64),consentDigest:'c'.repeat(64)});
const sha=s=>createHash('sha256').update(String(s)).digest('hex');
const signingMessage=payload=>Buffer.from('JENIOS_B298_READONLY_EVIDENCE_V1\0'+canonical(payload),'utf8');
const signed=(kind,event,{capturedAtMs=T,nonce='n1',...patch}={})=>{
 const isBroker=kind.endsWith('_GET');
 const payload={schema:B298_SCHEMA,kind,keyId:'collector_1',nonce,
  ...scope,provider:isBroker?'alpaca':kind==='SIGNAL_DELIVERY'?'notification-export':'customer-event-export',
  environment:isBroker?'paper':'isolated',capturedAtMs,expiresAtMs:capturedAtMs+120000,
  readOnly:true,executionTransportEnabled:false,ordersSent:0,paperOrdersSent:0,
  event:{...event,observedAtMs:kind==='SIGNAL_DELIVERY'?undefined:capturedAtMs},...patch};
 if(kind==='SIGNAL_DELIVERY')delete payload.event.observedAtMs;
 const signatureBase64=sign(null,signingMessage(payload),privateKey).toString('base64');
 return {payload,signatureBase64};
};
const opts=()=>({scope,trustedKeys,nowMs:NOW});
const order=(status='new',filled_qty='0',id='brk-001')=>({kind:'ORDER_GET',clientOrderId:'client-001',symbol:'BTCUSD',expectedQuantity:'2',
 observedAtMs:T,order:{id,client_order_id:'client-001',symbol:'BTCUSD',qty:'2',filled_qty,status}});
const orderPair=(a='filled',b='filled',f='2',g='2')=>({
 first:signed('ORDER_GET',order(a,f),{capturedAtMs:T,nonce:'a'}),
 second:signed('ORDER_GET',order(b,g),{capturedAtMs:T+800,nonce:'b'})
});
const position=(side='long',quantity='2')=>({kind:'POSITION_GET',symbol:'BTCUSD',side,quantity,observedAtMs:T});
const intent=(eventId,referenceId,action,side='buy',commercialMode='reverse')=>
 ({kind:'OPERATOR_INTENT',eventId,referenceId,action,side,commercialMode,observedAtMs:T});
const replaceSignature=(e,patch)=>({
 payload:{...e.payload,...patch},signatureBase64:e.signatureBase64});
const reSign=x=>({...x,signatureBase64:sign(null,signingMessage(x.payload),privateKey).toString('base64')});
const fails=(fn,regex=/B298_|B297_|BROKER_|PAPER_|INVALID_/)=>assert.throws(fn,regex);

test('B298 signed collector export is redacted and cannot claim a broker/provider signature',()=>{
 const x=signed('ORDER_GET',order(),{nonce:'only'});
 const res=inspectB298SignedReadEnvelope(x,opts());
 assert.equal(B298_KINDS.length,4);
 assert.match(res.evidenceDigestSha256,/^[a-f0-9]{64}$/);
 assert.equal(res.configuredCollectorSignatureVerified,true);
 assert.equal(res.independentBrokerAttestation,false);
 assert.equal(res.keyProvisioningAuditedByModule,false);
 assert.equal(res.externalClientConsentAttested,false);
 assert.equal(res.durableReplayCheckPerformed,false);
 assert.equal(res.ordersSent,0);
 assert.equal(JSON.stringify(res).includes('client-001'),false);
});

test('B298 fails closed on mutated signed payload, modified signature, and unverifiable keys',()=>{
 const good=signed('ORDER_GET',order());
 fails(()=>inspectB298SignedReadEnvelope(replaceSignature(good,{ordersSent:1}),opts()));
 fails(()=>inspectB298SignedReadEnvelope(replaceSignature(good,{consentDigest:'d'.repeat(64)}),opts()));
 fails(()=>inspectB298SignedReadEnvelope(replaceSignature(good,{nonce:'another'}),opts()));
 fails(()=>inspectB298SignedReadEnvelope({...good,signatureBase64:'A'.repeat(86)+'=='},opts()));
 fails(()=>inspectB298SignedReadEnvelope(good,{...opts(),trustedKeys:{}}));
 fails(()=>inspectB298SignedReadEnvelope(good,{...opts(),trustedKeys:{collector_1:'garbage'}}));
});

test('B298 rejects expired, future, zero duration and wrong-scope exports',()=>{
 const good=signed('ORDER_GET',order());
 fails(()=>inspectB298SignedReadEnvelope(good,{...opts(),nowMs:T+120000}));
 fails(()=>inspectB298SignedReadEnvelope(good,{...opts(),nowMs:T-2000}));
 fails(()=>inspectB298SignedReadEnvelope(good,{...opts(),scope:{...scope,ownerDigest:'f'.repeat(64)}}));
 fails(()=>inspectB298SignedReadEnvelope(reSign(replaceSignature(good,{expiresAtMs:T})),opts()));
 fails(()=>inspectB298SignedReadEnvelope(reSign(replaceSignature(good,{executionTransportEnabled:true})),opts()));
});

test('B298 rejects credentials and raw extra fields in signed broker export',()=>{
 const good=signed('ORDER_GET',order());
 const injection=reSign(replaceSignature(good,{apiKey:'hidden'}));
 fails(()=>inspectB298SignedReadEnvelope(injection,opts()));
 const changed=reSign(replaceSignature(good,{event:{...good.payload.event,order:{...good.payload.event.order,secret:'bad'}}}));
 fails(()=>inspectB298SignedReadEnvelope(changed,opts()));
 const qty=reSign(replaceSignature(good,{event:{...good.payload.event,order:{...good.payload.event.order,filled_qty:'3'}}}));
 fails(()=>inspectB298SignedReadEnvelope(qty,opts()));
});

test('B298 calls existing B197 paired Alpaca Paper status review without any execution',()=>{
 const r=auditB298SignedOrderPair({...orderPair(),...opts()});
 assert.equal(r.assessment,'STABLE_TERMINAL_OBSERVATIONS');
 assert.equal(r.lastObservedKind,'FILLED');
 assert.equal(r.cumulativeQuantity,'2');
 assert.equal(r.configuredCollectorSignatureVerified,true);
 assert.equal(r.brokerProviderSignatureVerified,false);
 assert.equal(r.durableLedgerReconciled,false);
 assert.equal(r.positionClosedVerified,false);
 assert.equal(r.ordersSent,0);
 assert.equal(r.productionTradingAuthorized,false);
});

test('B298 preserves partial-cancel exposure and treats evolving fills as ambiguous',()=>{
 const data=orderPair('partially_filled','canceled','1','1');
 const r=auditB298SignedOrderPair({...data,...opts()});
 assert.equal(r.assessment,'EVOLVING_OR_AMBIGUOUS');
 assert.equal(r.partialCancelRequiresExposureReview,true);
 assert.equal(r.lastObservedKind,'CANCELLED');
 assert.equal(r.manualBrokerReviewRequired,true);
});

test('B298 rejects order drift, replayed nonce, stale events, and regressed fills',()=>{
 const pair=orderPair();
 fails(()=>auditB298SignedOrderPair({...opts(),first:pair.first,second:pair.first}));
 const newId=signed('ORDER_GET',order('filled','2','different'),{capturedAtMs:T+800,nonce:'b'});
 fails(()=>auditB298SignedOrderPair({...opts(),first:pair.first,second:newId}));
 const early=signed('ORDER_GET',order('filled','2'),{capturedAtMs:T+100,nonce:'b'});
 fails(()=>auditB298SignedOrderPair({...opts(),first:pair.first,second:early}));
 const regress=orderPair('partially_filled','partially_filled','1','0.5');
 fails(()=>auditB298SignedOrderPair({...opts(),...regress}));
 const other=signed('ORDER_GET',order('filled','2'),{capturedAtMs:T+800,nonce:'b',accountDigest:'e'.repeat(64)});
 fails(()=>auditB298SignedOrderPair({...opts(),first:pair.first,second:other}));
});

test('B298 paired positions remain observations and do not infer an actual closed position',()=>{
 const a=signed('POSITION_GET',position(),{capturedAtMs:T,nonce:'pos-a'});
 const b=signed('POSITION_GET',position(),{capturedAtMs:T+800,nonce:'pos-b'});
 const stable=auditB298SignedPositionPair({first:a,second:b,...opts()});
 assert.equal(stable.assessment,'STABLE_READ_NEEDS_RECONCILIATION');
 const c=signed('POSITION_GET',position('flat','0'),{capturedAtMs:T+800,nonce:'pos-c'});
 const changed=auditB298SignedPositionPair({first:a,second:c,...opts()});
 assert.equal(changed.zeroQuantityObserved,true);
 assert.equal(changed.assessment,'CHANGED_READ_PAUSE_AND_REVIEW');
 assert.equal(changed.observedPositionCloseCertified,false);
 assert.equal(changed.accountWidePositionReconciled,false);
 assert.equal(changed.ordersSent,0);
});

test('B298 rejects invalid positions (flat with quantity; side with zero; broken timestamps)',()=>{
 const bad=signed('POSITION_GET',position('flat','2'),{nonce:'pos-bad'});
 fails(()=>inspectB298SignedReadEnvelope(bad,opts()));
 const bad2=signed('POSITION_GET',position('short','0'),{nonce:'pos-bad2'});
 fails(()=>inspectB298SignedReadEnvelope(bad2,opts()));
 const a=signed('POSITION_GET',position(),{capturedAtMs:T,nonce:'a'});
 const b=signed('POSITION_GET',position(),{capturedAtMs:T+100,nonce:'b'});
 fails(()=>auditB298SignedPositionPair({first:a,second:b,...opts()}));
});

async function syntheticCapture(){
 const scenarios=['manual','hybrid','reverse'].map(mode=>({id:'signal-'+mode,mode,intent:'buy',horizon:'day'}));
 return captureB297OriginalDecisions({nowMs:T,scenarios,analyzeRequest:async request=>({
  ok:true,version:'ONLY_LAB_FIXTURE',simulation:true,executionEnabled:false,
  sourceMode:'synthetic',symbol:'LABORATÓRIO SINTÉTICO',
  scan:{decisionAt:T-5000},decision:{action:request.mode==='manual'?'manual_preview':
   request.mode==='hybrid'?'wait_for_confluence':'reverse_not_calibrated',
   side:request.mode==='manual'?'buy':null,mayClose:true}
 })});
}
const receipt=(entry,status='DELIVERED')=>({kind:'SIGNAL_DELIVERY',signalId:entry.id,
 decisionOutputSha256:entry.rawOutputSha256,emittedAtMs:entry.decisionAtMs,
 receiptAtMs:T+700,targetOpenMs:T+3600000,
 recipientDigest:sha('isolated-recipient'),receiptStatus:status});

test('B298 ties signed receipt to B297 synthetic source without certifying real delivery',async()=>{
 const capture=await syntheticCapture();
 const envelope=signed('SIGNAL_DELIVERY',receipt(capture.entries[0]),{capturedAtMs:T+800});
 const report=auditB298SignedSignalDelivery({capture,receipt:envelope,...opts()});
 assert.equal(report.beforeTarget,true);
 assert.equal(report.localOriginalDecisionLinked,true);
 assert.equal(report.declaredAsDelivered,true);
 assert.equal(report.recipientReceiptIndependentlyVerified,false);
 assert.equal(report.originalSourceWasSynthetic,true);
 assert.equal(report.realSignalEmissionVerified,false);
 assert.equal(report.noCommercialDeliveryClaim,true);
});

test('B298 validates declared receipts but never upgrades ACCEPTED/FAILED to actual delivery',async()=>{
 const capture=await syntheticCapture();
 const envelope=signed('SIGNAL_DELIVERY',receipt(capture.entries[0],'FAILED'),{capturedAtMs:T+800});
 const report=auditB298SignedSignalDelivery({capture,receipt:envelope,...opts()});
 assert.equal(report.declaredAsDelivered,false);
 assert.equal(report.recipientActuallyReceivedCertified,false);
});

test('B298 refuses mismatched signal, changed hash, late receipt, forged chain',async()=>{
 const capture=await syntheticCapture();
 const mk=(patch)=>signed('SIGNAL_DELIVERY',{...receipt(capture.entries[0]),...patch},
  {capturedAtMs:T+800});
 for(const patch of [{signalId:'missing'},{decisionOutputSha256:'d'.repeat(64)},
  {receiptAtMs:T+3600000},{receiptAtMs:T-2000},
  {emittedAtMs:T-15000}]){
  fails(()=>auditB298SignedSignalDelivery({capture,receipt:mk(patch),...opts()}));
 }
 const changed={...capture,entries:capture.entries.map((e,i)=>i?e:{...e,rawOutputSha256:'f'.repeat(64)})};
 fails(()=>auditB298SignedSignalDelivery({capture:changed,receipt:mk({}),...opts()}));
});

test('B298 reverse reference inverts only open; manual/hybrid never invert',()=>{
 for(const [mode,side] of [['reverse','sell'],['manual','buy'],['hybrid','buy']]){
  const envelope=signed('OPERATOR_INTENT',intent('ev-'+mode,'ref-1','open','buy',mode),
   {nonce:'op-'+mode});
  const report=auditB298SignedOperatorIntent({envelope,...opts()});
  assert.equal(report.referenceSide,side);
  assert.equal(report.attachedToRealBrokerOrder,false);
  assert.equal(report.genuinePrivateReverseCoreUsed,false);
  assert.equal(report.externalConsentIndependentlyVerified,false);
  assert.equal(report.ordersSent,0);
 }
});

test('B298 signed reverse megatrend exception and cancel/close remain no-new-exposure',()=>{
 const open=signed('OPERATOR_INTENT',intent('ev-1','ref-1','open'),{nonce:'open'});
 const a=auditB298SignedOperatorIntent({envelope:open,megaTrendDirection:'buy',...opts()});
 assert.equal(a.referenceSide,'buy');
 assert.equal(a.referenceDecision,'MEGATREND_FOLLOW');
 const cancel=signed('OPERATOR_INTENT',intent('ev-2','ref-1','cancel'),{nonce:'cancel'});
 const b=auditB298SignedOperatorIntent({envelope:cancel,...opts()});
 assert.equal(b.noNewExposure,true);
 assert.equal(b.action,'cancel');
});

test('B298 signed multi-event lifecycle enforces chronology and reference isolation',()=>{
 const events=[
  signed('OPERATOR_INTENT',intent('ev1','r1','open','buy','reverse'),{capturedAtMs:T,nonce:'n1'}),
  signed('OPERATOR_INTENT',intent('ev2','r1','cancel','buy','reverse'),{capturedAtMs:T+400,nonce:'n2'}),
  signed('OPERATOR_INTENT',intent('ev3','r2','open','sell','manual'),{capturedAtMs:T+800,nonce:'n3'}),
  signed('OPERATOR_INTENT',intent('ev4','r2','close','sell','manual'),{capturedAtMs:T+1200,nonce:'n4'})
 ];
 const report=auditB298SignedOperatorLifecycle({envelopes:events,...opts()});
 assert.equal(report.observedEvents,4);
 assert.equal(report.actions.cancel,1);
 assert.equal(report.actions.close,1);
 assert.equal(report.unresolvedReferenceIntents,0);
 assert.equal(report.originalPrivateEngineComparedToActualOrders,false);
 assert.equal(report.cancelledOrClosedPositionsVerified,false);
 assert.equal(report.ordersSent,0);
 fails(()=>auditB298SignedOperatorLifecycle({envelopes:[events[1],events[0]],...opts()}));
 fails(()=>auditB298SignedOperatorLifecycle({envelopes:[events[0],events[0]],...opts()}));
 fails(()=>auditB298SignedOperatorLifecycle({envelopes:[events[0],events[2],events[1]],...opts()}));
 const wrongSide=signed('OPERATOR_INTENT',intent('ev2','r1','close','sell','reverse'),{capturedAtMs:T+400,nonce:'n2'});
 fails(()=>auditB298SignedOperatorLifecycle({envelopes:[events[0],wrongSide],...opts()}));
 const wrongMode=signed('OPERATOR_INTENT',intent('ev2','r1','close','buy','hybrid'),{capturedAtMs:T+400,nonce:'n2'});
 fails(()=>auditB298SignedOperatorLifecycle({envelopes:[events[0],wrongMode],...opts()}));
});

test('B298 hypothetical Lossometer cannot be converted into real earnings',()=>{
 const report=computeB298LossometerHypotheses([
  {id:'a',source:'LAB_COUNTERFACTUAL_ONLY',referenceNetR:-1,candidateNetR:0.3},
  {id:'b',source:'LAB_COUNTERFACTUAL_ONLY',referenceNetR:2,candidateNetR:-0.2},
  {id:'c',source:'LAB_COUNTERFACTUAL_ONLY',referenceNetR:-0.4,candidateNetR:-0.7}
 ]);
 assert.equal(report.hypotheticalLossesAvoided,1);
 assert.equal(report.hypotheticalProfitsForegone,1);
 assert.equal(report.hypotheticalLossRNotTaken,1);
 assert.equal(report.hypotheticalProfitRForegone,2);
 assert.equal(report.actualLossesAvoided,null);
 assert.equal(report.actualBrokerRealizedPnl,null);
 assert.equal(report.realizedPnLVerified,false);
 assert.equal(report.commercialPerformanceClaimAllowed,false);
});

test('B298 Lossometer refuses duplications, fake sources, and nonfinite returns',()=>{
 const good={id:'a',source:'LAB_COUNTERFACTUAL_ONLY',referenceNetR:-1,candidateNetR:1};
 fails(()=>computeB298LossometerHypotheses([good,good]));
 fails(()=>computeB298LossometerHypotheses([{...good,source:'REAL_BROKER_PROFIT'}]));
 fails(()=>computeB298LossometerHypotheses([{...good,candidateNetR:Infinity}]));
 fails(()=>computeB298LossometerHypotheses([{...good,actualPnl:999999}]));
});

test('B298 final integration gate remains NO-GO without independent external data',()=>{
 const gate=assessB298ExternalIntegrationGate();
 assert.equal(gate.status,'NO_GO_EXTERNAL_SOURCES_NOT_CONNECTED');
 assert.equal(gate.signedExportContractImplemented,true);
 for(const k of ['networkBrokerFeedConnected','independentlyVerifiedOperatorConsent',
 'independentDeliveryProviderAck','originalPrivateCoreToBrokerEventBound',
 'durableExternalAntiReplay','realLossometerCertified','commercialLaunchAllowed',
 'liveExecutionAuthorized'])assert.equal(gate[k],false);
 assert.equal(gate.ordersSent,0);
 assert.equal(gate.paperOrdersSent,0);
});

// Private CLI safety is tested against temporary fixture files outside the repo.
// It does not contact the broker, send a paper order, or read any actual account.
import {mkdtempSync,writeFileSync,chmodSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
const cliPath=resolve('scripts/platform/research/b298-audit-signed-readonly.mjs');
const makeCLIFixture=()=>{
 const dir=mkdtempSync(join(tmpdir(),'jenios-b298-audit-'));
 chmodSync(dir,0o700);
 const stamp=Date.now()-15000;
 const a=signed('ORDER_GET',order('filled','2'),{nonce:'fixture-1',capturedAtMs:stamp});
 const b=signed('ORDER_GET',order('filled','2'),{nonce:'fixture-2',capturedAtMs:stamp+1000});
 const json=join(dir,'event.json'),key=join(dir,'collector.pem');
 writeFileSync(json,JSON.stringify({schema:'JENIOS_B298_OFFLINE_PRIVATE_PACKAGE_V1',
  signedOrders:[[a,b]],signedPositions:[],signedSignalReceipts:[],signedOperatorIntents:[]}),{mode:0o600});
 writeFileSync(key,trustedKeys.collector_1,{mode:0o600});
 const env={...process.env,VERCEL:'',VERCEL_ENV:'',
  JENIOS_B298_PRIVATE_READ_ONLY:'true',
  JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED:'false',
  JENIOS_PRIVATE_PAPER_EXECUTOR:'false',JENIOS_REAL_EXECUTION_ENABLED:'false',
  JENIOS_B298_OWNER_DIGEST:scope.ownerDigest,
  JENIOS_B298_ACCOUNT_DIGEST:scope.accountDigest,
  JENIOS_B298_CONSENT_DIGEST:scope.consentDigest,
  JENIOS_B298_EVIDENCE_PATH:json,
  JENIOS_B298_TRUSTED_PUBLIC_KEY_PATH:key,
  JENIOS_B298_TRUSTED_KEY_ID:'collector_1'};
 return {dir,json,key,env,run:override=>spawnSync(process.execPath,[cliPath],
  {cwd:resolve('.'),env:{...env,...override},encoding:'utf8'})};
};

test('B298 isolated CLI reports read-only pair, never echoes client/broker identifiers',()=>{
 const x=makeCLIFixture();
 try{
  const result=x.run();
  assert.equal(result.status,0,result.stderr);
  const j=JSON.parse(result.stdout);
  assert.equal(j.signedOrderPairs,1);
  assert.equal(j.orderAssessments[0].assessment,'STABLE_TERMINAL_OBSERVATIONS');
  assert.equal(j.ordersSent,0);
  assert.equal(j.external.commercialLaunchAllowed,false);
  assert.equal(result.stdout.includes('client-001'),false);
  assert.equal(result.stdout.includes('brk-001'),false);
  assert.equal(result.stdout.includes(trustedKeys.collector_1),false);
 }finally{rmSync(x.dir,{recursive:true,force:true});}
});

test('B298 isolated CLI rejects world-readable or repository-contained evidence',()=>{
 const x=makeCLIFixture();
 try{
  chmodSync(x.json,0o644);
  const result=x.run();
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/B298_PRIVATE_FILE_NOT_PROTECTED/);
 }finally{rmSync(x.dir,{recursive:true,force:true});}
});

test('B298 isolated CLI denies Paper executor even with valid signed evidence',()=>{
 const x=makeCLIFixture();
 try{
  const result=x.run({JENIOS_PRIVATE_PAPER_EXECUTOR:'true'});
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/B298_PRIVATE_READ_ONLY_MODE_REQUIRED/);
 }finally{rmSync(x.dir,{recursive:true,force:true});}
});