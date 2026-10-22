/**
 * ROBOT R12 -- only a cross-file, OFFLINE reconciliation of the R9 original
 * private record, public Git commitment and optional closed-candle observation.
 * Never import proprietary engine or connect to public market/broker network.
 * Caller-supplied data and Git metadata are NOT independently authenticated.
 */
import {createHash} from 'node:crypto';
import {canonical} from '../pilot-prep/contracts.mjs';
import {verifyR10Commit,R10_PROTOCOL} from './robot-r10-post-candle.mjs';

const err=code=>{throw Object.assign(new Error(code),{code});};
const exact=(obj,keys)=>obj&&typeof obj==='object'&&!Array.isArray(obj)&&
 Object.keys(obj).length===keys.length&&Object.keys(obj).every(k=>keys.includes(k));
const goodTime=x=>Number.isSafeInteger(x)&&x>0;
const sha=x=>createHash('sha256').update(canonical(x)).digest('hex');
const COMMIT_DATE=Date.parse('2026-10-22T12:20:55Z');
const NO_GO='NO_GO_MISSING_INDEPENDENT_MARKET_EVIDENCE';
const timestamp=x=>typeof x==='string'&&Number.isFinite(Date.parse(x))&&
 new Date(x).toISOString()===x;
const PAIRS=['manual|buy','manual|sell','hybrid|buy','hybrid|sell','reverse|buy','reverse|sell'];
export const R12_RECONCILIATION_PROTOCOL=Object.freeze({
 schema:'JENIOS_R12_STRICT_SOURCE_LINK_V1',
 originalCommitSha:R10_PROTOCOL.publicCommitSha,
 targetOpenMs:R10_PROTOCOL.openMs,targetCloseMs:R10_PROTOCOL.closeMs,
 minimumObservationMs:R10_PROTOCOL.earliestObserveMs,
 publicCommitMetadataIsNotIndependentRuntimeProof:true,
 unsignedPriceInputsNeverOfficialSignatures:true,
 brokerOrdersAllowed:false,tradeResultsFromAbstentionsAllowed:false
});
function checkPrivate(record) {
 if(!record||record.schema!=='JENIOS_R9_PRIVATE_ORIGINAL_PRECOMMIT_V1'||
  record.studyId!=='R9-20261022-FORWARD-ORIGINAL-CORE'||
  record.asset!=='BTC-USD'||!goodTime(record.capturedAtMs)||
  !goodTime(record.decidedAtMs)||!goodTime(record.registeredAtMs)||
  record.capturedAtMs>record.decidedAtMs||
  record.decidedAtMs>record.registeredAtMs||
  record.registeredAtMs>R10_PROTOCOL.openMs-600000||
  record.ordersSent!==0||record.originalCorePrivate!==true||
  record.liveExecutionDisabled!==true||
  record.engineSha256!=='9341d9243cbe742b90bf40149663e632fc472f5586c74bf70bdfcfd114e65aea'||
  record.serviceSha256!=='cbb92005459f79bf6e23a0edc7c5542cc62b632b6c301e3f23b98ebd514ce5be'||
  typeof record.inputSha256!=='string'||!/^[a-f0-9]{64}$/.test(record.inputSha256))
  err('R12_INVALID_ORIGINAL_PRIVATE_RECORD');
 if(record.modeResults?.length!==6||
  PAIRS.some(pair=>!record.modeResults.some(x=>x?.mode+'|'+x?.intent===pair)))
  err('R12_NON_UNIQUE_PRECOMMITTED_ABSTENTIONS');
}
function validatePublic(publicRecord,gitMetadata,privateRecord){
 const check=verifyR10Commit(privateRecord,publicRecord);
 if(!check.digestMatched||!check.allModesAbstained||
  publicRecord.schema!=='JENIOS_R9_PUBLIC_HASH_ONLY_FORWARD_PRIVATE_ORIGINAL_V1'||
  publicRecord.studyId!==privateRecord.studyId||
  publicRecord.publicContextInputSha256!==
   'c03c70d57d59699b936f9d2996833f1a4bd021fe34296c8e8aae24578ca3d726'||
  publicRecord.originalCoreEngineSha256!==privateRecord.engineSha256||
  publicRecord.originalCoreServiceSha256!==privateRecord.serviceSha256||
  publicRecord.declaredCapturedAtMs!==privateRecord.capturedAtMs||
  publicRecord.declaredPrivateCalculatedAtMs!==privateRecord.decidedAtMs||
  publicRecord.declaredPrivateRegisteredAtMs!==privateRecord.registeredAtMs||
  publicRecord.isCommitmentNotResult!==true||
  publicRecord.futureOutcomeKnownAtPublication!==false||
  publicRecord.ordersSent!==0||publicRecord.paperOrdersSent!==0||
  !exact(gitMetadata,['commitSha','committedAtUtc','origin'])||
  gitMetadata.commitSha!==R10_PROTOCOL.publicCommitSha||
  gitMetadata.origin!=='GITHUB_COMMIT_METADATA_NOT_RUNTIME_ATTESTATION'||
  !timestamp(gitMetadata.committedAtUtc)||
  Date.parse(gitMetadata.committedAtUtc)!==COMMIT_DATE||
  Date.parse(gitMetadata.committedAtUtc)>=R10_PROTOCOL.openMs)
  err('R12_PUBLIC_PRIVATE_COMMIT_MISMATCH');
}
const finitePositive=x=>typeof x==='number'&&Number.isFinite(x)&&x>0;
function inspectCandle(row,expectedT){
 if(!exact(row,['t','open','high','low','close','volume'])||
  row.t!==expectedT||!goodTime(row.t)||
  !['open','high','low','close','volume'].every(k=>finitePositive(row[k]))||
  row.high<Math.max(row.open,row.close,row.low)||
  row.low>Math.min(row.open,row.close)||row.high/row.low>1.5)
  err('R12_INVALID_OR_WRONG_HOUR_CANDLE');
}
function validateOptionalOutcome(observation,nowMs){
 if(observation===undefined||observation===null)return false;
 const expected=['schema','precommitDigest','targetOpenMs','targetCloseMs','observedAtMs',
  'coinbase','kraken','closeDifferenceBps','issues','ohlcDifferenceBps',
  'priceConsistencyWithinResearchThresholds','sourceSigned','independentSourceAttested',
  'originalEnginePrivatelyAttested','allSixOriginalDecisions','entries','lossesAvoided',
  'tradingProfit','tradeAccuracy','ordersSent','paperOrdersSent','commercialPerformanceCertified'];
 if(!exact(observation,expected)||
  observation.schema!=='JENIOS_R10_POST_CANDLE_READ_ONLY_V1'||
  observation.precommitDigest!==R10_PROTOCOL.precommitDigest||
  observation.targetOpenMs!==R10_PROTOCOL.openMs||
  observation.targetCloseMs!==R10_PROTOCOL.closeMs||
  !goodTime(observation.observedAtMs)||
  observation.observedAtMs<R10_PROTOCOL.earliestObserveMs||
  observation.observedAtMs>nowMs||
  !Array.isArray(observation.issues)||
  observation.issues.length!==0||
  observation.priceConsistencyWithinResearchThresholds!==true||
  observation.sourceSigned!==false||
  observation.independentSourceAttested!==false||
  observation.originalEnginePrivatelyAttested!==false||
  observation.allSixOriginalDecisions!=='ABSTAIN'||
  observation.entries!==0||observation.ordersSent!==0||observation.paperOrdersSent!==0||
  observation.tradingProfit!==null||observation.lossesAvoided!==null||
  observation.tradeAccuracy!==null||
  observation.commercialPerformanceCertified!==false)
  err('R12_UNTRUSTED_OR_NON_ABSTAINED_OUTCOME');
 inspectCandle(observation.coinbase,R10_PROTOCOL.openMs);
 inspectCandle(observation.kraken,R10_PROTOCOL.openMs);
 const bps=(x,y)=>Math.abs(x-y)/((x+y)/2)*10000;
 const close=bps(observation.coinbase.close,observation.kraken.close);
 const other=Math.max(...['open','high','low'].map(k=>bps(observation.coinbase[k],observation.kraken[k])));
 if(close>50||other>150||
  !Number.isFinite(observation.closeDifferenceBps)||
  !Number.isFinite(observation.ohlcDifferenceBps)||
  Math.abs(observation.closeDifferenceBps-Number(close.toFixed(6)))>0.000001||
  Math.abs(observation.ohlcDifferenceBps-Number(other.toFixed(6)))>0.000001||
  ['open','high','low','close','volume'].every(k=>observation.coinbase[k]===observation.kraken[k]))
  err('R12_MISREPORTED_OR_INCONSISTENT_PUBLIC_PRICES');
 return true;
}
/** Never return actual PnL, trade win-rate or losses avoided for abstentions. */
export function auditR12LinkedEvidence({privateRecord,publicRecord,gitMetadata,
 observation=null,reviewedAtMs}={}){
 if(!goodTime(reviewedAtMs))err('R12_INVALID_REVIEW_CLOCK');
 checkPrivate(privateRecord);
 validatePublic(publicRecord,gitMetadata,privateRecord);
 const descriptiveOnly=validateOptionalOutcome(observation,reviewedAtMs);
 return Object.freeze({
  schema:'JENIOS_R12_OFFLINE_PRECOMMIT_OUTCOME_LINK_V1',
  privateRecordCanonicalSha256:sha(privateRecord),
  originalGitCommitSha:R10_PROTOCOL.publicCommitSha,
  originalGitCommitAtUtc:'2026-10-22T12:20:55.000Z',
  targetOpenMs:R10_PROTOCOL.openMs,targetCloseMs:R10_PROTOCOL.closeMs,
  validSixUniqueAbstentions:true,
  originalHashConsistent:true,originalGitCommitBeforeCandle:true,
  localObservedOutcomeProvided:descriptiveOnly,
  localPriceConsistencyPassed:descriptiveOnly,
  exchangePriceResponsesCryptographicallySigned:false,
  independentMarketCollectionAuthenticated:false,
  privateRuntimeIdentityIndependentlyVerified:false,
  timestampNotaryOutsideGitHub:false,
  commercialAccuracyCertified:false,brokerOrdersSent:0,paperOrdersSent:0,
  actualLossesAvoided:null,actualBrokerRealizedPnl:null,tradeAccuracy:null,
  decision:descriptiveOnly?
   'DESCRIPTIVE_ONLY_UNATTESTED_PUBLIC_PRICE_NO_TRADES':
   NO_GO
 });
}
