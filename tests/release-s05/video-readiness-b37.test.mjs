import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {checkVideoRuntime} from '../../lib/social/video-runtime-diagnostics.mjs';
const read=p=>readFileSync(p,'utf8');
test('S05 readiness disabled by default; original video always playable',async()=>{
 const state=await checkVideoRuntime({enabled:false,resolveBinary:()=>{throw Error('should not touch binary')}});
 assert.deepEqual(state,{optimization:'disabled',playbackFallback:true});
});
test('S05 FFmpeg missing never blocks video',async()=>{
 const state=await checkVideoRuntime({enabled:true,resolveBinary:()=>{throw Error('not found')}});
 assert.deepEqual(state,{optimization:'unavailable',playbackFallback:true});
});
test('S05 FFmpeg file presence is not automatically certified as transcoding',async()=>{
 const state=await checkVideoRuntime({enabled:true,resolveBinary:()=>'/tmp/mock-ffmpeg',statFile:async()=>({isFile:()=>true,size:1000000}),accessFile:async()=>{}});
 assert.deepEqual(state,{optimization:'binary-present-unverified',playbackFallback:true});
});
test('S05 an invalid executable path never leaks it or allows transcoding',async()=>{
 for(const path of ['ffmpeg','/','https://evil.invalid/bin','/tmp/'+'x'.repeat(510)]){
  const value=await checkVideoRuntime({enabled:true,resolveBinary:()=>path});
  assert.deepEqual(value,{optimization:'unavailable',playbackFallback:true});
 }
});
test('S05 video diagnostic route is read-only, never exposes binaries or initiates operations',()=>{
 const s=read('app/api/social/video-capabilities/route.js');
 assert.match(s,/export async function GET\(\)/);
 assert.doesNotMatch(s,/export async function POST|execFile|spawn\(|unlink|writeFile|deleteObject/);
 assert.match(s,/Cache-Control.*no-store/);
 assert.match(s,/checkVideoRuntime/);
});
test('S05 preview smoke refuses production host and never provisions user or payment',()=>{
 const s=read('scripts/check-s05-public-preview.mjs');
 assert.match(s,/S05_PREVIEW_MUST_BE_ISOLATED_VERCEL_HOST/);
 assert.match(s,/vercel\\\.app/);
 assert.doesNotMatch(s,/signUp\(|signInWithPassword|\/auth\/v1\/admin|\/api\/jenios-pay|payments/);
 assert.match(s,/unauthenticated signed-media upload is denied/);
});
