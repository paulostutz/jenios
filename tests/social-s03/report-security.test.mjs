import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {requirePrelaunchReportAccess} from '../../lib/reports/prelaunch-access.mjs';
const user={id:'11111111-1111-4111-8111-111111111111',is_anonymous:false};
const bank={codigo:'123',periodo:'202606'};
const token={network:'ethereum',type:'token',identifier:'0x'+'1'.repeat(40)};
function profileDb({profile=user.id,error=false,throwError=false}={}) {
 const calls=[];
 return {calls,from(table){calls.push(table);if(table!=='profiles')throw Error('A tabela de pedidos não pode ser consultada');
  return {select(field){assert.equal(field,'id');return this},eq(field,value){assert.equal(field,'id');assert.equal(value,user.id);return this},async maybeSingle(){if(throwError)throw Error('storage unavailable');return {data:profile?{id:profile}:null,error:error?{message:'unavailable'}:null}}};}};
}
for(const [code,target] of [['social-bankscore-report',bank],['social-crypto-validator',token]]) {
 test(code+' accepts a real Social profile without orders or payment mutations',async()=>{
  const db=profileDb();const result=await requirePrelaunchReportAccess({db,user,productCode:code,target});
  assert.equal(result.authorized,true);assert.equal(result.orderId,null);assert.equal(result.status,'prelaunch');assert.deepEqual(db.calls,['profiles']);
 });
 for(const props of [{profile:null},{profile:'22222222-2222-4222-8222-222222222222'}])test(code+' rejects absent or mismatched Social profile',async()=>{
  await assert.rejects(requirePrelaunchReportAccess({db:profileDb(props),user,productCode:code,target}),{status:403});
 });
 for(const props of [{error:true},{throwError:true}])test(code+' fails closed on database errors',async()=>{
  await assert.rejects(requirePrelaunchReportAccess({db:profileDb(props),user,productCode:code,target}),{status:503});
 });
 test(code+' validates input before accessing the database',async()=>{
  const db=profileDb();await assert.rejects(requirePrelaunchReportAccess({db,user,productCode:code,target:{}}),{status:400});assert.deepEqual(db.calls,[]);
 });
}
test('anonymous users, missing sessions and out-of-scope product codes cannot query Social profiles',async()=>{
 const db=profileDb();for(const invalid of [null,{}, {...user,is_anonymous:true}])await assert.rejects(requirePrelaunchReportAccess({db,user:invalid,productCode:'social-bankscore-report',target:bank}),{status:401});
 await assert.rejects(requirePrelaunchReportAccess({db,user,productCode:'social-boost',target:{}}),{status:403});
 assert.equal(db.calls.length,0);
});
test('Social and admin report flows remain distinct and paid checkout protections stay in place',()=>{
 for(const p of ['app/api/bankscore/detailed/route.js','app/api/crypto-validator/detailed/route.js']){
  const x=readFileSync(p,'utf8');assert.match(x,/prelaunch\?requirePayUser\(request,db\)/);assert.match(x,/requirePrelaunchReportAccess/);assert.match(x,/Cache-Control/);
 }
 const pay=readFileSync('app/api/jenios-pay/checkout/route.js','utf8');
 assert.ok(pay.indexOf('if(isPrelaunchReport(body?.productCode))')<pay.indexOf('getJeniosPayAdmin()'));
});
