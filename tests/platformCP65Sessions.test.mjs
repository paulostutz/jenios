import test from 'node:test';
import assert from 'node:assert/strict';
import {observePlatformDiagnostic,loadAccountDiagnostic,submitAccountDiagnostic,readSessionMode,writeSessionMode} from '../lib/platform/diagnostic-client.mjs';
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function harness(){let cb,closed=false;const timers=[];const auth={onAuthStateChange(fn){cb=fn;return {data:{subscription:{unsubscribe(){closed=true;}}}};}};
return {supabase:{auth},timers,schedule:fn=>timers.push(fn),event:name=>cb(name),run:()=>timers.shift()?.(),closed:()=>closed};}
test('B65 pending status never asserts server authorization',()=>{
 const h=harness(),seen=[];const stop=observePlatformDiagnostic(h.supabase,s=>seen.push(s),async()=>({verified:true}),h.schedule);
 assert.equal(seen[0].verified,false);assert.equal(seen[0].reason,'checking');stop();
});
test('B65 stale response for previous account is ignored',async()=>{
 const h=harness(),first=deferred(),second=deferred(),seen=[];let calls=0;
 const stop=observePlatformDiagnostic(h.supabase,s=>seen.push(s),()=>++calls===1?first.promise:second.promise,h.schedule);
 h.run();h.event('SIGNED_IN');h.run();first.resolve({verified:true,userId:'previous'});await tick();
 assert.equal(seen.some(s=>s.userId==='previous'),false);
 second.resolve({verified:true,userId:'current'});await tick();
 assert.equal(seen.at(-1).userId,'current');stop();
});
test('B65 logout removes verified state synchronously',async()=>{
 const h=harness(),seen=[];const stop=observePlatformDiagnostic(h.supabase,s=>seen.push(s),async()=>({verified:true,userId:'A'}),h.schedule);
 h.run();await tick();assert.equal(seen.at(-1).verified,true);
 h.event('SIGNED_OUT');assert.equal(seen.at(-1).verified,false);assert.equal(seen.at(-1).userId,null);stop();
});
test('B65 unmounted component ignores delayed results',async()=>{
 const h=harness(),task=deferred(),seen=[];const stop=observePlatformDiagnostic(h.supabase,s=>seen.push(s),()=>task.promise,h.schedule);
 h.run();const n=seen.length;stop();task.resolve({verified:true,userId:'A'});await tick();
 assert.equal(seen.length,n);assert.equal(h.closed(),true);
});
test('B65 only latest scheduled refresh runs',async()=>{
 const h=harness(),seen=[];const stop=observePlatformDiagnostic(h.supabase,s=>seen.push(s),async()=>({verified:true}),h.schedule);
 h.event('SIGNED_OUT');h.run();await tick();assert.equal(seen.some(s=>s.verified),false);
 h.run();await tick();assert.equal(seen.at(-1).verified,true);stop();
});
test('B65 token refresh does not invent new verified state',()=>{
 const h=harness(),seen=[];const stop=observePlatformDiagnostic(h.supabase,s=>seen.push(s),async()=>({verified:false}),h.schedule);
 const n=seen.length;h.event('TOKEN_REFRESHED');assert.equal(seen.length,n);stop();
});
test('B65 GET rejects result after account changes',async()=>{
 let id='A';const supabase={auth:{async getSession(){return {data:{session:{access_token:'T',user:{id}}}};}}};
 const s=await loadAccountDiagnostic(supabase,async()=>{id='B';return {ok:true,json:async()=>({verified:true,completed:true,mode:'manual'})};});
 assert.equal(s.verified,false);assert.equal(s.reason,'session_changed');
});
test('B65 POST rejects result after sign out',async()=>{
 let id='A';const supabase={auth:{async getSession(){return {data:{session:id?{access_token:'T',user:{id}}:null}};}}};
 const s=await submitAccountDiagnostic(supabase,[4,4,4,4,4],'SWING',async()=>{id=null;return {ok:true,json:async()=>({verified:true,mode:'manual'})};});
 assert.equal(s.verified,false);assert.equal(s.reason,'session_changed');
});
test('B65 client preferences are user scoped',()=>{
 const map=new Map(),store={getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)};
 writeSessionMode(store,'A','manual');writeSessionMode(store,'B','reversa');
 assert.equal(readSessionMode(store,'A'),'manual');assert.equal(readSessionMode(store,'B'),'reversa');assert.equal(readSessionMode(store,'C'),null);
});
test('B65 auth loader rejection fails closed',async()=>{
 const h=harness(),seen=[];const stop=observePlatformDiagnostic(h.supabase,s=>seen.push(s),async()=>{throw Error('offline');},h.schedule);
 h.run();await tick();assert.equal(seen.at(-1).verified,false);assert.equal(seen.at(-1).reason,'backend_unavailable');stop();
});
