import test from 'node:test';import assert from 'node:assert/strict';
import {verifyIdentityWithProvider} from '../../lib/platform/trial/verified-person-provider.mjs';
import {personDigest,TRIAL_DURATION_MS,trialAccessWindow} from '../../lib/platform/trial/person-ledger.mjs';
import {readFileSync} from 'node:fs';
const userId='11111111-1111-4111-8111-111111118802';
const opts={apiKey:'testing-secret-only-not-production'.repeat(2),fetcher:async()=>{throw Error('network must not be used');}};
for(const endpoint of ['https://127.0.0.1/test','https://169.254.169.254/latest/meta-data','https://10.1.2.3/verify','https://[::1]/verify','https://identity.internal/verify','https://identity.local/verify','http://provider.example/verify','https://any.test/verify']){
 test('untrusted verification endpoint cannot receive tokens: '+endpoint,async()=>{
  await assert.rejects(verifyIdentityWithProvider({userId,verificationToken:'verification-token-'+ 'a'.repeat(35)},{...opts,endpoint}),{status:503});
 });
}
test('trial uses per-person cryptographic digest and exactly 168 hours',()=>{
 const pepper='unit-test-only-pepper-very-long-1234567890';const a=personDigest('52998224725',pepper);
 assert.match(a,/^[a-f0-9]{64}$/);assert.equal(a.includes('52998224725'),false);assert.equal(TRIAL_DURATION_MS,168*60*60*1000);
 const now=Date.parse('2026-10-18T00:00:00Z');assert.equal(trialAccessWindow('2026-10-11T00:00:00Z',now).active,false);
});
test('trial activation remains gated behind two server-side toggles and no identity provider is configured',()=>{
 const s=readFileSync('app/api/platform/trial/route.js','utf8');
 assert.match(s,/JENIOS_TRIAL_ENABLED/);assert.match(s,/JENIOS_TRIAL_ACTIVATION_APPROVED/);
 assert.doesNotMatch(s,/PAY_ADMIN_TOKEN|inter\/pix|paymentIntent|chargeCustomer/);
});
