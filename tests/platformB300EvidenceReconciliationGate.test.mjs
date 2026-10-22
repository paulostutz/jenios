import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {canonical} from '../lib/platform/pilot-prep/contracts.mjs';
import {captureB297OriginalDecisions} from '../lib/platform/research/b297-private-readonly-audit.mjs';
import {auditB300ReadOnlyCohort,assessB300LaunchReadiness} from '../lib/platform/research/b300-evidence-reconciliation-gate.mjs';
const T=Date.parse('2026-10-21T22:20:00Z');
const owner={ownerDigest:'a'.repeat(64),accountDigest:'b'.repeat(64),consentDigest:'c'.repeat(64)};
const collector=generateKeyPairSync('ed25519'),authority=generateKeyPairSync('ed25519'),outsider=generateKeyPairSync('ed25519');
const pub=k=>k.publicKey.export({format:'pem',type:'spki'});
const trustedConsentKeys={'owner-signer':pub(authority)},trustedCollectorKeys={'collector-signer':pub(collector)};
const signed=(payload,key,domain)=>({payload,signatureBase64:sign(null,
 Buffer.from(domain+canonical(payload),'utf8'),key.privateKey).toString('base64')});
const CON='JENIOS_B299_OWNER_CONSENT_V1\0',EVI='JENIOS_B298_READONLY_EVIDENCE_V1\0';
let serial=0;
const consent=(overrides={})=>signed({schema:'JENIOS_B299_SIGNED_READ_CONSENT_V1',
 consentId:'B300-consent',...owner,collectorKeyId:'collector-signer',
 consentKeyId:'owner-signer',allowedKinds:['ORDER_GET','POSITION_GET','SIGNAL_DELIVERY','OPERATOR_INTENT'],
 issuedAtMs:T-10000,expiresAtMs:T+100000,readOnly:true,paperExecutionAllowed:false,
 liveExecutionAllowed:false,...overrides},authority,CON);
const make=(kind,event,at=T-3000,{nonce,scope={},key=collector,expiry=T+60000}={})=>{
 serial++;
 const provider=kind==='ORDER_GET'||kind==='POSITION_GET'?'alpaca':
 kind==='SIGNAL_DELIVERY'?'notification-export':'customer-event-export';
 const environment=kind==='ORDER_GET'||kind==='POSITION_GET'?'paper':'isolated';
 const payload={schema:'JENIOS_B298_READONLY_EVIDENCE_V1',kind,keyId:'collector-signer',
  nonce:nonce??`B300-event-${serial}`, ...owner,...scope,provider,environment,
  capturedAtMs:at,expiresAtMs:expiry,readOnly:true,executionTransportEnabled:false,
  ordersSent:0,paperOrdersSent:0,event:{kind,...event,observedAtMs:at}};
 if(kind==='SIGNAL_DELIVERY')delete payload.event.observedAtMs;
 return signed(payload,key,EVI);
};
const order=(status='filled',filled='2',id='ord-1',symbol='BTCUSD')=>({
 clientOrderId:'cust-order-1',symbol,expectedQuantity:'2',
 order:{id,client_order_id:'cust-order-1',symbol,qty:'2',filled_qty:filled,status}});
const position=(side='flat',quantity='0',symbol='BTCUSD')=>({symbol,side,quantity});
const op=(name,mode,action,side,ref)=>({eventId:name,referenceId:ref,commercialMode:mode,action,side});
const risk=()=>({order:{clientOrderId:'b300-check',mode:'direct',side:'buy',quantity:'0.1',entry:'100',stop:'95',target:'120'},
 meta:{provider:'alpaca',id:'BTCUSD',marketType:'spot',base:'BTC',quote:'USD',settlement:'USD',
 contractSize:'1',qtyStep:'0.01',minQty:'0.01',maxQty:'2',tickSize:'0.01',capturedAtMs:T-1000,
 sourceSha256:'a'.repeat(64),quantityUnit:'base'},
 options:{now:T,roundTripFeeBps:20,slippageBps:10,fundingCost:'0'}});
const createCapture=()=>captureB297OriginalDecisions({nowMs:T-2000,scenarios:[
 {id:'m-buy',mode:'manual',intent:'buy',horizon:'day'},
 {id:'h-sell',mode:'hybrid',intent:'sell',horizon:'swing'},
 {id:'r-buy',mode:'reverse',intent:'buy',horizon:'day'}],
 analyzeRequest:async ({mode,intent},{now})=>({ok:true,version:'B300_FAKE_TEST_CALLBACK',
  simulation:true,executionEnabled:false,sourceMode:'synthetic',symbol:'LABORATÓRIO SINTÉTICO',
  scan:{decisionAt:now-2000},decision:{action:mode==='manual'?'manual_preview':
    mode==='hybrid'?'wait_for_confluence':'reverse_not_calibrated',
    side:mode==='manual'?intent:null,mayClose:true}})
});
const makeBundle=async()=>{
 const capture=await createCapture();
 const signal=capture.entries[0];
 return {scope:owner,signedConsent:consent(),trustedConsentKeys,trustedCollectorKeys,nowMs:T,
  b297Capture:capture,
  orderPairs:[[make('ORDER_GET',order(),T-1600),make('ORDER_GET',order(),T-1100)]],
  positionPairs:[[make('POSITION_GET',position(),T-1550),make('POSITION_GET',position(),T-1000)]],
  deliveryReceipts:[make('SIGNAL_DELIVERY',{
   signalId:signal.id,decisionOutputSha256:signal.rawOutputSha256,
   emittedAtMs:signal.decisionAtMs,receiptAtMs:T-700,targetOpenMs:T+30000,
   recipientDigest:'d'.repeat(64),receiptStatus:'DELIVERED'},T-500)],
  operatorIntents:[
   make('OPERATOR_INTENT',op('op1','manual','open','buy','man-1'),T-980),
   make('OPERATOR_INTENT',op('op2','manual','close','buy','man-1'),T-940),
   make('OPERATOR_INTENT',op('op3','hybrid','open','sell','hyb-1'),T-900),
   make('OPERATOR_INTENT',op('op4','hybrid','cancel','sell','hyb-1'),T-860),
   make('OPERATOR_INTENT',op('op5','reverse','open','buy','rev-1'),T-820),
   make('OPERATOR_INTENT',op('op6','reverse','close','buy','rev-1'),T-780)
  ],riskChecks:[risk()],lossometerWhatIf:[
   {id:'s1',referenceNetR:-1.2,candidateNetR:0.1,source:'LAB_COUNTERFACTUAL_ONLY'},
   {id:'s2',referenceNetR:1.1,candidateNetR:-0.2,source:'LAB_COUNTERFACTUAL_ONLY'}]
 };
};
const matchError=(fn,code)=>assert.throws(fn,new RegExp(code));

test('B300 correlates three fixture modes but never upgrades them into broker attestations',async()=>{
 const report=auditB300ReadOnlyCohort(await makeBundle());
 assert.equal(report.evidenceCount,11);
 assert.deepEqual(report.collectorClaimedModes,{manual:2,hybrid:2,reverse:2});
 assert.equal(report.orderPairs,1);assert.equal(report.positionPairs,1);
 assert.equal(report.declaredDelivered,1);assert.equal(report.actualDeliveryConfirmed,false);
 assert.equal(report.riskArithmeticOnly,true);assert.equal(report.staticRiskArithmeticChecks,1);
 assert.equal(report.consentSignatureVerifiedToConfiguredKey,true);
 assert.equal(report.realPnlVerified,null);assert.equal(report.brokerRealFillVerified,false);
 assert.equal(report.b152DurableLedgerReconciled,false);
 assert.equal(report.ordersSent,0);assert.equal(report.paperOrdersSent,0);
 assert.equal(report.releaseStatus,'NO_GO_EXTERNAL_VERIFICATION_REQUIRED');
 assert.match(report.reportSha256,/^[a-f0-9]{64}$/);
});
test('B300 Lossometer numbers are strictly hypothetical; actual fields remain null',async()=>{
 const r=auditB300ReadOnlyCohort(await makeBundle());
 assert.equal(r.hypothesis.hypotheticalLossesAvoided,1);
 assert.equal(r.hypothesis.hypotheticalLossRNotTaken,1.2);
 assert.equal(r.hypothesis.hypotheticalProfitsForegone,1);
 assert.equal(r.hypothesis.hypotheticalProfitRForegone,1.1);
 assert.equal(r.hypothesis.actualLossesAvoided,null);
 assert.equal(r.hypothesis.actualBrokerRealizedPnl,null);
 assert.equal(r.manualLossStreakVerified,null);
 assert.equal(r.commercialResultsCanBeClaimed,false);
});
test('B300 deterministic digest for equivalent signed export and consent',async()=>{
 const a=await makeBundle();const one=auditB300ReadOnlyCohort(a),two=auditB300ReadOnlyCohort(a);
 assert.equal(one.reportSha256,two.reportSha256);
});
test('B300 remains NO-GO even if local paired broker status says filled and position says flat',async()=>{
 const r=auditB300ReadOnlyCohort(await makeBundle());
 assert.ok(r.issues.includes('FILLED_ORDER_AND_FLAT_POSITION_NOT_A_CLOSE_PROOF'));
 assert.ok(r.issues.includes('COLLECTOR_EXPORT_NOT_OFFICIAL_BROKER_ATTESTATION'));
 assert.equal(r.brokerStopAndTargetGuaranteed,false);
});
test('B300 consent key that does not match configured authority is rejected',async()=>{
 const b=await makeBundle();b.signedConsent=signed(b.signedConsent.payload,outsider,CON);
 matchError(()=>auditB300ReadOnlyCohort(b),'B299_SIGNATURE_VERIFICATION_FAILED');
});
test('B300 revoked or future consent cannot be claimed by moving its timestamp',async()=>{
 const b=await makeBundle();b.signedConsent=consent({issuedAtMs:T+1,expiresAtMs:T+100000});
 matchError(()=>auditB300ReadOnlyCohort(b),'B299_CONSENT_INACTIVE_OR_INVALID');
});
test('B300 past expiry is rejected without trusting caller claims',async()=>{
 const b=await makeBundle();b.signedConsent=consent({expiresAtMs:T-1});
 matchError(()=>auditB300ReadOnlyCohort(b),'B299_CONSENT_INACTIVE_OR_INVALID');
});
test('B300 rejects scope mismatch even if the export is re-signed by a configured collector',async()=>{
 const b=await makeBundle();const a=b.orderPairs[0][0];
 b.orderPairs[0][0]=signed({...a.payload,accountDigest:'e'.repeat(64)},collector,EVI);
 matchError(()=>auditB300ReadOnlyCohort(b),'B298_WRONG_ACCOUNT_OR_CONSENT_SCOPE');
});
test('B300 rejects collector trust root rotation without an updated consent',async()=>{
 const b=await makeBundle();b.trustedCollectorKeys={'collector-signer':pub(outsider)};
 assert.throws(()=>auditB300ReadOnlyCohort(b));
});
test('B300 rejects a valid signature from a collector outside the consent key ID',async()=>{
 const b=await makeBundle();const a=b.orderPairs[0][0];
 b.trustedCollectorKeys={...trustedCollectorKeys,'collector-second':pub(outsider)};
 b.orderPairs[0][0]=signed({...a.payload,keyId:'collector-second'},outsider,EVI);
 matchError(()=>auditB300ReadOnlyCohort(b),'B300_OUTSIDE_SIGNED_CONSENT');
});
test('B300 rejects when signed consent does not permit a required read kind',async()=>{
 const b=await makeBundle();b.signedConsent=consent({allowedKinds:['POSITION_GET','SIGNAL_DELIVERY','OPERATOR_INTENT']});
 matchError(()=>auditB300ReadOnlyCohort(b),'B300_OUTSIDE_SIGNED_CONSENT');
});
test('B300 rejects signed export captured before consent issued',async()=>{
 const b=await makeBundle();b.signedConsent=consent({issuedAtMs:T-1200});
 matchError(()=>auditB300ReadOnlyCohort(b),'B300_OUTSIDE_SIGNED_CONSENT');
});
test('B300 rejects signed export captured at consent expiry even if now is valid',async()=>{
 const b=await makeBundle();const a=b.orderPairs[0][1];
 b.signedConsent=consent({expiresAtMs:T-500});
 // The consent is already inactive at T: a B299 failure, never false accepted.
 matchError(()=>auditB300ReadOnlyCohort(b),'B299_CONSENT_INACTIVE_OR_INVALID');
});
test('B300 rejects duplicate nonce across different types of signed export',async()=>{
 const b=await makeBundle(),v=b.orderPairs[0][0],other=b.positionPairs[0][0];
 b.positionPairs[0][0]=signed({...other.payload,nonce:v.payload.nonce},collector,EVI);
 matchError(()=>auditB300ReadOnlyCohort(b),'B300_DUPLICATE_EVIDENCE_OR_NONCE');
});
test('B300 rejects duplicate order pair in same signed cohort',async()=>{
 const b=await makeBundle(),a=b.orderPairs[0];b.orderPairs.push(a);
 matchError(()=>auditB300ReadOnlyCohort(b),'B300_DUPLICATE_EVIDENCE_OR_NONCE');
});
test('B300 rejects duplicate order ID even when nonces and signatures differ',async()=>{
 const b=await makeBundle();b.orderPairs.push([
  make('ORDER_GET',order(),T-1500),make('ORDER_GET',order(),T-900)]);
 matchError(()=>auditB300ReadOnlyCohort(b),'B300_ORDER_TWICE_IN_COHORT');
});
test('B300 rejects a repeated position symbol despite distinct read pair',async()=>{
 const b=await makeBundle();b.positionPairs.push([
  make('POSITION_GET',position(),T-1400),make('POSITION_GET',position(),T-800)]);
 matchError(()=>auditB300ReadOnlyCohort(b),'B300_POSITION_TWICE_IN_COHORT');
});
test('B300 rejects mismatched order IDs across pair without looking at broker',async()=>{
 const b=await makeBundle();const v=b.orderPairs[0][1];
 b.orderPairs[0][1]=signed({...v.payload,event:{...v.payload.event,clientOrderId:'other',
  order:{...v.payload.event.order,client_order_id:'other'}}},collector,EVI);
 matchError(()=>auditB300ReadOnlyCohort(b),'B298_INCOMPARABLE_BROKER_READS');
});
test('B300 partial cancellation after partial fill is critical manual review',async()=>{
 const b=await makeBundle();b.orderPairs=[[make('ORDER_GET',order('partially_filled','1'),T-1400),
  make('ORDER_GET',order('canceled','1'),T-800)]];
 const r=auditB300ReadOnlyCohort(b);
 assert.equal(r.severity,'CRITICAL_REVIEW');
 assert.ok(r.issues.includes('CANCEL_WITH_PARTIAL_FILL_REQUIRES_REVIEW'));
 assert.equal(r.ordersSent,0);
});
test('B300 changed position observation triggers critical review, never close confirmation',async()=>{
 const b=await makeBundle();b.positionPairs=[[make('POSITION_GET',position('long','2'),T-1550),
  make('POSITION_GET',position('flat','0'),T-900)]];
 const r=auditB300ReadOnlyCohort(b);
 assert.equal(r.severity,'CRITICAL_REVIEW');
 assert.ok(r.issues.includes('POSITION_CHANGED_OR_AMBIGUOUS'));
 assert.equal(r.brokerRealFillVerified,false);
});
test('B300 missing order position match reported, not assumed closed',async()=>{
 const b=await makeBundle();b.positionPairs=[[make('POSITION_GET',position('flat','0','ETHUSD'),T-1550),
  make('POSITION_GET',position('flat','0','ETHUSD'),T-900)]];
 const r=auditB300ReadOnlyCohort(b);
 assert.ok(r.issues.includes('ORDER_HAS_NO_SAME_SYMBOL_POSITION_READ'));
});
test('B300 signal FAILED receipt counts as a claim, not a delivered signal',async()=>{
 const b=await makeBundle();const a=b.deliveryReceipts[0];
 b.deliveryReceipts=[signed({...a.payload,event:{...a.payload.event,receiptStatus:'FAILED'}},collector,EVI)];
 const r=auditB300ReadOnlyCohort(b);
 assert.equal(r.declaredDelivered,0);assert.equal(r.declaredFailed,1);
 assert.ok(r.issues.includes('DELIVERY_NOT_DECLARED_DELIVERED'));
});
test('B300 rejects a mismatched decision hash in signed delivery receipt',async()=>{
 const b=await makeBundle();const a=b.deliveryReceipts[0];
 b.deliveryReceipts=[signed({...a.payload,event:{...a.payload.event,
  decisionOutputSha256:'e'.repeat(64)}},collector,EVI)];
 matchError(()=>auditB300ReadOnlyCohort(b),'B298_UNMATCHED_OR_LATE_SIGNAL_RECEIPT');
});
test('B300 rejects a capture chain modified after core callback return',async()=>{
 const b=await makeBundle();b.b297Capture={...b.b297Capture,entries:b.b297Capture.entries.map((e,i)=>i?e:{...e,action:'wait_for_context'})};
 matchError(()=>auditB300ReadOnlyCohort(b),'B297_AUDIT_CHAIN_TAMPERED');
});
test('B300 rejects a signal receipt without private local B297 reference',async()=>{
 const b=await makeBundle();b.b297Capture=null;
 matchError(()=>auditB300ReadOnlyCohort(b),'B300_ORIGINAL_CAPTURE_REQUIRED');
});
test('B300 never infers an actual fill from a signed collector-exported status',async()=>{
 const b=await makeBundle();const r=auditB300ReadOnlyCohort(b);
 assert.equal(r.orderAssessments[0].kind,'FILLED');
 assert.equal(r.actualDeliveryConfirmed,false);assert.equal(r.brokerRealFillVerified,false);
 assert.equal(r.realPnlVerified,null);
});
test('B300 flags unresolved operator references as critical review',async()=>{
 const b=await makeBundle();b.operatorIntents.push(make('OPERATOR_INTENT',
  op('op7','reverse','open','buy','unresolved'),T-600));
 const r=auditB300ReadOnlyCohort(b);
 assert.equal(r.unresolvedOperatorReferences,1);
 assert.ok(r.issues.includes('OPEN_OPERATOR_INTENTS_UNRECONCILED'));
 assert.equal(r.severity,'CRITICAL_REVIEW');
});
test('B300 duplicate operator event IDs are rejected by existing B298 lifecycle',async()=>{
 const b=await makeBundle();b.operatorIntents[1]=make('OPERATOR_INTENT',
  op('op1','manual','close','buy','man-1'),T-940);
 matchError(()=>auditB300ReadOnlyCohort(b),'B298_OPERATOR_SEQUENCE_TAMPERED');
});
test('B300 orphan close does not silently open a reverse exposure',async()=>{
 const b=await makeBundle();b.operatorIntents[1]=make('OPERATOR_INTENT',
  op('op2','manual','close','buy','unknown'),T-940);
 matchError(()=>auditB300ReadOnlyCohort(b),'B298_ORPHAN_OR_MISMATCHED_CLOSE');
});
test('B300 invalid risk arithmetic fails closed without touching B152 ledger',async()=>{
 const b=await makeBundle();b.riskChecks[0].order.stop='105';
 assert.throws(()=>auditB300ReadOnlyCohort(b));
});
test('B300 spot short risk calculation is rejected by original B152 arithmetic',async()=>{
 const b=await makeBundle();b.riskChecks[0].order={...b.riskChecks[0].order,side:'sell',stop:'105',target:'85'};
 assert.throws(()=>auditB300ReadOnlyCohort(b));
});
test('B300 unexpected risk fields rejected before certification',async()=>{
 const b=await makeBundle();b.riskChecks=[{...risk(),apiSecret:'fake'}];
 matchError(()=>auditB300ReadOnlyCohort(b),'B300_RISK_FIELDS_INVALID');
});
test('B300 rejects actual P&L inserted into hypothetical Lossometer',async()=>{
 const b=await makeBundle();b.lossometerWhatIf=[{...b.lossometerWhatIf[0],actualProfit:1000}];
 matchError(()=>auditB300ReadOnlyCohort(b),'B298_UNTRUSTED_LOSSOMETER_EVENT');
});
test('B300 rejects mixed live trading claims in signed envelope',async()=>{
 const b=await makeBundle();const x=b.orderPairs[0][0];
 b.orderPairs[0][0]=signed({...x.payload,ordersSent:1},collector,EVI);
 matchError(()=>auditB300ReadOnlyCohort(b),'B298_INVALID_OR_STALE_READ_ENVELOPE');
});
test('B300 never interprets one order read as a stable pair',async()=>{
 const b=await makeBundle();b.orderPairs=[[b.orderPairs[0][0]]];
 matchError(()=>auditB300ReadOnlyCohort(b),'B300_ORDER_PAIR_REQUIRED');
});
test('B300 invalid sizes, clock, and empty reviews are rejected',async()=>{
 const b=await makeBundle();
 matchError(()=>auditB300ReadOnlyCohort({...b,nowMs:0}),'B300_INVALID_CLOCK');
 matchError(()=>auditB300ReadOnlyCohort({...b,orderPairs:Array(21).fill(null)}),'B300_INVALID_ORDER_PAIRS');
 matchError(()=>auditB300ReadOnlyCohort({...b,orderPairs:[],positionPairs:[],deliveryReceipts:[],operatorIntents:[],riskChecks:[]}),
  'B300_EMPTY_REVIEW');
});
test('B300 signed but missing operator events never claims three-mode coverage',async()=>{
 const b=await makeBundle();b.operatorIntents=[];
 const r=auditB300ReadOnlyCohort(b);
 assert.equal(r.operatorEvents,0);assert.ok(r.issues.includes('THREE_COMMERCIAL_MODES_INCOMPLETE'));
 assert.equal(r.automaticReverseModeSwitch,false);
});
test('B300 signed but missing risk check never claims B152 reconciliation',async()=>{
 const b=await makeBundle();b.riskChecks=[];
 const r=auditB300ReadOnlyCohort(b);
 assert.ok(r.issues.includes('RISK_B152_EVIDENCE_MISSING'));
 assert.equal(r.b152DurableLedgerReconciled,false);
});
test('B300 cannot use a forged source with an actual account id embedded',async()=>{
 const b=await makeBundle();const x=b.positionPairs[0][0];
 b.positionPairs[0][0]=signed({...x.payload,apiKey:'secret'},collector,EVI);
 assert.throws(()=>auditB300ReadOnlyCohort(b));
});
test('B300 no-go launch assessment forbids orders, Paper, financial claims and deploy',()=>{
 const result=assessB300LaunchReadiness();
 assert.equal(result.status,'NO_GO_REQUIRE_INDEPENDENT_EXTERNAL_EVIDENCE');
 assert.equal(result.liveExecutionPermitted,false);
 assert.equal(result.paperExecutionPermitted,false);
 assert.equal(result.automatedModeSwitchPermitted,false);
 assert.equal(result.commercialPerformanceClaimsPermitted,false);
 assert.equal(result.productionDeployPermitted,false);
});

// CLI integration: only owner-readable off-repository files; no network, no trading.
import {mkdtempSync,chmodSync,writeFileSync,rmSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
const cli=resolve(process.cwd(),'scripts/platform/research/b300-review-private-cohort.mjs');
async function withOfflineBundle(fn){
 const dir=mkdtempSync(join(tmpdir(),'jenios-b300-fixture-'));chmodSync(dir,0o700);
 const bundle=await makeBundle();
 const paths={bundle:join(dir,'bundle.json'),consent:join(dir,'consent.pem'),collector:join(dir,'collector.pem')};
 const x=({schema:'JENIOS_B300_PRIVATE_COHORT_V1',signedConsent:bundle.signedConsent,
   b297Capture:bundle.b297Capture,orderPairs:bundle.orderPairs,
   positionPairs:bundle.positionPairs,deliveryReceipts:bundle.deliveryReceipts,
   operatorIntents:bundle.operatorIntents,riskChecks:bundle.riskChecks,
   lossometerWhatIf:bundle.lossometerWhatIf});
 try{
  for(const [path,content] of [[paths.bundle,JSON.stringify(x)],
      [paths.consent,pub(authority)],[paths.collector,pub(collector)]])
   writeFileSync(path,content,{mode:0o600});
  const environment={...process.env,VERCEL:'',VERCEL_ENV:'',JENIOS_B300_PRIVATE_READ_ONLY:'true',
   JENIOS_B300_OWNER_DIGEST:owner.ownerDigest,
   JENIOS_B300_ACCOUNT_DIGEST:owner.accountDigest,
   JENIOS_B300_CONSENT_DIGEST:owner.consentDigest,
   JENIOS_B300_COLLECTOR_KEY_ID:'collector-signer',
   JENIOS_B300_CONSENT_KEY_ID:'owner-signer',
   JENIOS_B300_PACKAGE_PATH:paths.bundle,
   JENIOS_B300_CONSENT_PUBLIC_KEY_PATH:paths.consent,
   JENIOS_B300_COLLECTOR_PUBLIC_KEY_PATH:paths.collector,
   JENIOS_B300_LAB_CLOCK_OVERRIDE:String(T),
   JENIOS_B300_FIXTURE_ONLY:'LAB_SYNTHETIC_FIXTURE_ONLY',
   JENIOS_REAL_EXECUTION_ENABLED:'false',
   JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED:'false',
   JENIOS_PRIVATE_PAPER_EXECUTOR:'false'};
  const exec=(extra={})=>spawnSync(process.execPath,[cli],{cwd:process.cwd(),
    env:{...environment,...extra},timeout:20000,encoding:'utf8'});
  await fn({paths,dir,bundle,exec});
 }finally{rmSync(dir,{recursive:true,force:true});}
}
test('B300 isolated CLI reads protected fixtures and outputs redacted NO-GO report',async()=>{
 await withOfflineBundle(({exec})=>{
  const run=exec();assert.equal(run.status,0,run.stderr);
  const report=JSON.parse(run.stdout);
  assert.equal(report.evidenceCount,11);
  assert.equal(report.releaseStatus,'NO_GO_EXTERNAL_VERIFICATION_REQUIRED');
  assert.equal(report.rawSourceContentsEmitted,false);
  assert.equal(report.labClockOverridden,true);
  assert.equal(report.ordersSent,0);
  assert.ok(!run.stdout.includes(owner.ownerDigest));
  assert.ok(!run.stdout.includes('cust-order-1'));
  assert.ok(!run.stdout.includes('BEGIN PUBLIC KEY'));
 });
});
test('B300 CLI refuses missing read-only guard and enabled Paper executor',async()=>{
 await withOfflineBundle(({exec})=>{
  const noGuard=exec({JENIOS_B300_PRIVATE_READ_ONLY:'false'});
  assert.notEqual(noGuard.status,0);
  assert.match(noGuard.stderr,/B300_PRIVATE_READONLY_ENV_REQUIRED/);
  const wrong=exec({JENIOS_PRIVATE_PAPER_EXECUTOR:'true'});
  assert.notEqual(wrong.status,0);
  assert.match(wrong.stderr,/B300_PRIVATE_READONLY_ENV_REQUIRED/);
 });
});
test('B300 CLI rejects unprotected group-readable file',async()=>{
 await withOfflineBundle(({paths,exec})=>{
  chmodSync(paths.bundle,0o644);
  const run=exec();assert.notEqual(run.status,0);
  assert.match(run.stderr,/B300_PRIVATE_FILE_UNSAFE/);
 });
});
test('B300 CLI refuses to follow symlinks to private fixtures',async()=>{
 await withOfflineBundle(({paths,dir,exec})=>{
  const link=join(dir,'link.json');symlinkSync(paths.bundle,link);
  const run=exec({JENIOS_B300_PACKAGE_PATH:link});
  assert.notEqual(run.status,0);
  assert.match(run.stderr,/B300_PRIVATE_FILE_UNSAFE/);
 });
});
test('B300 CLI refuses unapproved clock override even for otherwise valid exports',async()=>{
 await withOfflineBundle(({exec})=>{
  const run=exec({JENIOS_B300_FIXTURE_ONLY:'false'});
  assert.notEqual(run.status,0);
  assert.match(run.stderr,/B300_UNAUTHORIZED_CLOCK_OVERRIDE/);
 });
});