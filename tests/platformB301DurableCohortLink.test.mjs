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

import {randomBytes} from 'node:crypto';
import {mkdtempSync,rmSync,chmodSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {B299PrivateEvidenceJournal} from '../lib/platform/research/b299-private-consent-replay-journal.mjs';
import {linkB301PrivateCohortOnce} from '../lib/platform/research/b301-durable-cohort-link.mjs';
const makeJournal=()=>{
 const dir=mkdtempSync(join(tmpdir(),'jenios-b301-private-'));
 chmodSync(dir,0o700);
 const path=join(dir,'audit.sqlite');
 const auditKeyBase64=randomBytes(32).toString('base64');
 const open=()=>new B299PrivateEvidenceJournal(path,{auditKeyBase64,repositoryRoot:process.cwd()});
 return {path,dir,open,cleanup:()=>rmSync(dir,{recursive:true,force:true})};
};
const withJournal=async(callback)=>{const fixture=makeJournal();const journal=fixture.open();
 try{return await callback(journal,fixture)}finally{journal.close();fixture.cleanup()}};

test('B301 binds a signed B300 cohort to B299 durable journal with eleven receipts',async()=>withJournal(async journal=>{
 const cohort=await makeBundle(),before=journal.inspect(owner,cohort.signedConsent.payload.consentId);
 assert.equal(before.recordedEvidenceCount,0);
 const result=linkB301PrivateCohortOnce({cohort,journal,nowMs:T});
 assert.equal(result.durableReceiptCount,11);
 assert.equal(result.localJournalCount,11);
 assert.equal(result.durableLocalReplayGateUsed,true);
 assert.equal(result.externallyAttestedBroker,false);
 assert.equal(result.independentDeliveryVerified,false);
 assert.equal(result.actualBrokerRealizedPnl,null);
 assert.equal(result.actualLossesAvoided,null);
 assert.equal(result.hypotheticalLossesAvoided,1);
 assert.equal(result.hypotheticalProfitsForegone,1);
 assert.equal(result.ordersSent,0);
 assert.equal(result.releaseStatus,'NO_GO_EXTERNAL_VERIFICATION_REQUIRED');
 assert.match(result.receiptBatchSha256,/^[a-f0-9]{64}$/);
 assert.equal(journal.inspect(owner,cohort.signedConsent.payload.consentId).recordedEvidenceCount,11);
}));

test('B301 never accepts a replayed cohort, even if all signatures are valid',async()=>withJournal(async journal=>{
 const cohort=await makeBundle();linkB301PrivateCohortOnce({cohort,journal,nowMs:T});
 assert.throws(()=>linkB301PrivateCohortOnce({cohort,journal,nowMs:T}),/B301_COHORT_ALREADY_STARTED_OR_PARTIAL/);
 assert.equal(journal.inspect(owner,cohort.signedConsent.payload.consentId).recordedEvidenceCount,11);
}));

test('B301 journal survives process restart and replay remains blocked',async()=>{
 const fixture=makeJournal();const cohort=await makeBundle();let journal=fixture.open();
 try{
  linkB301PrivateCohortOnce({cohort,journal,nowMs:T});journal.close();
  journal=fixture.open();
  assert.equal(journal.inspect(owner,cohort.signedConsent.payload.consentId).recordedEvidenceCount,11);
  assert.throws(()=>linkB301PrivateCohortOnce({cohort,journal,nowMs:T}),/B301_COHORT_ALREADY_STARTED_OR_PARTIAL/);
 }finally{journal.close();fixture.cleanup()}
});

test('B301 tampered consent rejected before writing any journal event',async()=>withJournal(async journal=>{
 const cohort=await makeBundle();cohort.signedConsent.signatureBase64='A'.repeat(88);
 assert.throws(()=>linkB301PrivateCohortOnce({cohort,journal,nowMs:T}),/B299_SIGNATURE_VERIFICATION_FAILED|B299_INVALID_SIGNATURE_ENCODING/);
 assert.equal(journal.inspect(owner,'B300-consent').recordedEvidenceCount,0);
}));

test('B301 invalid collector export fails entire preflight without partial journal writes',async()=>withJournal(async journal=>{
 const cohort=await makeBundle();const p=cohort.orderPairs[0][1];
 cohort.orderPairs[0][1]={...p,payload:{...p.payload,capturedAtMs:T-300}};
 assert.throws(()=>linkB301PrivateCohortOnce({cohort,journal,nowMs:T}),/B298_/);
 assert.equal(journal.inspect(owner,cohort.signedConsent.payload.consentId).recordedEvidenceCount,0);
}));

test('B301 rejects a forged journal object and a foreign clock',async()=>{
 const cohort=await makeBundle();
 assert.throws(()=>linkB301PrivateCohortOnce({cohort,journal:{inspect:()=>({recordedEvidenceCount:0})},nowMs:T}),/B301_ISOLATED_JOURNAL_AND_CLOCK_REQUIRED/);
 await withJournal(async journal=>{
  assert.throws(()=>linkB301PrivateCohortOnce({cohort,journal,nowMs:T+1}),/B301_ISOLATED_JOURNAL_AND_CLOCK_REQUIRED/);
  assert.equal(journal.inspect(owner,'B300-consent').recordedEvidenceCount,0);
 });
});

test('B301 local consent revocation stops all new evidence',async()=>withJournal(async journal=>{
 const cohort=await makeBundle();
 const payload={schema:'JENIOS_B299_SIGNED_CONSENT_REVOCATION_V1',consentId:cohort.signedConsent.payload.consentId,
  ...owner,consentKeyId:'owner-signer',revokedAtMs:T-500};
 const revocation=signed(payload,authority,'JENIOS_B299_CONSENT_REVOCATION_V1\0');
 journal.revoke({signedConsent:cohort.signedConsent,signedRevocation:revocation,
  trustedConsentKeys,scope:owner,nowMs:T});
 assert.throws(()=>linkB301PrivateCohortOnce({cohort,journal,nowMs:T}),/B301_CONSENT_REVOKED_LOCALLY/);
 assert.equal(journal.inspect(owner,'B300-consent').recordedEvidenceCount,0);
}));

test('B301 detects global duplicate across separate signed consents and fails closed after partial progress',async()=>withJournal(async journal=>{
 const cohort=await makeBundle();const other=consent({consentId:'B301-alternative'});
 journal.record({signedConsent:other,signedEvidence:cohort.orderPairs[0][1],trustedConsentKeys,
  trustedCollectorKeys,scope:owner,nowMs:T});
 assert.throws(()=>linkB301PrivateCohortOnce({cohort,journal,nowMs:T}),/B299_DUPLICATE_OR_REPLAYED_EVIDENCE/);
 // First new event was durably stored before the second was detected as duplicate.
 // Never automatically retry the batch after this failure.
 assert.equal(journal.inspect(owner,cohort.signedConsent.payload.consentId).recordedEvidenceCount,1);
}));

test('B301 rejects missing evidence before journal writes',async()=>withJournal(async journal=>{
 const cohort=await makeBundle();cohort.orderPairs=[];cohort.positionPairs=[];
 cohort.deliveryReceipts=[];cohort.operatorIntents=[];
 assert.throws(()=>linkB301PrivateCohortOnce({cohort,journal,nowMs:T}),/B301_EMPTY_OR_OVERSIZED_COHORT/);
 assert.equal(journal.inspect(owner,'B300-consent').recordedEvidenceCount,0);
}));

test('B301 cannot promote supplied filled/flat statuses or hypothetical Lossometer to verified PnL',async()=>withJournal(async journal=>{
 const report=linkB301PrivateCohortOnce({cohort:await makeBundle(),journal,nowMs:T});
 assert.ok(report.warnings.includes('FILLED_ORDER_AND_FLAT_POSITION_NOT_A_CLOSE_PROOF'));
 assert.equal(report.positionsAndFillsExternallyProven,false);
 assert.equal(report.b152DurableTradingLedgerReconciled,false);
 assert.equal(report.commercialPerformanceClaimsAllowed,false);
}));