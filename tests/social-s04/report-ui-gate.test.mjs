import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolveSocialReportGate} from '../../lib/reports/social-report-gate.mjs';

const uid='11111111-1111-4111-8111-111111111111';
function client({user={id:uid,is_anonymous:false},getUserError=null,profile={id:uid},profileError=null,throwAuth=false}={}){
 const calls=[];
 const api={calls,auth:{async getUser(){calls.push('getUser');if(throwAuth)throw Error('offline');return {data:{user},error:getUserError}}},
 from(table){calls.push(table);return {select(col){calls.push('select:'+col);return this},eq(k,v){calls.push('eq:'+k+':'+v);return this},async maybeSingle(){return {data:profile,error:profileError}}}}};
 return api;
}
test('real Social profile required to display report as ready',async()=>{
 const api=client();assert.deepEqual(await resolveSocialReportGate(api),{status:'ready',userId:uid});
 assert.deepEqual(api.calls,['getUser','profiles','select:id','eq:id:'+uid]);
});
test('valid auth without profile must NOT unlock report UI',async()=>{
 for(const profile of [null,{id:'33333333-3333-4333-8333-333333333333'}]){
  const result=await resolveSocialReportGate(client({profile}));
  assert.deepEqual(result,{status:'profile-missing',userId:''});
 }
});
test('anonymous or invalid session never queries profiles',async()=>{
 for(const params of [{user:null},{user:{id:uid,is_anonymous:true}},{getUserError:Error('token invalid')}]){
  const api=client(params);
  assert.deepEqual(await resolveSocialReportGate(api),{status:'guest',userId:''});
  assert.deepEqual(api.calls,['getUser']);
 }
});
test('database error, exception and absent client fail closed',async()=>{
 for(const input of [client({profileError:Error('db')}),client({throwAuth:true}),null]){
  assert.deepEqual(await resolveSocialReportGate(input),{status:'unavailable',userId:''});
 }
});
test('React report UI checks actual profile; supports missing/unavailable states and retry',()=>{
 const src=readFileSync('app/components/ReportAccountGate.js','utf8');
 assert.match(src,/resolveSocialReportGate\(supabase\)/);
 assert.match(src,/state\.status === 'profile-missing'/);
 assert.match(src,/state\.status === 'unavailable'/);
 assert.match(src,/recheck\.current\(\)/);
 assert.match(src,/!active \|\| ticket !== revision/);
});
