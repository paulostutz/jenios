/** R97: offline, no-cost operational gates for an independent private host.
 * Does not provision infrastructure, open a socket, authenticate a broker,
 * submit an order, or claim persistence after deployment.
 */
import {inspectR94PrivateHost} from './private-host-preflight-r94.mjs';
const deny=code=>{throw Object.assign(new Error(code),{code});};
const FIELDS=Object.freeze([
 'nodeHostIsolatedFromWeb',
 'privateNetworkRestricted',
 'durableVolumeAttached',
 'volumeBackupRestoreTested',
 'restartRecoveryTested',
 'secretStoreProtected',
 'perTenantAuthorizationReviewed',
 'brokerTestnetCredentialsOwnerProvided',
 'killSwitchRaceReviewed',
 'independentSecurityApproval',
 'approvedCostCeiling'
]);
export const R97_PRIVATE_HOST_REQUIREMENTS=FIELDS;
export function inspectR97PrivateHostDeploymentGates({
 env=process.env,volumePath,evidence={}
}={}){
 if(!evidence||typeof evidence!=='object'||Array.isArray(evidence))
   deny('R97_EVIDENCE_REQUIRED');
 const host=inspectR94PrivateHost({env,volumePath});
 const gates=Object.freeze(FIELDS.map(name=>Object.freeze({
  name,passed:evidence[name]===true
 })));
 const missing=Object.freeze(gates.filter(x=>!x.passed).map(x=>x.name));
 // A self-asserted boolean checklist is never independent verification.
 // This is a PLAN, not a deployment or authorization decision.
 return Object.freeze({schema:'JENIOS_R97_PRIVATE_HOST_GATES_V1',
  preflightValid:host.hostConfigurationValid,
  assertedChecksPassed:gates.length-missing.length,
  requiredChecks:gates.length,missing,
  evidenceIndependentlyVerified:false,
  deployAuthorized:false,hostDeployed:false,
  durableStorageCertified:false,brokerAuthenticated:false,
  ordersSent:0,liveExecution:false,paymentsEnabled:false,
  requiresHumanInfrastructureApproval:true});
}
