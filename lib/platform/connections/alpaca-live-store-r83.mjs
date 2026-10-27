/** R83: private service-role store, owner-scoped and GET-only.
 * Do not import into routes or a browser. Never log encrypted fields or secrets.
 * Read-only verification remains separate from the trading execution path.
 */
import {requireR83PrivateVaultGate} from './alpaca-live-vault-r83.mjs';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const TABLE='jenios_robot_live_connections_r83';
const fail=code=>{throw Object.assign(new Error(code),{code});};
function scope({ownerUserId,connectionId}){
 if(!UUID.test(ownerUserId||'')||!UUID.test(connectionId||''))
  fail('R83_OWNER_CONNECTION_INVALID');
 return {ownerUserId,connectionId};
}
function safe(row){
 if(!row||!UUID.test(row.id||'')||!UUID.test(row.owner_user_id||'')||
   !['STAGED','READ_VERIFIED','REVOKED'].includes(row.status)||
   !Number.isSafeInteger(row.revision)||row.revision<1)
  fail('R83_PRIVATE_ROW_INVALID');
 return Object.freeze({id:row.id,ownerUserId:row.owner_user_id,
  status:row.status,revision:row.revision,liveExecution:false,
  ordersSent:0,custody:false,withdrawals:false,
  providerRevocationRequired:row.status==='REVOKED'});
}
export function createR83PrivateLiveStore(db,{env=process.env}={}){
 requireR83PrivateVaultGate(env);
 if(typeof db?.from!=='function'||typeof db?.rpc!=='function')
  fail('R83_PRIVATE_DATABASE_REQUIRED');
 return Object.freeze({
  /** The separate owner-authenticated service seals the credentials BEFORE staging.
   * The connection is NOT verified, and has no execution permissions.
   */
  async stage({ownerUserId,connectionId,envelope}){
   scope({ownerUserId,connectionId});
   if(!envelope||!['ALPACA_API_KEY_PAIR','ALPACA_OAUTH_ACCESS_TOKEN'].includes(envelope.kind)||
      envelope.v!==1||typeof envelope.data!=='string')
    fail('R83_SEALED_ENVELOPE_REQUIRED');
   let response;
   try{
    response=await db.from(TABLE).insert({
     id:connectionId,owner_user_id:ownerUserId,provider:'alpaca',
     environment:'live',credential_kind:envelope.kind,
     credential_box:envelope,status:'STAGED',
     identity_verified:false,external_digest:null,
     source:'JENIOS_R83_PRIVATE_OWNER_AUTH'
    }).select('id,owner_user_id,status,revision').single();
   }catch{fail('R83_PRIVATE_STORE_UNAVAILABLE');}
   if(response?.error)fail('R83_PRIVATE_STORE_UNAVAILABLE');
   const meta=safe(response?.data);
   if(meta.id!==connectionId||meta.ownerUserId!==ownerUserId||
      meta.status!=='STAGED')fail('R83_PRIVATE_STORE_UNCONFIRMED');
   return meta;
  },
  /** Returns a sealed envelope to PRIVATE worker code only, never to an HTTP response.
   * A revoked row is never surfaced. The client-specific owner predicate is mandatory.
   */
  async loadSealed({ownerUserId,connectionId}){
   scope({ownerUserId,connectionId});
   let response;
   try{
    response=await db.from(TABLE)
     .select('id,owner_user_id,provider,environment,credential_kind,credential_box,status,identity_verified,external_digest,source,last_sync_at,revision')
     .eq('owner_user_id',ownerUserId).eq('id',connectionId).maybeSingle();
   }catch{fail('R83_PRIVATE_STORE_UNAVAILABLE');}
   if(response?.error)fail('R83_PRIVATE_STORE_UNAVAILABLE');
   const row=response?.data;
   if(row===null)return null;
   const meta=safe(row);
   if(meta.id!==connectionId||meta.ownerUserId!==ownerUserId||
      row.provider!=='alpaca'||row.environment!=='live'||
      meta.status==='REVOKED'||!row.credential_box||
      row.credential_box.kind!==row.credential_kind||
      !['ALPACA_API_KEY_PAIR','ALPACA_OAUTH_ACCESS_TOKEN'].includes(row.credential_kind))
    fail('R83_PRIVATE_STORE_SCOPE_MISMATCH');
   if(meta.status==='STAGED'&&
      (row.identity_verified!==false||row.external_digest!==null||
       row.source!=='JENIOS_R83_PRIVATE_OWNER_AUTH'))
     fail('R83_PRIVATE_STORE_SCOPE_MISMATCH');
   if(meta.status==='READ_VERIFIED'&&
      (row.identity_verified!==true||!/^[a-f0-9]{64}$/.test(row.external_digest||'')||
       row.source!=='JENIOS_PRIVATE_LIVE_VAULT_VERIFIED'||
       !Number.isFinite(Date.parse(row.last_sync_at||''))))
     fail('R83_PRIVATE_STORE_SCOPE_MISMATCH');
   return Object.freeze({meta,kind:row.credential_kind,
     envelope:Object.freeze({...row.credential_box}),
     brokerDigest:meta.status==='READ_VERIFIED'?row.external_digest:null});
  },
  async markReadVerified({ownerUserId,connectionId,expectedRevision,brokerDigest}){
   scope({ownerUserId,connectionId});
   if(!Number.isSafeInteger(expectedRevision)||expectedRevision<1||
      !/^[a-f0-9]{64}$/.test(brokerDigest||''))
    fail('R83_INVALID_VERIFICATION');
   const response=await privateRpc(db,'jenios_r83_mark_live_read_verified',{
    p_owner_user_id:ownerUserId,p_connection_id:connectionId,
    p_expected_revision:expectedRevision,p_external_digest:brokerDigest
   });
   if(response!==true)fail('R83_READ_VERIFICATION_CONFLICT');
   return Object.freeze({readVerified:true,liveExecution:false,ordersSent:0});
  },
  async noteRead({ownerUserId,connectionId,expectedRevision,brokerDigest}){
   scope({ownerUserId,connectionId});
   if(!Number.isSafeInteger(expectedRevision)||expectedRevision<1||
      !/^[a-f0-9]{64}$/.test(brokerDigest||''))
    fail('R83_INVALID_VERIFICATION');
   const response=await privateRpc(db,'jenios_r83_note_live_read',{
    p_owner_user_id:ownerUserId,p_connection_id:connectionId,
    p_expected_revision:expectedRevision,p_external_digest:brokerDigest
   });
   if(response!==true)fail('R83_LIVE_READ_CONFLICT');
   return Object.freeze({readObserved:true,liveExecution:false,ordersSent:0});
  },
  async revoke({ownerUserId,connectionId}){
   scope({ownerUserId,connectionId});
   const changed=await privateRpc(db,'jenios_r83_revoke_live_connection',{
    p_owner_user_id:ownerUserId,p_connection_id:connectionId
   });
   return Object.freeze({revoked:changed,providerRevocationRequired:true,
    ordersCancelled:false,positionsClosed:false,liveExecution:false});
  }
 });
}
async function privateRpc(db,operation,params){
 let response;
 try{response=await db.rpc(operation,params);}
 catch{fail('R83_PRIVATE_DATABASE_UNAVAILABLE');}
 if(response?.error||typeof response?.data!=='boolean')
  fail('R83_PRIVATE_DATABASE_UNAVAILABLE');
 return response.data;
}
