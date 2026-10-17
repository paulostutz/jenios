import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {shouldRequestVideoVariant,playbackSource,nextVideoVariant} from '../../lib/social/video-playback.mjs';
const src='https://example.supabase.co/storage/v1/object/public/social-media/abc/video.mp4';
const id='11111111-1111-4111-8111-111111111111';
for (const enabled of [false,undefined,null,'true']) test('video optimization is off without an explicit boolean true '+String(enabled),()=>{
 assert.equal(shouldRequestVideoVariant({enabled,postId:id,src}),false);
});
test('valid public video can request variant only if explicitly enabled',()=>assert.equal(shouldRequestVideoVariant({enabled:true,postId:id,src}),true));
for(const bad of ['http://example.test/video.mp4','https://example.test/video.mp4','https://example.test/storage/v1/object/public/a-stream-v1.mp4'])test('reject unsafe or already optimized input',()=>assert.equal(shouldRequestVideoVariant({enabled:true,postId:id,src:bad}),false));
test('reject malformed post id',()=>assert.equal(shouldRequestVideoVariant({enabled:true,postId:'not-valid',src}),false));
test('original video always starts immediately in viewport without requiring optimization',()=>{
 assert.equal(playbackSource({near:true,original:src}),src);
 assert.equal(playbackSource({near:false,original:src,variant:'https://a.test/variant.mp4'}),undefined);
 assert.equal(playbackSource({near:true,original:src,variant:'https://a.test/variant.mp4'}),'https://a.test/variant.mp4');
 assert.equal(playbackSource({near:true,original:src,variant:'javascript:alert(1)'}),src);
});
test('bounded variant cache evicts oldest and never stores invalid URLs',()=>{
 const cache=new Map();assert.equal(nextVideoVariant(cache,'a','https://example.com/1.mp4',2),true);
 assert.equal(nextVideoVariant(cache,'b','https://example.com/2.mp4',2),true);
 assert.equal(nextVideoVariant(cache,'c','https://example.com/3.mp4',2),true);
 assert.equal(cache.has('a'),false);assert.equal(cache.size,2);
 assert.equal(nextVideoVariant(cache,'d','http://plain.test/video.mp4',2),false);assert.equal(cache.size,2);
});
test('SocialVideo does not gate video src on a transcode result, keeps pause and one-video focus',()=>{
 const src=readFileSync('app/components/SocialVideo.js','utf8');
 assert.match(src,/playbackSource\(\{near,original:src,variant:url\}\)/);
 assert.match(src,/src=\{display\}/);assert.match(src,/IntersectionObserver/);
 assert.match(src,/jenios:video-play/);assert.doesNotMatch(src,/near&&!needsProcessing/);
});
test('media and upload authentication routes are unchanged in the S03 working tree',()=>{
 for(const p of ['app/api/social/video/route.js','app/api/social/media/route.js'])assert.match(readFileSync(p,'utf8'),/requirePayToken|socialContext/);
});
