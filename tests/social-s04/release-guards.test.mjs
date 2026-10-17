import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
const PROTECTED={
 'app/api/social/media/route.js':'630ab943013387abe3c8bf2e470d16639f3666a6',
 'app/api/social/video/route.js':'ebea4fbeedbde009bd886c0242eaaee63f81f0a7',
 'app/api/jenios-pay/checkout/route.js':'c429cfce6663def02e8ad415f30954378f25cb9c',
 'app/api/bankscore/detailed/route.js':'38c9575aeabccf01c18a10aad95ee93f4c9b64ad',
 'app/api/crypto-validator/detailed/route.js':'80d7104321b06a0645e5b32a22f0b1bfe1b60e5c',
 'app/api/admin/consultas/route.js':'50551e483a28224a81222f6dee26f2f21b7ddc75',
 'lib/pay/access.mjs':'4f1818185dae747aabfbdeacc3312677c700437d',
 'lib/social/video-processing.mjs':'9fadbc0eb070f287fd8d4495587ec9d4eebd18e6',
};
for(const [path,expected] of Object.entries(PROTECTED))test('protected S02 Git object remains byte-identical '+path,()=>{
 const b=readFileSync(path),hash=createHash('sha1').update(`blob ${b.length}\0`).update(b).digest('hex');
 assert.equal(hash,expected);
});
test('review-only migrations do not appear in deployed migrations',()=>{
 const items=readdirSync('supabase/migrations');
 assert(items.every(name=>!/(s03|s04|trial|deletion|identity_candidate)/i.test(name)));
 for(const f of ['supabase/review-only/20261017_s04_deletion_state_machine_STAGING_ONLY.sql','supabase/review-only/20261017_s03_platform_trial_STAGING_ONLY.sql'])
   assert.match(readFileSync(f,'utf8'),/STAGING|REVIEW|PROPOSAL ONLY/i);
});
test('trial/grant module cannot make payments or grant paid entitlements',()=>{
 for(const p of ['lib/platform/trial/trial-http.mjs','lib/platform/trial/verified-person-provider.mjs','app/api/platform/trial/route.js']){
  const s=readFileSync(p,'utf8');assert.doesNotMatch(s,/checkoutService|createOrder|markPaid|BancoInter|PIX|placeTrade/);
 }
});
test('no direct admin privileges in public signup; paid/admin source unchanged',()=>{
 const signup=readFileSync('lib/social/signup-policy.mjs','utf8');
 assert.doesNotMatch(signup,/app_metadata|service_role|is_admin|reports\.run/);
 assert.match(signup,/registration_source:'social'/);
});
