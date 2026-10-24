/** In-process integration, mocked Auth/storage only. NOT hosted login certification. */
import test,{after,mock} from 'node:test';
import assert from 'node:assert/strict';
import {requirePayUser} from '../lib/pay/auth.mjs';
import {requireAdminPermission} from '../lib/admin-access.mjs';
import {handleLearning} from '../lib/learning/service.mjs';
import {LESSONS,TRACKS} from '../lib/learning/catalog.mjs';
import {saveVerifiedDiagnostic,readVerifiedDiagnostic} from '../lib/platform/diagnostic-server.mjs';
import {registerPlatformAccount,requestPlatformPasswordReset,changePlatformPassword,signOutPlatform} from '../lib/platform/account-access.mjs';

const network=mock.method(globalThis,'fetch',()=>{throw Error('BLOCK_A_NETWORK_FORBIDDEN');});
after(()=>{assert.equal(network.mock.callCount(),0);network.mock.restore();});
const U1='10000000-0000-4000-8000-000000000001';
const U2='20000000-0000-4000-8000-000000000002';
const USER=id=>({id,is_anonymous:false,app_metadata:{role:'master'},user_metadata:{}});
const NOW=Date.parse('2026-10-24T12:00:00Z');
const req=(token='session-a',body=null)=>new Request('https://qa.invalid/api/platform/learning',{
 method:body===null?'GET':'POST',headers:{...(token?{authorization:'Bearer '+token}:{}),'content-type':'application/json'},
 ...(body===null?{}:{body:JSON.stringify(body)})
});
function fixture(){
 const rows=new Map(),sessions=new Map([['session-a',USER(U1)],['session-b',USER(U2)]]),calls=[];
 function bucket(table){if(!rows.has(table))rows.set(table,new Map());return rows.get(table);}
 const db={rows,sessions,calls,
  auth:{getUser:async token=>({data:{user:structuredClone(sessions.get(token)||null)},error:sessions.has(token)?null:{message:'Invalid session'}})},
  from(table){
   assert.ok(['jenios_learning_state','jenios_platform_diagnostics'].includes(table),'Unexpected table '+table);
   const filters=[];let action='read',payload=null;
   const execute=()=>{
    const store=bucket(table);let data=null,error=null;
    if(action==='insert'){
     assert.ok(payload.user_id);calls.push({table,action,userId:payload.user_id});
     if(store.has(payload.user_id))error={code:'23505'};
     else{data={...structuredClone(payload),created_at:new Date(NOW).toISOString()};store.set(payload.user_id,data);}
    }else{
     assert.ok(filters.some(([key])=>key==='user_id'),'Every storage operation must be scoped to an owner');
     const entry=[...store.values()].find(row=>filters.every(([key,value])=>row[key]===value));
     if(entry){data=entry;if(action==='update'){data={...entry,...structuredClone(payload)};store.set(entry.user_id,data);}}
     calls.push({table,action,filters:structuredClone(filters)});
    }
    return {data:structuredClone(data),error};
   };
   const q={
    select(){return q;},eq(key,value){filters.push([key,value]);return q;},
    insert(value){action='insert';payload=value;return q;},update(value){action='update';payload=value;return q;},
    async maybeSingle(){return execute();},async single(){return execute();},
    then(resolve,reject){return Promise.resolve(execute()).then(resolve,reject);}
   };return q;
  }
 };return db;
}
async function learning(db,token,body=null){
 const response=await handleLearning(req(token,body),{db,now:NOW,env:{}});
 return {status:response.status,body:await response.json()};
}

test('Block A mock-auth: missing, expired, anonymous and wrong-project sessions are denied',async()=>{
 const db=fixture();
 db.sessions.set('anonymous',{id:U1,is_anonymous:true});
 for(const token of ['', 'expired', 'platform-token-on-social', 'anonymous']){
  await assert.rejects(requirePayUser(req(token),db),e=>e.status===401);
  assert.equal((await learning(db,token)).status,401);
 }
 assert.equal(db.rows.size,0);
});

test('Block A mock-auth: user metadata and operational roles cannot enter Master office',async()=>{
 const db=fixture();
 for(const role of ['admin','finance_admin','ordinary']){
  db.sessions.set('untrusted',{id:U1,is_anonymous:false,app_metadata:{role},user_metadata:{role:'master',permissions:['reports.run']}});
  await assert.rejects(requireAdminPermission(req('untrusted'),db,'reports.run'),e=>e.status===403);
 }
 assert.equal((await requireAdminPermission(req('session-a'),db,'reports.run')).id,U1);
});

test('Block A mock-auth: all tracks readable before onboarding, grades or placement',async()=>{
 const db=fixture();const result=await learning(db,'session-a');
 assert.equal(result.status,200);assert.equal(result.body.access.kind,'admin-preview');
 assert.equal(result.body.learning.route.length,TRACKS.length);
 assert.ok(result.body.learning.route.every(track=>track.unlocked));
 assert.equal(result.body.learning.placementRequired,false);
 assert.equal(result.body.learning.assessmentsRequired,false);
 const last=LESSONS.at(-1);
 const completed=await learning(db,'session-a',{revision:0,action:'complete_lesson',lessonId:last.id});
 assert.equal(completed.status,200);
 assert.ok(completed.body.learning.route.flatMap(t=>t.lessons).some(l=>l.id===last.id&&l.completed));
 assert.equal(completed.body.learning.executionEnabled,false);
});

test('Block A mock-auth: progress survives a new request and is isolated by user',async()=>{
 const db=fixture();await learning(db,'session-a');await learning(db,'session-b');
 assert.equal((await learning(db,'session-a',{revision:0,action:'complete_lesson',lessonId:LESSONS[0].id})).status,200);
 const again=await learning(db,'session-a'),other=await learning(db,'session-b');
 assert.equal(again.body.learning.revision,1);
 assert.equal(again.body.learning.route.flatMap(t=>t.lessons).filter(l=>l.completed).length,1);
 assert.equal(other.body.learning.revision,0);
 assert.equal(other.body.learning.route.flatMap(t=>t.lessons).filter(l=>l.completed).length,0);
 db.sessions.set('refreshed-session',USER(U1));
 assert.equal((await learning(db,'refreshed-session')).body.learning.revision,1);
 db.sessions.delete('session-a');
 assert.equal((await learning(db,'session-a')).status,401);
});

test('Block A mock-auth: simultaneous stale writes cannot overwrite progress',async()=>{
 const db=fixture();await learning(db,'session-a');
 const results=await Promise.all([0,1].map(i=>learning(db,'session-a',{revision:0,action:'complete_lesson',lessonId:LESSONS[i].id})));
 assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
 const current=await learning(db,'session-a');assert.equal(current.body.learning.revision,1);
 assert.equal(current.body.learning.route.flatMap(t=>t.lessons).filter(l=>l.completed).length,1);
});

test('Block A mock-auth: fabricated owner, unknown lesson and oversized payload are rejected',async()=>{
 const db=fixture();await learning(db,'session-a');
 assert.equal((await learning(db,'session-a',{revision:0,action:'complete_lesson',lessonId:LESSONS[0].id,user_id:U2})).status,400);
 assert.equal((await learning(db,'session-a',{revision:0,action:'complete_lesson',lessonId:'nonexistent'})).status,403);
 assert.equal((await learning(db,'session-a',{revision:0,action:'complete_lesson',lessonId:'x'.repeat(17000)})).status,413);
 assert.equal((await learning(db,'session-a')).body.learning.revision,0);
});

test('Block A storage fixture: diagnostic binds to authenticated identity and first submission wins',async()=>{
 const db=fixture();const a=USER(U1),b=USER(U2);
 const form={answers:[4,4,4,4,4],timeframe:'SWING',user_id:U2};
 const saved=await saveVerifiedDiagnostic(db,a,form);assert.equal(saved.verified,true);
 assert.deepEqual(await readVerifiedDiagnostic(db,b),{completed:false,verified:false});
 const second=await saveVerifiedDiagnostic(db,a,{answers:[0,0,0,0,0],timeframe:'RAPIDO'});
 assert.deepEqual(second,saved);
 await assert.rejects(saveVerifiedDiagnostic(db,{id:U2,is_anonymous:true},form),e=>e.status===401);
});

test('Block A Auth stub: disabled registration never invokes signUp',async()=>{
 let called=false;const auth={signUp:async()=>{called=true;return {data:{session:null},error:null};}};
 await assert.rejects(registerPlatformAccount(auth,'qa@example.invalid','Example-Test-123!','Example-Test-123!','https://qa.invalid','false'));
 assert.equal(called,false);
 await registerPlatformAccount(auth,' QA@example.invalid ','Example-Test-123!','Example-Test-123!','https://qa.invalid','true');
 assert.equal(called,true);
});

test('Block A Auth stub: recovery uses Platform route and returns a generic message',async()=>{
 const calls=[];const auth={resetPasswordForEmail:async(...args)=>{calls.push(args);return {error:null};}};
 const result=await requestPlatformPasswordReset(auth,' QA@example.invalid ','https://qa.invalid');
 assert.equal(calls.length,1);assert.equal(calls[0][0],'qa@example.invalid');
 assert.equal(calls[0][1].redirectTo,'https://qa.invalid/platform/redefinir');
 assert.match(result,/Se este endereço estiver cadastrado/);
});

test('Block A Auth stub: expired identity cannot change password; logout clears only own local state',async()=>{
 let changed=false;const auth={getUser:async()=>({data:{user:null},error:null}),updateUser:async()=>{changed=true;return {error:null};}};
 await assert.rejects(changePlatformPassword(auth,'Example-Test-123!','Example-Test-123!'));
 assert.equal(changed,false);
 const removed=[];await signOutPlatform({signOut:async()=>({error:null})},{removeItem:key=>removed.push(key)},U1);
 assert.equal(removed.length,4);assert.ok(removed.every(key=>key.includes(U1)&&!key.includes(U2)));
});
