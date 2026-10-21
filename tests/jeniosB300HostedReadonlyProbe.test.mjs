import test from 'node:test';
import assert from 'node:assert/strict';
import {
 B300_PINNED_PREVIEW,B300_PREVIEW_SHA,assertB300PinnedPreview,
 inspectB300PlatformCatalog,inspectB300SocialCatalog,probeB300HostedPreview
} from '../lib/platform/qa/b300-hosted-readonly-probe.mjs';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const plans=[
 {id:null,code:'platform-nacional',price_cents:9990,category:'platform',active:false,
  configured:false,billing_type:'monthly',currency:'BRL'},
 {id:null,code:'platform-global-crypto',price_cents:14990,category:'platform',active:false,
  configured:false,billing_type:'monthly',currency:'BRL'},
 {id:null,code:'platform-internacional-pro',price_cents:19990,category:'platform',active:false,
  configured:false,billing_type:'monthly',currency:'BRL'}
];
const platform={products:plans,paymentsEnabled:false,checkoutReady:false,
 checkoutScope:'platform',catalogStatus:'defaults'};
const social={products:[{code:'social-university-monthly',active:false,price_cents:4990,
 billing_type:'monthly'}],paymentsEnabled:false,checkoutReady:false,checkoutScope:'social'};
const json=data=>Response.json(data,{status:200});
function makeFetch(patch={}){
 const calls=[];
 const fetcher=async(url,options)=>{
  calls.push({url,options});
  const target=new URL(url),path=target.pathname+target.search;
  if(patch.throwOn===path)throw Error('network unavailable with secret token should never be printed');
  if(patch.override?.[path])return patch.override[path];
  if(path==='/api/assistant/free')return json({ok:true,free:true,paidAi:false,personas:['genio','genia']});
  if(path==='/api/jenios-pay/products?scope=platform')return json(platform);
  if(path==='/api/jenios-pay/products?scope=social')return json(social);
  if(['/api/platform/learning','/api/assistant/pro/access',
   '/api/platform/admin/access','/api/admin/inter/setup'].includes(path))
   return Response.json({ok:false,error:'Unauthorized'},{status:401});
  return new Response('<main>QA fixture</main>',{status:200,headers:{'content-type':'text/html'}});
 };
 return {fetcher,calls};
}
test('B300 pins the precise previously READY B293 Preview rather than production',()=>{
 assert.equal(assertB300PinnedPreview(B300_PINNED_PREVIEW),B300_PINNED_PREVIEW);
 assert.equal(B300_PREVIEW_SHA,'b44d43a4fa6ff6249d61bf8b257b1a64105be33d');
 for(const address of ['https://jenios.com.br','https://evil.vercel.app',
  B300_PINNED_PREVIEW+'/other',B300_PINNED_PREVIEW+'?key=one',
  'http://jenios-ecossistem-9dgnjtals-jenios.vercel.app'])
  assert.throws(()=>assertB300PinnedPreview(address));
});
test('B300 no network writes, no auth tokens, all 17 GET checks in offline harness',async()=>{
 const x=makeFetch(),result=await probeB300HostedPreview({fetcher:x.fetcher});
 assert.equal(result.observedGetRequests,17);
 assert.equal(result.hostedAnonymousBoundaryCertified,true);
 assert.equal(result.authenticatedUserSessionsCertified,false);
 assert.equal(result.integratedB298B299HostedCertified,false);
 assert.equal(result.bankTransfersMade,0);
 assert.equal(result.ordersSent,0);
 assert.equal(result.paidModelInvocations,0);
 assert.ok(x.calls.every(c=>c.options.method==='GET'&&c.options.redirect==='manual'&&
  c.options.credentials==='omit'&&!c.options.headers.authorization));
 assert.ok(x.calls.every(c=>new URL(c.url).origin===B300_PINNED_PREVIEW));
});
test('B300 fallback platform catalog cannot claim configured or active checkout',()=>{
 assert.equal(inspectB300PlatformCatalog(platform).fallbackReported,true);
 for(const change of [{active:true},{configured:true},{price_cents:1},{billing_type:'annual'},{category:'other'}]){
  const rows=plans.map((p,i)=>i===0?{...p,...change}:p);
  assert.throws(()=>inspectB300PlatformCatalog({...platform,products:rows}));
 }
 assert.throws(()=>inspectB300PlatformCatalog({...platform,paymentsEnabled:true}));
 assert.throws(()=>inspectB300PlatformCatalog({...platform,checkoutReady:true}));
});
test('B300 configured but inactive DB claims do not become independent DB proof',()=>{
 const payload={...platform,catalogStatus:undefined,products:plans.map(p=>({...p,id:'db-fixture',configured:true}))};
 const result=inspectB300PlatformCatalog(payload);
 assert.equal(result.persistedRowsClaimed,true);
 assert.equal(result.independentDatabaseProven,false);
 assert.equal(result.checkoutReady,false);
});
test('B300 Social University is inactive at approved monthly price',()=>{
 assert.equal(inspectB300SocialCatalog(social).universityMonthlyInactive,true);
 for(const patch of [{active:true},{price_cents:4991},{billing_type:'one_time'}]){
  assert.throws(()=>inspectB300SocialCatalog({...social,products:[{...social.products[0],...patch}]}));
 }
});
test('B300 external access gate or redirect never counts as validated public route',async()=>{
 const x=makeFetch({override:{'/':new Response('',{status:307,headers:{location:'https://sso.vercel.com'}})}});
 await assert.rejects(()=>probeB300HostedPreview({fetcher:x.fetcher}),{code:'B300_HOSTED_ACCESS_PROTECTED_OR_REDIRECTED'});
});
test('B300 200 on a protected API is a security failure',async()=>{
 const x=makeFetch({override:{'/api/platform/admin/access':Response.json({permissions:['platform.admin']})}});
 await assert.rejects(()=>probeB300HostedPreview({fetcher:x.fetcher}),{code:'B300_PRIVATE_API_EXPOSED'});
});
test('B300 unreachable Preview is NO-GO, no arbitrary address retry',async()=>{
 const x=makeFetch({throwOn:'/'}),message=await assert.rejects(
  ()=>probeB300HostedPreview({fetcher:x.fetcher}),{code:'B300_HOSTED_NETWORK_UNREACHABLE'});
 assert.equal(x.calls.length,1);
});
test('B300 external response that advertises paid Ai is rejected',async()=>{
 const x=makeFetch({override:{'/api/assistant/free':json({ok:true,free:true,paidAi:true,personas:['genio','genia']})}});
 await assert.rejects(()=>probeB300HostedPreview({fetcher:x.fetcher}),{code:'B300_FREE_ASSISTANT_UNSAFE'});
});
test('B300 uses original Auth CP69 but never creates users or uses secrets in CI',()=>{
 const source=read('scripts/platform/cp69-authenticated-e2e.mjs');
 assert.match(source,/auth\.admin\.createUser/);
 assert.match(source,/auth\.admin\.deleteUser/);
 const yml=read('.github/workflows/jenios-b300qa-hosted-readonly.yml');
 assert.doesNotMatch(yml,/\$\{\{\s*secrets\./);
 assert.doesNotMatch(yml,/cp69-authenticated-e2e\.mjs/);
 const vercel=JSON.parse(read('vercel.json'));
 assert.equal(vercel.git.deploymentEnabled['fix/jenios-b300qa-hosted-preview-readonly-evidence-20261021'],false);
});
