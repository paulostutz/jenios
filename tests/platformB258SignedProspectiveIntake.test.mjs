import test from 'node:test';import assert from 'node:assert/strict';
import {generateKeyPairSync,createHash,sign} from 'node:crypto';
import {auditSignedProspectiveChain,prospectiveSignaturePayload} from '../lib/platform/release260/b258-signed-prospective-intake.mjs';
const {privateKey,publicKey}=generateKeyPairSync('ed25519');const key=publicKey.export({format:'pem',type:'spki'});
const fingerprint=createHash('sha256').update(publicKey.export({format:'der',type:'spki'})).digest('hex');
const now=1792573000000,CORE='9341d9243cbe742b90bf40149663e632fc472f5586c74bf70bdfcfd114e65aea';
const params={expectedPublicKeyPem:key,expectedKeyFingerprint:fingerprint,nowMs:now};
function sample(rowsModes=['direct','reverse','hybrid']){
 let previous='0'.repeat(64);return rowsModes.map((mode,i)=>{
  const data={eventId:`synthetic-${i}`,mode,asset:'BTCUSDT',signalAtMs:now-50000+i*10000,
    closeAtMs:now-49000+i*10000,recordedAtMs:now-48000+i*10000,
    originalCoreSha256:CORE,previousDigest:previous};
  const signature=sign(null,Buffer.from(prospectiveSignaturePayload(data)),privateKey);
  previous=createHash('sha256').update(prospectiveSignaturePayload(data)).update(signature).digest('hex');
  return {...data,signatureBase64:signature.toString('base64')};
 });
}
test('B258 valid ephemeral QA Ed25519 chain validates bytes, not market independence',()=>{
 const v=auditSignedProspectiveChain(sample(),params);
 assert.equal(v.signatureCryptographicallyValid,true);assert.equal(v.samples,3);
 assert.equal(v.independentWitnessIdentityVerified,false);assert.equal(v.profitabilityCertified,false);
 assert.equal(v.liveExecutionAuthorized,false);
});
test('B258 tampered signed mode, time or previous digest cannot pass',()=>{
 for(const patch of [{mode:'hybrid'},{signalAtMs:now+1},{previousDigest:'f'.repeat(64)},
  {originalCoreSha256:'f'.repeat(64)}]){
  const rows=sample();rows[1]={...rows[1],...patch};
  assert.throws(()=>auditSignedProspectiveChain(rows,params));
 }
});
test('B258 forged key identity and duplicate event never pass',()=>{
 assert.throws(()=>auditSignedProspectiveChain(sample(),{...params,expectedKeyFingerprint:'f'.repeat(64)}),
   /PROSPECTIVE_PINNED_WITNESS_KEY_MISMATCH/);
 const rows=sample();rows[1]={...rows[1],eventId:rows[0].eventId};
 assert.throws(()=>auditSignedProspectiveChain(rows,params));
});
