/** PUBLIC research: two read-only Kraken Futures book snapshots, NO credentials or orders. */
import {createHash} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
const SHA=x=>createHash('sha256').update(x).digest('hex');
const URL='wss://futures.kraken.com/ws/v1',PRODUCT='PI_XBTUSD';
const ROOT='r45-public-kraken-forward',PREREG='82cf7d5c8b8e0ec94e7ca84b6aec814c1169ab23';
const check=(x,r)=>{if(!x)throw Error('R45_PUBLIC_FAIL_CLOSED: '+r)};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function verify(s,now){
 check(s?.feed==='book_snapshot'&&s.product_id===PRODUCT&&
   Number.isSafeInteger(s.seq)&&s.seq>=0&&Number.isSafeInteger(s.timestamp),
   'Feed/product/sequence invalid');
 check(now>=s.timestamp-5000&&now-s.timestamp<=30000,'Stale/future provider book');
 const ladders={};
 for(const k of ['bids','asks']){
  const rows=s[k];check(Array.isArray(rows)&&rows.length>0&&rows.length<=500,'Bad book size');
  let prev=k==='bids'?Infinity:-Infinity;
  ladders[k]=rows.map(x=>{
   const p=Number(x.price),q=Number(x.qty);
   check(Number.isFinite(p)&&p>0&&Number.isFinite(q)&&q>0,'Invalid book price or size');
   check(k==='bids'?p<prev:p>prev,'Unsorted book levels');prev=p;return {price:p,qty:q};
  });
 }
 const bid=ladders.bids[0].price,ask=ladders.asks[0].price;
 check(bid<ask,'Crossed book');
 return {seq:s.seq,providerTimestampMs:s.timestamp,receivedAtMs:now,bid,ask,
  spreadBps:(ask-bid)/((bid+ask)/2)*10000,
  bids:ladders.bids.length,asks:ladders.asks.length,
  contractMultiplierProven:false,notBinanceUSDM:true};
}
async function capture(index){
 check(typeof WebSocket==='function','Missing Node native WebSocket');
 return new Promise((resolve,reject)=>{
  let ws,done=false;const finish=(err,payload)=>{
   if(done)return;done=true;clearTimeout(timer);
   if(ws&&(ws.readyState===WebSocket.OPEN||ws.readyState===WebSocket.CONNECTING))ws.close();
   err?reject(err):resolve(payload);
  };
  const timer=setTimeout(()=>finish(Error('No valid public snapshot within 30 seconds')),30000);
  try{ws=new WebSocket(URL)}catch(e){finish(e);return}
  ws.addEventListener('open',()=>{
   try{ws.send(JSON.stringify({event:'subscribe',feed:'book',product_ids:[PRODUCT]}))}
   catch(e){finish(e)}
  });
  ws.addEventListener('message',evt=>{
   try{
    const raw=typeof evt.data==='string'?evt.data:String(evt.data);
    check(raw.length<300000,'Oversized snapshot');
    const d=JSON.parse(raw);
    if(d.event==='error'||d.event==='subscribed_failed')throw Error('Public subscription rejected');
    if(d.feed!=='book_snapshot')return;
    const now=Date.now(),facts=verify(d,now);
    finish(null,{index,raw,sha256:SHA(raw),facts,completedAtUtc:new Date().toISOString()});
   }catch(e){finish(e)}
  });
  ws.addEventListener('error',()=>finish(Error('WebSocket network error')));
  ws.addEventListener('close',evt=>{if(!done)finish(Error('No snapshot before socket closure: '+evt.code))});
 });
}
const write=(p,v)=>writeFileSync(p,JSON.stringify(v,null,2)+'\n');
async function main(){
 mkdirSync(ROOT,{recursive:true});
 const audit={schema:'JENIOS_R45_PUBLIC_KRAKEN_TWO_SNAPSHOTS',
  preregisteredProtocolCommit:PREREG,runCommit:process.env.GITHUB_SHA||null,
  runId:process.env.GITHUB_RUN_ID||null,source:URL,feed:'book',product:PRODUCT,
  nominalWaitSeconds:65,publicReadOnly:true,noApiKeys:true,noOrderClient:true,
  noRealCustomerIntent:true,noObservedBrokerFills:true,noVerifiedReturns:true,
  externallyAttestedClock:false,observations:[],errors:[],
  coverageComplete:false,liveTradingAllowed:false,releaseGate:'NO_GO'};
 for(let i=0;i<2;i++){
  if(i===1)await sleep(65000);
  try{
   const q=await capture(i);
   writeFileSync(ROOT+'/OBSERVACAO-'+i+'.txt',q.raw);
   audit.observations.push({index:i,file:'OBSERVACAO-'+i+'.txt',sha256:q.sha256,
    ...q.facts,completedAtUtc:q.completedAtUtc});
  }catch(e){audit.errors.push({index:i,reason:String(e.message||e)})}
  write(ROOT+'/AUDITORIA-R45.json',audit);
 }
 audit.coverageComplete=audit.observations.length===2&&audit.errors.length===0&&
  audit.observations[1].receivedAtMs-audit.observations[0].receivedAtMs>=60000&&
  audit.observations[1].seq>audit.observations[0].seq;
 write(ROOT+'/AUDITORIA-R45.json',audit);
 console.log(JSON.stringify({validCaptures:audit.observations.length,
  errors:audit.errors,coverageComplete:audit.coverageComplete,releaseGate:'NO_GO'}));
 if(!audit.coverageComplete)process.exitCode=1;
}
main().catch(e=>{console.error('R45 capture fail closed',String(e));process.exitCode=1});