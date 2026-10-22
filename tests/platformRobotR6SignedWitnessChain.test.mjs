import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,generateKeyPairSync,sign} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {canonical} from '../lib/platform/pilot-prep/contracts.mjs';
import {sealR5ProspectiveBatch} from '../lib/platform/research/robot-r5-dual-source-prospective.mjs';
import {reviewR6ConfiguredWitnessChain,ROBOT_R6_SIGNED_PROTOCOL}
 from '../lib/platform/research/robot-r6-signed-witness-chain.mjs';

const H=3600000,DAY=86400000,GRACE=300000;
const START=Date.parse('2026-10-24T00:00:00.000Z');
const roles=['registrar','coinbase_exchange','kraken_spot'];
const REG_DOMAIN='JENIOS_ROBOT_R6_REGISTRATION_RECEIPT_V1\0',
 ROW_DOMAIN='JENIOS_ROBOT_R6_SOURCE_RECEIPT_V1\0',
 CHAIN_DOMAIN='JENIOS_ROBOT_R6_ENVELOPE_CHAIN_V1\0';
const sh=s=>createHash('sha256').update(s).digest('hex');
const hash=x=>sh(JSON.stringify(x));
const keyMaterial=()=>{
 const privateKeys={},trustedKeys={};
 for(const role of roles){
  const pair=generateKeyPairSync('ed25519');
  privateKeys[role]=pair.privateKey;
  trustedKeys[role]={keyId:'r6-'+role,
   publicKeyPem:pair.publicKey.export({format:'pem',type:'spki'})};
 }
 return {privateKeys,trustedKeys};
};
const signed=(payload,key,domain)=>({payload,
 signatureBase64:sign(null,Buffer.from(domain+canonical(payload),'utf8'),key).toString('base64')});
const envelopeDigest=e=>sh(CHAIN_DOMAIN+canonical(e));
function synthetic({days=2,hoursPerDay=2,assets=['BTC-USD'],closeDifference=0.0004,
 identical=false}={}){
 const signals=[],sourcePairs=[];let index=0;
 const map={
  'BTC-USD':{coinbase_exchange:'BTC-USD',kraken_spot:'XBTUSD'},
  'ETH-USD':{coinbase_exchange:'ETH-USD',kraken_spot:'ETHUSD'},
  'SOL-USD':{coinbase_exchange:'SOL-USD',kraken_spot:'SOLUSD'}
 };
 for(let day=0;day<days;day++)for(let h=0;h<hoursPerDay;h++)
  for(const asset of assets){
   const openMs=START+day*DAY+h*H,closeMs=openMs+H,
    direction=index%2?'DOWN':'UP',open=100+index*.05,
    close=open+(index%2?-0.5:0.5),
    high=Math.max(open,close)*1.005,low=Math.min(open,close)*.995;
   for(const mode of ['manual','hybrid','reverse']){
    const side=mode==='reverse'?(direction==='UP'?'DOWN':'UP'):direction;
    signals.push({id:'r6-'+index+'-'+mode,mode,asset,
     signalAtMs:START-21*60000,targetCloseMs:closeMs,
     direction:side,isOrder:false,executed:false,realizedPnl:null});
   }
   const source=(provider,ratio,delay)=>({
    provider,providerPair:map[asset][provider],asset,
    targetCloseMs:closeMs,candleStartMs:openMs,
    capturedAtMs:closeMs+GRACE+1000+delay,
    open:open*ratio,high:high*ratio,low:low*ratio,close:close*ratio,
    volume:1000+index+delay,
    quoteCurrency:'USD',sourceSigned:false,orderExecuted:false,
    originClaim:'CALLER_SUPPLIED_UNSIGNED_PUBLIC_CANDLE'
   });
   const a=source('coinbase_exchange',1,0),
    b=source('kraken_spot',identical?1:1+closeDifference,1000);
   if(identical)b.volume=a.volume;
   sourcePairs.push({asset,targetCloseMs:closeMs,readings:[a,b]});
   index++;
  }
 const batchBase={schema:'JENIOS_B287_SIGNAL_BATCH_V1',
  frozenAtMs:START-20*60000,signals};
 const batch={...batchBase,sha256:hash(batchBase)};
 const seal=sealR5ProspectiveBatch(batch,{
  studyId:'r6-private-offline',registeredAtMs:START-19*60000});
 const reviewedAtMs=START+days*DAY+hoursPerDay*H+25*60000;
 return {seal,sourcePairs,reviewedAtMs};
}
function pack(input,{privateKeys,trustedKeys}=keyMaterial()){
 const {seal,sourcePairs,reviewedAtMs}=input;
 const firstTargetOpenMs=Math.min(...seal.signalBatch.signals.map(x=>x.targetCloseMs-H));
 const registration={
  schema:'JENIOS_ROBOT_R6_LOCAL_REGISTRATION_RECEIPT_V1',
  studyId:seal.studyId,sealDigestSha256:seal.sealDigestSha256,
  keyId:trustedKeys.registrar.keyId,nonce:'registration-unique-1',
  registeredAtMs:seal.registeredAtMs,acknowledgedAtMs:seal.registeredAtMs+1000,
  firstTargetOpenMs,claimedIndependentTimestamp:false,
  officialProviderReceipt:false,ordersSent:0
 };
 const signedRegistration=signed(registration,privateKeys.registrar,REG_DOMAIN);
 let previousEnvelopeDigestSha256=sh('JENIOS_ROBOT_R6_GENESIS_V1\0'+
  envelopeDigest(signedRegistration));
 let seq=0;
 const rows=[...sourcePairs].sort((a,b)=>a.targetCloseMs-b.targetCloseMs||
  a.asset.localeCompare(b.asset)).flatMap(p=>[...p.readings].sort((a,b)=>
  a.provider.localeCompare(b.provider)));
 const signedRows=rows.map(row=>{
  const payload={
   schema:'JENIOS_ROBOT_R6_LOCAL_SOURCE_RECEIPT_V1',
   sequence:++seq,studyId:seal.studyId,
   sealDigestSha256:seal.sealDigestSha256,
   keyId:trustedKeys[row.provider].keyId,
   nonce:'r6-receipt-'+seq,
   provider:row.provider,asset:row.asset,targetCloseMs:row.targetCloseMs,
   rowDigestSha256:hash(row),capturedAtMs:row.capturedAtMs,
   signedAtMs:row.capturedAtMs+1000,
   previousEnvelopeDigestSha256,claimedOfficialProviderSignature:false,
   claimedIndependentTimestamp:false,ordersSent:0,paperOrdersSent:0
  };
  const e=signed(payload,privateKeys[row.provider],ROW_DOMAIN);
  previousEnvelopeDigestSha256=envelopeDigest(e);
  return e;
 });
 return {seal,sourcePairs,reviewedAtMs,signedRegistration,signedRows,
  trustedKeys,privateKeys};
}
function verified(p){return reviewR6ConfiguredWitnessChain(p);}
const failure=(f,code)=>assert.throws(f,e=>e?.code===code);
const editEnvelope=(envelope,patch)=>({...envelope,payload:{...envelope.payload,...patch}});
test('R6 local public key signatures chain R5 preregistration and exact source rows',()=>{
 const pack1=pack(synthetic());
 const a=verified(pack1);
 assert.equal(a.reviewedCohorts,4);
 assert.equal(a.locallySignedSourceRows,8);
 assert.equal(a.configuredEd25519RegistrationSignatureChecked,true);
 assert.equal(a.configuredEd25519SourceSignaturesChecked,true);
 assert.equal(a.localSequentialChainingChecked,true);
 assert.equal(a.r5LocalSourceConsistencyPassed,true);
 assert.equal(a.independentlyAuthenticatedMarketProviders,false);
 assert.equal(a.independentlyTimestampedSignalRegistration,false);
 assert.equal(a.durableCrossRunReplayProtection,false);
 assert.equal(a.originalPrivateEngineOutputsAttested,false);
 assert.equal(a.ordersSent,0);
 assert.equal(a.actualBrokerRealizedPnl,null);
 assert.match(a.finalLocalReceiptDigestSha256,/^[a-f0-9]{64}$/);
 assert.equal(a.classification,'LOCAL_CONFIGURED_SIGNATURE_AND_PRICE_CONSISTENCY_ONLY');
});
test('R6 deliberately reports NO_GO for externally witnessed timestamps and broker PnL',()=>{
 const a=verified(pack(synthetic()));
 assert.equal(a.officialBrokerOrExchangeSigningVerified,false);
 assert.equal(a.realExecutionAuthorized,false);
 assert.equal(a.paperExecutionAuthorized,false);
 assert.equal(a.statisticallyProvenAdvantage,false);
 assert.equal(a.commercialPerformanceClaimsAllowed,false);
 assert.equal(a.actualLossesAvoided,null);
 assert.equal(a.releaseStatus,'NO_GO_INDEPENDENT_TIMESTAMP_BROKER_AND_PRICE_ATTESTATION_REQUIRED');
 assert.equal(ROBOT_R6_SIGNED_PROTOCOL.independentTrustedTimestampProvided,false);
});
test('R6 changed signed registration field is detected',()=>{
 const x=pack(synthetic());
 const copy={...x,signedRegistration:editEnvelope(x.signedRegistration,
  {acknowledgedAtMs:x.signedRegistration.payload.acknowledgedAtMs+1500})};
 failure(()=>verified(copy),'ROBOT_R6_SIGNATURE_CHECK_FAILED');
});
test('R6 independent-time assertion cannot be injected into registration even if signed',()=>{
 const x=pack(synthetic());
 const forgedPayload={...x.signedRegistration.payload,claimedIndependentTimestamp:true};
 const forged={...x,signedRegistration:signed(forgedPayload,x.privateKeys.registrar,REG_DOMAIN)};
 failure(()=>verified(forged),'ROBOT_R6_INVALID_REGISTRATION_RECEIPT');
});
test('R6 late local registration does not become earlier because a signer signs it',()=>{
 const x=pack(synthetic()),first=x.signedRegistration.payload.firstTargetOpenMs;
 const tamperedPayload={...x.signedRegistration.payload,acknowledgedAtMs:first-1000};
 const forged={...x,signedRegistration:signed(tamperedPayload,x.privateKeys.registrar,REG_DOMAIN)};
 failure(()=>verified(forged),'ROBOT_R6_INVALID_REGISTRATION_RECEIPT');
});
test('R6 malformed receipt field and false official-provider claims fail closed',()=>{
 const x=pack(synthetic());
 for(const patch of [{claimedOfficialProviderSignature:true},
  {claimedIndependentTimestamp:true},{ordersSent:1},{paperOrdersSent:1},
  {claimedBrokerFill:true},{rowDigestSha256:'a'.repeat(64)},
  {provider:'wrong'},{asset:'ETH-USD'},{targetCloseMs:1000}]){
  const altered=editEnvelope(x.signedRows[0],patch);
  const z={...x,signedRows:[altered,...x.signedRows.slice(1)]};
  failure(()=>verified(z),'ROBOT_R6_RECEIPT_SCOPE_SEQUENCE_TIME_OR_REPLAY_INVALID');
 }
});
test('R6 missing or additional receipts are refused',()=>{
 const x=pack(synthetic());
 for(const signedRows of [x.signedRows.slice(1),[...x.signedRows,x.signedRows[0]]])
  failure(()=>verified({...x,signedRows}),'ROBOT_R6_MISSING_OR_EXTRA_SOURCE_RECEIPT');
});
test('R6 repeated nonce is not accepted even with valid local signatures',()=>{
 const x=pack(synthetic()),p={...x.signedRows[1].payload,
  nonce:x.signedRows[0].payload.nonce};
 const copy={...x,signedRows:[x.signedRows[0],
  signed(p,x.privateKeys.kraken_spot,ROW_DOMAIN),...x.signedRows.slice(2)]};
 failure(()=>verified(copy),'ROBOT_R6_RECEIPT_SCOPE_SEQUENCE_TIME_OR_REPLAY_INVALID');
});
test('R6 receipt order, sequence and chain predecessor cannot be rewritten',()=>{
 const x=pack(synthetic());
 for(const signedRows of [
  [x.signedRows[1],x.signedRows[0],...x.signedRows.slice(2)],
  [editEnvelope(x.signedRows[0],{sequence:2}),...x.signedRows.slice(1)],
  [editEnvelope(x.signedRows[0],{previousEnvelopeDigestSha256:'0'.repeat(64)}),
   ...x.signedRows.slice(1)]
 ])failure(()=>verified({...x,signedRows}),
  'ROBOT_R6_RECEIPT_SCOPE_SEQUENCE_TIME_OR_REPLAY_INVALID');
});
test('R6 wrong configured key or modified signature is rejected',()=>{
 const x=pack(synthetic());
 const bad={...x.signedRows[0],signatureBase64:
  x.signedRows[0].signatureBase64.replace(/^./,'A')};
 // Deliberately perturb deterministic bytes rather than relying on first char mismatch.
 const bytes=Buffer.from(x.signedRows[0].signatureBase64,'base64');
 bytes[0]^=0x01;bad.signatureBase64=bytes.toString('base64');
 failure(()=>verified({...x,signedRows:[bad,...x.signedRows.slice(1)]}),
  'ROBOT_R6_SIGNATURE_CHECK_FAILED');
 const fake={
  ...x,trustedKeys:{...x.trustedKeys,coinbase_exchange:{
   ...x.trustedKeys.coinbase_exchange,keyId:'other-key'}}
 };
 failure(()=>verified(fake),'ROBOT_R6_RECEIPT_SCOPE_SEQUENCE_TIME_OR_REPLAY_INVALID');
});
test('R6 same cryptographic key reused for both providers is not independent',()=>{
 const x=pack(synthetic());
 const bad={...x,trustedKeys:{...x.trustedKeys,
  kraken_spot:{...x.trustedKeys.kraken_spot,
   publicKeyPem:x.trustedKeys.coinbase_exchange.publicKeyPem}}};
 failure(()=>verified(bad),'ROBOT_R6_DISTINCT_CONFIGURED_KEYS_REQUIRED');
});
test('R6 elliptic/P256 public key cannot replace Ed25519 signing keys',()=>{
 const x=pack(synthetic());
 const other=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
 const bad={...x,trustedKeys:{...x.trustedKeys,registrar:{
  ...x.trustedKeys.registrar,
  publicKeyPem:other.publicKey.export({format:'pem',type:'spki'})}}};
 failure(()=>verified(bad),'ROBOT_R6_ED25519_KEYS_REQUIRED');
});
test('R6 R5 close disagreement remains NO_GO even with correctly re-signed source rows',()=>{
 const x=synthetic({closeDifference:0.04}),p=pack(x);
 const result=verified(p);
 assert.equal(result.r5LocalSourceConsistencyPassed,false);
 assert.ok(result.r5Issues.includes('CLAIMED_PROVIDER_CLOSE_DISAGREEMENT'));
 assert.equal(result.classification,'NO_GO_LOCAL_SOURCE_PRICE_DISAGREEMENT');
 assert.equal(result.commercialPerformanceClaimsAllowed,false);
});
test('R6 tampered source OHLCV cannot reuse original signed collector receipt',()=>{
 const x=pack(synthetic()),y=structuredClone(x);
 y.sourcePairs[0].readings[0].close*=1.001;
 failure(()=>verified(y),'ROBOT_R6_RECEIPT_SCOPE_SEQUENCE_TIME_OR_REPLAY_INVALID');
});
test('R6 300 synthetic hours/30 days never imply true forward market witnessing',()=>{
 const x=pack(synthetic({days:30,hoursPerDay:10}));
 const a=verified(x);
 assert.equal(a.uniqueUtcHours,300);
 assert.equal(a.reportedUtcDays,30);
 assert.equal(a.locallySignedSourceRows,600);
 assert.equal(a.independentlyTimestampedSignalRegistration,false);
 assert.equal(a.statisticallyProvenAdvantage,false);
 assert.equal(a.actualLossesAvoided,null);
 assert.equal(a.actualBrokerRealizedPnl,null);
});
test('R6 source receipt timestamp before capture or more than 120s late is refused',()=>{
 const x=pack(synthetic());
 for(const signedAtMs of [x.signedRows[0].payload.capturedAtMs-1,
  x.signedRows[0].payload.capturedAtMs+120001]){
  const changed={...x.signedRows[0].payload,signedAtMs};
  const signedRows=[signed(changed,x.privateKeys.coinbase_exchange,ROW_DOMAIN),
   ...x.signedRows.slice(1)];
  failure(()=>verified({...x,signedRows}),'ROBOT_R6_RECEIPT_SCOPE_SEQUENCE_TIME_OR_REPLAY_INVALID');
 }
});
test('R6 pricing and signal provenance assertions never turn into order status',()=>{
 const a=verified(pack(synthetic()));
 assert.equal(a.officialBrokerOrExchangeSigningVerified,false);
 assert.equal(a.originalPrivateEngineOutputsAttested,false);
 assert.equal(a.actualBrokerRealizedPnl,null);
 assert.equal(a.ordersSent,0);
 assert.equal(a.paperOrdersSent,0);
 assert.equal(a.paidAiInvocations,0);
});
test('R6 no network, broker trade, generative AI, environment read or auto deploy',()=>{
 const source=readFileSync(new URL('../lib/platform/research/robot-r6-signed-witness-chain.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(source,/\bfetch\s*\(|\bsubmitOrder\s*\(|\bcreateOrder\s*\(|process\.env|OPENAI_API_KEY/);
 const v=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8'));
 assert.equal(v.git.deploymentEnabled['fix/jenios-robot-r6-signed-witness-chain-20261022'],false);
 assert.equal(v.git.deploymentEnabled['fix/jenios-robot-r5-dual-source-prospective-integrity-20261021'],false);
});
