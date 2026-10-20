import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readPlatformJson} from '../lib/platform/request-limit.mjs';
import {adminPermissions,requireAdminPermission} from '../lib/admin-access.mjs';

const base=new URL('../',import.meta.url);
const read=p=>readFileSync(new URL(p,base),'utf8');
const mockDb=(user,grants=[])=>({
  auth:{getUser:async token=>token==='token'?{data:{user},error:null}:{data:{user:null},error:{message:'invalid'}}},
  from(name){
    assert.equal(name,'jenios_admin_permissions');
    return {select(column){assert.equal(column,'permission');return{async eq(key,id){
      assert.equal(key,'user_id');assert.equal(id,user.id);
      return {data:grants.map(permission=>({permission})),error:null};
    }};}};
  }
});
const req=(body,headers={})=>new Request('https://qa.invalid/api/platform/diagnostico',{
  method:'POST',headers:{'content-type':'application/json',...headers},body
});
const tokenReq=()=>new Request('https://qa.invalid/api/admin/access',{headers:{authorization:'Bearer token'}});

test('CP64: JSON válido é aceito sob limite',async()=>{
 assert.deepEqual(await readPlatformJson(req('{"answers":[4,4,4,4,4],"timeframe":"SWING"}')),{answers:[4,4,4,4,4],timeframe:'SWING'});
});
test('CP64: sem JSON content-type não há parsing',async()=>{
 await assert.rejects(()=>readPlatformJson(req('{}',{'content-type':'text/plain'})),{status:415});
});
test('CP64: Content-Length maior que limite é recusado cedo',async()=>{
 await assert.rejects(()=>readPlatformJson(req('{}',{'content-length':'500000'})),{status:413});
});
test('CP64: body oversized sem Content-Length também é rejeitado',async()=>{
 await assert.rejects(()=>readPlatformJson(req(JSON.stringify({blob:'x'.repeat(2100)}))),{status:413});
});
test('CP64: body malformado falha fechado com status 400',async()=>{
 await assert.rejects(()=>readPlatformJson(req('{invalid')), {status:400});
});
test('CP64: body não é interpretado como query/form',async()=>{
 await assert.rejects(()=>readPlatformJson(req('answers=123',{'content-type':'application/x-www-form-urlencoded'})),{status:415});
});
test('CP64: JSON multipart ou misto não é aceito',async()=>{
 await assert.rejects(()=>readPlatformJson(req('{}',{'content-type':'application/json,text/plain'})),{status:415});
});
test('CP64: usuário comum não recebe permissões de Admin',async()=>{
 const u={id:'u1',app_metadata:{},user_metadata:{role:'admin',permissions:['permissions.manage']}};
 assert.deepEqual(await adminPermissions(mockDb(u),u,{}),[]);
});
test('CP64: papel admin de app_metadata recebe permissões autorizadas',async()=>{
 const u={id:'u1',app_metadata:{role:'admin'}};
 const p=await adminPermissions(mockDb(u),u,{});
 assert(p.includes('permissions.manage'));
 assert(p.includes('finance.manage'));
 assert(p.includes('reports.run'));
});
test('CP64: finance_admin não vira Master',async()=>{
 const u={id:'u1',app_metadata:{role:'finance_admin'}};
 const p=await adminPermissions(mockDb(u),u,{});
 assert.deepEqual(p,['finance.manage']);
 assert(!p.includes('permissions.manage'));
});
test('CP64: permissões por tabela aceitam apenas lista branca',async()=>{
 const u={id:'u1',app_metadata:{}};
 const p=await adminPermissions(mockDb(u,['reports.run','dangerous.action']),u,{});
 assert.deepEqual(p,['reports.run']);
});
test('CP64: token inválido impede administração',async()=>{
 const u={id:'u1',app_metadata:{role:'admin'}};
 const db=mockDb(u);
 await assert.rejects(()=>requireAdminPermission(new Request('https://qa.invalid',{headers:{authorization:'Bearer invalid'}}),db,'permissions.manage'),{status:401});
});
test('CP64: permissão financeira não permite atribuir permissões',async()=>{
 const u={id:'u1',app_metadata:{role:'finance_admin'}};
 await assert.rejects(()=>requireAdminPermission(tokenReq(),mockDb(u),'permissions.manage'),{status:403});
});
test('CP64-B127: somente Master legítimo pode consultar o escritório, sem privilégio delegado',async()=>{
 const u={id:'u1',app_metadata:{role:'master'}};
 const authenticated=await requireAdminPermission(tokenReq(),mockDb(u),'permissions.manage');
 assert.equal(authenticated.id,'u1');
 const delegated={id:'u1',app_metadata:{role:'admin'}};
 await assert.rejects(()=>requireAdminPermission(tokenReq(),mockDb(delegated),'permissions.manage'),{status:403});
});
test('CP64: cadastro administrativo separado só aceita permissões previstas',()=>{
 const p=read('app/admin/plataforma/permissoes/page.js');
 assert.match(p,/AdminAccess permission="permissions.manage"/);
 assert.match(p,/reports\.run/);
 assert.match(p,/finance\.manage/);
 assert.doesNotMatch(p,/admin123|permissions\.manage">Master/);
 assert.match(read('app/admin/page.js'),/href:'\/admin\/plataforma\/permissoes'/);
});
test('CP64: nenhum cliente pode tratar laudo local como confirmado',()=>{
 const s=read('app/diagnostico/page.js');
 assert.match(s,/if \(!status\.verified\)/);
 assert.match(s,/Continuar apenas no simulador/);
 assert.doesNotMatch(s,/persistLocalReport\(/);
 const route=read('app/api/platform/diagnostico/route.js');
 assert.match(route,/readPlatformJson\(request\)/);
});
test('CP64: migração usa restrições e privilégios mínimos',()=>{
 const sql=read('supabase/migrations/20261019014500_platform_diagnostic_private_cp63.sql');
 assert.match(sql,/answers <@ ARRAY\[0,1,2,3,4\]::smallint\[\]/);
 assert.match(sql,/enable row level security/);
 assert.match(sql,/revoke all on public\.jenios_platform_diagnostics from public,anon,authenticated/);
 assert.doesNotMatch(sql,/grant (select|insert) on public\.jenios_platform_diagnostics to authenticated/);
});
