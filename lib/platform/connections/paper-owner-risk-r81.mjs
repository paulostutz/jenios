/** R81: owner-verified, explicitly consented PAPER risk approval (NO LIVE).
 * Private service only, no HTTP route. A paused row must be present.
 * Only the actual Platform Auth principal can approve their own risk.
 */
import {units} from '../pilot-prep/contracts.mjs';
import {createR80PaperSafetyStore} from './paper-safety-store-r80.mjs';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const CONSENT='I_APPROVE_ALPACA_PAPER_RISK_FOR_MY_OWN_ACCOUNT';
const fail=code=>{throw Object.assign(new Error(code),{code});};
export async function approveR81OwnerPaperRisk({
 accessToken,connectionId,maxNotional,expiresAtMs,consent,acceptsPaperRisk
},{db,env=process.env,clock=Date.now}={}){
 if(env.VERCEL_ENV!=='preview'||env.JENIOS_REAL_EXECUTION_ENABLED!=='false'||
    env.JENIOS_R81_PAPER_RISK_APPROVAL_ENABLED!=='true')
  fail('R81_RISK_APPROVAL_DISABLED');
 if(!db?.rpc||!db?.from||!db?.auth?.getUser)fail('R81_PRIVATE_DATABASE_REQUIRED');
 if(consent!==CONSENT||acceptsPaperRisk!==true||
    !UUID.test(connectionId||'')||typeof accessToken!=='string'||
    accessToken.length<20||accessToken.length>4096)
  fail('R81_OWNER_CONSENT_REQUIRED');
 const nowMs=clock();
 if(!Number.isSafeInteger(nowMs)||!Number.isSafeInteger(expiresAtMs)||
    expiresAtMs<=nowMs+120000||expiresAtMs>nowMs+3600000)
  fail('R81_RISK_EXPIRATION_INVALID');
 let amount;
 try{amount=units(maxNotional).toString();}catch{fail('R81_RISK_LIMIT_INVALID');}
 if(amount==='0'||amount.length>26)fail('R81_RISK_LIMIT_INVALID');
 let auth;
 try{auth=await db.auth.getUser(accessToken);}catch{fail('R81_PLATFORM_AUTH_UNAVAILABLE');}
 const user=auth?.data?.user;
 if(auth?.error||!UUID.test(user?.id||'')||user.is_anonymous===true||
    !user.email_confirmed_at)fail('R81_PLATFORM_OWNER_REQUIRED');
 const ownerUserId=user.id;
 let conn;
 try{conn=await db.from('jenios_platform_demo_broker_connections')
  .select('id,user_id,provider,environment,status,identity_verified,external_digest,last_sync_at')
  .eq('id',connectionId).eq('user_id',ownerUserId).maybeSingle();}
 catch{fail('R81_CONNECTION_UNAVAILABLE');}
 const row=conn?.data;
 if(conn?.error||!row||row.id!==connectionId||row.user_id!==ownerUserId||
    row.provider!=='alpaca'||row.environment!=='paper'||row.status!=='active'||
    row.identity_verified!==true||!/^[a-f0-9]{64}$/.test(row.external_digest||'')||
    !Number.isFinite(Date.parse(row.last_sync_at||''))||
    nowMs-Date.parse(row.last_sync_at)>300000||Date.parse(row.last_sync_at)>nowMs)
  fail('R81_PAPER_ACCOUNT_NOT_VERIFIED');
 let initialized;
 try{initialized=await db.rpc('jenios_r81_initialize_paper_safety',{
    p_owner_user_id:ownerUserId,p_connection_id:connectionId
  });}catch{fail('R81_RISK_STORE_UNAVAILABLE');}
 const expectedRevision=initialized?.data;
 if(initialized?.error||!Number.isSafeInteger(expectedRevision)||expectedRevision<=0)
  fail('R81_RISK_STORE_UNAVAILABLE');
 let result;
 try{result=await db.rpc('jenios_r81_activate_paper_owner_risk',{
   p_owner_user_id:ownerUserId,p_connection_id:connectionId,
   p_expected_revision:expectedRevision,p_account_digest:row.external_digest,
   p_max_notional_units:amount,p_expires_at:new Date(expiresAtMs).toISOString()
 });}catch{fail('R81_RISK_APPROVAL_CONFLICT');}
 if(result?.error||result?.data!==true)fail('R81_RISK_APPROVAL_CONFLICT');
 const verified=await createR80PaperSafetyStore(db).readSafety({ownerUserId,connectionId});
 if(!verified||verified.status!=='ACTIVE'||verified.killSwitchEngaged!==false||
    verified.paperConsentEnabled!==true||verified.maxNotionalUnits!==amount||
    verified.riskExpiresAtMs!==expiresAtMs||
    verified.liveExecutionEnabled!==false)fail('R81_RISK_RECEIPT_UNCONFIRMED');
 return Object.freeze({ownerUserId,connectionId,paperOnly:true,liveExecution:false,
   riskApproved:true,maxNotionalUnits:amount,expiresAtMs});
}

/** Owner-authenticated emergency stop. It can be invoked while risk is already paused.
 * This never calls the broker and MUST NOT be displayed as position liquidation.
 */
export async function pauseR81OwnerPaperAccount({
 accessToken,connectionId
},{db}={}){
 if(!db?.auth?.getUser||!db?.rpc||!UUID.test(connectionId||'')||
    typeof accessToken!=='string'||accessToken.length<20||accessToken.length>4096)
  fail('R81_KILL_AUTH_REQUIRED');
 let result;
 try{result=await db.auth.getUser(accessToken);}
 catch{fail('R81_KILL_AUTH_REQUIRED');}
 const user=result?.data?.user;
 if(result?.error||!UUID.test(user?.id||'')||user.is_anonymous===true||
    !user.email_confirmed_at)fail('R81_KILL_AUTH_REQUIRED');
 const response=await createR80PaperSafetyStore(db).engageKill({
  ownerUserId:user.id,connectionId
 });
 if(response.paused!==true)fail('R81_PAPER_ACCOUNT_NOT_FOUND');
 return Object.freeze({paused:true,ordersCancelled:false,positionsClosed:false,
  brokerCancellationNotVerified:true,liveExecution:false,manualReconciliationRequired:true});
}
