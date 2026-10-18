import test from 'node:test';import assert from 'node:assert/strict';
import {inspectS05VideoBinary} from '../../scripts/check-s05-video-runtime.mjs';
test('missing FFmpeg is a recorded limitation, not a reason to hide original media',async()=>{
 const r=await inspectS05VideoBinary({resolveBinary:()=>{throw Error('missing binary path /home/secret/private-file');}});
 assert.deepEqual(r,{transcoder:'unavailable',optimizedPlaybackEnabled:false,originalFallback:true});
 assert.equal(JSON.stringify(r).includes('private-file'),false);
});
test('FFmpeg read-only diagnostic never switches on optimized delivery',async()=>{
 const r=await inspectS05VideoBinary({resolveBinary:()=>null});
 assert.equal(r.optimizedPlaybackEnabled,false);assert.equal(r.originalFallback,true);
});
