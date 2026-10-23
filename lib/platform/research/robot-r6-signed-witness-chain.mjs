/**
 * JENIOS ROBOT-R6 — local Ed25519 chain over previously verified R5 fixtures.
 * Only cryptographically verifies exports against CALLER-CONFIGURED trust roots;
 * no external notary, exchange signature, market API, private engine or order.
 */
import {createHash,createPublicKey,verify as verifySignature} from 'node:crypto';
import {canonical} from '../pilot-prep/contracts.mjs';
import {reviewR5DualSourceEvidence,ROBOT_R5_FROZEN_PROTOCOL} from './robot-r5-dual-source-prospective.mjs';

const fail=code=>{throw Object.assign(new Error(code),{code});};
const freeze=Object.freeze;
const HASH=/^[a-f0-9]{64}$/;
const ID=/^[A-Za-z0-9._:-]{1,80}$/;
const ROLES=freeze(['registrar','coinbase_exchange','kraken_spot']);
const REGISTRATION_SCHEMA='JENIOS_ROBOT_R6_LOCAL_REGISTRATION_RECEIPT_V1';
const ROW_SCHEMA='JENIOS_ROBOT_R6_LOCAL_SOURCE_RECEIPT_V1';
const REGISTER_DOMAIN='JENIOS_ROBOT_R6_REGISTRATION_RECEIPT_V1\0';
const ROW_DOMAIN='JENIOS_ROBOT_R6_SOURCE_RECEIPT_V1\0';
const CHAIN_DOMAIN='JENIOS_ROBOT_R6_ENVELOPE_CHAIN_V1\0';
const positive=x=>Number.isSafeInteger(x)&&x>0;
const exact=(x,keys)=>x&&typeof x==='object'&&!Array.isArray(x)&&
 Object.keys(x).length===keys.length&&Object.keys(x).every(k=>keys.includes(k));
const sha=x=>createHash('sha256').update(x).digest('hex');
export const ROBOT_R6_SIGNED_PROTOCOL=freeze({
 schema:'JENIOS_ROBOT_R6_LOCAL_SIGNED_WITNESS_CHAIN_V1',
 registrationReceiptSchema:REGISTRATION_SCHEMA,
 sourceReceiptSchema:ROW_SCHEMA,
 registrationDomain:REGISTER_DOMAIN,sourceDomain:ROW_DOMAIN,
 chainDomain:CHAIN_DOMAIN,
 maxLocalSourceReceiptDelayMs:120000,
 requiredRegistrationLeadMs:ROBOT_R5_FROZEN_PROTOCOL.minimumRegistrationLeadMs,
 configuredKeysMustBeDistinct:true,
 canonicalRowDigest:'SHA256_JSON_STRINGIFY_R5_SOURCE_ROW',
 independentTrustedTimestampProvided:false,
 officialExchangeSignatureRecognized:false,
 ownerIdentityVerified:false,
 durableAntiReplayVerified:false,
 brokerOrdersAllowed:false
});
function keysFrom(trustedKeys){
 if(!exact(trustedKeys,ROLES))fail('ROBOT_R6_INVALID_CONFIGURED_TRUST_ROOTS');
 const result={},material=new Set(),ids=new Set();
 for(const role of ROLES){
  const slot=trustedKeys[role];
  if(!exact(slot,['keyId','publicKeyPem'])||!ID.test(slot.keyId)||
   typeof slot.publicKeyPem!=='string'||slot.publicKeyPem.length>3000||
   ids.has(slot.keyId))
   fail('ROBOT_R6_INVALID_CONFIGURED_TRUST_ROOTS');
  let key;
  try{key=createPublicKey(slot.publicKeyPem);}
  catch{fail('ROBOT_R6_INVALID_CONFIGURED_TRUST_ROOTS');}
  if(key.asymmetricKeyType!=='ed25519')
   fail('ROBOT_R6_ED25519_KEYS_REQUIRED');
  const der=key.export({format:'der',type:'spki'}).toString('hex');
  if(material.has(der))fail('ROBOT_R6_DISTINCT_CONFIGURED_KEYS_REQUIRED');
  ids.add(slot.keyId);material.add(der);
  result[role]={key,keyId:slot.keyId};
 }
 return result;
}
function sigBytes(s){
 if(typeof s!=='string'||s.length!==88||!/^[A-Za-z0-9+/]+={0,2}$/.test(s))
  fail('ROBOT_R6_INVALID_SIGNATURE_ENCODING');
 const b=Buffer.from(s,'base64');
 if(b.length!==64||b.toString('base64')!==s)
  fail('ROBOT_R6_INVALID_SIGNATURE_ENCODING');
 return b;
}
function verifyEnvelope(envelope,domain,slot){
 if(!exact(envelope,['payload','signatureBase64']))
  fail('ROBOT_R6_INVALID_SIGNED_ENVELOPE');
 if(envelope.payload.keyId!==slot.keyId)
  fail('ROBOT_R6_WRONG_CONFIGURED_SIGNER');
 let valid=false;
 try{valid=verifySignature(null,Buffer.from(domain+canonical(envelope.payload),'utf8'),
   slot.key,sigBytes(envelope.signatureBase64));}
 catch(e){if(e?.code==='ROBOT_R6_INVALID_SIGNATURE_ENCODING')throw e;
  fail('ROBOT_R6_SIGNATURE_CHECK_FAILED');}
 if(!valid)fail('ROBOT_R6_SIGNATURE_CHECK_FAILED');
 return sha(CHAIN_DOMAIN+canonical(envelope));
}
function orderedSourceRows(sourcePairs){
 const pairs=[...sourcePairs].sort((a,b)=>a.targetCloseMs-b.targetCloseMs||
  a.asset.localeCompare(b.asset));
 return pairs.flatMap(pair=>[...pair.readings].sort((a,b)=>
  a.provider.localeCompare(b.provider)));
}
/**
 * A sequence of signatures made with configured private testing keys protects
 * file integrity and order within this particular package. It does NOT prove
 * who controls those keys or when a signature was truly created.
 * No SQLite/network/ledger mutation, and no replay protection across invocations.
 */
export function reviewR6ConfiguredWitnessChain({
 seal,sourcePairs,reviewedAtMs,signedRegistration,signedRows,trustedKeys
}={}){
 const r5=reviewR5DualSourceEvidence({seal,sourcePairs,reviewedAtMs});
 const roots=keysFrom(trustedKeys);
 const firstTargetOpenMs=Math.min(...seal.signalBatch.signals.map(x=>
  x.targetCloseMs-ROBOT_R5_FROZEN_PROTOCOL.intervalMs));
 if(!exact(signedRegistration,['payload','signatureBase64']))
  fail('ROBOT_R6_INVALID_SIGNED_ENVELOPE');
 const reg=signedRegistration.payload;
 const regFields=['schema','studyId','sealDigestSha256','keyId','nonce',
  'registeredAtMs','acknowledgedAtMs','firstTargetOpenMs',
  'claimedIndependentTimestamp','officialProviderReceipt','ordersSent'];
 if(!exact(reg,regFields)||reg.schema!==REGISTRATION_SCHEMA||
  !ID.test(reg.nonce)||reg.studyId!==seal.studyId||
  reg.sealDigestSha256!==r5.frozenSealDigestSha256||
  !HASH.test(reg.sealDigestSha256)||reg.keyId!==roots.registrar.keyId||
  reg.registeredAtMs!==seal.registeredAtMs||
  reg.firstTargetOpenMs!==firstTargetOpenMs||
  !positive(reg.acknowledgedAtMs)||
  reg.acknowledgedAtMs<reg.registeredAtMs||
  reg.acknowledgedAtMs>reviewedAtMs||
  reg.acknowledgedAtMs>
   firstTargetOpenMs-ROBOT_R6_SIGNED_PROTOCOL.requiredRegistrationLeadMs||
  reg.claimedIndependentTimestamp!==false||
  reg.officialProviderReceipt!==false||reg.ordersSent!==0)
  fail('ROBOT_R6_INVALID_REGISTRATION_RECEIPT');
 const registrationDigest=verifyEnvelope(signedRegistration,REGISTER_DOMAIN,roots.registrar);
 const sortedRows=orderedSourceRows(sourcePairs);
 if(!Array.isArray(signedRows)||signedRows.length!==sortedRows.length||
  signedRows.length<2||signedRows.length>666)
  fail('ROBOT_R6_MISSING_OR_EXTRA_SOURCE_RECEIPT');
 const nonces=new Set([reg.nonce]);
 let previousDigest=sha('JENIOS_ROBOT_R6_GENESIS_V1\0'+registrationDigest);
 const rowFields=['schema','sequence','studyId','sealDigestSha256',
  'keyId','nonce','provider','asset','targetCloseMs',
  'rowDigestSha256','capturedAtMs','signedAtMs','previousEnvelopeDigestSha256',
  'claimedOfficialProviderSignature','claimedIndependentTimestamp',
  'ordersSent','paperOrdersSent'];
 for(let i=0;i<sortedRows.length;i++){
  const row=sortedRows[i],envelope=signedRows[i];
  if(!exact(envelope,['payload','signatureBase64']))
   fail('ROBOT_R6_INVALID_SIGNED_ENVELOPE');
  const p=envelope.payload;
  if(!exact(p,rowFields)||p.schema!==ROW_SCHEMA||p.sequence!==i+1||
   p.studyId!==seal.studyId||p.sealDigestSha256!==r5.frozenSealDigestSha256||
   p.provider!==row.provider||p.asset!==row.asset||
   p.targetCloseMs!==row.targetCloseMs||
   p.keyId!==roots[row.provider]?.keyId||
   !ID.test(p.nonce)||nonces.has(p.nonce)||
   !HASH.test(p.rowDigestSha256)||
   p.rowDigestSha256!==sha(JSON.stringify(row))||
   p.capturedAtMs!==row.capturedAtMs||
   !positive(p.signedAtMs)||p.signedAtMs<p.capturedAtMs||
   p.signedAtMs>p.capturedAtMs+
    ROBOT_R6_SIGNED_PROTOCOL.maxLocalSourceReceiptDelayMs||
   p.signedAtMs>reviewedAtMs||
   p.previousEnvelopeDigestSha256!==previousDigest||
   p.claimedOfficialProviderSignature!==false||
   p.claimedIndependentTimestamp!==false||
   p.ordersSent!==0||p.paperOrdersSent!==0)
   fail('ROBOT_R6_RECEIPT_SCOPE_SEQUENCE_TIME_OR_REPLAY_INVALID');
  nonces.add(p.nonce);
  previousDigest=verifyEnvelope(envelope,ROW_DOMAIN,roots[row.provider]);
 }
 return freeze({
  schema:'JENIOS_ROBOT_R6_CONFIGURED_KEY_CHAIN_AUDIT_V1',
  studyId:seal.studyId,
  sourceSealDigestSha256:r5.frozenSealDigestSha256,
  registrationReceiptDigestSha256:registrationDigest,
  finalLocalReceiptDigestSha256:previousDigest,
  configuredEd25519RegistrationSignatureChecked:true,
  configuredEd25519SourceSignaturesChecked:true,
  configuredKeyMaterialDistinct:true,
  localNonceUniquenessChecked:true,
  localSequentialChainingChecked:true,
  localTimestampBoundsChecked:true,
  locallySignedSourceRows:sortedRows.length,
  reviewedCohorts:r5.cohortsReviewed,
  uniqueUtcHours:r5.uniqueHourSlots,
  reportedUtcDays:r5.distinctUtcDays,
  r5LocalSourceConsistencyPassed:r5.sourceAgreementWithinLockedTolerances,
  r5Issues:freeze([...r5.issues]),
  independentlyAuthenticatedMarketProviders:false,
  independentlyTimestampedSignalRegistration:false,
  officialBrokerOrExchangeSigningVerified:false,
  originalPrivateEngineOutputsAttested:false,
  civilOwnerIdentityConfirmed:false,
  durableCrossRunReplayProtection:false,
  externallyAttestedStopFills:false,
  actualLossesAvoided:null,actualBrokerRealizedPnl:null,
  statisticallyProvenAdvantage:false,
  paperExecutionAuthorized:false,realExecutionAuthorized:false,
  commercialPerformanceClaimsAllowed:false,
  ordersSent:0,paperOrdersSent:0,paidAiInvocations:0,
  classification:r5.descriptiveOfflinePairingEligible?
   'LOCAL_CONFIGURED_SIGNATURE_AND_PRICE_CONSISTENCY_ONLY':
   'NO_GO_LOCAL_SOURCE_PRICE_DISAGREEMENT',
  releaseStatus:'NO_GO_INDEPENDENT_TIMESTAMP_BROKER_AND_PRICE_ATTESTATION_REQUIRED'
 });
}
