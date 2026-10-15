import test from 'node:test';import assert from 'node:assert/strict';
import {adminPermissions} from '../lib/admin-access.mjs';
import {trendAlertBatches} from '../lib/trend-alerts.mjs';
import {interConfiguration} from '../lib/pay/inter-diagnostics.mjs';
import {videoVariantPath,videoArgs} from '../lib/social/video-processing.mjs';
const db=permissions=>({from(){return {select(){return {eq:async()=>({data:permissions.map(permission=>({permission})),error:null})}}}}});
test('admin permissions trust server grants and app metadata only',async()=>{
 const user={id:'user',user_metadata:{role:'admin',permissions:['permissions.manage']},app_metadata:{}};
 assert.deepEqual(await adminPermissions(db([]),user,{}),[]);
 assert.deepEqual(await adminPermissions(db(['reports.run']),user,{}),['reports.run']);
 assert.deepEqual(await adminPermissions(db(['reports.run']),{...user,is_anonymous:true},{}),[]);
 assert((await adminPermissions(db([]),{...user,app_metadata:{role:'admin'}},{})).includes('permissions.manage'));
});
test('alerts reject historical whales, stale quotes and stale lookup results',()=>{
 const data={tokens:[{id:'x'}],megapulse:[],baleias:[{id:'hash'}],modulos:{tokens:{disponivel:true,stale:true},baleias:{disponivel:true,historico:true},megapulse:{disponivel:false}}};
 assert.deepEqual(trendAlertBatches(data,{disponivel:false}),[]);
 data.modulos.baleias.historico=false;assert.deepEqual(trendAlertBatches(data,null)[0].keys,['hash']);
});
test('radar alerts deduplicate token IDs and identify candidates as observation',()=>{const batches=trendAlertBatches(null,{disponivel:true,candidatos:[{id:'a'},{id:'a'},{id:'b'}]});assert.deepEqual(batches[0].keys,['a','b']);assert.match(batches[0].body,/observação/);});
test('diagnostic exposes presence and status, never secrets',()=>{const env={INTER_CLIENT_ID:'secret-client-id',INTER_CLIENT_SECRET:'secret-value',INTER_CERTIFICATE:'bad-secret-certificate',INTER_PRIVATE_KEY:'bad-key',INTER_PIX_KEY:'private-pix',JENIOS_PAY_PROVIDER:'inter_pix'};const result=interConfiguration(env);assert.equal(result.certificate,'invalid');assert(result.configured);for(const value of Object.values(env).filter(x=>x!=='inter_pix'))assert(!JSON.stringify(result).includes(value));});
test('video variants are bounded to storage UUID paths and compatible feed encoding',()=>{
 assert.equal(videoVariantPath('11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222.mov'),'11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222-stream-v1.mp4');
 for(const p of ['../../file.mov','https://host/file.mov','id/file.mp4'])assert.throws(()=>videoVariantPath(p));
 const args=videoArgs('/tmp/a','/tmp/b');assert(args.includes('+faststart'));assert(args.includes('libx264'));assert(args.some(x=>x.includes('fps=30')));assert(args.includes('90'));assert(!args.includes('-c:v copy'));
});
