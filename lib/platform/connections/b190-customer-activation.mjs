/** B190: display-only customer-owned broker onboarding assessment.
 * Never consumes credentials, never upgrades a browser status to trading authorization.
 * Account validation evidence is a separate server/provider responsibility.
 */
import {providerPaths} from './provider-paths.mjs';

const reject=code=>{throw Object.assign(new Error(code),{code});};
const GUIDE=Object.freeze({
 code:'GUIDE_ONLY',stage:'guidance',message:'Guia disponível; conector autenticado ainda não homologado.',
 actions:Object.freeze(['CONSULT_OFFICIAL_PROVIDER_REQUIREMENTS','WAIT_FOR_PROVIDER_INTEGRATION'])
});
const NEXT=Object.freeze([
 'VERIFY_BROKER_PERMISSIONS_INDEPENDENTLY',
 'CERTIFY_ISOLATED_PRIVATE_WORKER',
 'AUTHORIZE_AND_AUDIT_EXTERNAL_PAPER_PILOT',
 'VERIFY_PROTECTIVE_LEGS_AND_RECONCILIATION',
 'OBTAIN_INDEPENDENT_PROSPECTIVE_EVIDENCE'
]);
function safeDate(value){
 if(typeof value!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d/.test(value))return NaN;
 return Date.parse(value);
}
export function customerBrokerActivation({provider,connection=null,nowMs=Date.now()}={}){
 if(!Number.isSafeInteger(nowMs)||nowMs<=0)reject('INVALID_ACTIVATION_CLOCK');
 const spec=providerPaths().find(p=>p.provider===provider);
 if(!spec)reject('UNLISTED_BROKER');
 const demo=spec.provider==='binance'||spec.provider==='alpaca';
 if(!demo)return Object.freeze({provider,schema:'JENIOS_B190_CUSTOMER_ACTIVATION',...GUIDE,
  authenticatedAccount:false,externalAccountReferenceConfirmed:false,civilAccountOwnershipVerified:false,permissionsVerified:false,
  paperOrdersCertified:false,liveOrdersAllowed:false,realExecutionAuthorized:false,
  custody:false,withdrawals:false});
 const expectedEnvironment=provider==='binance'?'testnet':'paper';
 const validScope=connection&&typeof connection==='object'&&!Array.isArray(connection)&&
  connection.provider===provider&&connection.environment===expectedEnvironment&&
  connection.status==='active'&&connection.connectedForReadOnlyDemo===true;
 const freshness=safeDate(connection?.lastSyncedAt);
 const recent=validScope&&Number.isFinite(freshness)&&freshness<=nowMs&&nowMs-freshness<=300000;
 const identity=recent&&connection.identityVerified===true;
 const actions=[];
 if(!validScope)actions.push('CONNECT_OWN_TEST_ACCOUNT_FOR_READ_ONLY');
 else if(!recent)actions.push('REFRESH_AUTHENTICATED_READ_IN_PRIVATE_QA');
 else if(!identity)actions.push('VERIFY_EXTERNAL_ACCOUNT_IDENTITY');
 actions.push(...NEXT);
 const code=!validScope?'NO_ACCOUNT_LINKED':!recent?'READ_STALE_OR_UNCONFIRMED':
  !identity?'ACCOUNT_IDENTITY_UNCONFIRMED':'READ_ONLY_DEMO_LINKED';
 return Object.freeze({schema:'JENIOS_B190_CUSTOMER_ACTIVATION',provider,
  environment:expectedEnvironment,code,stage:identity?'authenticated_read_only':'needs_external_verification',
  message:identity?'Leitura demonstrativa vinculada. Isso não libera negociação.':
   'Sem validação suficiente para avançar além do guia ou da leitura demonstrativa.',
  authenticatedAccount:!!recent,externalAccountReferenceConfirmed:!!identity,
  civilAccountOwnershipVerified:false,
  // Broker key scopes, verified order protection and worker have NOT been checked by B165/B169.
  permissionsVerified:false,brokerApiReadOnlyPermissionVerified:false,
  privateWorkerCertified:false,independentPaperPilotCertified:false,
  stopAndTargetBrokerVerified:false,prospectivePerformanceCertified:false,
  paperOrdersCertified:false,liveOrdersAllowed:false,realExecutionAuthorized:false,
  ordersSubmittedByThisAssessment:0,custody:false,withdrawals:false,
  actions:Object.freeze(actions)
 });
}
export function brokerActivationCatalog(){
 return Object.freeze(providerPaths().map(p=>Object.freeze({provider:p.provider,kind:p.kind,
  customerOwnedAccount:true,officialBrokerApiOrTerminal:true,
  availableReadOnlyTestAdapter:p.provider==='alpaca'||p.provider==='binance',
  executableConnectorCertified:false,externalApprovalRequired:true,
  liveOrdersAllowed:false,custody:false})));
}
