/** Robot R9: offline, fail-closed original-core prospective preregistration audit.
 * Local SHA is NOT a timestamp witness, broker receipt or original runtime proof.
 */
import {createHash} from 'node:crypto';
import {canonical} from '../pilot-prep/contracts.mjs';
const fail=code=>{throw Object.assign(new Error(code),{code})};
const time=x=>Number.isSafeInteger(x)&&x>0;
const id=x=>typeof x==='string'&&/^[A-Za-z0-9._-]{1,80}$/.test(x);
const hex=x=>typeof x==='string'&&/^[0-9a-f]{64}$/.test(x);
const exact=(o,keys)=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).length===keys.length&&Object.keys(o).every(k=>keys.includes(k));
const E='9341d9243cbe742b90bf40149663e632fc472f5586c74bf70bdfcfd114e65aea',S='cbb92005459f79bf6e23a0edc7c5542cc62b632b6c301e3f23b98ebd514ce5be';
const F=['schema','studyId','asset','targetOpenMs','targetCloseMs','capturedAtMs','decidedAtMs','registeredAtMs','engineSha256','serviceSha256','inputSha256','modeResults','originalCorePrivate','liveExecutionDisabled','ordersSent'];
export function reviewR9PrivatePrecommit(record,{reviewedAtMs}={}){
 if(!exact(record,F)||record.schema!=='JENIOS_R9_PRIVATE_ORIGINAL_PRECOMMIT_V1'||
  !id(record.studyId)||record.asset!=='BTC-USD'||!time(record.targetOpenMs)||
  record.targetOpenMs%3600000!==0||record.targetCloseMs!==record.targetOpenMs+3600000||
  ![record.capturedAtMs,record.decidedAtMs,record.registeredAtMs,reviewedAtMs].every(time)||
  record.capturedAtMs>record.decidedAtMs||record.decidedAtMs>record.registeredAtMs||
  record.registeredAtMs>record.targetOpenMs-600000||reviewedAtMs<record.registeredAtMs||
  record.engineSha256!==E||record.serviceSha256!==S||!hex(record.inputSha256)||
  record.originalCorePrivate!==true||record.liveExecutionDisabled!==true||
  record.ordersSent!==0||!Array.isArray(record.modeResults)||record.modeResults.length!==6)
  fail('R9_FUTURE_PRIVATE_PRECOMMIT_NOT_VERIFIED');
 const keys=new Set();
 for(const x of record.modeResults){
  if(!exact(x,['mode','intent','action','side'])||
   !['manual','hybrid','reverse'].includes(x.mode)||!['buy','sell'].includes(x.intent)||
   typeof x.action!=='string'||x.action.length>80||
   !(x.side===null||x.side==='buy'||x.side==='sell'))
   fail('R9_UNTRUSTED_MODE_DECISION');
  keys.add(x.mode+'|'+x.intent);
 }
 if(keys.size!==6)fail('R9_MISSING_OR_DUPLICATE_DECISIONS');
 return Object.freeze({schema:'JENIOS_R9_UNWITNESSED_LOCAL_PRECOMMIT_AUDIT_V1',
  draftSha256:createHash('sha256').update(canonical(record)).digest('hex'),
  declaredLeadMs:record.targetOpenMs-record.registeredAtMs,
  claimedEngineHashMatchesArchive:true,
  actualEngineBytesAttestedByThisModule:false,
  independentRegistrationTimestampVerified:false,
  privateOriginalCoreDecisionIndependentlyAttested:false,
  originalSignalsDeliveredToClient:false,
  externalBrokerFillsVerified:false,independentPriceFeedVerified:false,
  outcomeObserved:false,realizedPnl:null,actualLossesAvoided:null,
  statisticalAdvantageCertified:false,ordersSent:0,paperOrdersSent:0,
  readyForCommercialUse:false,
  status:'NO_GO_EXTERNAL_TIMESTAMP_AND_ORIGINAL_RUNTIME_REQUIRED'});
}
export function recordR9UnavailableFreshContext({lastCapturedAtMs,checkedAtMs,targetOpenMs}={}){
 if(![lastCapturedAtMs,checkedAtMs,targetOpenMs].every(time)||
  lastCapturedAtMs>checkedAtMs||targetOpenMs%3600000!==0)
  fail('R9_UNTRUSTED_CLOCK');
 return Object.freeze({schema:'JENIOS_R9_FRESH_CONTEXT_NO_GO_V1',
  lastCapturedAtMs,checkedAtMs,targetOpenMs,
  staleR8InputCannotClaimNewProspectiveSignal:true,
  genuinePrivateForecastRecorded:false,independentMarketOutcomeObserved:false,
  externallyWitnessedTimestamp:false,ordersSent:0,paperOrdersSent:0,
  status:'NO_GO_FRESH_CONTEXT_AND_PRIOR_WITNESS_NEEDED'});
}