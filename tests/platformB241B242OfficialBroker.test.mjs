import test from 'node:test';import assert from 'node:assert/strict';import {createHmac} from 'node:crypto';
import {evaluateOwnBrokerStage} from '../lib/platform/release250/b241-broker-status.mjs';
import {providerPaths} from '../lib/platform/connections/provider-paths.mjs';
import {readDemoBroker} from '../lib/platform/connections/demo-broker-reader.mjs';
const user='4d238a7a-8c7b-4d8e-9a10-1c5c82db59a7',connection='50b85e9d-339c-4d32-b2bf-82c467673832',now=1792540000000;
const account={id:connection,user_id:user,provider:'alpaca',environment:'paper',status:'active',
 external_digest:'a'.repeat(64),last_sync_at:new Date(now).toISOString()};
test('B241 12 official guides remain distinct from 2 demo GET readers',()=>{
 assert.equal(providerPaths().length,12);
 for(const spec of providerPaths()){
  const state=evaluateOwnBrokerStage({provider:spec.provider});assert.equal(state.connectionStage,'GUIDE_OR_REVIEW');
  assert.equal(state.externalPaperOrderPilotAuthorized,false);assert.equal(state.realOrderSubmissionEnabled,false);
 }
});
test('B241 server-owned Alpaca Paper binding is read-only and other owner is denied',()=>{
 const r=evaluateOwnBrokerStage({verifiedUserId:user,storedConnection:account,provider:'alpaca'});
 assert.equal(r.serverOwnedDemoBindingValidated,true);assert.equal(r.realOrderSubmissionEnabled,false);
 assert.equal(evaluateOwnBrokerStage({verifiedUserId:connection,storedConnection:account,provider:'alpaca'}).serverOwnedDemoBindingValidated,false);
 assert.equal(evaluateOwnBrokerStage({verifiedUserId:user,storedConnection:{...account,environment:'live'},provider:'alpaca'}).serverOwnedDemoBindingValidated,false);
});
test('B242 Binance Spot Testnet signed account GET is offline and cannot become futures execution',async()=>{
 const creds={apiKey:'fixture_api_01234567890123',secret:'fixture_secret_01234567890123'};let calls=0;
 const fetcher=async(url,options)=>{
  calls++;const u=new URL(url);assert.equal(u.hostname,'testnet.binance.vision');assert.equal(options.method,'GET');
  if(u.pathname==='/api/v3/time')return Response.json({serverTime:now});
  const signature=u.searchParams.get('signature');u.searchParams.delete('signature');
  assert.equal(signature,createHmac('sha256',creds.secret).update(u.searchParams.toString()).digest('hex'));
  if(u.pathname==='/api/v3/account')return Response.json({accountType:'SPOT',uid:123,balances:[]});
  return Response.json([]);
 };
 const r=await readDemoBroker({provider:'binance',environment:'testnet',...creds},{fetcher,now:()=>now});
 assert.equal(calls,3);assert.equal(r.publicSummary.orderExecutionEnabled,false);
 assert.equal(r.publicSummary.permissionsVerified,false);
});
test('B242 Alpaca Paper client account GET is offline, method GET only, no broker POST',async()=>{
 const creds={apiKey:'fixture_api_01234567890123',secret:'fixture_secret_01234567890123'};let calls=0;
 const fetcher=async(url,options)=>{calls++;const path=new URL(url).pathname;assert.equal(options.method,'GET');
  assert.equal(new URL(url).hostname,'paper-api.alpaca.markets');
  return Response.json(path==='/v2/account'?{id:'account-test-123',status:'ACTIVE',cash:'100',equity:'100',trading_blocked:false}:[]);
 };
 const r=await readDemoBroker({provider:'alpaca',environment:'paper',...creds},{fetcher,now:()=>now});
 assert.equal(calls,3);assert.equal(r.identityVerified,true);assert.equal(r.publicSummary.permissionsVerified,false);
});
