/** B92 — server-side CONTRACT to accept non-executable snapshots from an isolated
 * private research runner. Proprietary engine source is NOT shipped here.
 * HMAC authenticates a message to the bridge, not broker orders or performance.
 */
import {createHmac,timingSafeEqual} from 'node:crypto';

export const B92_SCHEMA='JENIOS_R45_PRIVATE_RESEARCH_V1';
export const PINNED_ENGINE_SHA256='9341d9243cbe742b90bf40149663e632fc472f5586c74bf70bdfcfd114e65aea';
export const PRIVATE_RESEARCH_MODES=Object.freeze(['direct','reverse','hybrid']);
const SHA=/^[a-f0-9]{64}$/;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
function payloadFields(e) {
 return [e?.schema,e?.engineSha256,e?.mode,e?.eventId,e?.observationSha256,
  e?.asset,e?.decisionAtMs,e?.side,e?.declaredSandbox===true,
  e?.realExecutionAllowed===false];
}
function canonicalPayload(e){return JSON.stringify(payloadFields(e));}
const deny=reason=>Object.freeze({valid:false,reason,privateCoreLoaded:false,
  runtimeBytesVerified:false,realExecutionAllowed:false,performanceCertified:false});
export function verifyPrivateModeEnvelope(envelope,{secret,now=Date.now(),maxAgeMs=120000}={}){
 if(typeof secret!=='string'||secret.length<32||!Number.isFinite(now)||
  !Number.isSafeInteger(maxAgeMs)||maxAgeMs<1000||maxAgeMs>300000)
  return deny('SECURE_BRIDGE_NOT_CONFIGURED');
 const e=envelope;
 if(!e||typeof e!=='object'||Array.isArray(e)||e.schema!==B92_SCHEMA||
   e.engineSha256!==PINNED_ENGINE_SHA256||!PRIVATE_RESEARCH_MODES.includes(e.mode)||
   !UUID.test(String(e.eventId||''))||!SHA.test(String(e.observationSha256||''))||
   typeof e.asset!=='string'||!(/^[A-Z0-9:!._-]{1,35}$/).test(e.asset)||
   !Number.isSafeInteger(e.decisionAtMs)||e.decisionAtMs<1||
   e.decisionAtMs>now+5000||now-e.decisionAtMs>maxAgeMs||
   ![null,'buy','sell'].includes(e.side)||
   e.declaredSandbox!==true||e.realExecutionAllowed!==false||
   typeof e.hmacSha256!=='string'||!SHA.test(e.hmacSha256))
  return deny('INVALID_OR_STALE_RESEARCH_ENVELOPE');
 // Only the declared, allowlisted research fields are signed. Extra
 // claims (profit, entitlement, permission) are discarded entirely.
 const signature=createHmac('sha256',secret).update(canonicalPayload(e)).digest();
 const provided=Buffer.from(e.hmacSha256,'hex');
 if(provided.length!==signature.length||!timingSafeEqual(signature,provided))
  return deny('UNAUTHENTICATED_PRIVATE_MESSAGE');
 return Object.freeze({valid:true,mode:e.mode,side:e.side,asset:e.asset,
  decisionAtMs:e.decisionAtMs,eventId:e.eventId,observationSha256:e.observationSha256,
  engineHashPinned:true,authenticatedBridgeMessage:true,
  privateCoreLoaded:false,runtimeBytesVerified:false,
  realExecutionAllowed:false,performanceCertified:false,
  source:'private_runner_claim_not_production_connected'});
}
export function comparePrivateModeEnvelopes(results) {
 if(!Array.isArray(results)||results.length!==3||!results.every(x=>x?.valid))
  return deny('UNVERIFIED_OR_INCOMPLETE_MODES');
 const modes=new Set(results.map(x=>x.mode));
 if(modes.size!==3||PRIVATE_RESEARCH_MODES.some(m=>!modes.has(m))||
   results.some(x=>x.observationSha256!==results[0].observationSha256||
    x.asset!==results[0].asset||x.decisionAtMs!==results[0].decisionAtMs))
  return deny('NON_COMPARABLE_OR_REPLAYED_MODE_INPUTS');
 return {valid:true,source:'private_runner_claim_not_production_connected',
  sideByMode:Object.fromEntries(results.map(x=>[x.mode,x.side])),
  sharedObservationSha256:results[0].observationSha256,
  privateCoreLoaded:false,runtimeBytesVerified:false,
  performanceCertified:false,realExecutionAllowed:false};
}
