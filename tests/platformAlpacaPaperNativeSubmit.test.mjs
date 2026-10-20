import test from 'node:test';import assert from 'node:assert/strict';
import {postNativeAlpacaPaperOnce,checkNativePaperBracket} from '../lib/platform/connections/alpaca-paper-native-submit.mjs';
const env={JENIOS_PRIVATE_PAPER_EXECUTOR:'true',JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED:'true',JENIOS_PRIVATE_PAPER_REHEARSAL:'true',JENIOS_PAPER_WORKER_SIGNING_KEY_B64:Buffer.alloc(32,4).toString('base64')};
const body={symbol:'AAPL',qty:'1',side:'buy',type:'limit',time_in_force:'day',limit_price:'100',order_class:'bracket',take_profit:{limit_price:'104'},stop_loss:{stop_price:'98'},client_order_id:'paper-client-178'};
const credentials={apiKey:'alpaca_test_key_12345678',secret:'alpaca_test_secret_12345678'};
const nowMs=1792526000010;
const receipt={id:'alpaca-remote-fixture-1',symbol:'AAPL',qty:'1',filled_qty:'0',client_order_id:body.client_order_id,status:'new'};
const args={body,credentials,expectedClientOrderId:body.client_order_id,nowMs};
test('B180 official PAPER request uses only expected POST endpoint with native bracket',async()=>{
 let sent=0;const fetcher=async(url,request)=>{
  sent++;assert.equal(url,'https://paper-api.alpaca.markets/v2/orders');assert.equal(request.method,'POST');
  assert.equal(request.redirect,'error');assert.equal(request.headers['APCA-API-KEY-ID'],credentials.apiKey);
  assert.deepEqual(JSON.parse(request.body),body);return Response.json(receipt,{status:200});
 };
 const result=await postNativeAlpacaPaperOnce(args,{env,fetcher});assert.equal(sent,1);assert.equal(result.kind,'broker_receipt');assert.equal(result.brokerEvent.kind,'ACK');assert.equal(result.realOrdersSent,0);
 assert.equal(JSON.stringify(result).includes(credentials.secret),false);
});
test('B180 rejects unprotected/mutated native body before any POST',async()=>{
 for(const input of [{...body,order_class:'simple'},{...body,stop_loss:null},{...body,extended_hours:true},{...body,stop_loss:{stop_price:'101'}},{...body,qty:'0.2'}])
  assert.throws(()=>checkNativePaperBracket(input),/PAPER_|INVALID_|UNPROTECTED_/);
 let sent=0;await assert.rejects(postNativeAlpacaPaperOnce({...args,expectedClientOrderId:'different-id'},{env,fetcher:async()=>{sent++;return Response.json(receipt);}}),/PAPER_CLIENT_ORDER_ID_MISMATCH/);
 assert.equal(sent,0);
});
test('B180 invalid credentials or Vercel runtime cannot trigger PAPER POST',async()=>{
 let sent=0;const fetcher=async()=>{sent++;return Response.json(receipt);};
 await assert.rejects(postNativeAlpacaPaperOnce({...args,credentials:{apiKey:'short',secret:'also-short'}},{env,fetcher}),/PAPER_KEY_REJECTED/);
 await assert.rejects(postNativeAlpacaPaperOnce(args,{env:{...env,VERCEL_ENV:'production'},fetcher}),/PRIVATE_PAPER_TRANSPORT_DISABLED/);
 assert.equal(sent,0);
});
test('B180 provider mismatch, HTTP error, large body, redirect and transport timeout are ambiguous; no internal retry',async()=>{
 const arr=[async()=>{throw Error('timeout')},async()=>Response.json({code:403},{status:403}),async()=>Response.redirect('https://www.example.com'),async()=>Response.json({...receipt,client_order_id:'foreign'}),async()=>Response.json({...receipt,qty:'2'})];
 let calls=0;for(const handler of arr){
  await assert.rejects(postNativeAlpacaPaperOnce(args,{env,fetcher:async()=>{calls++;return handler();}}),/PAPER_/);
 }assert.equal(calls,arr.length);
});
