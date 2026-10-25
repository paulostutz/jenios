/** Isolated verification only: no database connection, customer identity or real ledger. */
import {randomUUID} from 'node:crypto';
import {handlePro} from '../lib/assistant/pro-service.mjs';
import {invokeProProvider} from '../lib/assistant/pro-provider.mjs';

export function imageVerificationHarness({provider=invokeProProvider,env={},now=Date.now(),eligible=true}={}){
 const userId=randomUUID(),rows=new Map();
 const stats={providerCalls:0,reservations:0,settlements:0,chargedNanoUsd:0,providerNanoUsd:0};
 const config={installed:true,generationEnabled:true,requiresReconciliation:false,allowedModels:['gpt-6.1-sol','gpt-6-luna'],maxRequestProviderNanoUsd:200_000_000,allowances:{'platform-global-crypto':4_000_000_000}};
 const plan={code:'platform-global-crypto',periodStart:new Date(now-60_000).toISOString(),periodEnd:new Date(now+86400_000).toISOString()};
 const repo={
  config:async()=>config,
  status:async()=>({ok:true,pendingRequests:0,wallet:{status:'verified',totalNanoUsd:0,reservedNanoUsd:0,availableNanoUsd:0},allowance:{status:'configured',totalNanoUsd:4_000_000_000,spentNanoUsd:0,reservedNanoUsd:0,availableNanoUsd:4_000_000_000,periodEnd:plan.periodEnd}}),
  request:async key=>rows.get(key)||null,
  reserve:async(input,quote,key)=>{stats.reservations++;rows.set(key,{id:key,user_id:userId,request_key:key,fingerprint:input.fingerprint,task:input.task,source:input.source,state:'reserved',created_at:new Date(now).toISOString()});return {ok:true,state:'reserved',requestId:key};},
  dispatch:async(input,key)=>{const row=rows.get(key);if(row.state!=='reserved')return {ok:true,acquired:false,state:row.state};row.state='dispatched';return {ok:true,acquired:true,state:row.state};},
  settle:async(input,key,result)=>{const row=rows.get(key);row.state='settled';row.result_data=result.result;row.charged_nano_usd=result.cost.retailDebitNanoUsd;row.provider_nano_usd=result.cost.providerCostNanoUsd;stats.settlements++;stats.chargedNanoUsd+=row.charged_nano_usd;stats.providerNanoUsd+=row.provider_nano_usd;return {ok:true};},
  reconcile:async(input,key,action)=>{rows.get(key).state=action==='confirmed_no_charge'?'released':'needs_reconciliation';return {ok:true};},
  release:async(input,key)=>{rows.get(key).state='released';return {ok:true};}
 };
 // Only the API credential is reused by the caller. Never pass production DB or signing credentials.
 const isolatedEnv={OPENAI_API_KEY:env.OPENAI_API_KEY,JENIOS_PRO_GENERATION_ENABLED:'true',JENIOS_PRO_QUOTE_SECRET:randomUUID()+randomUUID()};
 const options={db:{},now,env:isolatedEnv,planOnly:true,authorize:async()=>({id:userId}),repository:()=>repo,planResolver:async()=>eligible?plan:null,passResolver:async()=>null,lessonLoader:async()=>null,
  provider:async(...args)=>{stats.providerCalls++;return provider(...args);}};
 return {stats,rows,async call(action,body){
  const response=await handlePro(new Request('https://verification.invalid/api/assistant/pro/'+action,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}),{...options,action});
  return {status:response.status,body:await response.json()};
 }};
}
