/** B299-QA Stage 2 preflight: pure checks; no credentials emitted, no network.
 * This module never creates users, performs financial operations, or requests broker access.
 */
import {providerPaths} from '../connections/provider-paths.mjs';
export const B299_QA_SOCIAL_URL='https://rebzztxlzofxpfwjvbee.supabase.co';
export const B299_QA_PLATFORM_URL='https://xaicvhagftzjkqphnbgx.supabase.co';
export const B299_QA_DISABLED_FLAGS=Object.freeze([
 'NEXT_PUBLIC_PLATFORM_SIGNUP_ENABLED',
 'JENIOS_PRO_GENERATION_ENABLED','JENIOS_PRO_PAYMENTS_ENABLED',
 'JENIOS_SALES_GENERATIVE_ENABLED','JENIOS_INTER_CHARGES_ENABLED',
 'JENIOS_PAY_PAYMENTS_ENABLED','JENIOS_REAL_EXECUTION_ENABLED',
 'JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED','JENIOS_PRIVATE_PAPER_EXECUTOR',
 'JENIOS_QA_CANDIDATE_ENABLED','JENIOS_TRIAL_ENABLED',
 'JENIOS_TRIAL_ACTIVATION_APPROVED','JENIOS_DEMO_CONNECTORS_ENABLED'
]);
const EXPECTED_CATALOG=Object.freeze({
 'platform-nacional':{price_cents:9990,category:'platform'},
 'platform-global-crypto':{price_cents:14990,category:'platform'},
 'platform-internacional-pro':{price_cents:19990,category:'platform'},
 'social-university-monthly':{price_cents:4990,category:'other'}
});
const present=value=>typeof value==='string'&&value.length>=20&&!/\s/.test(value);
const missingSecret=(env,key)=>!present(env[key]);
const safeLocal=origin=>{
 try{const u=new URL(origin);
  return u.protocol==='http:'&&['127.0.0.1','localhost'].includes(u.hostname)&&
   u.port==='3129'&&u.pathname==='/'&&!u.search&&!u.hash;
 }catch{return false;}
};
export function inspectB299QaPreflight(env={}){
 const blockers=[];
 if(env.VERCEL||env.VERCEL_ENV==='production'||env.VERCEL_ENV==='preview')
  blockers.push('LOCAL_ONLY_QA_PREFLIGHT');
 if(env.NEXT_PUBLIC_SUPABASE_URL!==B299_QA_SOCIAL_URL||
  env.SOCIAL_SUPABASE_URL!==B299_QA_SOCIAL_URL)
  blockers.push('SOCIAL_QA_PROJECT_MISMATCH');
 if(env.PLATFORM_SUPABASE_URL!==B299_QA_PLATFORM_URL||
  env.NEXT_PUBLIC_PLATFORM_SUPABASE_URL!==B299_QA_PLATFORM_URL)
  blockers.push('PLATFORM_QA_PROJECT_MISMATCH');
 if(env.JENIOS_QA_STRICT_SUBSCRIPTION_PROOF!=='true')
  blockers.push('STRICT_BANK_PROOF_REQUIRED');
 if(env.JENIOS_PAY_PROVIDER!=='disabled')
  blockers.push('BILLING_PROVIDER_MUST_BE_DISABLED');
 for(const flag of B299_QA_DISABLED_FLAGS)
  if(env[flag]!=='false')blockers.push('UNSAFE_OR_UNCONFIRMED_FLAG:'+flag);
 const credentialsMissing=[];
 if(missingSecret(env,'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY')&&
  missingSecret(env,'NEXT_PUBLIC_SUPABASE_ANON_KEY'))credentialsMissing.push('SOCIAL_QA_PUBLISHABLE_KEY');
 if(missingSecret(env,'NEXT_PUBLIC_PLATFORM_SUPABASE_PUBLISHABLE_KEY')&&
  missingSecret(env,'PLATFORM_QA_PUBLISHABLE_KEY'))
  credentialsMissing.push('PLATFORM_QA_PUBLISHABLE_KEY');
 if(missingSecret(env,'SUPABASE_SECRET_KEY')&&missingSecret(env,'SUPABASE_SERVICE_ROLE_KEY'))
  credentialsMissing.push('SOCIAL_QA_SERVER_KEY');
 if(missingSecret(env,'PLATFORM_SUPABASE_SERVICE_ROLE_KEY'))
  credentialsMissing.push('PLATFORM_QA_SERVER_KEY');
 const safeQaConfiguration=blockers.length===0;
 const qaServerKeysPresent=credentialsMissing.length===0;
 const explicitAuthApproval=env.JENIOS_QA_AUTH_E2E_APPROVED==='true';
 const localQaServer=safeLocal(env.PLATFORM_QA_NEXT_URL);
 return Object.freeze({
  schema:'JENIOS_B299_QA_STAGE2_PREFLIGHT_V1',
  safeQaConfiguration,qaServerKeysPresent,
  blockers:Object.freeze(blockers),missingCredentials:Object.freeze(credentialsMissing),
  canRunExistingCp69AuthenticatedQa:safeQaConfiguration&&qaServerKeysPresent&&
   explicitAuthApproval&&localQaServer,
  authQaCurrentlyCertified:false,hostedQaCatalogCertified:false,
  bankInterActivated:false,paidAiActivated:false,externalBrokerAuthenticated:false,
  realOrPaperExternalOrdersAllowed:false,releaseAuthorized:false,
  action:'Review and authorize existing CP69 in a protected private QA runtime only after credentials are configured'
 });
}
export function inspectB299QaCatalog(rows,source='unknown'){
 const observedFromQaDatabase=source==='verified_qa_sql_read'&&Array.isArray(rows);
 const problems=[];
 if(!observedFromQaDatabase)problems.push('CATALOG_QA_SOURCE_NOT_VERIFIED');
 const found=new Map();
 if(Array.isArray(rows))for(const row of rows){
  if(!row||typeof row!=='object'||typeof row.code!=='string')continue;
  if(found.has(row.code))problems.push('DUPLICATE_PRODUCT:'+row.code);
  found.set(row.code,row);
 }
 for(const [code,expected] of Object.entries(EXPECTED_CATALOG)){
  const row=found.get(code);
  if(!row)problems.push('PRODUCT_MISSING:'+code);
  else if(row.active!==false||row.price_cents!==expected.price_cents||
   row.category!==expected.category||row.billing_type!=='monthly')
    problems.push('PRODUCT_STATE_MISMATCH:'+code);
 }
 return Object.freeze({
  schema:'JENIOS_B299_QA_CATALOG_REVIEW_V1',catalogQaRowsConsistent:problems.length===0,
  problems:Object.freeze(problems),
  actualBackendEndpointReadVerified:false,checkoutEnabled:false,
  paymentAuthorized:false
 });
}
export function inspectB299QaBrokerGuides(){
 const paths=providerPaths();
 return Object.freeze({
  schema:'JENIOS_B299_QA_BROKERS_V1',
  totalGuides:paths.length,
  readOnlyDemoDesigns:paths.filter(p=>p.capability==='read_only_demo_implemented_not_authenticated').length,
  guideOnly:paths.filter(p=>p.capability==='guide_only').length,
  officialAuthenticatedAccounts:0,
  brokerPermissionCertification:false,brokerOrderTransmissionAuthorized:false,
  providerIds:Object.freeze(paths.map(p=>p.provider))
 });
}
