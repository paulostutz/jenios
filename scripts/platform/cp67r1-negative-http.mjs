import assert from 'node:assert/strict';
const origin=process.env.PLATFORM_QA_ORIGIN||'http://127.0.0.1:3127';
let checks=0;
async function attempt(path,options={},allowed=[503]){
  const response=await fetch(origin+path,{cache:'no-store',...options});
  const text=await response.text();
  assert(allowed.includes(response.status),path+' returned '+response.status);
  assert.match(response.headers.get('cache-control')||'',/no-store/);
  assert(!text.includes('service_role')&&!text.includes('SUPABASE_SERVICE_ROLE_KEY'));
  checks++;
  console.log('PASS_PRIVATE_API '+response.status+' '+path+' '+(options.method||'GET'));
}
await attempt('/api/platform/diagnostico',{},[503]);
await attempt('/api/platform/risk-summary',{},[503]);
await attempt('/api/platform/diagnostico',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({answers:[4,4,4,4,4],timeframe:'SWING'})},[503]);
await attempt('/api/admin/access',{},[401]);
await attempt('/api/platform/admin/access',{},[401]); // ausência de token: autenticação recusada antes do acesso ao banco
const forbidden=await fetch(origin+'/api/platform/risk-summary',{method:'POST'});
assert.equal(forbidden.status,405,'The risk summary endpoint must be read-only');
checks++;console.log('PASS_PRIVATE_API 405 /api/platform/risk-summary POST');
console.log('CP67R1_FAIL_CLOSED_HTTP_CHECKS='+checks);
