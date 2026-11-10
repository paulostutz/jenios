/** USDⓈ-M order evidence only. No execution, account-wide P&L or funding allocation.
 * Uses the official REST contract, not an installed Binance SDK. Credentials stay local.
 * Callers must retain the original symbol/order/client IDs from their durable journal.
 */
import {createHash,createHmac} from 'node:crypto';
import {performance} from 'node:perf_hooks';

const ORIGINS=Object.freeze({demo:'https://demo-fapi.binance.com',live:'https://fapi.binance.com'});
const DAY=86400000,UNIT=10n**18n,MAX_BYTES=2_000_000;
const fail=code=>{throw Object.assign(Error(code),{collectorError:true});};
const symbol=v=>typeof v==='string'&&/^[A-Z0-9_]{2,40}$/.test(v);
const clientId=v=>typeof v==='string'&&/^[.A-Za-z0-9_:/-]{1,36}$/.test(v);
const asset=v=>typeof v==='string'&&/^[A-Z0-9]{2,20}$/.test(v);
function id(v){if(typeof v==='number'){if(!Number.isSafeInteger(v))fail('BINANCE_ID_PRECISION_UNVERIFIED');v=String(v);}if(typeof v!=='string'||! /^[1-9]\d{0,18}$/.test(v)||BigInt(v)>9223372036854775807n)fail('BINANCE_INVALID_ID');return v;}
function stamp(v){if(!Number.isSafeInteger(v)||v<=0)fail('BINANCE_INVALID_TIME');return v;}
function amount(v,{positive=false,nonnegative=false}={}){
 if(typeof v!=='string'||! /^-?(0|[1-9]\d{0,17})(\.\d{1,18})?$/.test(v))fail('BINANCE_INVALID_DECIMAL');
 const [whole,fraction='']=v.replace('-','').split('.');const n=(v.startsWith('-')?-1n:1n)*(BigInt(whole)*UNIT+BigInt(fraction.padEnd(18,'0')));
 if(positive&&n<=0n||nonnegative&&n<0n)fail('BINANCE_INVALID_DECIMAL');return n;
}
function format(n){const sign=n<0n?'-':'';if(n<0n)n=-n;const fraction=String(n%UNIT).padStart(18,'0').replace(/0+$/,'');return sign+String(n/UNIT)+(fraction?'.'+fraction:'');}
function reference(v){
 const keys=['symbol','orderId','clientOrderId','side','positionSide'];
 if(!v||Object.keys(v).some(k=>!keys.includes(k))||!symbol(v.symbol)||!clientId(v.clientOrderId)||!['BUY','SELL'].includes(v.side)||!['BOTH','LONG','SHORT'].includes(v.positionSide))fail('BINANCE_ORDER_REFERENCE_REQUIRED');
 return {...v,orderId:id(v.orderId)};
}
function order(v,ref,at){
 if(!v||id(v.orderId)!==ref.orderId||v.clientOrderId!==ref.clientOrderId||v.symbol!==ref.symbol||v.side!==ref.side||v.positionSide!==ref.positionSide)fail('BINANCE_ORDER_SCOPE_MISMATCH');
 if(!['NEW','PARTIALLY_FILLED','FILLED','CANCELED','EXPIRED','EXPIRED_IN_MATCH','REJECTED'].includes(v.status))fail('BINANCE_UNKNOWN_ORDER_STATUS');
 const requested=amount(v.origQty,{positive:true}),executed=amount(v.executedQty,{nonnegative:true});
 if(executed>requested||v.status==='FILLED'&&executed!==requested||['NEW','REJECTED'].includes(v.status)&&executed!==0n||v.status==='PARTIALLY_FILLED'&&(executed===0n||executed===requested))fail('BINANCE_ORDER_QUANTITY_CONFLICT');
 if(stamp(v.updateTime)<stamp(v.time)||v.updateTime>at+1000)fail('BINANCE_INVALID_TIME');
 return {...ref,status:v.status,requestedQuantity:v.origQty,executedQuantity:v.executedQty,createdAtMs:v.time,updatedAtMs:v.updateTime};
}
function trade(v,ref,start,end){
 if(!v||id(v.orderId)!==ref.orderId||v.symbol!==ref.symbol||v.side!==ref.side||v.positionSide!==ref.positionSide)fail('BINANCE_TRADE_SCOPE_MISMATCH');
 const tradeId=id(v.id);amount(v.qty,{positive:true});amount(v.price,{positive:true});amount(v.commission);amount(v.realizedPnl);
 if(!asset(v.commissionAsset)||v.marginAsset!==undefined&&!asset(v.marginAsset)||stamp(v.time)<start||v.time>end)fail('BINANCE_TRADE_RESPONSE_INVALID');
 return {tradeId,orderId:ref.orderId,symbol:ref.symbol,side:ref.side,positionSide:ref.positionSide,quantity:v.qty,price:v.price,commission:v.commission,commissionAsset:v.commissionAsset,realizedPnl:v.realizedPnl,marginAsset:v.marginAsset??null,timeMs:v.time};
}
/** Fingerprint of this environment's API key, NOT a verified Binance account UID. */
export function binanceReadOnlyKeyFingerprint(apiKey,environment){
 if(typeof apiKey!=='string'||! /^[A-Za-z0-9]{16,256}$/.test(apiKey)||!Object.hasOwn(ORIGINS,environment))fail('BINANCE_LOCAL_CREDENTIALS_REQUIRED');
 return createHash('sha256').update('jenios-ultra-binance-usds-m-key:'+environment+':'+apiKey).digest('hex');
}

export class BinanceOrderCollector {
 #key;#secret;#origin;#fetch;#now;#monotonic;#environment;#fingerprint;#busy=false;
 constructor({product,environment,expectedKeyFingerprint},{env=process.env,fetchImpl=fetch,now=Date.now,monotonicNow=()=>performance.now()}={}){
  if(product!=='usds_m_futures')fail('BINANCE_FUTURES_PRODUCT_REQUIRED');
  const key=env.JENIOS_BINANCE_API_KEY,secret=env.JENIOS_BINANCE_API_SECRET;
  const fingerprint=binanceReadOnlyKeyFingerprint(key,environment);
  if(typeof secret!=='string'||! /^[A-Za-z0-9]{16,256}$/.test(secret))fail('BINANCE_LOCAL_CREDENTIALS_REQUIRED');
  if(typeof expectedKeyFingerprint!=='string'||! /^[a-f0-9]{64}$/.test(expectedKeyFingerprint)||fingerprint!==expectedKeyFingerprint)fail('BINANCE_KEY_BINDING_MISMATCH');
  this.#key=key;this.#secret=secret;this.#origin=ORIGINS[environment];this.#environment=environment;this.#fingerprint=fingerprint;this.#fetch=fetchImpl;this.#now=now;this.#monotonic=monotonicNow;
 }
 async collect(references){
  if(this.#busy)fail('BINANCE_COLLECTION_BUSY');
  if(!Array.isArray(references)||!references.length||references.length>50)fail('BINANCE_ORDER_REFERENCES_REQUIRED');
  const refs=references.map(reference),seen=new Set();
  for(const r of refs){const key=r.symbol+':'+r.orderId;if(seen.has(key))fail('BINANCE_DUPLICATE_ORDER_REFERENCE');seen.add(key);}
  this.#busy=true;
  try{return await this.#collect(refs);}finally{this.#busy=false;}
 }
 async #collect(refs){
  let anchorTime=0,anchorMono=0,previousElapsed=0,calls=0,totalTrades=0;
  const get=async(path,params={},signed=true)=>{
   if(!['/fapi/v1/time','/fapi/v1/order','/fapi/v1/userTrades','/fapi/v3/positionRisk','/fapi/v1/income'].includes(path))fail('BINANCE_READ_ONLY_ENDPOINT_REQUIRED');
   if(++calls>200)fail('BINANCE_COLLECTION_LIMIT');
   const query=new URLSearchParams(params),headers={Accept:'application/json'};
   if(signed){const elapsed=this.#monotonic()-anchorMono;if(!Number.isFinite(elapsed)||elapsed<previousElapsed||elapsed>300000)fail('BINANCE_CLOCK_UNVERIFIED');previousElapsed=elapsed;query.set('timestamp',String(anchorTime+Math.floor(elapsed)));query.set('recvWindow','5000');query.set('signature',createHmac('sha256',this.#secret).update(query.toString()).digest('hex'));headers['X-MBX-APIKEY']=this.#key;}
   try{
    const response=await this.#fetch(this.#origin+path+(query.size?'?'+query:''),{method:'GET',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(10000),headers});
    if(response.redirected){await response.body?.cancel?.();fail('BINANCE_REDIRECT_DENIED');}
    const httpCodes={401:'BINANCE_AUTHENTICATION_REJECTED',403:'BINANCE_ACCESS_FORBIDDEN',418:'BINANCE_RATE_LIMITED',429:'BINANCE_RATE_LIMITED',451:'BINANCE_REGION_RESTRICTED'};
    if(httpCodes[response.status]){await response.body?.cancel?.();fail(httpCodes[response.status]);}
    const reader=response.body?.getReader?.();if(!reader)fail('BINANCE_RESPONSE_INVALID');
    const chunks=[];let length=0;
    try{for(;;){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>MAX_BYTES){await reader.cancel();fail('BINANCE_RESPONSE_TOO_LARGE');}chunks.push(value);}}finally{reader.releaseLock();}
    let json;try{json=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{fail('BINANCE_RESPONSE_INVALID');}
    if(!response.ok||json&&Number.isInteger(json.code)&&json.code<0){if(json?.code===-2013)fail('BINANCE_ORDER_HISTORY_UNAVAILABLE');fail('BINANCE_PROVIDER_REJECTED');}
    return json;
   }catch(e){if(e?.collectorError===true)throw e;fail('BINANCE_READ_FAILED');}
  };
  const local=stamp(this.#now()),startMono=this.#monotonic();const clock=await get('/fapi/v1/time',{},false);
  anchorMono=this.#monotonic();anchorTime=stamp(clock?.serverTime);
  if(!Number.isFinite(startMono)||!Number.isFinite(anchorMono)||anchorMono<startMono||anchorMono-startMono>2000||Math.abs(anchorTime-local)>30000)fail('BINANCE_CLOCK_UNVERIFIED');
  const evidence=[];
  for(const ref of refs){
   const first=order(await get('/fapi/v1/order',{symbol:ref.symbol,orderId:ref.orderId}),ref,anchorTime+Math.floor(this.#monotonic()-anchorMono));
   // Conservative 89-day bound fits both 90-day order and 3-month fill retention.
   if(first.createdAtMs<anchorTime-89*DAY)fail('BINANCE_HISTORY_OUTSIDE_SUPPORTED_WINDOW');
   const fills=new Map();
   const window=async(start,end)=>{
    const rows=await get('/fapi/v1/userTrades',{symbol:ref.symbol,orderId:ref.orderId,startTime:String(start),endTime:String(end),limit:'1000'});
    if(!Array.isArray(rows)||rows.length>1000)fail('BINANCE_TRADE_RESPONSE_INVALID');
    // A full page may be truncated. Bisect time rather than skip same-ms trades.
    if(rows.length===1000){if(start===end)fail('BINANCE_TRADE_PAGE_INCOMPLETE');const middle=start+Math.floor((end-start)/2);await window(start,middle);await window(middle+1,end);return;}
    for(const row of rows){const fill=trade(row,ref,start,end);if(fills.has(fill.tradeId))fail('BINANCE_DUPLICATE_TRADE');if(++totalTrades>20000)fail('BINANCE_COLLECTION_LIMIT');fills.set(fill.tradeId,fill);}
   };
   if(amount(first.executedQuantity)>0n){for(let start=first.createdAtMs;start<=first.updatedAtMs;start+=7*DAY){await window(start,Math.min(start+7*DAY-1,first.updatedAtMs));}}
   const last=order(await get('/fapi/v1/order',{symbol:ref.symbol,orderId:ref.orderId}),ref,anchorTime+Math.floor(this.#monotonic()-anchorMono));
   if(JSON.stringify(first)!==JSON.stringify(last))fail('BINANCE_ORDER_CHANGED_DURING_COLLECTION');
   const trades=[...fills.values()].sort((a,b)=>a.timeMs-b.timeMs||(BigInt(a.tradeId)<BigInt(b.tradeId)?-1:1));
   if(trades.reduce((n,t)=>n+amount(t.quantity),0n)!==amount(first.executedQuantity))fail('BINANCE_FILL_RECONCILIATION_PENDING');
   const fees=new Map();for(const t of trades)fees.set(t.commissionAsset,(fees.get(t.commissionAsset)||0n)+amount(t.commission));
   evidence.push({...first,trades,commissions:[...fees].map(([asset,n])=>({asset,amount:format(n)})),fillsCompleteForOrderSnapshot:true,positionReconciled:false,costsComplete:false,financing:null,net:null});
  }
  // Position and funding belong to the account/symbol, not automatically to this robot.
  // An absent position row, FILLED order or funding row never certifies a closed lifecycle.
  const context=[];
  for(const selectedSymbol of new Set(refs.map(r=>r.symbol))){
   const raw=await get('/fapi/v3/positionRisk',{symbol:selectedSymbol});
   if(!Array.isArray(raw)||raw.length>3)fail('BINANCE_POSITION_RESPONSE_INVALID');
   const sides=new Set(),positions=raw.map(p=>{
    if(p?.symbol!==selectedSymbol||!['BOTH','LONG','SHORT'].includes(p.positionSide)||sides.has(p.positionSide)||!asset(p.marginAsset))fail('BINANCE_POSITION_SCOPE_MISMATCH');
    sides.add(p.positionSide);amount(p.positionAmt);amount(p.entryPrice,{nonnegative:true});amount(p.unRealizedProfit);
    if(!Number.isSafeInteger(p.updateTime)||p.updateTime<0||p.updateTime>anchorTime+Math.floor(this.#monotonic()-anchorMono)+1000)fail('BINANCE_INVALID_TIME');
    return {symbol:selectedSymbol,positionSide:p.positionSide,quantity:p.positionAmt,entryPrice:p.entryPrice,unrealized:p.unRealizedProfit,marginAsset:p.marginAsset,updatedAtMs:p.updateTime};
   });
   const since=Math.min(...evidence.filter(o=>o.symbol===selectedSymbol).map(o=>o.createdAtMs)),funding=new Map();
   const window=async(start,end)=>{
    const rows=await get('/fapi/v1/income',{symbol:selectedSymbol,incomeType:'FUNDING_FEE',startTime:String(start),endTime:String(end),limit:'1000'});
    if(!Array.isArray(rows)||rows.length>1000)fail('BINANCE_FUNDING_RESPONSE_INVALID');
    if(rows.length===1000){if(start===end)fail('BINANCE_FUNDING_PAGE_INCOMPLETE');const middle=start+Math.floor((end-start)/2);await window(start,middle);await window(middle+1,end);return;}
    for(const row of rows){
     if(row?.symbol!==selectedSymbol||row.incomeType!=='FUNDING_FEE'||!asset(row.asset)||stamp(row.time)<start||row.time>end)fail('BINANCE_FUNDING_SCOPE_MISMATCH');
     const transactionId=id(row.tranId);amount(row.income);
     if(funding.has(transactionId))fail('BINANCE_DUPLICATE_FUNDING');if(++totalTrades>20000)fail('BINANCE_COLLECTION_LIMIT');
     funding.set(transactionId,{transactionId,symbol:selectedSymbol,asset:row.asset,income:row.income,timeMs:row.time,attributedToRobot:false});
    }
   };
   await window(since,anchorTime);
   context.push({symbol:selectedSymbol,scope:'account_symbol_not_robot',observedAtMs:anchorTime+Math.floor(this.#monotonic()-anchorMono),positions,positionOwnershipVerified:false,fundingWindow:{startTime:since,endTime:anchorTime},funding:[...funding.values()],fundingAllocated:false});
  }
  return {schema:'JENIOS_ULTRA_BINANCE_ORDER_EVIDENCE_V1',provider:'binance',product:'usds_m_futures',environment:this.#environment,keyFingerprint:this.#fingerprint,identityScope:'api_key_not_account_uid',readOnly:true,executionAvailable:false,generatedAt:new Date(anchorTime+Math.floor(this.#monotonic()-anchorMono)).toISOString(),orders:evidence,context};
 }
}
