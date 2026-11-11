import test from 'node:test';
import assert from 'node:assert/strict';
import {ownerCommandHttp} from '../lib/platform/ultra/web/command-http.mjs';
import {createRuntimeCommandSource} from '../lib/platform/ultra/web/runtime-command.mjs';
const command={schema:'ULTRA_COMMAND_V1',commandId:'00000000-0000-4000-8000-000000000001',action:'start',consentVersion:'v1',expectedScope:'cycle-1'};
const req=(body=command,origin='https://app.example')=>new Request('https://app.example/api/commands',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
const user=async()=>({id:'owner'});
for(const platform of ['jenios','flow']){
 test(`${platform}: absence of runtime blocks without fake execution or charge`,async()=>{
  const r=await ownerCommandHttp(req(),{platform,getUser:user,executeCommand:createRuntimeCommandSource({env:{}})});const body=await r.json();assert.equal(body.status,'blocked');assert.equal(body.actualExecutionAuthorized,false);assert.equal(body.realDebitAuthorized,false);
 });
 test(`${platform}: rejects forged owner, payment confirmation and foreign origin before dispatch`,async()=>{
  let calls=0;const opts={platform,getUser:user,executeCommand:async()=>{calls++}};
  assert.equal((await ownerCommandHttp(req({...command,owner:'someone'}),opts)).status,400);
  assert.equal((await ownerCommandHttp(req({...command,paymentConfirmed:true}),opts)).status,400);
  assert.equal((await ownerCommandHttp(req(command,'https://evil.example'),opts)).status,403);assert.equal(calls,0);
 });
 test(`${platform}: session replacement before dispatch is rejected`,async()=>{
  let calls=0,reads=0;const r=await ownerCommandHttp(req(),{platform,getUser:async()=>({id:++reads===1?'first':'second'}),executeCommand:async()=>{calls++}});assert.equal(r.status,409);assert.equal(calls,0);
 });
 test(`${platform}: timeout after dispatch is unknown, not a successful action`,async()=>{
  const r=await ownerCommandHttp(req(),{platform,getUser:user,executeCommand:async()=>{throw Error('timeout')}});assert.equal((await r.json()).status,'unknown');
 });
}

test('release guard pins command routes, controller, transport and preserved predecessor',async()=>{
 const {verifyOwnerWebRelease}=await import('../scripts/check-ultra-owner-web.mjs');const {readFileSync}=await import('node:fs');
 assert.equal(verifyOwnerWebRelease().commandWebRelease,true);
 for(const target of ['app/api/platform/ultra/commands/route.js','app/components/platform/UltraCommands.js','lib/platform/ultra/web/command-controller.mjs','lib/platform/ultra/web/runtime-command.mjs','scripts/check-ultra-owner-web-baseline.mjs'])assert.throws(()=>verifyOwnerWebRelease({read:name=>name===target?Buffer.from('tampered'):readFileSync(name)}));
});
