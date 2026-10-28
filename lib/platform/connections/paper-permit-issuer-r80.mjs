/** R80 trusted PAPER permit issuer. No browser route and no configured signing key.
 * Service role is used exclusively to validate Platform Auth and durable owner records.
 * Never accepts a caller-supplied user id, account digest, approval timestamp or risk ceiling.
 */
import {createPrivateKey,randomUUID,sign} from 'node:crypto';
import {canonicalR78PaperPermit} from './paper-signed-authorization-r78.mjs';
import {createR80PaperSafetyStore} from './paper-safety-store-r80.mjs';
import {units,SCALE} from '../pilot-prep/contracts.mjs';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/;
const EQUITY=/^[A-Z][A-Z0-9.]{0,14}$/;
const CONSENT='I_AUTHORIZE_THIS_ALPACA_PAPER_ORDER';
const deny=code=>{throw Object.assign(new Error(code),{code});};
function issuerGate(env){
 if(env.VERCEL_ENV!=='preview'||env.JENIOS_REAL_EXECUTION_ENABLED!=='false'||
    env.JENIOS_R80_PRIVATE_ISSUER_ENABLED!=='true')deny('R80_ISSUER_DISABLED');
}
function privateSigner(env){
 const encoded=env.JENIOS_R80_PRIVATE_ED25519_SIGNING_KEY;
 if(typeof encoded!=='string'||encoded.length>512||!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded))
  deny('R80_SIGNING_KEY_UNAVAILABLE');
 try{
  const bytes=Buffer.from(encoded,'base64');
  if(bytes.toString('base64')!==encoded)deny('R80_SIGNING_KEY_UNAVAILABLE');
  const key=createPrivateKey({key:bytes,format:'der',type:'pkcs8'});
  if(key.asymmetricKeyType!=='ed25519')deny('R80_SIGNING_KEY_UNAVAILABLE');
  return key;
 }catch{deny('R80_SIGNING_KEY_UNAVAILABLE');}
}
export async function issueR80PaperPermit({
 accessToken,connectionId,clientOrderId,mode,side,symbol,quantity,entry,consent
},{db,env=process.env,clock=Date.now,uuid=randomUUID}={}){
 issuerGate(env);
 if(!db?.auth?.getUser||!db?.from||!db?.rpc)deny('R80_PRIVATE_DATABASE_REQUIRED');
 if(consent!==CONSENT||!UUID.test(connectionId||'')||
    !ID.test(clientOrderId||'')||!EQUITY.test(symbol||'')||
    !['direct','reverse','hybrid'].includes(mode)||side!=='buy'||
    typeof accessToken!=='string'||accessToken.length<20||accessToken.length>4096)
  deny('R80_EXPLICIT_PAPER_CONSENT_REQUIRED');
 const nowMs=clock();
 if(!Number.isSafeInteger(nowMs)||nowMs<=0)deny('R80_CLOCK_INVALID');
 // Validate risk dimensions before involving a signer or creating durable approval.
 let requested;
 try{requested=units(quantity)*units(entry)/SCALE;}catch{deny('R80_INVALID_PAPER_NOTIONAL');}
 if(requested<=0n)deny('R80_INVALID_PAPER_NOTIONAL');
 let identity;
 try{identity=await db.auth.getUser(accessToken);}catch{deny('R80_PLATFORM_AUTH_UNAVAILABLE');}
 const user=identity?.data?.user;
 if(identity?.error||!UUID.test(user?.id||'')||user?.is_anonymous===true||
    !user?.email_confirmed_at)deny('R80_PLATFORM_AUTH_REQUIRED');
 // Database scope is derived only from the verified Platform Auth principal.
 const userId=user.id;
 let response;
 try{response=await db.from('jenios_platform_demo_broker_connections')
  .select('id,user_id,provider,environment,status,identity_verified,external_digest,last_sync_at')
  .eq('id',connectionId).eq('user_id',userId).maybeSingle();}
 catch{deny('R80_CONNECTION_UNAVAILABLE');}
 const connection=response?.data;
 if(response?.error||!connection||connection.id!==connectionId||
    connection.user_id!==userId||connection.provider!=='alpaca'||
    connection.environment!=='paper'||connection.status!=='active'||
    connection.identity_verified!==true||!/^[a-f0-9]{64}$/.test(connection.external_digest||'')||
    !Number.isFinite(Date.parse(connection.last_sync_at||''))||
    nowMs-Date.parse(connection.last_sync_at)>300000||
    Date.parse(connection.last_sync_at)>nowMs)deny('R80_CONNECTION_NOT_VERIFIED');
 const safety=await createR80PaperSafetyStore(db).readSafety({ownerUserId:userId,connectionId});
 if(!safety||safety.status!=='ACTIVE'||safety.killSwitchEngaged!==false||
    safety.paperConsentEnabled!==true||safety.liveExecutionEnabled!==false||
    safety.approvalSource!=='PLATFORM_OWNER_SERVER_VERIFIED'||
    !Number.isSafeInteger(safety.checkedAtMs)||Math.abs(nowMs-safety.checkedAtMs)>30000||
    !Number.isSafeInteger(safety.riskApprovedAtMs)||safety.riskApprovedAtMs>nowMs||
    !Number.isSafeInteger(safety.riskExpiresAtMs)||safety.riskExpiresAtMs<=nowMs||
    !safety.maxNotionalUnits||requested>BigInt(safety.maxNotionalUnits))
  deny('R80_RISK_APPROVAL_REQUIRED');
 const approvalId=uuid();
 if(!UUID.test(approvalId||''))deny('R80_APPROVAL_ID_INVALID');
 const permit={schema:'JENIOS_R78_SIGNED_PAPER_PERMIT_V1',approvalId,
  ownerUserId:userId,connectionId,accountDigest:connection.external_digest,
  clientOrderId,mode,side,symbol,maxNotionalUnits:safety.maxNotionalUnits,
  issuedAtMs:nowMs,expiresAtMs:nowMs+120000,environment:'paper'};
 const canonical=canonicalR78PaperPermit(permit);
 const {createHash}=await import('node:crypto');
 const permitSha256=createHash('sha256').update(canonical).digest('hex');
 const signature=sign(null,Buffer.from(canonical,'utf8'),privateSigner(env)).toString('base64');
 // Atomic registration holds the same Postgres row lock as R80 KILL and R79 CLAIM.
 // This prevents a paused or expired risk state from authorizing a stale signed permit.
 try{response=await db.rpc('jenios_r81_register_signed_paper_permit',{
  p_approval_id:approvalId,p_owner_user_id:userId,p_connection_id:connectionId,
  p_account_digest:connection.external_digest,p_client_order_id:clientOrderId,
  p_permit_sha256:permitSha256,p_issued_at:new Date(nowMs).toISOString(),
  p_expires_at:new Date(permit.expiresAtMs).toISOString(),
  p_notional_units:requested.toString(),p_currency:'USD'
 });}
 catch{deny('R80_APPROVAL_PERSISTENCE_FAILED');}
 if(response?.error||response?.data!==true)deny('R80_APPROVAL_PERSISTENCE_FAILED');
 return Object.freeze({permit:Object.freeze(permit),signature,
  paperOnly:true,liveExecution:false,ordersSent:0,
  expiresAtMs:permit.expiresAtMs});
}
