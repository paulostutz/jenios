/** B256: only trusted server-side demo rows may be summarized for release QA.
 * Does not authenticate a broker, read secrets, send orders or identify customers.
 */
import {nativeCustomerBinding} from '../connections/native-broker-bridge.mjs';
import {providerPaths} from '../connections/provider-paths.mjs';
const reject=c=>{throw Object.assign(new Error(c),{code:c});};
export function auditCustomerBrokerReadOnly({verifiedUserId,connection,nowMs}={}){
 if(!Number.isSafeInteger(nowMs)||nowMs<=0||typeof verifiedUserId!=='string')
   reject('INVALID_BROKER_AUDIT_SCOPE');
 let binding;
 try{binding=nativeCustomerBinding(verifiedUserId,connection);}catch{
   return Object.freeze({schema:'JENIOS_B256_BROKER_SCOPE_QA',classification:'INVALID_OR_UNLINKED',
     recentReadConfirmed:false,permittedToTrade:false,accountIdDisclosed:false,
     externalOrderCalls:0,customerFundsCustodied:false});
 }
 const spec=providerPaths().find(x=>x.provider===binding.provider);
 const at=Date.parse(connection.last_sync_at);
 const recent=Number.isFinite(at)&&at<=nowMs&&nowMs-at<=300000&&
   connection.identity_verified===true&&connection.status==='active';
 return Object.freeze({schema:'JENIOS_B256_BROKER_SCOPE_QA',provider:binding.provider,
   environment:binding.environment,classification:recent?'RECENT_DEMO_READ_CLAIM':'STALE_RECHECK_REQUIRED',
   officialGuideAvailable:!!spec?.guideReady,recentReadConfirmed:recent,
   brokerPermissionsIndependentlyAudited:false,actualAccountOwnerVerified:false,
   approvedReadOnlyTestAdapter:['alpaca','binance'].includes(binding.provider),
   providerRevocationCertified:false,permittedToTrade:false,
   accountIdDisclosed:false,externalOrderCalls:0,customerFundsCustodied:false});
}
