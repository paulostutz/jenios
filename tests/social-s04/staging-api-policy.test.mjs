import test from 'node:test';
import assert from 'node:assert/strict';
import {checkS04StagingApi} from '../../scripts/check-s04-staging-api.mjs';
const url='https://rebzztxlzofxpfwjvbee.supabase.co';
const key='sb_publishable_dummy_testing_only';
function good(){
 const calls=[];
 const client={
  rpc:async(name,args)=>{calls.push({name,args});return {data:{handle:'s04_integration_probe_2026',available:true,suggestions:[]},error:null};},
  from:name=>({select:()=>({limit:async()=>({data:name==='profiles'?[]:null,error:name==='profiles'?null:{message:'permission denied'}})})})
 };
 return {db:client,fetcher:async()=>({ok:true}),endpoint:url,apiKey:key,calls};
}
test('remote smoke is read-only and checks auth health, handle RPC and private RLS boundaries',async()=>{
 const fixture=good();const r=await checkS04StagingApi(fixture);
 assert.equal(r.authHealth,'ok');assert.equal(r.handleRpc,'ok');assert.equal(r.guardAnonymousRead,'blocked');
 assert.deepEqual(fixture.calls.map(x=>x.name),['social_handle_availability_v1']);
});
test('remote smoke cannot use production URL',async()=>{
 await assert.rejects(()=>checkS04StagingApi({...good(),endpoint:'https://igayfjorjmucthlfoasf.supabase.co'}),/STAGING_URL_MISMATCH/);
});
test('remote smoke rejects nonpublishable or blank API key',async()=>{
 await assert.rejects(()=>checkS04StagingApi({...good(),apiKey:'SERVICE_SECRET'}),/STAGING_KEY_NOT_PUBLISHABLE/);
});
test('remote smoke rejects broken Supabase Auth health',async()=>{
 await assert.rejects(()=>checkS04StagingApi({...good(),fetcher:async()=>({ok:false,status:502})}),/STAGING_AUTH_HEALTH_FAILED/);
});
test('remote smoke rejects invalid handle response',async()=>{
 const obj=good();obj.db.rpc=async()=>({data:{handle:'wrong',available:true,suggestions:[]},error:null});
 await assert.rejects(()=>checkS04StagingApi(obj),/STAGING_HANDLE_RPC_FAILED/);
});
test('remote smoke fails if anon can read staging guard row',async()=>{
 const obj=good();obj.db.from=name=>({select:()=>({limit:async()=>({data:name==='jenios_s04_staging_guard_20261017'?[{marker:'private'}]:[],error:null})})});
 await assert.rejects(()=>checkS04StagingApi(obj),/STAGING_GUARD_ANON_READ_ALLOWED/);
});
test('remote smoke fails if anon can read trial ledger',async()=>{
 const obj=good();obj.db.from=name=>({select:()=>({limit:async()=>({data:name==='jenios_platform_trial_ledger_v1'?[{subject_digest:'fake'}]:[],error:null})})});
 await assert.rejects(()=>checkS04StagingApi(obj),/STAGING_TRIAL_LEDGER_ANON_READ_ALLOWED/);
});
test('remote smoke fails if anon can read user profiles',async()=>{
 const obj=good();obj.db.from=name=>({select:()=>({limit:async()=>({data:name==='profiles'?[{id:'other'}]:[],error:null})})});
 await assert.rejects(()=>checkS04StagingApi(obj),/STAGING_ANONYMOUS_PROFILE_READ_FAILED/);
});
