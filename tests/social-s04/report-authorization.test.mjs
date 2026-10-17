import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {requirePrelaunchReportAccess} from '../../lib/reports/prelaunch-access.mjs';
import {adminPermissions} from '../../lib/admin-access.mjs';
const uid='11111111-1111-4111-8111-111111111111';
const user={id:uid,is_anonymous:false,app_metadata:{}};
const bankTarget={codigo:'123',periodo:'202606'};
const cryptoTarget={network:'ethereum',type:'token',identifier:'0x'+'1'.repeat(40)};
function profileDb({profile={id:uid},dbError=false}={}){
 const calls=[];return {calls,from(table){calls.push(['table',table]);return {select(field){calls.push(['select',field]);return this},eq(k,v){calls.push(['eq',k,v]);return this},async maybeSingle(){return {data:profile,error:dbError?{code:'DATABASE_UNAVAILABLE'}:null}}}}};
}
for(const [code,target] of [['social-bankscore-report',bankTarget],['social-crypto-validator',cryptoTarget]]){
 test('only persistent Social owner can access '+code,async()=>{
  const db=profileDb();const r=await requirePrelaunchReportAccess({db,user,productCode:code,target});
  assert.equal(r.authorized,true);assert.equal(r.orderId,null);assert.equal(r.productCode,code);
  assert.deepEqual(db.calls.slice(0,3),[['table','profiles'],['select','id'],['eq','id',uid]]);
  for(const profile of [null,{id:'33333333-3333-4333-8333-333333333333'}]){
   await assert.rejects(requirePrelaunchReportAccess({db:profileDb({profile}),user,productCode:code,target}),{status:403});
  }
  await assert.rejects(requirePrelaunchReportAccess({db:profileDb({dbError:true}),user,productCode:code,target}),{status:503});
 });
 test('unauthenticated and anonymous callers are denied '+code,async()=>{
  const db=profileDb();await assert.rejects(requirePrelaunchReportAccess({db,user:null,productCode:code,target}),{status:401});
  await assert.rejects(requirePrelaunchReportAccess({db,user:{...user,is_anonymous:true},productCode:code,target}),{status:401});
  assert.equal(db.calls.length,0);
 });
}
test('admin report.run permission is not derived from user_metadata',async()=>{
 const fake={from(table){assert.equal(table,'jenios_admin_permissions');return {select(){return this},eq(){return this},async then(resolve){return resolve({data:[],error:null})}}}};
 const caller={...user,user_metadata:{role:'admin',permissions:['reports.run']}};
 const perms=await adminPermissions(fake,caller,{JENIOS_PAY_ADMIN_USER_IDS:''});
 assert.deepEqual(perms,[]);
});
test('server-admin role or explicit DB-granted reports.run can be used; unknown permissions are ignored',async()=>{
 const db={from(){return {select(){return this},eq(){return Promise.resolve({data:[{permission:'reports.run'},{permission:'does.not.exist'}],error:null})}}}};
 const p=await adminPermissions(db,user,{JENIOS_PAY_ADMIN_USER_IDS:''});assert.deepEqual(p,['reports.run']);
 assert((await adminPermissions({}, {...user,app_metadata:{role:'admin'}},{JENIOS_PAY_ADMIN_USER_IDS:''})).includes('reports.run'));
});
test('PDF routes and admin audit remain unchanged and preserve attachment headers',()=>{
 for(const path of ['app/api/bankscore/detailed/route.js','app/api/crypto-validator/detailed/route.js','app/api/admin/consultas/route.js']){
  const s=readFileSync(path,'utf8');assert.match(s,/application\/pdf/);assert.match(s,/attachment; filename=/);
 }
 const admin=readFileSync('app/api/admin/consultas/route.js','utf8');
 assert.match(admin,/requireAdminPermission\(request,db,'reports.run'\)/);assert.match(admin,/await auditAdmin\(/);
 const b=readFileSync('app/api/bankscore/detailed/route.js','utf8');assert.match(b,/requirePrelaunchReportAccess/);
 const c=readFileSync('app/api/crypto-validator/detailed/route.js','utf8');assert.match(c,/requirePrelaunchReportAccess/);
});