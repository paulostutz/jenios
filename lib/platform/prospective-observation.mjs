/** B89 — browser-local observation log of successive public historical candle snapshots.
 * No scheduled monitoring; no exchange trade, P&L, implied fill or provider-signed attestation.
 */
const MAX_OBSERVATIONS=120;
const account=id=>typeof id==='string'&&/^(?:social_)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
const market=new Set(['BTC-USD','ETH-USD','SOL-USD']);
const interval=new Set([60,300,3600]);
export function observationKey(userId,product,granularity){
 return account(userId)&&market.has(product)&&interval.has(granularity)
  ?'jenios_r45_b89_observations:'+userId.toLowerCase()+':'+product+':'+granularity:null;
}
function safe(record){
 const at=Date.parse(record?.recordedAt),candleAt=Date.parse(record?.candleAt);
 return record&&typeof record==='object'&&Number.isFinite(at)&&Number.isFinite(candleAt)
  &&candleAt<at&&Number.isFinite(record.close)&&record.close>0&&record.source==='browser_public_candle_capture'
  &&record.realOrder===false&&record.verifiedProfit===null
  ?{candleAt:new Date(candleAt).toISOString(),recordedAt:new Date(at).toISOString(),
    close:record.close,source:'browser_public_candle_capture',realOrder:false,verifiedProfit:null}:null;
}
export function readProspectiveObservations(storage,userId,product,granularity){
 const key=observationKey(userId,product,granularity);
 if(!key||!storage?.getItem)return [];
 try{
  const data=JSON.parse(storage.getItem(key)||'null');
  if(data?.version!==1||!Array.isArray(data.rows))return [];
  const rows=data.rows.slice(-MAX_OBSERVATIONS).map(safe);
  return rows.every(Boolean)?rows:[];
 }catch{return [];}
}
export function captureProspectiveObservation(storage,userId,providerData,{now=Date.now()}={}){
 const product=providerData?.product,granularity=providerData?.granularity;
 const key=observationKey(userId,product,granularity);
 if(!key)return {ok:false,reason:'USER_OR_MARKET_REQUIRED'};
 if(!providerData?.available||providerData?.provider!=='coinbase_exchange_public_rest'
  ||providerData?.historicalOnly!==true||providerData?.liveStream!==false
  ||!Array.isArray(providerData.candles)||!providerData.candles.length)
  return {ok:false,reason:'PUBLIC_PROVIDER_NOT_AVAILABLE'};
 const received=Date.parse(providerData.obtainedAt),candleAt=Date.parse(providerData.lastCompleteCandle);
 const intervalMs=granularity*1000;
 const last=providerData.candles.at(-1);
 if(!Number.isSafeInteger(now)||!Number.isFinite(received)||!Number.isFinite(candleAt)
  ||Math.abs(now-received)>90000||candleAt>=received||received>now+5000
  ||providerData.ageMs<0||providerData.ageMs>intervalMs*3
  ||last?.time!==providerData.lastCompleteCandle||!Number.isFinite(last?.close)||last.close<=0)
  return {ok:false,reason:'UNVERIFIABLE_CAPTURE_TIME'};
 const old=readProspectiveObservations(storage,userId,product,granularity);
 const previous=old.at(-1),previousAt=previous&&Date.parse(previous.candleAt);
 if(previous&&candleAt<=previousAt)return {ok:false,reason:'NO_NEW_COMPLETE_CANDLE',rows:old};
 const item=safe({recordedAt:new Date(now).toISOString(),candleAt:last.time,close:last.close,
  source:'browser_public_candle_capture',realOrder:false,verifiedProfit:null});
 if(!item)return {ok:false,reason:'INVALID_RECORD'};
 const next=[...old,item].slice(-MAX_OBSERVATIONS);
 try{
  if(!storage?.setItem)return {ok:false,reason:'STORAGE_UNAVAILABLE'};
  storage.setItem(key,JSON.stringify({version:1,rows:next}));
  return {ok:true,rows:next,record:item};
 }catch{return {ok:false,reason:'STORAGE_UNAVAILABLE'};}
}
export function prospectiveCoverage(rows){
 const seq=Array.isArray(rows)?rows.map(safe):[];
 if(!seq.every(Boolean))return {count:0,hours:0,usable:false,verifiedPerformance:false};
 const count=seq.length;
 const hours=count>1?(Date.parse(seq.at(-1).recordedAt)-Date.parse(seq[0].recordedAt))/3600000:0;
 return {count,hours:Number(hours.toFixed(2)),usable:count>=12&&hours>=1,
  verifiedPerformance:false,source:'browser_local_observations_only'};
}
