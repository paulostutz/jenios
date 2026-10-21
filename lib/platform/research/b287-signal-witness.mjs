/** B287 isolated prospective signal witness: validation only, no execution. */
import {createHash} from 'node:crypto';
const modes=new Set(['manual','hybrid','reverse']);
const assets=new Set(['BTC-USD','ETH-USD','SOL-USD']);
const fail=s=>{throw Object.assign(new Error(s),{code:s});};
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
export function inspectFrozenSignalBatch(batch,{nowMs=Date.now()}={}){
 if(!batch||batch.schema!=='JENIOS_B287_SIGNAL_BATCH_V1'||!Array.isArray(batch.signals)||
 batch.signals.length<3||batch.signals.length>1000||!Number.isSafeInteger(nowMs))
 fail('B287_INVALID_BATCH');
 const ids=new Set(),counts={manual:0,hybrid:0,reverse:0};
 for(const s of batch.signals){
  if(!s||!modes.has(s.mode)||!assets.has(s.asset)||
  typeof s.id!=='string'||!/^[a-zA-Z0-9._-]{1,80}$/.test(s.id)||
  ids.has(s.id)||!Number.isSafeInteger(s.signalAtMs)||!Number.isSafeInteger(s.targetCloseMs)||
  s.signalAtMs>=s.targetCloseMs||s.signalAtMs>nowMs||
  !['UP','DOWN','ABSTAIN'].includes(s.direction)||
  s.isOrder!==false||s.executed!==false||s.realizedPnl!==null)
  fail('B287_INVALID_OR_NONCAUSAL_SIGNAL');
  ids.add(s.id);counts[s.mode]++;
 }
 if(Object.values(counts).some(x=>x===0))fail('B287_THREE_MODES_REQUIRED');
 if(batch.frozenAtMs>nowMs||batch.signals.some(s=>s.signalAtMs>batch.frozenAtMs))
 fail('B287_UNFROZEN_SIGNAL');
 const core={schema:batch.schema,frozenAtMs:batch.frozenAtMs,signals:batch.signals};
 if(sha(core)!==batch.sha256)fail('B287_SIGNAL_BATCH_TAMPERED');
 return Object.freeze({valid:true,sha256:batch.sha256,counts,
  total:batch.signals.length,privateCoreIdentityAttested:false,
  independentTimestampAttested:false,brokerExecutionVerified:false,
  outcomesVerified:false,lossesNeutralized:null,profitPct:null,
  ordersSent:0,liveAllowed:false,classification:'FROZEN_SIGNALS_AWAITING_FUTURE_OUTCOMES'});
}
export function scoreWitnessedSignals(batch,observations,{observedAtMs=Date.now()}={}){
 const audit=inspectFrozenSignalBatch(batch,{nowMs:observedAtMs});
 if(!Array.isArray(observations)||observations.length!==batch.signals.length)fail('B287_MISSING_OUTCOMES');
 const by=new Map(observations.map(o=>[o?.id,o]));
 if(by.size!==observations.length)fail('B287_DUPLICATE_OUTCOME');
 const summary={manual:{up:0,down:0,abstained:0,correct:0,incorrect:0},
  hybrid:{up:0,down:0,abstained:0,correct:0,incorrect:0},
  reverse:{up:0,down:0,abstained:0,correct:0,incorrect:0}};
 for(const s of batch.signals){
  const o=by.get(s.id);
  if(!o||o.asset!==s.asset||o.targetCloseMs!==s.targetCloseMs||
  o.observedAtMs<s.targetCloseMs+300000||o.observedAtMs>observedAtMs||
  !Number.isFinite(o.open)||!Number.isFinite(o.close)||o.open<=0||o.close<=0||
  o.signedByIndependentSource!==false||o.orderExecuted!==false)
  fail('B287_UNTRUSTED_OR_EARLY_OUTCOME');
  const x=summary[s.mode];
  if(s.direction==='ABSTAIN'){x.abstained++;continue;}
  if(s.direction==='UP')x.up++;else x.down++;
  const actual=Math.sign(o.close-o.open),expected=s.direction==='UP'?1:-1;
  if(actual===expected)x.correct++;else x.incorrect++;
 }
 const result=Object.fromEntries(Object.entries(summary).map(([mode,x])=>[mode,{
  ...x,signals:x.correct+x.incorrect,accuracyPct:x.correct+x.incorrect?
  Number((100*x.correct/(x.correct+x.incorrect)).toFixed(3)):null
 }]));
 return Object.freeze({schema:'JENIOS_B287_DESCRIPTIVE_SIGNALS_V1',
  originalBatchSha256:audit.sha256,summary:result,
  provenance:'UNSIGNED_OBSERVATIONS_NOT_PRIVATE_CORE_CERTIFIED',
  profitabilityCertified:false,lossesNeutralized:null,
  netReturnPct:null,ordersSent:0,commercialClaimsAllowed:false});
}
