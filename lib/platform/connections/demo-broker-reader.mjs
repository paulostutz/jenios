/** B166 — Binance Spot Testnet and Alpaca Paper: *only* allowlisted signed/account GETs.
 * No live destinations, mutable methods, orders placement, cancellation or transfers.
 */
import {createHmac} from 'node:crypto';
import {performance} from 'node:perf_hooks';
const fail=code=>{throw Object.assign(new Error(code),{code});};
const DEC=/^(?:0|[1-9]\d{0,20})(?:\.\d{1,18})?$/;
const ID=/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,95}$/;
const symbol=x=>typeof x==='string'&&ID.test(x)?x:fail('INVALID_SYMBOL');
const decimal=x=>typeof x==='string'&&DEC.test(x)?x:fail('INVALID_DECIMAL');
const id=x=>typeof x==='string'&&ID.test(x)?x:fail('INVALID_ORDER_REFERENCE');
const parseDecimal=x=>{const [a,b='']=decimal(x).split('.');return BigInt(a+b.padEnd(18,'0'));};
const addDecimal=(x,y)=>{const sum=(parseDecimal(x)+parseDecimal(y)).toString().padStart(19,'0');return sum.slice(0,-18)+'.'+sum.slice(-18).replace(/0+$/,'').padEnd(1,'0');};
function credentials(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).sort().join(',')!=='apiKey,environment,provider,secret')fail('INVALID_CREDENTIAL_FIELDS');
 if(input.provider!=='binance'&&input.provider!=='alpaca')fail('UNSUPPORTED_PROVIDER');
 if(input.environment!==(input.provider==='binance'?'testnet':'paper'))fail('LIVE_DISABLED');
 for(const k of ['apiKey','secret'])if(typeof input[k]!=='string'||!/^[A-Za-z0-9_+/=-]{16,256}$/.test(input[k]))fail('INVALID_CREDENTIAL_FORMAT');
 return input;
}
async function jsonGet(fetcher,url,headers={}){
 // URL is created only by this module; no caller-supplied host, path, proxy or redirect.
 const host=new URL(url).hostname;
 if(!['testnet.binance.vision','paper-api.alpaca.markets'].includes(host))fail('UPSTREAM_NOT_ALLOWED');
 let response;
 try{response=await fetcher(url,{method:'GET',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(10000),headers:{accept:'application/json',...headers}});}catch{fail('PROVIDER_NETWORK_UNAVAILABLE');}
 if(response.redirected||!response.ok){await response.body?.cancel?.();fail([401,403,429,451].includes(response.status)?'PROVIDER_'+response.status:'PROVIDER_UNAVAILABLE');}
 const reader=response.body?.getReader?.();if(!reader)fail('INVALID_PROVIDER_RESPONSE');
 const bytes=[];let size=0;
 try{while(true){let p;try{p=await reader.read();}catch{fail('PROVIDER_NETWORK_UNAVAILABLE');}if(p.done)break;size+=p.value.length;if(size>262144){await reader.cancel();fail('PROVIDER_RESPONSE_TOO_LARGE');}bytes.push(p.value);}}finally{reader.releaseLock();}
 try{return JSON.parse(Buffer.concat(bytes).toString('utf8'));}catch{fail('INVALID_PROVIDER_RESPONSE');}
}
const boundedArray=(items,maximum)=>Array.isArray(items)&&items.length<=maximum?items:fail('INCOMPLETE_PROVIDER_LIST');
function projectAlpacaPosition(pos){
 if(!pos||typeof pos!=='object')fail('INVALID_POSITION_RESPONSE');
 const asset=symbol(pos.symbol),side=pos.side;
 if(!['long','short'].includes(side))fail('INVALID_POSITION_RESPONSE');
 return {key:'position-'+id(pos.asset_id||asset),symbol:asset,side,quantity:decimal(String(pos.qty))};
}
function projectAlpacaOrder(order){
 if(!order||typeof order!=='object'||!['buy','sell'].includes(order.side))fail('INVALID_ORDER_RESPONSE');
 return {key:'order-'+id(order.id),symbol:symbol(order.symbol),side:order.side,status:id(order.status),quantity:decimal(String(order.qty)),filledQuantity:decimal(String(order.filled_qty))};
}
function projectBinanceOrder(order){
 if(!order||typeof order!=='object'||!['BUY','SELL'].includes(order.side)||!Number.isSafeInteger(order.orderId)||order.orderId<0)fail('INVALID_ORDER_RESPONSE');
 return {key:'order-'+String(order.orderId),symbol:symbol(order.symbol),side:order.side.toLowerCase(),status:id(order.status),quantity:decimal(order.origQty),filledQuantity:decimal(order.executedQty)};
}
export async function readDemoBroker(raw,{fetcher=fetch,now=Date.now,monotonicNow=()=>performance.now()}={}){
 const input=credentials(raw);const timestamp=now();
 if(!Number.isSafeInteger(timestamp))fail('INVALID_CLOCK');
 let accountRef,identityVerified=false,positions,openOrders,accountStatus;
 if(input.provider==='binance'){
  const root='https://testnet.binance.vision';
  const syncStart=monotonicNow();
  const clock=await jsonGet(fetcher,root+'/api/v3/time');
  const syncEnd=monotonicNow();
  if(!Number.isSafeInteger(clock?.serverTime)||Math.abs(clock.serverTime-timestamp)>30000)fail('CLOCK_NOT_VERIFIED');
  // Keep a conservative server-time anchor. The monotonic elapsed time must
  // advance even when a caller pins `now` for snapshot identity/authorization.
  // A slow clock sample or an old anchor is rejected, never widened to 60s.
  if(!Number.isFinite(syncStart)||!Number.isFinite(syncEnd)||
     syncEnd<syncStart||syncEnd-syncStart>2000)fail('CLOCK_NOT_VERIFIED');
  let previousElapsed=0;
  const getSigned=path=>{
   const elapsed=monotonicNow()-syncEnd;
   if(!Number.isFinite(elapsed)||elapsed<previousElapsed||elapsed>30000)
    fail('CLOCK_NOT_VERIFIED');
   previousElapsed=elapsed;
   const signedAt=clock.serverTime+Math.floor(elapsed);
   if(!Number.isSafeInteger(signedAt))fail('CLOCK_NOT_VERIFIED');
   const params=new URLSearchParams({recvWindow:'5000',timestamp:String(signedAt)});
   const query=params.toString(),signature=createHmac('sha256',input.secret).update(query).digest('hex');
   return jsonGet(fetcher,root+path+'?'+query+'&signature='+signature,{'X-MBX-APIKEY':input.apiKey});
  };
  const account=await getSigned('/api/v3/account');
  if(account?.accountType!=='SPOT')fail('INVALID_ACCOUNT_RESPONSE');
  const balances=boundedArray(account.balances,1000);
  positions=balances.map(b=>{
   if(!b||typeof b!=='object')fail('INVALID_POSITION_RESPONSE');
   const s=symbol(b.asset),amount=addDecimal(b.free,b.locked);
   return {key:'spot-'+s,symbol:s,side:'spot',quantity:amount};
  }).filter(p=>parseDecimal(p.quantity)>0n);
  // Binance account uid is an account reference; if unavailable, bind to this restricted key only.
  if(Number.isSafeInteger(account.uid)&&account.uid>0){accountRef='account-'+account.uid;identityVerified=true;}
  else {accountRef='credential-'+input.apiKey;identityVerified=false;}
  const orders=await getSigned('/api/v3/openOrders');
  openOrders=boundedArray(orders,500).map(projectBinanceOrder);
  accountStatus='SPOT_TESTNET';
 }else{
  const root='https://paper-api.alpaca.markets';const headers={'APCA-API-KEY-ID':input.apiKey,'APCA-API-SECRET-KEY':input.secret};
  const account=await jsonGet(fetcher,root+'/v2/account',headers);
  if(typeof account?.id!=='string'||!ID.test(account.id)||typeof account.status!=='string'||!ID.test(account.status)||typeof account.trading_blocked!=='boolean')fail('INVALID_ACCOUNT_RESPONSE');
  decimal(account.cash);decimal(account.equity);
  accountRef='account-'+account.id;identityVerified=true;accountStatus=account.status;
  const positionsRaw=await jsonGet(fetcher,root+'/v2/positions',headers);
  positions=boundedArray(positionsRaw,1000).map(projectAlpacaPosition);
  const ordersRaw=await jsonGet(fetcher,root+'/v2/orders?status=open&limit=500',headers);
  openOrders=boundedArray(ordersRaw,500).map(projectAlpacaOrder);
  // Exactly 500 open orders might be a truncated page. Never mark the snapshot complete.
  if(openOrders.length===500)fail('PAGINATION_REQUIRED');
 }
 if(positions.length>5000||openOrders.length>500)fail('INCOMPLETE_PROVIDER_LIST');
 const snap={provider:input.provider,environment:input.environment,observedAtMs:timestamp,complete:true,accountReadConfirmed:true,positions,openOrders};
 // Internal-only: external identity, raw positions and order IDs must be encrypted before persistence.
 return {accountRef,identityVerified,snapshot:snap,
  observation:{ok:true,provider:input.provider,environment:input.environment,accountReadConfirmed:true,summary:{status:accountStatus,permissionsVerified:false},linkedToJenios:false,liveExecution:false,ordersSent:0,credentialsStored:false,observedAtMs:timestamp},
  publicSummary:{provider:input.provider,environment:input.environment,observedAtMs:timestamp,accountReadConfirmed:true,positionsReadConfirmed:true,openOrdersReadConfirmed:true,spotBalancesNotDerivativePositions:input.provider==='binance',positionCount:positions.length,openOrderCount:openOrders.length,identityVerified,permissionsVerified:false,brokerApiReadOnlyPermissionVerified:false,connectedForReadOnlyDemo:true,orderExecutionEnabled:false,realExecutionEnabled:false,ordersSent:0,custody:false}};
}
