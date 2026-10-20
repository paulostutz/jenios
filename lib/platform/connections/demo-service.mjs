/** B167 — tenant-scoped API orchestration (no client owner selector, no trading). */
import {randomUUID} from 'node:crypto';
import {encryptDemo,decryptDemo,digestDemoAccount,vaultReady} from './demo-vault.mjs';
import {readDemoBroker} from './demo-broker-reader.mjs';
import {buildDemoAssociation} from './demo-association.mjs';
import {reconcileDemoSnapshots} from './demo-reconciliation.mjs';
export const DEMO_CONSENT='READ_ONLY_DEMO_NO_ORDERS';
export const DEMO_TABLE='jenios_platform_demo_broker_connections';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const bad=(code,status=400)=>{throw Object.assign(new Error(code),{code,status});};
const current=now=>{const x=now();if(!Number.isSafeInteger(x)||x<0)bad('INVALID_CLOCK',503);return x;};
const exact=(obj,fields)=>obj&&typeof obj==='object'&&!Array.isArray(obj)&&Object.keys(obj).sort().join(',')===fields.slice().sort().join(',');
export function demoEnabled(env=process.env){return env.JENIOS_DEMO_CONNECTORS_ENABLED==='true'&&env.VERCEL_ENV!=='production'&&vaultReady(env);}
export function ensureDemoEnabled(env){if(!demoEnabled(env))bad('DEMO_CONNECTORS_DISABLED',404);}
const scope=(userId,id,provider,environment,kind)=>({userId,id,provider,environment,kind});
const providerEnv=provider=>provider==='binance'?'testnet':provider==='alpaca'?'paper':bad('UNSUPPORTED_PROVIDER');
export function publicDemoRow(row){
 return {id:row.id,provider:row.provider,environment:row.environment,status:row.status,
  accountReadConfirmed:row.status==='active'&&!!row.last_sync_at,
  identityVerified:row.status==='active'&&row.identity_verified===true,
  positionsReadConfirmed:row.status==='active'&&!!row.last_sync_at,
  openOrdersReadConfirmed:row.status==='active'&&!!row.last_sync_at,
  positionCount:row.status==='active'?row.position_count||0:0,
  openOrderCount:row.status==='active'?row.open_order_count||0:0,
  lastSyncedAt:row.last_sync_at||null,lastErrorCode:row.last_error_code||null,
  permissionsVerified:false,brokerApiReadOnlyPermissionVerified:false,
  connectedForReadOnlyDemo:row.status==='active'&&!!row.last_sync_at,
  liveExecution:false,ordersSent:0,custody:false};
}
export async function listDemoConnections(userId,{store,env=process.env}={}){
 ensureDemoEnabled(env);if(!UUID.test(userId))bad('INVALID_USER',401);
 return (await store.list(userId)).map(publicDemoRow);
}
export async function connectDemo(userId,input,{store,env=process.env,reader=readDemoBroker,uuid=randomUUID,now=Date.now}={}){
 ensureDemoEnabled(env);if(!UUID.test(userId))bad('INVALID_USER',401);
 if(!exact(input,['provider','environment','apiKey','secret','confirmation']))bad('INVALID_REQUEST');
 const environment=providerEnv(input.provider);
 if(input.environment!==environment)bad('LIVE_DISABLED');
 if(input.confirmation!==DEMO_CONSENT)bad('DEMO_CONSENT_REQUIRED');
 if(typeof input.apiKey!=='string'||typeof input.secret!=='string'||input.apiKey.length>256||input.secret.length>256)bad('INVALID_CREDENTIAL_FORMAT');
 const existing=await store.findByScope(userId,input.provider,environment);
 if(existing?.status==='active')bad('EXISTING_DEMO_CONNECTION',409);
 if(!(await store.claimConnectAttempt(userId,input.provider)))bad('CONNECT_COOLDOWN_60_SECONDS',429);
 const checkedAt=current(now);
 const result=await reader({provider:input.provider,environment,apiKey:input.apiKey,secret:input.secret},{now:()=>checkedAt});
 const id=uuid(),dig=digestDemoAccount(result.accountRef,{userId,provider:input.provider,environment},env);
 buildDemoAssociation({userId,provider:input.provider,environment,externalReferenceDigest:dig,observation:result.observation},{now:()=>checkedAt});
 const row={id,user_id:userId,provider:input.provider,environment,status:'active',revision:1,
  credential_box:encryptDemo({apiKey:input.apiKey,secret:input.secret},scope(userId,id,input.provider,environment,'credentials'),env),
  snapshot_box:encryptDemo(result.snapshot,scope(userId,id,input.provider,environment,'snapshot'),env),
  external_digest:dig,identity_verified:result.identityVerified,position_count:result.snapshot.positions.length,
  open_order_count:result.snapshot.openOrders.length,last_sync_at:new Date(checkedAt).toISOString(),sync_lease_until:'1970-01-01T00:00:00.000Z',last_error_code:null};
 if(existing?.status==='revoked'&&!(await store.removeRevoked(userId,existing.id)))bad('CONNECTION_RACE',409);
 if(existing&&existing.status!=='revoked')bad('CONNECTION_RACE',409);
 return publicDemoRow(await store.insert(row));
}
export async function syncDemo(userId,id,{store,env=process.env,reader=readDemoBroker,now=Date.now}={}){
 ensureDemoEnabled(env);if(!UUID.test(userId))bad('INVALID_USER',401);if(!UUID.test(id))bad('INVALID_CONNECTION_ID');
 const row=await store.findById(userId,id);if(!row||row.status!=='active')bad('CONNECTION_NOT_FOUND',404);
 const checkedAt=current(now),previousTime=Date.parse(row.last_sync_at);
 // Full-account Binance open-orders GET has high weight; do not permit rapid re-polling.
 if(!Number.isFinite(previousTime)||checkedAt-previousTime<120000)bad('SYNC_INTERVAL_120_SECONDS',429);
 const acquired=await store.claimSync(userId,row,new Date(checkedAt).toISOString(),new Date(checkedAt+30000).toISOString());
 if(!acquired)bad('SYNC_IN_PROGRESS',409);
 try{
  const credentials=decryptDemo(row.credential_box,scope(userId,id,row.provider,row.environment,'credentials'),env);
  const result=await reader({provider:row.provider,environment:row.environment,...credentials},{now:()=>checkedAt});
  const digest=digestDemoAccount(result.accountRef,{userId,provider:row.provider,environment:row.environment},env);
  if(digest!==row.external_digest)bad('EXTERNAL_ACCOUNT_CHANGED',409);
  const previous=decryptDemo(row.snapshot_box,scope(userId,id,row.provider,row.environment,'snapshot'),env);
  const recon=reconcileDemoSnapshots(previous,result.snapshot);
  const updates={snapshot_box:encryptDemo(result.snapshot,scope(userId,id,row.provider,row.environment,'snapshot'),env),
   identity_verified:result.identityVerified,position_count:result.snapshot.positions.length,open_order_count:result.snapshot.openOrders.length,
   last_sync_at:new Date(checkedAt).toISOString(),last_error_code:null};
  if(!(await store.finishSync(userId,row,updates)))bad('CONNECTION_CHANGED_DURING_SYNC',409);
  return {connection:publicDemoRow({...row,...updates}),reconciliation:{changeCount:recon.changeCount,
   reviewRequired:recon.reviewRequired,missingPositions:recon.positions.missing.length,missingOpenOrders:recon.orders.missing.length,
   cannotInferFillOrClose:true,performanceVerified:false,protectionVerified:false}};
 }catch(error){
  const safe=['EXTERNAL_ACCOUNT_CHANGED','CONNECTION_CHANGED_DURING_SYNC','INVALID_PROVIDER_RESPONSE','PROVIDER_NETWORK_UNAVAILABLE','PROVIDER_401','PROVIDER_403','PROVIDER_429','PROVIDER_451','PROVIDER_UNAVAILABLE','PAGINATION_REQUIRED','INCOMPLETE_PROVIDER_LIST'].includes(error?.code)?error.code:'DEMO_READ_FAILED';
  await store.releaseSync(userId,row,safe).catch(()=>{});
  // Never expose a provider error payload, key or secret in API responses.
  bad(safe, ['EXTERNAL_ACCOUNT_CHANGED','CONNECTION_CHANGED_DURING_SYNC'].includes(safe)?409:503);
 }
}
export async function revokeDemo(userId,id,{store,env=process.env}={}){
 ensureDemoEnabled(env);if(!UUID.test(userId))bad('INVALID_USER',401);if(!UUID.test(id))bad('INVALID_CONNECTION_ID');
 const row=await store.findById(userId,id);
 if(!row)bad('CONNECTION_NOT_FOUND',404);
 if(row.status==='revoked')return {id,revoked:true,providerRevocationRequired:true};
 if(row.status!=='active')bad('CONNECTION_NOT_FOUND',404);
 if(!(await store.revoke(userId,row)))bad('CONNECTION_RACE',409);
 return {id,revoked:true,providerRevocationRequired:true,
  message:'Vínculo local revogado. Revogue também a chave diretamente na corretora; isso não cancela ordens nem encerra posições.'};
}
