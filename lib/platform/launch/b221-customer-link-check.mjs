/** B221 — review one read-only customer broker link; never stores credentials. */
import {customerBrokerActivation} from '../connections/b190-customer-activation.mjs';
import {officialBrokerImplementationMatrix} from './b220-provider-implementation-matrix.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const deny=code=>{throw Object.assign(new Error(code),{code});};
export function assessCustomerBrokerLink({ownerId,verifiedSessionOwnerId,provider,connection=null,nowMs}={}){
 if(!UUID.test(ownerId||'')||ownerId!==verifiedSessionOwnerId||
  !Number.isSafeInteger(nowMs)||nowMs<=0)deny('B221_AUTHENTICATED_OWNER_REQUIRED');
 const chosen=officialBrokerImplementationMatrix().find(p=>p.provider===provider);
 if(!chosen)deny('B221_PROVIDER_UNKNOWN');
 // Connections must already have been fetched by server-role, never from a request body.
 if(connection!==null&&(connection.user_id!==ownerId||connection.provider!==provider||
  connection.revoked===true||connection.status!=='active'))deny('B221_OWNER_ACCOUNT_SCOPE_MISMATCH');
 const publicConnection=connection&&({provider,environment:connection.environment,status:'active',
  connectedForReadOnlyDemo:connection.serverRoleFetched===true,
  identityVerified:connection.identity_verified===true,
  lastSyncedAt:connection.last_sync_at});
 const activation=customerBrokerActivation({provider,connection:publicConnection,nowMs});
 return Object.freeze({schema:'JENIOS_B221_CUSTOMER_LINK_PREFLIGHT',provider,
  observedReadOnlyState:activation.code,
  authenticatedReadOnlyClaim:activation.code==='READ_ONLY_DEMO_LINKED',
  additionalRequirements:Object.freeze(activation.actions||[]),
  ownerVerifiedByThisOfflineContract:false,permissionScopeIndependentlyVerified:false,
  realTradingAllowed:false,paperExecutionCertified:false,ordersSent:0,
  credentialsExposed:false,custody:false});
}
