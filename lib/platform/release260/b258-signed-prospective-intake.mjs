/** B258: cryptographic provenance *format* for future operator-reviewed observations.
 * A valid Ed25519 signature proves the holder of a key signed bytes; it does NOT
 * prove that issuer is independent, prices are real, or private robot is profitable.
 */
import {createHash,verify,createPublicKey} from 'node:crypto';
const deny=c=>{throw Object.assign(new Error(c),{code:c});};
const modes=new Set(['direct','reverse','hybrid']);
const assets=new Set(['BTCUSDT','ETHUSDT','SOLUSDT']);
const SHA=/^[a-f0-9]{64}$/;
const ID=/^[A-Za-z0-9._:-]{1,96}$/;
const CORE='9341d9243cbe742b90bf40149663e632fc472f5586c74bf70bdfcfd114e65aea';
function payload(row){return JSON.stringify([row.eventId,row.mode,row.asset,
 row.signalAtMs,row.closeAtMs,row.recordedAtMs,row.originalCoreSha256,row.previousDigest]);}
export function auditSignedProspectiveChain(rows,{expectedPublicKeyPem,expectedKeyFingerprint,nowMs}={}){
 if(!Array.isArray(rows)||rows.length<1||rows.length>500||
   !Number.isSafeInteger(nowMs)||nowMs<=0||!SHA.test(expectedKeyFingerprint||'')||
   typeof expectedPublicKeyPem!=='string'||expectedPublicKeyPem.length>4096)
   deny('INVALID_PROSPECTIVE_INTAKE');
 let key;
 try{key=createPublicKey(expectedPublicKeyPem);if(key.asymmetricKeyType!=='ed25519')deny('ED25519_ONLY');}
 catch{deny('INVALID_PROSPECTIVE_WITNESS_KEY');}
 const keyFingerprint=createHash('sha256').update(key.export({type:'spki',format:'der'})).digest('hex');
 if(keyFingerprint!==expectedKeyFingerprint)deny('PROSPECTIVE_PINNED_WITNESS_KEY_MISMATCH');
 const seen=new Set();let previous='0'.repeat(64),lastSignal=0,lastRecorded=0;
 const byMode={direct:0,reverse:0,hybrid:0};
 for(const row of rows){
   if(!row||!ID.test(row.eventId||'')||seen.has(row.eventId)||
     !modes.has(row.mode)||!assets.has(row.asset)||row.originalCoreSha256!==CORE||
     row.previousDigest!==previous||!Number.isSafeInteger(row.signalAtMs)||
     !Number.isSafeInteger(row.closeAtMs)||!Number.isSafeInteger(row.recordedAtMs)||
     row.signalAtMs<=lastSignal||row.signalAtMs>=row.closeAtMs||
     row.closeAtMs>row.recordedAtMs||row.recordedAtMs<lastRecorded||
     row.recordedAtMs>nowMs||nowMs-row.recordedAtMs>30*86400000||
     typeof row.signatureBase64!=='string'||row.signatureBase64.length>256)
     deny('INVALID_OR_LOOKAHEAD_PROSPECTIVE_ENTRY');
   let signature;
   try{signature=Buffer.from(row.signatureBase64,'base64');}catch{deny('INVALID_PROSPECTIVE_SIGNATURE');}
   if(signature.length!==64||!verify(null,Buffer.from(payload(row)),key,signature))
     deny('INVALID_PROSPECTIVE_SIGNATURE');
   seen.add(row.eventId);byMode[row.mode]++;lastSignal=row.signalAtMs;
   lastRecorded=row.recordedAtMs;
   previous=createHash('sha256').update(payload(row)).update(signature).digest('hex');
 }
 return Object.freeze({schema:'JENIOS_B258_SIGNED_PROSPECTIVE_INTAKE',samples:rows.length,
   witnessKeyFingerprint:keyFingerprint,chainHeadSha256:previous,byMode:Object.freeze(byMode),
   signatureCryptographicallyValid:true,independentWitnessIdentityVerified:false,
   observedMarketDataExternallyVerified:false,originalRobotDecisionsAttested:false,
   futureMarketReturnVerified:false,profitabilityCertified:false,
   cashAtRisk:false,ordersSent:0,liveExecutionAuthorized:false});
}
export function prospectiveSignaturePayload(row){return payload(row);}
