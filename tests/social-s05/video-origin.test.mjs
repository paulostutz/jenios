import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {samePublicVideoBucket} from '../../lib/social/video-playback.mjs';
import {stagingRouteDecision} from '../../lib/staging/route-policy.mjs';
const src='https://lab.supabase.co/storage/v1/object/public/social-media/original.mov';
test('public variants from same origin/bucket may be played',()=>{
 assert.equal(samePublicVideoBucket(src,'https://lab.supabase.co/storage/v1/object/public/social-media/optimized.mp4'),true);
});
for(const bad of ['https://evil.test/storage/v1/object/public/social-media/x.mp4','https://lab.supabase.co/storage/v1/object/public/other-bucket/x.mp4','http://lab.supabase.co/storage/v1/object/public/social-media/x.mp4','javascript:alert(1)','https://lab.supabase.co@evil.test/storage/v1/object/public/social-media/x.mp4'])
 test('block untrusted optimized video: '+bad.slice(0,50),()=>assert.equal(samePublicVideoBucket(src,bad),false));
test('readiness is permitted only by GET in isolated lab and no transcode POST is exposed',()=>{
 assert.equal(stagingRouteDecision('/api/s05/video-readiness','GET'),'allow');
 for(const method of ['POST','PUT','DELETE'])assert.equal(stagingRouteDecision('/api/s05/video-readiness',method),'block');
 assert.equal(stagingRouteDecision('/api/social/video','POST'),'block');
 const route=readFileSync('app/api/s05/video-readiness/route.js','utf8');assert.doesNotMatch(route,/writeFile|optimizeStoredVideo|execFile|\/api\/jenios-pay/);
});
test('player validates bucket before caching optimized response',()=>{
 const s=readFileSync('app/components/SocialVideo.js','utf8');assert.match(s,/samePublicVideoBucket\(src,result.url\)/);
 assert.match(s,/src=\{display\}/);
});
