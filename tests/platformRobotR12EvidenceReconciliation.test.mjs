import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {canonical} from '../lib/platform/pilot-prep/contracts.mjs';
import {auditR12LinkedEvidence,R12_RECONCILIATION_PROTOCOL}
 from '../lib/platform/research/robot-r12-evidence-reconciliation.mjs';
import {readFileSync} from 'node:fs';
const OPEN=Date.parse('2026-10-22T13:00:00Z'),CLOSE=OPEN+3600000;
const sha=o=>createHash('sha256').update(canonical(o)).digest('hex');
const orig=()=>({
 schema:'JENIOS_R9_PRIVATE_ORIGINAL_PRECOMMIT_V1',
 studyId:'R9-20261022-FORWARD-ORIGINAL-CORE',asset:'BTC-USD',
 targetOpenMs:OPEN,targetCloseMs:CLOSE,
 capturedAtMs:1792671455651,decidedAtMs:1792671583754,
 registeredAtMs:1792671583754,
 engineSha256:'9341d9243cbe742b90bf40149663e632fc472f5586c74bf70bdfcfd114e65aea',
 serviceSha256:'cbb92005459f79bf6e23a0edc7c5542cc62b632b6c301e3f23b98ebd514ce5be',
 inputSha256:'e5fbb979bdd09b1ecf37808f4b4ae4c8c06d8834149e67df034c05591c1a28ee',
 modeResults:['manual','hybrid','reverse'].flatMap(mode=>
  ['buy','sell'].map(intent=>({mode,intent,action:'wait_for_context',side:null}))),
 originalCorePrivate:true,liveExecutionDisabled:true,ordersSent:0
});
const pub=()=>({
 schema:'JENIOS_R9_PUBLIC_HASH_ONLY_FORWARD_PRIVATE_ORIGINAL_V1',
 studyId:'R9-20261022-FORWARD-ORIGINAL-CORE',
 commitmentSha256:'2b9734aada05ad3fcbfbcb9f0d24859dfd17547cb9e16d3424c27681fb21a36d',
 publicContextInputSha256:'c03c70d57d59699b936f9d2996833f1a4bd021fe34296c8e8aae24578ca3d726',
 originalCoreEngineSha256:'9341d9243cbe742b90bf40149663e632fc472f5586c74bf70bdfcfd114e65aea',
 originalCoreServiceSha256:'cbb92005459f79bf6e23a0edc7c5542cc62b632b6c301e3f23b98ebd514ce5be',
 declaredCapturedAtMs:1792671455651,declaredPrivateCalculatedAtMs:1792671583754,
 declaredPrivateRegisteredAtMs:1792671583754,
 futureTargetOpenMs:OPEN,futureTargetCloseMs:CLOSE,
 isCommitmentNotResult:true,futureOutcomeKnownAtPublication:false,
 ordersSent:0,paperOrdersSent:0
});
const git=()=>({commitSha:'8ada1a2a4166f02a88b645e3473543a44197b9ab',
 committedAtUtc:'2026-10-22T12:20:55.000Z',
 origin:'GITHUB_COMMIT_METADATA_NOT_RUNTIME_ATTESTATION'});
const fixture=()=>({privateRecord:orig(),publicRecord:pub(),gitMetadata:git(),
 reviewedAtMs:CLOSE+3600000});
const changed=(fn,code)=>assert.throws(fn,e=>e?.code===code);
const candle=(close,high=102)=>({t:OPEN,open:100,high,low:99,close,volume:30});
const obs=()=>({
 schema:'JENIOS_R10_POST_CANDLE_READ_ONLY_V1',
 precommitDigest:pub().commitmentSha256,
 targetOpenMs:OPEN,targetCloseMs:CLOSE,observedAtMs:CLOSE+600000,
 coinbase:candle(101),kraken:candle(101.02,102.02),
 closeDifferenceBps:Number((Math.abs(101-101.02)/((101+101.02)/2)*10000).toFixed(6)),
 issues:[],ohlcDifferenceBps:Number((Math.abs(102-102.02)/((102+102.02)/2)*10000).toFixed(6)),
 priceConsistencyWithinResearchThresholds:true,sourceSigned:false,
 independentSourceAttested:false,originalEnginePrivatelyAttested:false,
 allSixOriginalDecisions:'ABSTAIN',entries:0,lossesAvoided:null,
 tradingProfit:null,tradeAccuracy:null,ordersSent:0,paperOrdersSent:0,
 commercialPerformanceCertified:false
});
test('R12 reconciles exact R9 canonical commitment only as an unavailable-outcome NO-GO',()=>{
 const f=fixture();
 assert.equal(sha(f.privateRecord),f.publicRecord.commitmentSha256);
 const out=auditR12LinkedEvidence(f);
 assert.equal(out.originalHashConsistent,true);
 assert.equal(out.validSixUniqueAbstentions,true);
 assert.equal(out.localObservedOutcomeProvided,false);
 assert.equal(out.decision,'NO_GO_MISSING_INDEPENDENT_MARKET_EVIDENCE');
 assert.equal(out.actualBrokerRealizedPnl,null);
});
test('R12 rejects mismatching original record or original motor identity',()=>{
 const f=fixture();
 for(const patch of [
  {inputSha256:'0'.repeat(64)},
  {engineSha256:'a'.repeat(64)},
  {ordersSent:1},
  {decidedAtMs:OPEN+1}
 ])changed(()=>auditR12LinkedEvidence({...f,privateRecord:{...f.privateRecord,...patch}}),
 'R12_INVALID_ORIGINAL_PRIVATE_RECORD');
});
test('R12 modified decisions fail the original SHA even if all six still abstain',()=>{
 const f=fixture();
 const copy=structuredClone(f.privateRecord);
 copy.modeResults[0].side='buy';
 assert.throws(()=>auditR12LinkedEvidence({...f,privateRecord:copy}));
});
test('R12 missing and duplicate pairs cannot be renamed as six unique abstentions',()=>{
 const f=fixture();
 const copy=structuredClone(f.privateRecord);
 copy.modeResults[5]={...copy.modeResults[0]};
 changed(()=>auditR12LinkedEvidence({...f,privateRecord:copy}),
  'R12_NON_UNIQUE_PRECOMMITTED_ABSTENTIONS');
});
test('R12 wrong target, metadata, source digest or forged past results fail',()=>{
 const f=fixture();
 for(const patch of [
  {publicContextInputSha256:'0'.repeat(64)},
  {futureTargetOpenMs:OPEN+3600000},
  {futureOutcomeKnownAtPublication:true},
  {paperOrdersSent:1}
 ])assert.throws(()=>auditR12LinkedEvidence({...f,publicRecord:{...f.publicRecord,...patch}}));
 for(const patch of [{committedAtUtc:'2026-10-22T13:01:00.000Z'},
  {origin:'SIGNED_PUBLIC_PRICE'},{commitSha:'bad'}])
 changed(()=>auditR12LinkedEvidence({...f,gitMetadata:{...f.gitMetadata,...patch}}),
  'R12_PUBLIC_PRIVATE_COMMIT_MISMATCH');
});
test('R12 an optional caller supplied H1 remains descriptive only, never a filled trade',()=>{
 const f=fixture(),result=auditR12LinkedEvidence({...f,observation:obs()});
 assert.equal(result.localObservedOutcomeProvided,true);
 assert.equal(result.exchangePriceResponsesCryptographicallySigned,false);
 assert.equal(result.decision,'DESCRIPTIVE_ONLY_UNATTESTED_PUBLIC_PRICE_NO_TRADES');
 assert.equal(result.tradeAccuracy,null);
 assert.equal(result.actualLossesAvoided,null);
});
test('R12 wrong hour, late, invented trade, signed price claims and changed bps all fail',()=>{
 const f=fixture();
 for(const patch of [
  {observedAtMs:CLOSE+500000},
  {targetOpenMs:OPEN+3600000},
  {tradingProfit:1200},
  {entries:1},
  {sourceSigned:true},
  {closeDifferenceBps:99},
  {issues:['OHLC_DIVERGENCE']},
  {priceConsistencyWithinResearchThresholds:false}
 ])changed(()=>auditR12LinkedEvidence({...f,observation:{...obs(),...patch}}),
 'R12_UNTRUSTED_OR_NON_ABSTAINED_OUTCOME');
 changed(()=>auditR12LinkedEvidence({...f,observation:{...obs(),
  coinbase:{...obs().coinbase,t:OPEN-3600000}}}), 'R12_INVALID_OR_WRONG_HOUR_CANDLE');
});
test('R12 fabricated close/ohlc/identical inputs cannot pass descriptive quality',()=>{
 const f=fixture(),row=obs();
 for(const patch of [{ohlcDifferenceBps:0},{closeDifferenceBps:0}])
 changed(()=>auditR12LinkedEvidence({...f,observation:{...row,...patch}}),
 'R12_MISREPORTED_OR_INCONSISTENT_PUBLIC_PRICES');
 const identical={...row,kraken:{...row.coinbase},ohlcDifferenceBps:0,closeDifferenceBps:0};
 changed(()=>auditR12LinkedEvidence({...f,observation:identical}),
 'R12_MISREPORTED_OR_INCONSISTENT_PUBLIC_PRICES');
});
test('R12 contains no network, broker transport, secrets, paid AI or auto deployment',()=>{
 const source=readFileSync(new URL('../lib/platform/research/robot-r12-evidence-reconciliation.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(source,/\bfetch\s*\(|submitOrder|createOrder|OPENAI_API_KEY|process\.env/);
 const v=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8'));
 assert.equal(v.git.deploymentEnabled['fix/jenios-robot-r12-evidence-reconciliation-20261022'],false);
});
