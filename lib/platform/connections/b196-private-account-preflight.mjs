/** B196 — customer-owned Alpaca Paper identity recheck in an isolated, read-only process.
 * This prepares a QA reviewer; it never certifies key permissions, creates orders, or exposes secrets.
 * NOT imported by any Next.js route. The official B166 GET-only reader remains the sole transport.
 */
import {decryptDemo,digestDemoAccount,vaultReady} from './demo-vault.mjs';
import {readDemoBroker} from './demo-broker-reader.mjs';
import {nativeCustomerBinding} from './native-broker-bridge.mjs';
const deny=code=>{throw Object.assign(new Error(code),{code});};
const scope=(userId,id)=>({userId,id,provider:'alpaca',environment:'paper',kind:'credentials'});
const date=x=>typeof x==='string'&&Number.isFinite(Date.parse(x))?Date.parse(x):NaN;
const privateRead=env=>{
 if(env.VERCEL||env.VERCEL_ENV||env.JENIOS_PRIVATE_PAPER_REHEARSAL!=='true'||
    env.JENIOS_PRIVATE_PAPER_ACCOUNT_PREFLIGHT!=='true'||!vaultReady(env))
  deny('PRIVATE_READ_ONLY_PREFLIGHT_DISABLED');
};
export async function verifyPrivatePaperAccountRead({session,storedConnection,nowMs},
 {env=process.env,refreshConnection,reader=readDemoBroker,fetcher}={}){
 privateRead(env);
 if(!session||session.authenticated!==true||session.diagnosticCompleted!==true||
    !Number.isSafeInteger(nowMs)||nowMs<=0)deny('AUTHENTICATED_PAPER_SESSION_REQUIRED');
 if(typeof refreshConnection!=='function'||typeof reader!=='function')deny('SERVER_ROLE_ACCOUNT_REFRESH_REQUIRED');
 const binding=nativeCustomerBinding(session.userId,storedConnection);
 if(binding.provider!=='alpaca'||binding.environment!=='paper'||storedConnection.identity_verified!==true)
  deny('ALPACA_PAPER_ACCOUNT_REQUIRED');
 const last=date(storedConnection.last_sync_at),created=date(storedConnection.created_at);
 if(!Number.isFinite(last)||last>nowMs||nowMs-last>300000||
    !Number.isFinite(created)||created>nowMs)deny('ACCOUNT_REQUIRES_FRESH_READ');
 const latest=await refreshConnection({userId:session.userId,connectionId:binding.connectionId});
 if(!latest||latest.user_id!==session.userId||latest.id!==binding.connectionId||
    latest.provider!=='alpaca'||latest.environment!=='paper'||latest.status!=='active'||
    latest.revoked===true||latest.identity_verified!==true||latest.external_digest!==binding.accountDigest||
    JSON.stringify(latest.credential_box)!==JSON.stringify(storedConnection.credential_box))
  deny('ACCOUNT_REVOKED_ROTATED_OR_CHANGED');
 const credentials=decryptDemo(latest.credential_box,scope(session.userId,binding.connectionId),env);
 if(!credentials||typeof credentials.apiKey!=='string'||typeof credentials.secret!=='string')
  deny('PRIVATE_ACCOUNT_CREDENTIALS_UNAVAILABLE');
 let observed;
 try{
  observed=await reader({provider:'alpaca',environment:'paper',...credentials},
   {now:()=>nowMs,...(fetcher?{fetcher}:{})});
 }catch{deny('OFFICIAL_PAPER_GET_NOT_CONFIRMED');}
 if(observed?.identityVerified!==true||!observed.accountRef||
    observed.snapshot?.provider!=='alpaca'||observed.snapshot?.environment!=='paper'||
    observed.snapshot?.complete!==true||observed.snapshot?.accountReadConfirmed!==true||
    observed.snapshot?.observedAtMs!==nowMs||!Array.isArray(observed.snapshot?.positions)||
    !Array.isArray(observed.snapshot?.openOrders)||observed.observation?.summary?.permissionsVerified!==false||
    observed.observation?.liveExecution!==false||observed.observation?.ordersSent!==0)
  deny('PAPER_READ_PROOF_INCOMPLETE');
 const digest=digestDemoAccount(observed.accountRef,
  {userId:session.userId,provider:'alpaca',environment:'paper'},env);
 if(digest!==binding.accountDigest)deny('EXTERNAL_BROKER_ACCOUNT_CHANGED');
 return Object.freeze({schema:'JENIOS_B196_PRIVATE_READ_ONLY_PREFLIGHT',
  provider:'alpaca',environment:'paper',connectionId:binding.connectionId,
  observedAtMs:nowMs,accountReferenceMatched:true,
  positionCount:observed.snapshot.positions.length,openOrderCount:observed.snapshot.openOrders.length,
  // Callbacks are mockable. Independent evidence requires authenticated operator review.
  independentProviderEvidenceCertified:false,brokerPermissionsVerified:false,
  civilAccountOwnershipVerified:false,paperOrderPermission:false,
  brokerLivePermission:false,liveExecution:false,ordersSent:0,custody:false,withdrawals:false,
  requiresIndependentBrokerReview:true,
  next:'VERIFY_KEY_SCOPES_AND_CONSENT_OUTSIDE_PUBLIC_APP'});
}
