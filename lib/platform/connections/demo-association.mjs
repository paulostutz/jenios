/** B162 — association contract for an authenticated DEMO/PAPER read.
 * This module does not receive credentials, persist state, call a broker, or authorize orders.
 */
import {timingSafeEqual} from 'node:crypto';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DIGEST=/^[0-9a-f]{64}$/;
const MAX_AGE_MS=30_000;
const fail=code=>{throw Object.assign(new Error(code),{code});};
const exactKeys=(value,allowed)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(k=>allowed.includes(k));

function providerEnvironment(provider,environment){
 if(provider==='binance'&&environment==='testnet')return;
 if(provider==='alpaca'&&environment==='paper')return;
 fail('DEMO_ENVIRONMENT_REQUIRED');
}
function userId(value){if(typeof value!=='string'||!UUID.test(value))fail('INVALID_PLATFORM_USER');return value.toLowerCase();}
function digest(value){if(typeof value!=='string'||!DIGEST.test(value))fail('INVALID_ACCOUNT_REFERENCE');return value;}
function time(value){if(!Number.isSafeInteger(value)||value<0)fail('INVALID_OBSERVATION_TIME');return value;}

export function buildDemoAssociation(input,{now=Date.now}={}){
 if(!exactKeys(input,['userId','provider','environment','externalReferenceDigest','observation']))fail('INVALID_ASSOCIATION_FIELDS');
 const owner=userId(input.userId),provider=input.provider,environment=input.environment;
 providerEnvironment(provider,environment);const externalReferenceDigest=digest(input.externalReferenceDigest);
 const observation=input.observation;
 if(!exactKeys(observation,['ok','provider','environment','accountReadConfirmed','summary','linkedToJenios','liveExecution','ordersSent','credentialsStored','observedAtMs']))fail('INVALID_OBSERVATION');
 if(observation.ok!==true||observation.accountReadConfirmed!==true||observation.provider!==provider||observation.environment!==environment)fail('AUTHENTICATED_READ_REQUIRED');
 if(observation.linkedToJenios!==false||observation.liveExecution!==false||observation.ordersSent!==0||observation.credentialsStored!==false)fail('UNSAFE_READER_STATE');
 if(!observation.summary||typeof observation.summary!=='object'||Array.isArray(observation.summary)||observation.summary.permissionsVerified!==false)fail('PERMISSIONS_NOT_EXPLICITLY_UNVERIFIED');
 const observedAtMs=time(observation.observedAtMs),current=time(now());
 if(observedAtMs>current+1000||current-observedAtMs>MAX_AGE_MS)fail('STALE_AUTHENTICATED_READ');
 return Object.freeze({
  schema:'JENIOS_DEMO_ASSOCIATION_B162',
  ownerUserId:owner,provider,environment,externalReferenceDigest,
  associatedAtMs:current,lastAuthenticatedReadAtMs:observedAtMs,
  associationConfirmed:true,accountReadConfirmed:true,permissionsVerified:false,
  positionsVerified:false,openOrdersVerified:false,protectionVerified:false,
  connected:false,liveExecution:false,ordersSent:0,custody:false
 });
}

export function assertDemoAssociationOwner(sessionUserId,association){
 const owner=userId(sessionUserId);
 if(!association||association.schema!=='JENIOS_DEMO_ASSOCIATION_B162'||association.associationConfirmed!==true)fail('INVALID_ASSOCIATION');
 const expected=Buffer.from(owner),actual=Buffer.from(String(association.ownerUserId||''));
 if(expected.length!==actual.length||!timingSafeEqual(expected,actual))fail('ACCOUNT_OWNER_MISMATCH');
 providerEnvironment(association.provider,association.environment);digest(association.externalReferenceDigest);
 if(association.connected!==false||association.liveExecution!==false||association.ordersSent!==0||association.custody!==false)fail('UNSAFE_ASSOCIATION_STATE');
 return association;
}

export function publicDemoAssociation(association,now=Date.now()){
 assertDemoAssociationOwner(association?.ownerUserId,association);const current=time(now);
 return Object.freeze({
  provider:association.provider,environment:association.environment,
  associationConfirmed:true,accountReadConfirmed:true,
  lastAuthenticatedReadAtMs:association.lastAuthenticatedReadAtMs,
  stale:current-association.lastAuthenticatedReadAtMs>MAX_AGE_MS,
  permissionsVerified:false,positionsVerified:false,openOrdersVerified:false,
  protectionVerified:false,connected:false,liveExecution:false,ordersSent:0,custody:false
 });
}
