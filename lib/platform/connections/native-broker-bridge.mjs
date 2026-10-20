/** Customer-owned broker-native bridge. This never replaces a broker API or sends an order. */
import {providerPaths} from './provider-paths.mjs';
import {paperOrderProposal} from './paper-order-proposal.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA=/^[a-f0-9]{64}$/;
const fail=code=>{throw Object.assign(new Error(code),{code});};
const providers=new Map(providerPaths().map(spec=>[spec.provider,spec]));
const lifecycle=Object.freeze(['verifyCustomerSession','authorizeAtBroker','verifyBrokerAccount','checkBrokerPermissions','readBrokerData','reserveStrategyRisk','submitViaNativeBroker','reconcileWithBroker','disconnect']);
export function nativeBrokerIntegrationPlan(provider){
 const spec=providers.get(provider);if(!spec)fail('BROKER_NOT_LISTED');
 return Object.freeze({provider,viaOfficialBroker:true,transport:spec.kind,authorization:spec.authentication,
  requiresLocalTerminal:spec.needsTerminal,separateCustomerAuthorization:true,steps:lifecycle,
  accountLinked:false,permissionVerified:false,orderSenderEnabled:false,custody:false,withdrawals:false,liveExecution:false});
}
/** Server-owned binding: never trust an owner or account number typed into the browser. */
export function nativeCustomerBinding(verifiedUserId,storedConnection){
 if(!UUID.test(verifiedUserId||''))fail('PLATFORM_SESSION_REQUIRED');
 const c=storedConnection;if(!c||typeof c!=='object'||Array.isArray(c))fail('BROKER_ACCOUNT_NOT_LINKED');
 if(c.user_id!==verifiedUserId||!UUID.test(c.id||''))fail('BROKER_OWNER_MISMATCH');
 if(c.status!=='active'||c.revoked===true||!SHA.test(c.external_digest||''))fail('BROKER_CONNECTION_INACTIVE');
 const spec=providers.get(c.provider);if(!spec)fail('BROKER_NOT_LISTED');
 if(!((c.provider==='alpaca'&&c.environment==='paper')||(c.provider==='binance'&&c.environment==='testnet')))fail('BROKER_NATIVE_ADAPTER_NOT_HOMOLOGATED');
 if(!c.last_sync_at||!Number.isFinite(Date.parse(c.last_sync_at)))fail('BROKER_READ_NOT_CONFIRMED');
 return Object.freeze({ownerUserId:verifiedUserId,connectionId:c.id,provider:c.provider,environment:c.environment,
  accountDigest:c.external_digest,nativeTransport:spec.kind,readOnly:true,readConfirmed:true,
  tradingScopeAudited:false,orderSubmissionEnabled:false,liveExecution:false});
}
/** Only a proposed native Alpaca Paper payload. The private risk ledger still must approve. */
export function strategyToNativePaperProposal({binding,userId,mode,signal,order,source}){
 if(!binding||binding.ownerUserId!==userId||!UUID.test(userId||''))fail('BROKER_OWNER_MISMATCH');
 if(binding.provider!=='alpaca'||binding.environment!=='paper'||binding.orderSubmissionEnabled!==false||binding.readOnly!==true)fail('PAPER_ORDER_BRIDGE_UNAVAILABLE');
 const proposal=paperOrderProposal({provider:'alpaca',environment:'paper',userId,mode,signal,order,source});
 return Object.freeze({provider:'alpaca',externalApi:'Alpaca Trading API',nativeEndpoint:'POST /v2/orders',
  clientOwnedAccount:true,proposalDigest:proposal.proposalDigest,body:proposal.body,
  brokerRequestSent:false,requiresDurableRiskReservation:true,requiresNativeBrokerReceipt:true,
  requiresExplicitPaperExecutionGate:true,liveExecution:false,canSubmit:false});
}
export function submitNativeBrokerOrder(){fail('NATIVE_ORDER_TRANSPORT_NOT_CERTIFIED');}
export function submitRealBrokerOrder(){fail('LIVE_EXECUTION_NOT_AUTHORIZED');}
