import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
// Git object digests independently recorded from the deployed release af86e69e...
// Any change to these files must be separately reviewed and must fail this S03 gate.
const PINNED={
 'app/api/social/media/route.js':'630ab943013387abe3c8bf2e470d16639f3666a6',
 'app/api/social/video/route.js':'ebea4fbeedbde009bd886c0242eaaee63f81f0a7',
 'app/api/jenios-pay/checkout/route.js':'c429cfce6663def02e8ad415f30954378f25cb9c',
 'app/api/bankscore/detailed/route.js':'38c9575aeabccf01c18a10aad95ee93f4c9b64ad',
 'app/api/crypto-validator/detailed/route.js':'80d7104321b06a0645e5b32a22f0b1bfe1b60e5c',
 'app/api/admin/consultas/route.js':'50551e483a28224a81222f6dee26f2f21b7ddc75',
 'lib/pay/access.mjs':'4f1818185dae747aabfbdeacc3312677c700437d',
 'lib/social/video-processing.mjs':'9fadbc0eb070f287fd8d4495587ec9d4eebd18e6',
};
for(const [path,expected] of Object.entries(PINNED)){
 test('S03 preserved production Git object: '+path,()=>{
  const bytes=readFileSync(path);const h=createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
  assert.equal(h,expected);
 });
}
test('staging review SQL is never in the applied migrations directory',()=>{
 for(const file of readdirSync('supabase/migrations'))assert.doesNotMatch(file,/S03|trial|identity_candidate/i);
});
