import test from 'node:test';
import assert from 'node:assert/strict';
import {ownerStateHttp,readJeniosState} from '../lib/platform/ultra/web/owner-state-http.mjs';
import {emptyOwnerState,available,validateOwnerState} from '../lib/platform/ultra/web/state-contract.mjs';
import {createRuntimeSource,createRuntimeStateService} from '../lib/platform/ultra/web/runtime-source.mjs';
const now=Date.parse('2026-11-11T02:00:00Z'),subject='verified-platform-owner',identity={platform:'jenios',subject,now};
const request=()=>new Request('https://www.jenios.com.br/api/platform/ultra/state');
const state=()=>{const s=emptyOwnerState(identity);s.sections.wallet=available({currency:'BRL',balanceMinor:2000,reservedMinor:500,availableMinor:1500,debitAuthorized:true},{observedAt:new Date(now).toISOString()});return s};
test('Owner state authenticates before touching any source',async()=>{
 let reads=0;for(const user of [null,{id:subject,is_anonymous:true}]){const r=await ownerStateHttp(request(),{platform:'jenios',getUser:async()=>user,readState:async()=>{reads++;return state()},now:()=>now});assert.equal(r.status,401);}assert.equal(reads,0);
});
test('Owner state absence is unavailable rather than a zero balance or entitlement',async()=>{
 const r=await ownerStateHttp(request(),{platform:'jenios',getUser:async()=>({id:subject}),now:()=>now});assert.equal(r.status,200);const s=await r.json();assert.equal(s.sections.wallet.status,'unavailable');assert.equal(s.sections.wallet.data,null);assert.equal(s.sections.entitlement.data,null);assert.match(r.headers.get('cache-control'),/no-store/);
});
test('Owner state rejects browser account selectors and cross-origin reads',async()=>{
 for(const r of [new Request(request().url+'?subject=other'),new Request(request().url,{headers:{origin:'https://other.invalid'}})])assert.notEqual((await ownerStateHttp(r,{getUser:async()=>{throw Error('must not authenticate')}})).status,200);
});
test('Owner state discards wrong-owner, wrong-platform and stale data',async()=>{
 for(const patch of [s=>s.owner.subject='other',s=>s.owner.platform='flow',s=>s.generatedAt=new Date(now-120000).toISOString()]){const s=state();patch(s);const r=await ownerStateHttp(request(),{platform:'jenios',getUser:async()=>({id:subject}),readState:async()=>s,now:()=>now});assert.equal((await r.json()).sections.wallet.data,null);}
});
test('Owner state session change during a source wait returns no previous data',async()=>{
 let current=subject;const r=await ownerStateHttp(request(),{platform:'jenios',getUser:async()=>({id:current}),readState:async()=>{current='other';return state()},now:()=>now});assert.equal(r.status,409);assert.equal((await r.json()).sections,undefined);
});
test('Owner state validates wallet arithmetic and never grants debit from an unverified display',()=>{
 const s=state();assert.equal(validateOwnerState(s,identity).sections.wallet.data.debitAuthorized,false);s.capabilities.realBillingVerified=true;s.sections.wallet.mode='demo';assert.equal(validateOwnerState(s,identity).sections.wallet.data.debitAuthorized,false);s.sections.wallet.data.availableMinor=2000;assert.throws(()=>validateOwnerState(s,identity));
});
test('Owner state strips source secrets and keeps incomplete costs pending',()=>{
 const s=state();s.sections.wallet.data.credential='secret';s.sections.operations=available({rows:[{id:'op',connectionId:'conn',environment:'demo',currency:'USDT',symbol:'FIXTUREUSDT',state:'closed',side:'buy',quantity:'1',openedAt:null,closedAt:null,gross:'10',fees:null,financing:'0',net:'999',costsComplete:false,secret:'never'}],hasMore:false},{mode:'demo',observedAt:new Date(now).toISOString()});const p=validateOwnerState(s,identity);assert.equal(p.sections.operations.data.rows[0].net,null);assert.equal(JSON.stringify(p).includes('secret'),false);
});
test('Runtime source is disabled without explicit server configuration',async()=>{
 let calls=0;const read=createRuntimeSource({fetchImpl:async()=>{calls++;throw Error()}});assert.equal(await read(identity),null);assert.equal(calls,0);
});
test('Runtime service and gateway preserve the mapped owner and nonce end to end',async()=>{
 const key='a'.repeat(64),consumer={readState:async()=>state()};const handler=createRuntimeStateService({serviceKey:key,now:()=>now,resolve:async who=>who.platform==='jenios'&&who.subject===subject?consumer:null});
 const source=createRuntimeSource({env:{ULTRA_RUNTIME_ENABLED:'true',ULTRA_RUNTIME_ORIGIN:'https://runtime.jenios.com.br',ULTRA_RUNTIME_SERVICE_KEY:key},now:()=>now,fetchImpl:async(url,init)=>handler(new Request(url,init))});assert.equal((await source({platform:'jenios',subject})).sections.wallet.data.balanceMinor,2000);await assert.rejects(source({platform:'jenios',subject:'other'}));const denied=await handler(new Request('https://runtime.jenios.com.br/v1/ultra/state',{method:'POST',headers:{Authorization:'Bearer wrong'}}));assert.equal(denied.status,401);
});
test('Runtime service rechecks owner mapping after a wait',async()=>{
 const key='b'.repeat(64),consumer={readState:async()=>state()};let count=0;const handler=createRuntimeStateService({serviceKey:key,now:()=>now,resolve:async()=>++count===1?consumer:null});const source=createRuntimeSource({env:{ULTRA_RUNTIME_ENABLED:'true',ULTRA_RUNTIME_ORIGIN:'https://runtime.jenios.com.br',ULTRA_RUNTIME_SERVICE_KEY:key},now:()=>now,fetchImpl:async(url,init)=>handler(new Request(url,init))});await assert.rejects(source({platform:'jenios',subject}));
});
test('Platform source scopes each query to the verified owner and excludes secrets',async()=>{
 const queries=[];const db={from(table){const q={table};queries.push(q);return {select(fields){q.fields=fields;return this},eq(field,value){assert.equal(field,'user_id');q.owner=value;return this},order(){return this},limit(){return Promise.resolve({data:[],error:null})}}}};
 const result=await readJeniosState(db,{id:subject},{now});assert.equal(result.sections.wallet.status,'unavailable');assert.equal(result.sections.connections.status,'available');assert.equal(queries.length,2);assert.ok(queries.every(q=>q.owner===subject));assert.ok(queries.every(q=>!/(token|credential|\*)/.test(q.fields)));
});
test('Platform source preserves older saved configuration without inventing a connected provider',async()=>{
 const db={from(table){return {select(){return this},eq(){return this},order(){return this},limit(){return Promise.resolve({error:null,data:table==='jenios_ultra_plans'?[{id:'saved',created_at:new Date(now).toISOString(),config:{markets:[{id:'crypto',currency:'USDT',capital:100,leverage:1}]}}]:[]})}}}};
 const result=await readJeniosState(db,{id:subject},{now});assert.equal(result.sections.configuration.status,'available');assert.equal(result.sections.configuration.data.markets[0].provider,null);assert.equal(result.sections.entitlement.status,'unavailable');
});
