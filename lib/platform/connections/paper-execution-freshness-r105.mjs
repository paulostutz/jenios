/** Elapsed time across async Paper preflight; never renews quote or consent dates. */
import {performance} from 'node:perf_hooks';
import {instrument,time} from '../pilot-prep/contracts.mjs';
const fail=code=>{throw Object.assign(new Error(code),{code});};
export function paperExecutionClock(nowMs,readClock){
 if(!Number.isSafeInteger(nowMs)||nowMs<=0)fail('PAPER_CLOCK_REQUIRED');
 const start=performance.now();let previous=nowMs;
 return ()=>{
  const current=readClock?readClock():nowMs+Math.floor(performance.now()-start);
  if(!Number.isSafeInteger(current)||current<previous)fail('PAPER_CLOCK_INVALID');
  time(current);previous=current;return current;
 };
}
export function requireFreshPaperMarket({meta,quote,order},nowMs){
 instrument(meta,nowMs);
 if(!quote||quote.provider!=='alpaca'||quote.instrument!==order?.symbol||
    meta.provider!==quote.provider||meta.id!==quote.instrument)fail('MARKET_SOURCE_NOT_MATCHED');
 time(quote.receivedAtMs);time(quote.sourceAtMs);
 if(quote.receivedAtMs>nowMs||quote.sourceAtMs>nowMs+1000||
    nowMs-quote.receivedAtMs>5000||nowMs-quote.sourceAtMs>5000)
  fail('STALE_OR_FUTURE_QUOTE');
}
