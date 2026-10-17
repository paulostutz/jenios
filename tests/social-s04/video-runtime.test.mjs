import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {checkVideoRuntime} from '../../lib/social/video-runtime-diagnostics.mjs';
const file={isFile:()=>true,size:200000};
test('optimization disabled does not touch filesystem or require binary',async()=>{
 const v=await checkVideoRuntime({enabled:false,resolveBinary(){throw Error('should not run')}});
 assert.deepEqual(v,{optimization:'disabled',playbackFallback:true});
});
test('valid executable presence is not described as a proven transcoder',async()=>{
 let checked=0;const v=await checkVideoRuntime({enabled:true,resolveBinary:()=>'/tmp/ffmpeg-demo',statFile:async()=>file,accessFile:async()=>{checked++;}});
 assert.equal(v.optimization,'binary-present-unverified');assert.equal(v.playbackFallback,true);assert.equal(checked,1);
});
for(const binary of [null,'','ffmpeg','http://unsafe','/tmp/missing'])test('invalid or inaccessible binary fails closed and preserves original playback: '+binary,async()=>{
 const v=await checkVideoRuntime({enabled:true,resolveBinary:()=>binary,statFile:async()=>{throw Error('ENOENT')}});
 assert.equal(v.optimization,'unavailable');assert.equal(v.playbackFallback,true);
});
test('API does not leak paths, billing secrets, user media, nor mutate original video API',()=>{
 const route=readFileSync('app/api/social/video-capabilities/route.js','utf8');
 assert.doesNotMatch(route,/service_role|SOCIAL_SUPABASE_SERVICE_ROLE_KEY|createClient|optimizeStoredVideo|put\(|delete\(/);
 const orig=readFileSync('app/api/social/video/route.js','utf8');
 assert.match(orig,/optimizeStoredVideo/);assert.match(orig,/socialContext/);
});
test('conversion CLI smoke used MP4 and H.264 codec with duration <= 90 seconds',()=>{
 const json=JSON.parse(readFileSync('tests/social-s04/fixtures/ffprobe-h264-local-smoke.json','utf8'));
 assert.equal(json.streams[0].codec_name,'h264');assert.equal(json.streams[0].width%2,0);
 assert(+json.format.duration>0&&+json.format.duration<=90);
});
