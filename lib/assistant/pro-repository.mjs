import {PRO_WALLET_TABLES,PRO_WALLET_RPC,proWalletConfig,ledgerInteger} from './pro-wallet-contract.mjs';
import {proError} from './pro-input.mjs';
const fields='id,user_id,request_key,fingerprint,task,source,state,charged_nano_usd,provider_nano_usd,created_at,result_data';
export function proRepository(db,userId){
 const rpc=async(name,args)=>{
  const {data,error}=await db.rpc(name,{p_user_id:userId,...args});
  if(error||!data||typeof data!=='object'||Array.isArray(data))throw proError('Não foi possível confirmar o registro do consumo.',503,'LEDGER_UNAVAILABLE');
  return data;
 };
 return {
  async config(){
   const {data,error}=await db.from(PRO_WALLET_TABLES.config).select('*').eq('id',true).maybeSingle();
   if(error){if(['42P01','PGRST205'].includes(error.code))return proWalletConfig(null);throw proError('O Pro está temporariamente indisponível.',503,'CONFIG_UNAVAILABLE');}
   const config=proWalletConfig(data);
   return config;
  },
  async status(){return projectProStatus(await rpc(PRO_WALLET_RPC.status,{}));},
  async request(requestKey){
   const {data,error}=await db.from(PRO_WALLET_TABLES.requests).select(fields).eq('user_id',userId).eq('request_key',requestKey).maybeSingle();
   if(error)throw proError('Não foi possível conferir a consulta.',503,'LEDGER_UNAVAILABLE');
   if(data&&data.user_id!==userId)throw proError('Registro de consumo inválido.',503,'LEDGER_UNAVAILABLE');
   return data;
  },
  async history(){
   const {data,error}=await db.from(PRO_WALLET_TABLES.requests).select(fields).eq('user_id',userId).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(51);
   if(error)throw proError('Não foi possível carregar o histórico de consumo.',503,'HISTORY_UNAVAILABLE');
   if((data||[]).some(r=>r.user_id!==userId))throw proError('Histórico indisponível.',503,'HISTORY_UNAVAILABLE');
   return {items:(data||[]).slice(0,50).map(projectProRequest),hasMore:(data||[]).length>50};
  },
  reserve(input,quote,key){return rpc(PRO_WALLET_RPC.reserve,{p_request_key:key,p_fingerprint:input.fingerprint,p_task:input.task,p_model:input.model,p_source:input.source,p_max_retail_nano_usd:quote.maxRetailNanoUsd,p_max_provider_nano_usd:quote.maxProviderNanoUsd,p_pricing_version:quote.version});},
  dispatch(input,key){return rpc(PRO_WALLET_RPC.dispatch,{p_request_key:key,p_fingerprint:input.fingerprint});},
  settle(input,key,response){return rpc(PRO_WALLET_RPC.settle,{p_request_key:key,p_fingerprint:input.fingerprint,p_provider_nano_usd:response.cost.providerCostNanoUsd,p_usage:response.usage,p_result:response.result,p_provider_response_id:response.providerResponseId});},
  release(input,key,reason){return rpc(PRO_WALLET_RPC.release,{p_request_key:key,p_fingerprint:input.fingerprint,p_reason:reason});},
  reconcile(input,key,action,evidence){return rpc(PRO_WALLET_RPC.reconcile,{p_request_key:key,p_fingerprint:input.fingerprint,p_action:action,p_provider_nano_usd:action==='confirmed_no_charge'?0:null,p_usage:null,p_result:null,p_provider_response_id:null,p_evidence:evidence});}
 };
}
export function projectProStatus(data){
 if(data?.ok!==true)return {ok:false};
 const w=data.wallet,a=data.allowance||data.included;
 if(!w||typeof w!=='object')throw proError('Não foi possível conferir o saldo.',503,'LEDGER_UNAVAILABLE');
 const wallet={status:'verified',totalNanoUsd:ledgerInteger(w.totalNanoUsd??w.balanceNanoUsd),reservedNanoUsd:ledgerInteger(w.reservedNanoUsd),availableNanoUsd:ledgerInteger(w.availableNanoUsd)};
 if(wallet.reservedNanoUsd>wallet.totalNanoUsd||wallet.availableNanoUsd!==wallet.totalNanoUsd-wallet.reservedNanoUsd)throw proError('Saldo em conferência.',503,'LEDGER_UNAVAILABLE');
 let allowance={status:'not_included',totalNanoUsd:null,spentNanoUsd:null,reservedNanoUsd:null,availableNanoUsd:null,periodEnd:null};
 if(a){
  const total=ledgerInteger(a.totalNanoUsd),spent=ledgerInteger(a.spentNanoUsd),reserved=ledgerInteger(a.reservedNanoUsd),available=ledgerInteger(a.availableNanoUsd);
  if(spent+reserved>total||available>total-spent-reserved||typeof a.periodEnd!=='string'||!Number.isFinite(Date.parse(a.periodEnd)))throw proError('Franquia em conferência.',503,'LEDGER_UNAVAILABLE');
  const transitionRequired=a.transitionRequired===true;
  if(transitionRequired&&(available!==0||a.transitionCode!=='INCLUDED_PERIOD_TRANSITION_REQUIRED'))throw proError('Mudança de franquia em conferência.',503,'LEDGER_UNAVAILABLE');
  allowance={status:transitionRequired?'pending_transition':total>0?'configured':'unconfigured',totalNanoUsd:total,spentNanoUsd:spent,reservedNanoUsd:reserved,availableNanoUsd:available,periodEnd:a.periodEnd,
   ...(transitionRequired?{transitionRequired:true,transitionCode:'INCLUDED_PERIOD_TRANSITION_REQUIRED'}:{})};
 }
 return {ok:true,wallet,allowance,pendingRequests:ledgerInteger(data.pendingRequests??data.pendingRequestCount??0)};
}
export function projectProRequest(row){
 if(!row)return null;
 const result=row.result_data&&typeof row.result_data==='object'?row.result_data:{};
 return {id:row.id,requestKey:row.request_key,createdAt:row.created_at,task:row.task,persona:['genio','genia'].includes(result.persona)?result.persona:null,source:row.source,state:row.state,chargedNanoUsd:ledgerInteger(row.charged_nano_usd),providerNanoUsd:ledgerInteger(row.provider_nano_usd),answer:typeof result.answer==='string'?result.answer.slice(0,16000):null,sourceInfo:result.source||null};
}
