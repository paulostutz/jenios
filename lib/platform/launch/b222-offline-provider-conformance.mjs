/** B222 — actual B166 adapter with deterministic LOCAL HTTP stubs; no real requests. */
import {readDemoBroker} from '../connections/demo-broker-reader.mjs';
import {createHmac} from 'node:crypto';
const fail=code=>{throw Object.assign(new Error(code),{code});};
const creds=Object.freeze({apiKey:'fixture_conformance_key_012345',secret:'fixture_conformance_secret_012345'});
export async function runOfflineBrokerConformance(provider,{nowMs=1792530000000}={}){
 if(!['alpaca','binance'].includes(provider)||!Number.isSafeInteger(nowMs)||nowMs<=0)
  fail('B222_PROVIDER_OR_CLOCK_INVALID');
 const urls=[],responses=provider==='alpaca'?[
  {id:'demo_account_001',status:'ACTIVE',cash:'1000',equity:'1000',trading_blocked:false},
  [],[]
 ]:[{serverTime:nowMs},{accountType:'SPOT',uid:101,balances:[{asset:'BTC',free:'1',locked:'0'}]},[]];
 const expected=provider==='alpaca'?['/v2/account','/v2/positions','/v2/orders']:
  ['/api/v3/time','/api/v3/account','/api/v3/openOrders'];
 const fetcher=async(url,options)=>{
  let u;try{u=new URL(url);}catch{fail('B222_BAD_URL');}
  const host=provider==='alpaca'?'paper-api.alpaca.markets':'testnet.binance.vision';
  if(u.hostname!==host||u.protocol!=='https:'||options?.method!=='GET'||options.redirect!=='error'||
     options.cache!=='no-store'||u.pathname!==expected[urls.length])fail('B222_DISALLOWED_HTTP_CONTRACT');
  if(provider==='binance'&&urls.length>0){
   const signature=u.searchParams.get('signature');u.searchParams.delete('signature');
   if(signature!==createHmac('sha256',creds.secret).update(u.searchParams.toString()).digest('hex'))
    fail('B222_INVALID_BINANCE_SIGNATURE');
  }
  urls.push(u.pathname);return Response.json(responses[urls.length-1]);
 };
 const observed=await readDemoBroker({...creds,provider,environment:provider==='alpaca'?'paper':'testnet'},
  {now:()=>nowMs,fetcher});
 if(urls.length!==3||observed.snapshot.complete!==true||observed.publicSummary.permissionsVerified!==false||
  observed.publicSummary.orderExecutionEnabled!==false)fail('B222_READONLY_CONTRACT_DRIFT');
 return Object.freeze({schema:'JENIOS_B222_OFFLINE_CONFORMANCE',provider,
  simulatedGetCalls:urls.length,paths:Object.freeze(urls),realNetworkCalls:0,
  externalBrokerAuthenticated:false,brokerPermissionsAudited:false,
  orderSenderEnabled:false,liveExecutionAuthorized:false,custody:false});
}
