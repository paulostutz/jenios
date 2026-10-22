/**
 * B303 — Protected Preview broker onboarding preflight, READ-ONLY.
 * Does not connect a broker, read credentials, create accounts or run orders.
 * Reuses Platform admin authorization and the existing B165–B169 GET-only flow.
 */
import {checkS05DeploymentScope} from '../../release/environment-scope.mjs';
import {vaultReady} from './demo-vault.mjs';
import {demoEnabled} from './demo-service.mjs';

export const B303_QA_BRANCH='fix/jenios-b303-protected-readonly-preview-20261021';
export const B303_QA_PROJECT='prj_9cRnjWFRsLkfTToF4U4xZQBa7Gq9';
const H=Object.freeze({'Cache-Control':'no-store, max-age=0','X-Content-Type-Options':'nosniff',
 'X-Frame-Options':'DENY','Referrer-Policy':'no-referrer','Vary':'Authorization'});
const reply=(status,body)=>Response.json(body,{status,headers:H});
const isPresent=x=>typeof x==='string'&&x.length>20;

/** Snapshot only of configuration presence, NOT validation of third-party API keys. */
export function inspectB303PreviewReadiness(env={}){
 const scope=checkS05DeploymentScope(env);
 const branch=env.VERCEL_GIT_COMMIT_REF===B303_QA_BRANCH;
 const preview=env.VERCEL_ENV==='preview';
 const correctProject=!env.VERCEL_PROJECT_ID||env.VERCEL_PROJECT_ID===B303_QA_PROJECT;
 const sourceValid=preview&&branch&&correctProject&&scope.ok&&
  scope.mode==='preview-b303-protected-readonly';
 const platformAuthPublicConfigured=isPresent(env.NEXT_PUBLIC_PLATFORM_SUPABASE_PUBLISHABLE_KEY);
 const platformServerAdminConfigured=isPresent(env.PLATFORM_SUPABASE_SERVICE_ROLE_KEY);
 const privateVaultConfigured=vaultReady(env);
 const brokerConnectorEnabled=demoEnabled(env);
 return Object.freeze({schema:'JENIOS_B303_PREVIEW_BROKER_PREFLIGHT_V1',
  previewBranchValidated:sourceValid,
  platformBrowserAuthConfigurationPresent:platformAuthPublicConfigured,
  platformServerAdminConfigurationPresent:platformServerAdminConfigured,
  privateVaultConfigurationPresent:privateVaultConfigured,
  demoConnectorEnabled:brokerConnectorEnabled,
  alpacaPaperReaderPresentInCode:true,
  binanceTestnetReaderPresentInCode:true,
  protectedPreviewSsoIndependentlyAttestedByModule:false,
  authorizedTestUserObserved:false,
  brokerAccountOwnershipVerified:false,
  brokerReadPermissionIndependentlyVerified:false,
  liveBrokerConnected:false,
  alpacaPaperConnected:false,
  providerGetPerformedByModule:false,
  orderFillExternallyConfirmed:false,
  signalDeliveryExternallyConfirmed:false,
  b152BrokerLedgerReconciled:false,
  realLossesAvoided:null,
  actualBrokerRealizedPnl:null,
  ordersSent:0,paperOrdersSent:0,chargesCreated:0,
  liveExecutionEnabled:false,paperExecutionEnabled:false,
  releaseStatus:'NO_GO_EXTERNAL_AUTHORIZATION_AND_BROKER_READ_REQUIRED',
  next:'CONFIGURE_SERVER_SECRETS_AND_VOLUNTARY_TEST_ACCOUNT_IN_PROTECTED_QA'});
}

/** Server-bound endpoint: 404 outside this preview, admin Bearer required. */
export async function b303BrokerPreflightHttp(request,{env=process.env,createDb,authorize}={}){
 if(env?.VERCEL_ENV!=='preview'||env?.VERCEL_GIT_COMMIT_REF!==B303_QA_BRANCH||
  env?.JENIOS_B303_READONLY_ENABLED!=='true')return reply(404,{error:'NOT_AVAILABLE'});
 if(request?.method!=='GET')return reply(405,{error:'METHOD_NOT_ALLOWED'});
 if(typeof createDb!=='function'||typeof authorize!=='function')
  return reply(503,{error:'QA_BACKEND_UNAVAILABLE'});
 try{
  const db=createDb();
  const grant=await authorize(request,db,'platform.admin');
  if(!grant?.user?.id||!Array.isArray(grant.permissions)||
     !grant.permissions.includes('platform.admin'))return reply(403,{error:'QA_ADMIN_REQUIRED'});
  return reply(200,inspectB303PreviewReadiness(env));
 }catch(error){
  const status=[401,403].includes(error?.status)?error.status:503;
  return reply(status,{error:status===401?'PLATFORM_LOGIN_REQUIRED':
    status===403?'QA_ADMIN_REQUIRED':'QA_BACKEND_UNAVAILABLE'});
 }
}