/** R8: public Coinbase closed BTC-USD 5m+1h context; never includes private engine. */
import {createHash} from 'node:crypto';
const fail=s=>{throw Object.assign(Error(s),{code:s})};
const M=300000,H=3600000,ORIGIN='https://api.exchange.coinbase.com';
export function planR8Market(nowMs){
 if(!Number.isSafeInteger(nowMs)||nowMs<1800000000000)fail('R8_INVALID_CLOCK');
 const decisionAtMs=Math.floor((nowMs-600000)/M)*M;
 const windows=[{intervalMs:M,count:200,endMs:decisionAtMs},{intervalMs:H,count:120,endMs:Math.floor(decisionAtMs/H)*H}].map(w=>{
  const startMs=w.endMs-w.count*w.intervalMs;
  const u=new URL(ORIGIN+'/products/BTC-USD/candles');
  u.searchParams.set('start',new Date(startMs).toISOString());
  u.searchParams.set('end',new Date(w.endMs).toISOString());
  u.searchParams.set('granularity',String(w.intervalMs/1000));
  return Object.freeze({...w,startMs,url:u.href});
 });
 return Object.freeze({decisionAtMs,requestedAtMs:nowMs,windows:Object.freeze(windows)});
}
export function parseR8Candles(rows,window){
 if(!Array.isArray(rows)||rows.length>301)fail('R8_UNSAFE_CANDLE_RESPONSE');
 const by=new Map();
 for(const record of rows){
  if(!Array.isArray(record)||record.length!==6||!Number.isSafeInteger(record[0]))fail('R8_INVALID_RECORD');
  const [sec,low,high,open,close,volume]=record,t=sec*1000;
  if(t<window.startMs||t>=window.endMs)continue;
  if(by.has(t)||![low,high,open,close,volume].every(x=>typeof x==='number'&&Number.isFinite(x))||
   low<=0||open<=0||close<=0||volume<0||high<Math.max(low,open,close)||
   low>Math.min(open,close)||high/low>1.5)fail('R8_DUPLICATE_OR_BAD_OHLCV');
  by.set(t,{time:t,open,high,low,close,volume});
 }
 const bars=[...by.values()].sort((a,b)=>a.time-b.time);
 if(bars.length!==window.count)fail('R8_MISSING_HISTORICAL_CANDLES');
 for(let i=0;i<bars.length;i++)if(bars[i].time!==window.startMs+i*window.intervalMs)fail('R8_GAPPED_HISTORY');
 return bars;
}
async function publicGet(window,fetcher){
 const url=new URL(window.url);
 if(url.origin!==ORIGIN||url.pathname!=='/products/BTC-USD/candles')fail('R8_UNSAFE_URL');
 let response;
 try{response=await fetcher(window.url,{method:'GET',redirect:'error',credentials:'omit',cache:'no-store',headers:{accept:'application/json'},signal:AbortSignal.timeout(12000)});}
 catch{fail('R8_PUBLIC_HTTP_UNAVAILABLE')}
 if(response?.status!==200)fail('R8_PUBLIC_HTTP_ERROR');
 let body;try{body=await response.text()}catch{fail('R8_BODY_FAILED')}
 if(body.length>120000)fail('R8_BODY_TOO_LARGE');
 try{return JSON.parse(body)}catch{fail('R8_BAD_JSON')}
}
export async function captureR8Market({plan,observedAtMs,fetcher=fetch}={}){
 if(!plan||!Number.isSafeInteger(observedAtMs)||observedAtMs<plan.requestedAtMs||
  JSON.stringify(plan)!==JSON.stringify(planR8Market(plan.requestedAtMs)))fail('R8_FORGED_PLAN');
 const [w5,w1]=plan.windows;
 const [p5,p1]=[await publicGet(w5,fetcher),await publicGet(w1,fetcher)];
 const bars=parseR8Candles(p5,w5),higherBars=parseR8Candles(p1,w1);
 if(bars.at(-1).time+M>plan.decisionAtMs||
  higherBars.at(-1).time+H>plan.decisionAtMs)fail('R8_OPEN_CANDLE');
 const sha=o=>createHash('sha256').update(JSON.stringify(o)).digest('hex');
 return Object.freeze({schema:'JENIOS_R8_PUBLIC_MARKET_CONTEXT_V1',
  asset:'BTC-USD',source:'coinbase_exchange_public_unsigned',
  bars,higherBars,intervalMs:M,higherIntervalMs:H,
  decisionAtMs:plan.decisionAtMs,observedAtMs,
  inputDigests:{lower:sha(p5),higher:sha(p1)},
  originalPrivateEngineExecuted:false,independentTimestampVerified:false,
  originalSignalsRegistered:0,ordersSent:0,paperOrdersSent:0,
  actualBrokerPnl:null,profitableRobotVerified:false});
}
