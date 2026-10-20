import test from 'node:test';
import assert from 'node:assert/strict';
import {CORE_SHA} from '../lib/platform/pilot-prep/contracts.mjs';
import {digestDemoAccount} from '../lib/platform/connections/demo-vault.mjs';
import {nativeBrokerIntegrationPlan,nativeCustomerBinding,strategyToNativePaperProposal,submitNativeBrokerOrder,submitRealBrokerOrder} from '../lib/platform/connections/native-broker-bridge.mjs';
import {lookupOwnAlpacaPaperOrder} from '../lib/platform/connections/alpaca-native-paper-order-lookup.mjs';
const owner='4d238a7a-8c7b-4d8e-9a10-1c5c82db59a7',other='b8e32748-9c47-4eb1-9c5f-1a7cc0d2e496';
const env={VERCEL_ENV:'preview',JENIOS_DEMO_CONNECTORS_ENABLED:'true',JENIOS_DEMO_VAULT_KEY_B64:Buffer.alloc(32,8).toString('base64')};
const connection={id:'50b85e9d-339c-4d32-b2bf-82c467673832',user_id:owner,provider:'alpaca',environment:'paper',status:'active',external_digest:digestDemoAccount('account-paper-17',{userId:owner,provider:'alpaca',environment:'paper'},env),last_sync_at:'2026-10-20T18:00:00Z'};
const credentials={apiKey:'fixture_api_key_1234567890',secret:'fixture_secret_1234567890'};
const query={verifiedUserId:owner,storedConnection:connection,credentials,clientOrderId:'jenios-1',symbol:'AAPL'};
const reader=async()=>({identityVerified:true,accountRef:'account-paper-17',snapshot:{accountReadConfirmed:true}});
const order={id:'provider-paper-id',client_order_id:'jenios-1',symbol:'AAPL',qty:'2',filled_qty:'0.5',status:'partially_filled'};
const now=()=>1792521600000;
test('B174 twelve paths go to the provider native API, not substitute broker APIs',()=>{
 const ids=['binance','profit','genial','clear','xp','btg','mt5','ctrader','ibkr','alpaca','mercado-bitcoin','kraken'];
 for(const id of ids){const plan=nativeBrokerIntegrationPlan(id);assert.equal(plan.viaOfficialBroker,true);assert.equal(plan.custody,false);assert.equal(plan.orderSenderEnabled,false);assert.ok(plan.steps.includes('submitViaNativeBroker'));}
 assert.equal(nativeBrokerIntegrationPlan('ctrader').authorization,'oauth2_accounts_then_trading_scope');
 assert.throws(()=>nativeBrokerIntegrationPlan('unsupported'),/BROKER_NOT_LISTED/);
});
test('B174 server verified user owns only their own active external connection',()=>{
 const b=nativeCustomerBinding(owner,connection);assert.equal(b.ownerUserId,owner);assert.equal(b.readOnly,true);
 assert.throws(()=>nativeCustomerBinding(other,connection),/BROKER_OWNER_MISMATCH/);
 assert.throws(()=>nativeCustomerBinding(owner,{...connection,environment:'live'}),/BROKER_NATIVE_ADAPTER_NOT_HOMOLOGATED/);
 assert.throws(()=>nativeCustomerBinding(owner,{...connection,status:'revoked'}),/BROKER_CONNECTION_INACTIVE/);
});
test('B174 all three original robot modes prepare native PAPER proposal, never submit',()=>{
 const binding=nativeCustomerBinding(owner,connection);
 for(const mode of ['direct','reverse','hybrid']){
  const p=strategyToNativePaperProposal({binding,userId:owner,mode,
   signal:{originalCoreSha256:CORE_SHA.engine,executionEnabled:false,mode,side:'buy',contextDigest:'a'.repeat(64),reviewStatus:'allow'},
   order:{clientOrderId:'jenios-1',symbol:'AAPL',side:'buy',quantity:'2',entry:'100',stop:'98',target:'104'},
   source:{provider:'alpaca',environment:'paper',accountAuthenticated:true,ownershipVerified:true,permissionsVerified:true,marketDataVerified:true,prospective:true,liveAccount:false}});
  assert.equal(p.body.order_class,'bracket');assert.equal(p.body.client_order_id,'jenios-1');
  assert.equal(p.canSubmit,false);assert.equal(p.brokerRequestSent,false);
 }
 assert.throws(()=>submitNativeBrokerOrder(),/NATIVE_ORDER_TRANSPORT_NOT_CERTIFIED/);
 assert.throws(()=>submitRealBrokerOrder(),/LIVE_EXECUTION_NOT_AUTHORIZED/);
});
test('B174 retrieves order by client key through the official Alpaca PAPER GET',async()=>{
 const urls=[];
 const result=await lookupOwnAlpacaPaperOrder(query,{env,now,reader,fetcher:async(url,options)=>{
  urls.push(url);assert.equal(options.method,'GET');assert.equal(options.redirect,'error');
  return Response.json(order);
 }});
 assert.equal(urls.length,1);assert.equal(new URL(urls[0]).origin,'https://paper-api.alpaca.markets');
 assert.equal(new URL(urls[0]).searchParams.get('client_order_id'),'jenios-1');
 assert.equal(result.state,'PARTIAL');assert.equal(result.automaticResubmissionAllowed,false);
 assert.ok(!JSON.stringify(result).includes(credentials.secret));
});
test('B174 404 broker lookup is UNKNOWN, not a fresh-order authorization',async()=>{
 const r=await lookupOwnAlpacaPaperOrder(query,{env,now,reader,fetcher:async()=>new Response('',{status:404})});
 assert.deepEqual(r,{found:false,state:'UNKNOWN',manualReview:true,automaticResubmissionAllowed:false,ordersSent:0,liveExecution:false});
});
test('B174 production, wrong tenant and changed broker account fail before order lookup',async()=>{
 let calls=0;const fetcher=async()=>{calls++;return Response.json(order);};
 await assert.rejects(lookupOwnAlpacaPaperOrder(query,{env:{...env,VERCEL_ENV:'production'},reader,fetcher,now}),/PAPER_RECONCILIATION_DISABLED/);
 await assert.rejects(lookupOwnAlpacaPaperOrder({...query,verifiedUserId:other},{env,reader,fetcher,now}),/BROKER_OWNER_MISMATCH/);
 await assert.rejects(lookupOwnAlpacaPaperOrder(query,{env,reader:async()=>({identityVerified:true,accountRef:'wrong-account',snapshot:{accountReadConfirmed:true}}),fetcher,now}),/BROKER_ACCOUNT_CHANGED/);
 assert.equal(calls,0);
});
test('B174 mismatched instrument or timeout never counts as filled',async()=>{
 await assert.rejects(lookupOwnAlpacaPaperOrder(query,{env,now,reader,fetcher:async()=>Response.json({...order,symbol:'MSFT'})}),/BROKER_ORDER_MISMATCH/);
 let calls=0;await assert.rejects(lookupOwnAlpacaPaperOrder(query,{env,now,reader,fetcher:async()=>{calls++;throw Error('secret');}}),/BROKER_NETWORK_UNKNOWN/);assert.equal(calls,1);
});
