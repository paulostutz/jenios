import test from 'node:test';
import assert from 'node:assert/strict';
import {encryptDemo,digestDemoAccount} from '../lib/platform/connections/demo-vault.mjs';
import {collectPrivatePaperOrderPair} from '../lib/platform/connections/b201-private-paired-paper-reader.mjs';
const now=1792526000000,user='4d238a7a-8c7b-4d8e-9a10-1c5c82db59a7';
const id='50b85e9d-339c-4d32-b2bf-82c467673832';
const session={userId:user,authenticated:true,diagnosticCompleted:true};
const env={JENIOS_DEMO_VAULT_KEY_B64:Buffer.alloc(32,7).toString('base64'),
 JENIOS_PRIVATE_PAPER_REHEARSAL:'true',JENIOS_PRIVATE_PAPER_ACCOUNT_PREFLIGHT:'true',
 JENIOS_PRIVATE_PAPER_READ_OBSERVER:'true'};
const apiKey='fixture_paper_key_0123456789',secret='fixture_paper_secret_0123456789';
const accountRef='account-12345678-1234-4234-8234-123456789012';
const credential_box=encryptDemo({apiKey,secret},
 {userId:user,id,provider:'alpaca',environment:'paper',kind:'credentials'},env);
const storedConnection={id,user_id:user,provider:'alpaca',environment:'paper',status:'active',
 identity_verified:true,last_sync_at:new Date(now-500).toISOString(),
 created_at:new Date(now-120000).toISOString(),
 external_digest:digestDemoAccount(accountRef,{userId:user,provider:'alpaca',environment:'paper'},env),
 credential_box};
const order={id:'broker-id-1',client_order_id:'j-paper-test-1',symbol:'AAPL',qty:'4',
 filled_qty:'4',status:'filled'};
const input={session,storedConnection,clientOrderId:'j-paper-test-1',symbol:'AAPL',
 expectedQuantity:'4',nowMs:now};
function kit({responses=[Response.json(order),Response.json(order)],refresh=null,readerResult=null,
 envOverride={},pauseDelay=true}={}){
 let t=now,reads=0,refreshes=0,urls=[];
 return {input,deps:{env:{...env,...envOverride},
  refreshConnection:async()=>{refreshes++;return refresh?refresh(refreshes):storedConnection;},
  reader:async value=>{
   assert.deepEqual(value,{provider:'alpaca',environment:'paper',apiKey,secret});
   return readerResult||{identityVerified:true,accountRef,
    observation:{summary:{permissionsVerified:false},liveExecution:false,ordersSent:0},
    snapshot:{provider:'alpaca',environment:'paper',complete:true,accountReadConfirmed:true,
     observedAtMs:now,positions:[],openOrders:[]}};
  },
  fetcher:async(url,options)=>{
   reads++;urls.push(url);
   assert.equal(options.method,'GET');assert.equal(options.redirect,'error');
   assert.equal(options.headers['APCA-API-KEY-ID'],apiKey);
   assert.equal(options.headers['APCA-API-SECRET-KEY'],secret);
   assert.ok(url.startsWith('https://paper-api.alpaca.markets/v2/orders:by_client_order_id?'));
   assert.equal(new URL(url).searchParams.get('client_order_id'),input.clientOrderId);
   return responses[Math.min(reads-1,responses.length-1)];
  },now:()=>t,delay:async milliseconds=>{if(pauseDelay)t+=milliseconds;}},
  get reads(){return reads;},get refreshes(){return refreshes;},get urls(){return urls;}};
}
const error=(call,code)=>assert.rejects(call(),e=>e?.code===code);
test('B201 two official Paper GETs only: stable FILLED remains untrusted for execution and redacted',async()=>{
 const k=kit();const value=await collectPrivatePaperOrderPair(k.input,k.deps);
 assert.equal(k.reads,2);assert.ok(k.refreshes>=3);
 assert.equal(value.assessment,'STABLE_TERMINAL_OBSERVATIONS');
 assert.equal(value.lastObservedKind,'FILLED');assert.equal(value.lastCumulativeQuantity,'4');
 assert.equal(value.ledgerChanged,false);assert.equal(value.ordersSent,0);
 assert.equal(value.independentlyAttested,false);assert.equal(value.liveExecutionAuthorized,false);
 for(const sensitive of [apiKey,secret,accountRef,order.id,order.client_order_id,id])
  assert.equal(JSON.stringify(value).includes(sensitive),false);
});
test('B201 a broker 404 never becomes a rejection or permission to re-send',async()=>{
 const k=kit({responses:[new Response(null,{status:404})]});
 const value=await collectPrivatePaperOrderPair(k.input,k.deps);
 assert.equal(value.assessment,'ORDER_NOT_FOUND_IS_UNKNOWN');assert.equal(k.reads,1);
 assert.equal(value.automaticResubmissionAllowed,false);assert.equal(value.manualBrokerReviewRequired,true);
});
test('B201 an evolving partial-to-full fill is not called stable terminal',async()=>{
 const k=kit({responses:[Response.json({...order,status:'partially_filled',filled_qty:'2'}),Response.json(order)]});
 const value=await collectPrivatePaperOrderPair(k.input,k.deps);
 assert.equal(value.assessment,'EVOLVING_OR_AMBIGUOUS');assert.equal(value.ordersSent,0);
});
test('B201 rejects public/preview runtime, revoked account and wrong owner before GET',async()=>{
 for(const envOverride of [{VERCEL:'1'},{VERCEL_ENV:'preview'},
  {JENIOS_PRIVATE_PAPER_READ_OBSERVER:'false'},
  {JENIOS_PRIVATE_PAPER_ACCOUNT_PREFLIGHT:'false'}]){
  const k=kit({envOverride});await error(()=>collectPrivatePaperOrderPair(k.input,k.deps),
   'ISOLATED_PAPER_READ_OBSERVER_DISABLED');assert.equal(k.reads,0);
 }
 const revoked=kit({refresh:()=>({...storedConnection,status:'revoked'})});
 await assert.rejects(collectPrivatePaperOrderPair(revoked.input,revoked.deps),
  /ACCOUNT_REVOKED_ROTATED_OR_CHANGED/);assert.equal(revoked.reads,0);
 const owner=kit();await assert.rejects(collectPrivatePaperOrderPair({...owner.input,
  session:{...session,userId:'other'}},owner.deps));assert.equal(owner.reads,0);
});
test('B201 revocation between paired official reads blocks the second GET',async()=>{
 const k=kit({refresh:n=>n>=3?{...storedConnection,credential_box:{...credential_box,data:'rotated'}}:storedConnection});
 await error(()=>collectPrivatePaperOrderPair(k.input,k.deps),'BROKER_CONNECTION_REVOKED_OR_ROTATED');
 assert.equal(k.reads,1);
});
test('B201 fails closed on invalid broker payload, wrong content-type and excessive body',async()=>{
 for(const [index,response] of [Response.json({...order,symbol:'TSLA'}),
  new Response('not json',{headers:{'content-type':'text/plain'}}),
  Response.json({...order,extra:'x'.repeat(72000)})].entries()){
  const k=kit({responses:[response,response]});
  await assert.rejects(collectPrivatePaperOrderPair(k.input,k.deps));
  assert.equal(k.reads,index===0?2:1);
 }
});
test('B201 enforces spacing between GETs; cannot label identical fixture timestamps independent',async()=>{
 const k=kit({pauseDelay:false});await error(()=>collectPrivatePaperOrderPair(k.input,k.deps),
  'PAPER_OBSERVATION_CLOCK_UNTRUSTED');assert.equal(k.reads,1);
});
