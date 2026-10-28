/** JENIOS R100 — offline/inert private worker host attestation.
 * Never polls a job queue, opens a listener, reads broker credentials, or sends orders.
 * Its only permitted deployment is a separately approved paid background worker.
 */
import {inspectR97PrivateHostDeploymentGates} from './private-host-deployment-gates-r97.mjs';
const deny=code=>{throw Object.assign(new Error(code),{code});};
const ON=Object.freeze([
 'JENIOS_R100_INERT_WORKER_ENABLED',
 'JENIOS_R100_NETWORK_DISABLED'
]);
const OFF=Object.freeze([
 'JENIOS_DEMO_CONNECTORS_ENABLED',
 'JENIOS_R93_PRIVATE_NODE_WORKER','JENIOS_R93_READONLY_RECOVERY_ENABLED',
 'JENIOS_R95_OFFLINE_STORAGE_PROBE_ENABLED',
 'JENIOS_R96_PRIVATE_NODE_WORKER','JENIOS_R96_BINANCE_PRIVATE_READ_ENABLED',
 'JENIOS_R98_OFFLINE_CRASH_PROBE_ONLY'
]);
/** Returns a bounded, nonsecret attestation. This is not a host approval. */
export function attestR100InertWorker({
 env=process.env,volumePath=env.JENIOS_R100_PRIVATE_VOLUME
}={}){
 if(env.JENIOS_R104_PRIVATE_OPERATOR_ENABLED==='true'||env.JENIOS_R103_PRIVATE_PAPER_CANCEL_ENABLED==='true'||
    env.VERCEL!==undefined||env.VERCEL_ENV!==undefined||
    env.JENIOS_R100_RUNTIME_CLASS!=='isolated-node'||
    env.JENIOS_R100_HOST_KIND!=='background-worker'||
    ON.some(key=>env[key]!=='true')||
    OFF.some(key=>env[key]!=='false'))
    deny('R100_INERT_PRIVATE_WORKER_ONLY');
 const readiness=inspectR97PrivateHostDeploymentGates({
  env,volumePath,evidence:{}
 });
 if(readiness.preflightValid!==true||readiness.deployAuthorized!==false||
    readiness.evidenceIndependentlyVerified!==false||
    readiness.requiredChecks!==11||readiness.missing.length!==11)
    deny('R100_INFRASTRUCTURE_GATES_NOT_MET');
 return Object.freeze({
  schema:'JENIOS_R100_INERT_WORKER_V1',
  runtime:'isolated-node',inert:true,
  noHttpListener:true,noQueuePolling:true,noBrokerNetwork:true,
  brokerAccountAuthenticated:false,
  externalDurabilityCertified:false,
  offsiteRestoreCertified:false,
  infrastructureApproval:false,
  paperOrderExecution:false,liveExecution:false,
  ordersSent:0,custody:false,paymentsEnabled:false,
  requiresOperatorProvisioning:true
 });
}
