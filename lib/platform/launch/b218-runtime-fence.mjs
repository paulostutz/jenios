/** B218 — explicit deny-by-default boundary for a PRIVATE READ-ONLY worker candidate. */
const deny=code=>{throw Object.assign(new Error(code),{code});};
const readFlags=['JENIOS_PRIVATE_PAPER_REHEARSAL','JENIOS_PRIVATE_PAPER_ACCOUNT_PREFLIGHT',
 'JENIOS_PRIVATE_PAPER_READ_OBSERVER','JENIOS_PRIVATE_PAPER_OBSERVER_WORKER'];
const never=['JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED','JENIOS_PRIVATE_PAPER_EXECUTOR','JENIOS_REAL_EXECUTION_ENABLED'];
export function auditReadOnlyRuntimeFence(env){
 if(!env||typeof env!=='object'||env.VERCEL||env.VERCEL_ENV||
  readFlags.some(k=>env[k]!=='true')||never.some(k=>env[k]==='true'))deny('B218_PRIVATE_GET_ONLY_RUNTIME_REQUIRED');
 for(const name of ['JENIOS_DEMO_VAULT_KEY_B64','JENIOS_PAPER_OBSERVER_KEY_B64']){
  const value=env[name];if(typeof value!=='string'||!/^[A-Za-z0-9+/]{43}=$/.test(value)||Buffer.from(value,'base64').length!==32)
   deny('B218_PRIVATE_KEYS_NOT_CONFIGURED');
 }
 if(env.JENIOS_DEMO_VAULT_KEY_B64===env.JENIOS_PAPER_OBSERVER_KEY_B64)
  deny('B218_INDEPENDENT_KEYS_REQUIRED');
 return Object.freeze({schema:'JENIOS_B218_RUNTIME_FENCE',readMethods:Object.freeze(['GET']),
  externalApiHost:'paper-api.alpaca.markets',privateRuntimeRequired:true,liveOrderEndpointEnabled:false,
  paperOrderEndpointEnabled:false,providerConnectionAuthenticated:false,
  credentialsDisplayed:false,ordersSent:0,paymentsCharged:0,liveExecutionAuthorized:false});
}
