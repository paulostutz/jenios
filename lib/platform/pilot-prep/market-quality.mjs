/** B150 — provider identity, closed bars and monotonic snapshots; no inferred prices. */
import {insist,record,id,time,uint,units,digest} from './contracts.mjs';
export function closedBars(rows,{intervalMs,decisionAtMs,expectedProvider,expectedInstrument,provider,instrument,minBars=80}={}){
 time(decisionAtMs);uint(intervalMs,604800000);insist(intervalMs>=60000,'INVALID_INTERVAL');
 insist(provider===expectedProvider&&instrument===expectedInstrument,'WRONG_MARKET_SOURCE');
 uint(minBars,10000);insist(minBars>=1&&Array.isArray(rows)&&rows.length>=minBars&&rows.length<=10000,'INSUFFICIENT_BARS');
 let prior=null;
 const bars=rows.map(r=>{
  record(r,['time','open','high','low','close','volume']);time(r.time);
  for(const k of ['open','high','low','close','volume'])insist(typeof r[k]==='number'&&Number.isFinite(r[k]),'NON_FINITE_BAR');
  insist(r.low>0&&r.open>=r.low&&r.close>=r.low&&r.high>=Math.max(r.open,r.close,r.low)&&r.volume>=0,'INVALID_OHLCV');
  insist(r.time%intervalMs===0&&r.time+intervalMs<=decisionAtMs,'OPEN_OR_MISALIGNED_BAR');
  if(prior!==null)insist(r.time-prior===intervalMs,'DUPLICATE_OR_GAPPED_BARS');prior=r.time;
  return {...r};
 });
 return {bars,sha256:digest(bars),provider,instrument,decisionAtMs,historical:true,liveExecution:false};
}
export class QuoteSequence {
 #last=new Map();
 accept(input,{now=Date.now(),maxAgeMs=5000,maxFutureSkewMs=1000}={}){
  record(input,['provider','instrument','bid','ask','sourceAtMs','receivedAtMs','sequence']);
  id(input.provider);id(input.instrument);time(now);time(input.sourceAtMs);time(input.receivedAtMs);uint(input.sequence);
  uint(maxAgeMs,60000);uint(maxFutureSkewMs,5000);insist(maxAgeMs>0,'INVALID_AGE_LIMIT');
  const bid=units(input.bid),ask=units(input.ask);insist(bid>0n&&ask>=bid,'CROSSED_OR_INVALID_BOOK');
  insist(input.sourceAtMs<=input.receivedAtMs+maxFutureSkewMs&&input.receivedAtMs<=now&&input.sourceAtMs<=now+maxFutureSkewMs&&now-input.sourceAtMs<=maxAgeMs&&now-input.receivedAtMs<=maxAgeMs,'STALE_OR_FUTURE_QUOTE');
  const key=input.provider+'|'+input.instrument,last=this.#last.get(key),sha=digest(input);
  if(last&&input.sequence===last.sequence){insist(last.sha===sha,'CONFLICTING_DUPLICATE_QUOTE');return {accepted:false,duplicate:true};}
  if(last)insist(input.sequence>last.sequence&&input.sourceAtMs>=last.sourceAtMs&&input.receivedAtMs>=last.receivedAtMs,'REORDERED_QUOTE');
  this.#last.set(key,{sequence:input.sequence,sourceAtMs:input.sourceAtMs,receivedAtMs:input.receivedAtMs,sha});
  return {accepted:true,duplicate:false,sha256:sha,quote:structuredClone(input)};
 }
}
