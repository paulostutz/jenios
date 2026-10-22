/**
 * ROBOT R15 — offline prospective multi-window cohort protocol.
 * Methodology only: no network, broker, Paper, paid services or private-engine import.
 */
import {createHash} from 'node:crypto';
import {canonical} from '../pilot-prep/contracts.mjs';

const die=code=>{throw Object.assign(new Error(code),{code});};
const sha=x=>createHash('sha256').update(canonical(x)).digest('hex');
const hour=3600000;
const minLead=600000;
const MODES=['manual','hybrid','reverse'];
const INTENTS=['buy','sell'];
const PAIRS=MODES.flatMap(mode=>INTENTS.map(intent=>mode+'|'+intent));
const allowedDecisionClass=new Set(['ABSTAIN','SIGNAL']);

export const R15_COHORT=Object.freeze({
 schema:'JENIOS_R15_MULTIWINDOW_COHORT_V1',
 studyId:'R15-20261022-BTCUSD-MULTIWINDOW-01',
 asset:'BTC-USD',
 windowDurationMs:hour,
 minimumLeadMs:minLead,
 windows:Object.freeze([
  {id:'R15-W01',openMs:Date.parse('2026-10-22T21:00:00Z'),closeMs:Date.parse('2026-10-22T22:00:00Z')},
  {id:'R15-W02',openMs:Date.parse('2026-10-22T22:00:00Z'),closeMs:Date.parse('2026-10-22T23:00:00Z')},
  {id:'R15-W03',openMs:Date.parse('2026-10-22T23:00:00Z'),closeMs:Date.parse('2026-10-23T00:00:00Z')},
  {id:'R15-W04',openMs:Date.parse('2026-10-23T00:00:00Z'),closeMs:Date.parse('2026-10-23T01:00:00Z')},
  {id:'R15-W05',openMs:Date.parse('2026-10-23T01:00:00Z'),closeMs:Date.parse('2026-10-23T02:00:00Z')},
  {id:'R15-W06',openMs:Date.parse('2026-10-23T02:00:00Z'),closeMs:Date.parse('2026-10-23T03:00:00Z')}
 ]),
 publicMarketSources:Object.freeze(['coinbase','kraken']),
 liveExecutionAllowed:false,
 paperExternalAllowed:false,
 paidServicesAllowed:false,
 realPnlCertificationAllowed:false
});

function exact(o,keys){
 return o&&typeof o==='object'&&!Array.isArray(o)&&
  Object.keys(o).length===keys.length&&Object.keys(o).every(k=>keys.includes(k));
}
function windowById(id){return R15_COHORT.windows.find(w=>w.id===id);}
function validPairSet(rows){
 return Array.isArray(rows)&&rows.length===6&&
  new Set(rows.map(x=>x?.mode+'|'+x?.intent)).size===6&&
  PAIRS.every(p=>rows.some(x=>x?.mode+'|'+x?.intent===p));
}
export function validateR15WindowPrecommit(record,{reviewedAtMs}={}){
 const keys=['schema','studyId','windowId','asset','capturedAtMs','decidedAtMs','registeredAtMs',
  'inputSha256','engineSha256','serviceSha256','modeResults','ordersSent','paperOrdersSent'];
 if(!exact(record,keys)||record.schema!=='JENIOS_R15_WINDOW_PRECOMMIT_V1'||
  record.studyId!==R15_COHORT.studyId||record.asset!=='BTC-USD'||
  !Number.isSafeInteger(reviewedAtMs)) die('R15_INVALID_PRECOMMIT_SHAPE');
 const w=windowById(record.windowId);
 if(!w)die('R15_UNKNOWN_WINDOW');
 if(![record.capturedAtMs,record.decidedAtMs,record.registeredAtMs].every(Number.isSafeInteger)||
  record.capturedAtMs>record.decidedAtMs||record.decidedAtMs>record.registeredAtMs||
  reviewedAtMs<record.registeredAtMs||record.registeredAtMs>w.openMs-minLead)
  die('R15_LATE_OR_INCONSISTENT_PRECOMMIT');
 if(!/^[a-f0-9]{64}$/.test(record.inputSha256)||
  record.engineSha256!=='9341d9243cbe742b90bf40149663e632fc472f5586c74bf70bdfcfd114e65aea'||
  record.serviceSha256!=='cbb92005459f79bf6e23a0edc7c5542cc62b632b6c301e3f23b98ebd514ce5be'||
  record.ordersSent!==0||record.paperOrdersSent!==0||!validPairSet(record.modeResults))
  die('R15_PRECOMMIT_INTEGRITY_FAILURE');
 for(const x of record.modeResults){
  if(!exact(x,['mode','intent','decisionClass','side'])||
   !MODES.includes(x.mode)||!INTENTS.includes(x.intent)||
   !allowedDecisionClass.has(x.decisionClass)||
   (x.decisionClass==='ABSTAIN'&&x.side!==null)||
   (x.decisionClass==='SIGNAL'&&!['buy','sell'].includes(x.side)))
   die('R15_INVALID_DECISION');
 }
 return Object.freeze({
  schema:'JENIOS_R15_WINDOW_PRECOMMIT_AUDIT_V1',
  studyId:record.studyId,windowId:record.windowId,
  canonicalSha256:sha(record),
  registeredBeforeWindow:true,
  leadMs:w.openMs-record.registeredAtMs,
  signals:record.modeResults.filter(x=>x.decisionClass==='SIGNAL').length,
  abstentions:record.modeResults.filter(x=>x.decisionClass==='ABSTAIN').length,
  ordersSent:0,paperOrdersSent:0
 });
}

export function validateR15Outcome(outcome,{reviewedAtMs}={}){
 const keys=['schema','studyId','windowId','precommitSha256','observedAtMs',
  'coinbaseSha256','krakenSha256','publicPriceConsistencyPassed',
  'brokerOrdersSent','paperOrdersSent','actualBrokerPnl','actualLossesAvoided','commercialPerformanceCertified'];
 if(!exact(outcome,keys)||outcome.schema!=='JENIOS_R15_WINDOW_OUTCOME_V1'||
  outcome.studyId!==R15_COHORT.studyId||!Number.isSafeInteger(reviewedAtMs))
  die('R15_INVALID_OUTCOME_SHAPE');
 const w=windowById(outcome.windowId);
 if(!w)die('R15_UNKNOWN_WINDOW');
 if(!Number.isSafeInteger(outcome.observedAtMs)||outcome.observedAtMs<w.closeMs+600000||
  outcome.observedAtMs>reviewedAtMs)die('R15_EARLY_OR_INVALID_OUTCOME');
 if(!/^[a-f0-9]{64}$/.test(outcome.precommitSha256)||
  !/^[a-f0-9]{64}$/.test(outcome.coinbaseSha256)||
  !/^[a-f0-9]{64}$/.test(outcome.krakenSha256)||
  typeof outcome.publicPriceConsistencyPassed!=='boolean'||
  outcome.brokerOrdersSent!==0||outcome.paperOrdersSent!==0||
  outcome.actualBrokerPnl!==null||outcome.actualLossesAvoided!==null||
  outcome.commercialPerformanceCertified!==false)
  die('R15_OUTCOME_INTEGRITY_FAILURE');
 return Object.freeze({windowId:outcome.windowId,outcomeAccepted:true,
  publicPriceConsistencyPassed:outcome.publicPriceConsistencyPassed});
}

export function aggregateR15Cohort({precommits=[],outcomes=[]}={}){
 if(!Array.isArray(precommits)||!Array.isArray(outcomes))die('R15_INVALID_COHORT_INPUT');
 const ids=new Set(),preBy=new Map();
 let signals=0,abstentions=0;
 for(const p of precommits){
  if(!p||ids.has(p.windowId))die('R15_DUPLICATE_WINDOW_PRECOMMIT');
  ids.add(p.windowId);preBy.set(p.windowId,p);
  signals+=p.signals;abstentions+=p.abstentions;
 }
 let linkedOutcomes=0,consistentOutcomes=0;
 for(const o of outcomes){
  const p=preBy.get(o.windowId);
  if(!p||o.precommitSha256!==p.canonicalSha256)die('R15_UNLINKED_OUTCOME');
  linkedOutcomes++;if(o.publicPriceConsistencyPassed)consistentOutcomes++;
 }
 return Object.freeze({
  schema:'JENIOS_R15_COHORT_SUMMARY_V1',
  plannedWindows:R15_COHORT.windows.length,
  preregisteredWindows:precommits.length,
  linkedOutcomes,consistentOutcomes,
  signals,abstentions,
  actualBrokerPnl:null,actualLossesAvoided:null,tradeAccuracy:null,
  commercialPerformanceCertified:false,
  status:precommits.length===R15_COHORT.windows.length&&linkedOutcomes===R15_COHORT.windows.length?
   'R15_COHORT_OBSERVED_NO_REAL_PNL_CERTIFICATION':'R15_COHORT_INCOMPLETE'
 });
}
