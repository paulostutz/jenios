/** B241: turn actual server-owned demo binding into a customer-facing capability label. */
import {nativeCustomerBinding} from '../connections/native-broker-bridge.mjs';
import {providerPaths} from '../connections/provider-paths.mjs';
export function evaluateOwnBrokerStage({verifiedUserId,storedConnection,provider}){
 const spec=providerPaths().find(p=>p.provider===provider);
 if(!spec)throw Error('B241_UNKNOWN_OFFICIAL_GUIDE');
 let readOnlyBindingValid=false,reason='GUIDE_ONLY';
 if(storedConnection){
  try{
   const b=nativeCustomerBinding(verifiedUserId,storedConnection);
   readOnlyBindingValid=b.provider===provider&&b.readOnly===true&&b.liveExecution===false;
   reason=readOnlyBindingValid?'TEST_READ_BINDING_EXISTS':'PROVIDER_SCOPE_MISMATCH';
  }catch{reason='NOT_A_VALID_SERVER_OWNED_CONNECTION';}
 }
 return Object.freeze({schema:'JENIOS_B241_CUSTOMER_BROKER_STAGE',provider,
  providerGuideAvailable:spec.guideReady===true,
  connectionStage:readOnlyBindingValid?'READ_ONLY_PRIVATE_TEST':'GUIDE_OR_REVIEW',
  reason,serverOwnedDemoBindingValidated:readOnlyBindingValid,
  brokerPermissionsIndependentlyCertified:false,
  privateWorkerOperatorAuthorized:false,
  externalPaperOrderPilotAuthorized:false,
  realOrderSubmissionEnabled:false,custody:false,withdrawals:false});
}
