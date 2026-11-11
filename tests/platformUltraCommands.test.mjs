import test from 'node:test';
import assert from 'node:assert/strict';
import {createCommandController} from '../lib/platform/ultra/web/command-controller.mjs';
const policy={scopes:{start:'cycle-1',pause:'cycle-1',billing:'2026-11'},revision:'cycle-1',consentVersion:'terms-1',canStart:true,canPause:true,canBill:true};
const storage=()=>{const map=new Map;return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)}};
const make=(extra={})=>createCommandController({platform:'flow',subject:'a',storage:storage(),uuid:()=> '00000000-0000-4000-8000-000000000001',send:async c=>({schema:'ULTRA_COMMAND_RESULT_V1',commandId:c.commandId,action:c.action,phase:'preparation',actualExecutionAuthorized:false,realDebitAuthorized:false,status:'pending'}),...extra});
test('Start requires source policy and explicit consent; pause does not',async()=>{
 const c=make();await assert.rejects(c.run('start',null,true),/UNAVAILABLE/);await assert.rejects(c.run('start',policy,false),/CONSENT/);await c.run('pause',policy,false);
});
test('repeated clicks, interruption and reconnection query same command, never send Start again',async()=>{
 const store=storage(),calls=[];const send=async c=>{calls.push(c);if(c.action==='start')throw Error('timeout');return {schema:'ULTRA_COMMAND_RESULT_V1',commandId:c.commandId,action:c.action,phase:'preparation',actualExecutionAuthorized:false,realDebitAuthorized:false,status:'unknown'}};
 await assert.rejects(make({storage:store,send}).run('start',policy,true));
 await make({storage:store,send}).run('start',policy,true);assert.deepEqual(calls.map(c=>c.action),['start','status']);assert.equal(calls[0].commandId,calls[1].commandId);
});
test('concurrent clicks are excluded and old responses discarded on session change',async()=>{
 let resolve;const c=make({send:()=>new Promise(r=>resolve=r)});const pending=c.run('start',policy,true);
 await assert.rejects(c.run('start',policy,true),/BUSY/);c.invalidate();resolve({});await assert.rejects(pending,/SESSION_CHANGED/);
});
test('storage failure cannot send a command',async()=>{
 let called=false;const c=make({storage:{getItem:()=>null,setItem:()=>{throw Error('storage')}},send:async()=>{called=true}});await assert.rejects(c.run('start',policy,true));assert.equal(called,false);
});
test('owners isolate commands while revision changes preserve pending requests',async()=>{
 const calls=[],store=storage(),send=async c=>{calls.push(c);return {schema:'ULTRA_COMMAND_RESULT_V1',commandId:c.commandId,action:c.action,phase:'preparation',actualExecutionAuthorized:false,realDebitAuthorized:false,status:'accepted'}};
 await make({storage:store,send}).run('billing',policy,true);await make({storage:store,send,subject:'b'}).run('billing',policy,true);await make({storage:store,send}).run('billing',{...policy,revision:'cycle-2'},true);
 assert.deepEqual(calls.map(c=>c.action),['billing','billing','status']);assert.deepEqual(Object.keys(calls[0]).sort(),['action','commandId','consentVersion','expectedScope','schema']);
});
test('untrusted or missing result never becomes a confirmed action',async()=>{await assert.rejects(make({send:async()=>({schema:'fake',status:'accepted'})}).run('billing',policy,true),/INVALID_RESULT/)});
test('pending command can be queried after new action permission is withdrawn, without new consent',async()=>{
 const calls=[],store=storage(),send=async c=>{calls.push(c);return {schema:'ULTRA_COMMAND_RESULT_V1',commandId:c.commandId,action:c.action,phase:'preparation',actualExecutionAuthorized:false,realDebitAuthorized:false,status:'pending'}};
 const c=make({storage:store,send});await c.run('start',policy,true);await c.run('start',{...policy,canStart:false},false);assert.deepEqual(calls.map(c=>c.action),['start','status']);
});
test('policy cannot invent authorization or accept a malformed envelope',async()=>{
 await assert.rejects(make({send:async c=>({schema:'ULTRA_COMMAND_RESULT_V1',commandId:c.commandId,action:c.action,phase:'policy',actualExecutionAuthorized:true,realDebitAuthorized:false,status:'accepted',policy})}).policy(),/invalid_result/);
});
test('unknown outcome remains bound to original ID across policy revision and scope changes',async()=>{
 const calls=[],store=storage(),send=async c=>{calls.push(c);return {schema:'ULTRA_COMMAND_RESULT_V1',commandId:c.commandId,action:c.action,phase:'reconcile_without_resend',actualExecutionAuthorized:false,realDebitAuthorized:false,status:'unknown'}};
 await make({storage:store,send}).run('start',policy,true);
 await make({storage:store,send}).run('start',{...policy,revision:'changed',scopes:{...policy.scopes,start:'cycle-2'}},true);
 assert.deepEqual(calls.map(c=>c.action),['start','status']);assert.equal(calls[0].commandId,calls[1].commandId);
});
test('a new action requires terminal status reconciliation AND a new explicit scope',async()=>{
 const calls=[],store=storage(),send=async c=>{calls.push(c);return {schema:'ULTRA_COMMAND_RESULT_V1',commandId:c.commandId,action:c.action,phase:'commercial_preparation',actualExecutionAuthorized:false,realDebitAuthorized:false,status:'accepted'}};
 const c=make({storage:store,send});await c.run('start',policy,true);
 const next={...policy,revision:'changed',scopes:{...policy.scopes,start:'cycle-2'}};
 await c.run('start',next,true);await c.run('start',next,true);
 assert.deepEqual(calls.map(c=>c.action),['start','status','start']);assert.equal(calls[0].expectedScope,'cycle-1');assert.equal(calls[1].expectedScope,undefined);assert.equal(calls[2].expectedScope,'cycle-2');
});
for(const [action,phase,nextScope] of [['pause','pause_confirmed','cycle-2'],['billing','monthly_assessed','2026-12']])test(`${action}: next cycle/month requires reconciliation before new scope`,async()=>{
 const calls=[],store=storage(),send=async c=>{calls.push(c);return {schema:'ULTRA_COMMAND_RESULT_V1',commandId:c.commandId,action:c.action,phase,actualExecutionAuthorized:false,realDebitAuthorized:false,status:'accepted'}};
 const c=make({storage:store,send});await c.run(action,policy,true);
 const next={...policy,revision:'changed',scopes:{...policy.scopes,[action]:nextScope}};
 await c.run(action,next,true);await c.run(action,next,true);assert.deepEqual(calls.map(c=>c.action),[action,'status',action]);
});
test('durable stale_scope rejection releases only after status confirmation and new scope',async()=>{
 const calls=[],store=storage(),send=async c=>{calls.push(c);return {schema:'ULTRA_COMMAND_RESULT_V1',commandId:c.commandId,action:c.action,phase:'stale_scope',actualExecutionAuthorized:false,realDebitAuthorized:false,status:'blocked'}};
 const c=make({storage:store,send});await c.run('billing',policy,true);
 const next={...policy,scopes:{...policy.scopes,billing:'2026-12'}};
 await c.run('billing',next,true);await c.run('billing',next,true);assert.deepEqual(calls.map(c=>c.action),['billing','status','billing']);
});
for(const phase of ['authority_or_consent_required','identity_changed'])test(`${phase}: durable rejection needs status then changed authority and fresh consent`,async()=>{
 const calls=[],store=storage(),send=async c=>{calls.push(c);return {schema:'ULTRA_COMMAND_RESULT_V1',commandId:c.commandId,action:c.action,phase,actualExecutionAuthorized:false,realDebitAuthorized:false,status:'blocked'}};
 const c=make({storage:store,send});await c.run('start',policy,true);await c.run('start',policy,true);
 await c.run('start',policy,true);assert.equal(calls[2].action,'status');
 const next={...policy,revision:'new-authority',consentVersion:'terms-2'};
 await assert.rejects(c.run('start',next,false),/CONSENT/);await c.run('start',next,true);assert.equal(calls.at(-1).action,'start');
});
