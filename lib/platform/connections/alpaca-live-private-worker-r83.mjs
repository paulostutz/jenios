/** JENIOS R83 — owner-authenticated PRIVATE workflow for the Live vault.
 * Stages sealed credentials only, verifies binding with official GET endpoints,
 * refreshes read-only observations and can revoke the local seal.
 * NO public route, NO order placement/cancellation, NO custody, NO trading scope.
 * OAuth authorization/callback must be supplied by a separately approved app.
 */
import {randomUUID} from 'node:crypto';
import {sealR83LiveCredentials,openR83LiveCredentials,requireR83PrivateVaultGate}
 from './alpaca-live-vault-r83.mjs';
import {createR83PrivateLiveStore} from './alpaca-live-store-r83.mjs';
import {requireR82LiveReadOnlyGate,probeR82StagedAlpacaLiveAccount,
 inspectR82AlpacaLiveReadOnly} from './alpaca-live-readonly-r82.mjs';

const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const AUTH=/^[A-Za-z0-9_.-]{20,4096}$/;
const CONSENT='I_AUTHORIZE_JENIOS_ALPACA_LIVE_READ_ONLY';
const fail=code=>{throw Object.assign(new Error(code),{code});};

function requirePrivateReadiness(env){
 requireR83PrivateVaultGate(env);
 requireR82LiveReadOnlyGate(env);
 if(env.JENIOS_R83_ALPACA_THIRD_PARTY_APP_APPROVED!=='true')
  fail('R83_ALPACA_APP_APPROVAL_REQUIRED');
}

async function verifiedPlatformOwner(db,token){
 if(!db?.auth?.getUser||typeof token!=='string'||!AUTH.test(token))
  fail('R83_PLATFORM_AUTH_REQUIRED');
 let verified;
 try{verified=await db.auth.getUser(token);}
 catch{fail('R83_PLATFORM_AUTH_REQUIRED');}
 const user=verified?.data?.user;
 if(verified?.error||!UUID.test(user?.id||'')||
    user.is_anonymous===true||!user.email_confirmed_at)
  fail('R83_PLATFORM_AUTH_REQUIRED');
 return user.id;
}

function nowValue(clock){
 const ms=clock();
 if(!Number.isSafeInteger(ms)||ms<=0)fail('R83_PRIVATE_CLOCK_REQUIRED');
 return ms;
}

/** Invoked only by a private service AFTER the approved third-party auth flow.
 * No endpoint is exposed. No request body owner_id or broker account ID accepted.
 */
export async function stageR83PrivateLiveConnection({
 accessToken,credentials,consent
},{db,env=process.env,uuid=randomUUID}={}){
 requirePrivateReadiness(env);
 if(consent!==CONSENT)fail('R83_EXPLICIT_LIVE_READ_CONSENT_REQUIRED');
 const ownerUserId=await verifiedPlatformOwner(db,accessToken);
 const connectionId=uuid();
 if(!UUID.test(connectionId||''))fail('R83_CONNECTION_ID_INVALID');
 const kind=credentials?.kind;
 const envelope=sealR83LiveCredentials({ownerUserId,connectionId,kind},
  credentials,{env});
 const store=createR83PrivateLiveStore(db,{env});
 const saved=await store.stage({ownerUserId,connectionId,envelope});
 return Object.freeze({
  id:saved.id,status:'STAGED',ownerUserId,
  environment:'live',provider:'alpaca',readVerified:false,
  realOrdersEnabled:false,ordersSent:0,providerRevocationRequired:false
 });
}

/** A first authenticated GET seals the account digest and proves only API reachability.
 * Atomic CAS refuses stale verify if the account was revoked during the network call.
 */
export async function verifyR83PrivateLiveConnection({
 accessToken,connectionId
},{db,env=process.env,fetcher=fetch,clock=Date.now}={}){
 requirePrivateReadiness(env);
 const ownerUserId=await verifiedPlatformOwner(db,accessToken);
 if(!UUID.test(connectionId||''))fail('R83_CONNECTION_ID_INVALID');
 const store=createR83PrivateLiveStore(db,{env});
 const saved=await store.loadSealed({ownerUserId,connectionId});
 if(!saved||saved.meta.status!=='STAGED')
  fail('R83_STAGED_LIVE_CONNECTION_REQUIRED');
 const credentials=openR83LiveCredentials({
  ownerUserId,connectionId,kind:saved.kind
 },saved.envelope,{env});
 const nowMs=nowValue(clock);
 const observation=await probeR82StagedAlpacaLiveAccount({
  session:{userId:ownerUserId,authenticated:true},
  stagedConnection:{id:connectionId,user_id:ownerUserId,
   provider:'alpaca',environment:'live',status:'STAGED',
   identity_verified:false,external_digest:null,
   source:'JENIOS_R83_PRIVATE_OWNER_AUTH'},
  credentials,nowMs
 },{env,fetcher});
 await store.markReadVerified({ownerUserId,connectionId,
  expectedRevision:saved.meta.revision,brokerDigest:observation.brokerDigest});
 return Object.freeze({
  id:connectionId,status:'READ_VERIFIED',accountReadConfirmed:true,
  accountActive:observation.accountActive,
  tradingBlocked:observation.tradingBlocked,marketOpen:observation.marketOpen,
  tradingPermissionsCertified:false,liveOrdersEnabled:false,
  ordersSent:0,custody:false,withdrawals:false,
  requiresSeparateLiveRiskApproval:true
 });
}

/** Every observation re-authenticates Platform owner, re-opens a scoped sealed box,
 * checks account digest against a fresh official GET and CAS-refreshes read time.
 */
export async function inspectR83PrivateLiveConnection({
 accessToken,connectionId
},{db,env=process.env,fetcher=fetch,clock=Date.now}={}){
 requirePrivateReadiness(env);
 const ownerUserId=await verifiedPlatformOwner(db,accessToken);
 const store=createR83PrivateLiveStore(db,{env});
 const saved=await store.loadSealed({ownerUserId,connectionId});
 if(!saved||saved.meta.status!=='READ_VERIFIED')
  fail('R83_LIVE_ACCOUNT_NOT_VERIFIED');
 const credentials=openR83LiveCredentials({
  ownerUserId,connectionId,kind:saved.kind
 },saved.envelope,{env});
 const observation=await inspectR82AlpacaLiveReadOnly({
  session:{authenticated:true,userId:ownerUserId},
  storedLiveConnection:{id:connectionId,user_id:ownerUserId,
   provider:'alpaca',environment:'live',status:'active',
   identity_verified:true,external_digest:saved.brokerDigest,
   source:'JENIOS_PRIVATE_LIVE_VAULT_VERIFIED'},
  credentials,nowMs:nowValue(clock)
 },{env,fetcher});
 // If revoked while GET was underway, fail closed rather than return a stale receipt.
 await store.noteRead({ownerUserId,connectionId,
  expectedRevision:saved.meta.revision,brokerDigest:saved.brokerDigest});
 return Object.freeze({
  id:connectionId,readOnly:true,
  accountReadConfirmed:observation.customerAccountVerified,
  accountActive:observation.accountActive,
  tradingBlocked:observation.tradingBlocked,
  marketOpen:observation.marketOpen,
  tradingPermissionsCertified:false,riskLimitsApproved:false,
  liveOrdersEnabled:false,ordersSent:0,custody:false,withdrawals:false,
  providerRevocationRequired:false
 });
}

/** Emergency local revocation does NOT require a usable vault key, an active
 * third-party OAuth client, or remote broker availability. This only destroys
 * local storage; the customer MUST revoke remote API keys or OAuth grant with Alpaca.
 */
export async function revokeR83PrivateLiveConnection({
 accessToken,connectionId
},{db,env=process.env}={}){
 if(env.JENIOS_R83_PRIVATE_NODE_WORKER!=='true'||
    env.JENIOS_REAL_EXECUTION_ENABLED!=='false'||
    env.JENIOS_R82_ALPACA_LIVE_ORDER_EXECUTION_ENABLED!=='false'||
    env.VERCEL_ENV==='production')fail('R83_PRIVATE_REVOKE_DISABLED');
 const ownerUserId=await verifiedPlatformOwner(db,accessToken);
 if(!UUID.test(connectionId||'')||typeof db?.rpc!=='function')
  fail('R83_PRIVATE_DATABASE_REQUIRED');
 let response;
 try{response=await db.rpc('jenios_r83_revoke_live_connection',{
  p_owner_user_id:ownerUserId,p_connection_id:connectionId
 });}catch{fail('R83_PRIVATE_REVOKE_UNAVAILABLE');}
 if(response?.error||response?.data!==true)
  fail('R83_PRIVATE_REVOKE_UNAVAILABLE');
 return Object.freeze({id:connectionId,revoked:true,
  localCredentialsDestroyed:true,providerRevocationRequired:true,
  ordersCancelled:false,positionsClosed:false,liveOrdersEnabled:false});
}
