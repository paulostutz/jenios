import {checkS05DeploymentScope} from '../lib/release/environment-scope.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
function worker(offline=false){
 const handlers={},seen=[],cached=[];
 const self={location:{origin:'https://www.jenios.com.br'},addEventListener:(type,fn)=>{handlers[type]=fn;},skipWaiting:async()=>{},clients:{claim:async()=>{}}};
 const caches={open:async()=>({addAll:async paths=>cached.push(...paths)}),keys:async()=>[],delete:async()=>true,match:async path=>({cached:path})};
 vm.runInNewContext(readFileSync('public/jenios-mobile-sw.js','utf8'),{self,caches,URL,Response,fetch:async req=>{seen.push(req.url);if(offline)throw Error('offline');return new Response('network');}});
 return {handlers,seen,cached};
}
async function request(w,path,{method='GET',auth=false,mode='navigate'}={}){
 let result;w.handlers.fetch({request:{url:'https://www.jenios.com.br'+path,method,mode,headers:new Headers(auth?{authorization:'Bearer private-token'}:{})},respondWith:r=>{result=r;}});return result&&await result;
}
test('mobile entry keeps the two existing access flows and installation identity',()=>{
 const manifest=JSON.parse(readFileSync('public/mobile/manifest.webmanifest'));
 assert.equal(manifest.start_url,'/mobile.html');assert.equal(manifest.scope,'/');assert.equal(manifest.display,'standalone');
 const html=readFileSync('public/mobile.html','utf8');assert.match(html,/href="\/social"/);assert.match(html,/href="\/platform\/entrar\?next=%2Fdashboard-logado"/);
});
test('worker never intercepts APIs, writes, bearer requests or signed assets',async()=>{
 const w=worker();
 for(const [path,opts] of [['/api/social/posts',{}],['/api/platform/subscription/checkout',{method:'POST'}],['/social',{auth:true}],['/mobile/icon-256.png?token=private',{mode:'cors'}]])assert.equal(await request(w,path,opts),undefined);
 assert.equal(w.seen.length,0);
});
test('private navigation uses network and never becomes a cached account snapshot',async()=>{
 const w=worker();assert.equal(await (await request(w,'/dashboard-logado')).text(),'network');assert.equal(w.cached.length,0);
 const failed=worker(true);assert.equal((await request(failed,'/dashboard-logado')).cached,'/mobile/offline.html');
 assert.equal((await request(failed,'/mobile.html?code=private')).cached,'/mobile/offline.html');
 assert.equal((await request(failed,'/mobile.html')).cached,'/mobile.html');
});
test('precache contains only the public entry and explicitly listed static assets',async()=>{
 const w=worker();let done;w.handlers.install({waitUntil:p=>{done=p;}});await done;
 assert.ok(w.cached.includes('/mobile.html'));assert.ok(w.cached.includes('/mobile/offline.html'));
 assert.equal(w.cached.some(p=>/api|dashboard|checkout|platform|social/.test(p)),false);
});

test('M02 preview remains isolated and rejects every external action and production promotion',()=>{
 const actions=['JENIOS_PAY_PAYMENTS_ENABLED','JENIOS_PRO_PAYMENTS_ENABLED','JENIOS_INTER_CHARGES_ENABLED',
 'JENIOS_REAL_EXECUTION_ENABLED','JENIOS_PRIVATE_PAPER_EXECUTOR','JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED',
 'JENIOS_EMAIL_PRODUCTION_ENABLED','JENIOS_EMAIL_DISPATCHER_ENABLED','JENIOS_PAYMENT_EMAILS_ENABLED',
 'JENIOS_TRANSACTIONAL_EMAILS_ENABLED','JENIOS_MARKETING_EMAILS_ENABLED','JENIOS_MARKETING_PLANNER_ENABLED',
 'JENIOS_SUBSCRIPTION_DUNNING_ENABLED','JENIOS_RESEND_WEBHOOK_ENABLED','JENIOS_PRO_GENERATION_ENABLED',
 'JENIOS_SALES_GENERATIVE_ENABLED','JENIOS_ASSISTANT_MEMORY_ENABLED','NEXT_PUBLIC_PLATFORM_SIGNUP_ENABLED'];
 const env={VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'feat/jenios-mobile-m02-20261024',VERCEL_PROJECT_ID:'prj_44ipBY3R9sHlQDAXY7NUn1zDguw4',
 NEXT_PUBLIC_SUPABASE_URL:'https://rebzztxlzofxpfwjvbee.supabase.co',SOCIAL_SUPABASE_URL:'https://rebzztxlzofxpfwjvbee.supabase.co',
 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'fixture',PLATFORM_SUPABASE_URL:'https://xaicvhagftzjkqphnbgx.supabase.co',
 NEXT_PUBLIC_PLATFORM_SUPABASE_URL:'https://xaicvhagftzjkqphnbgx.supabase.co',NEXT_PUBLIC_PLATFORM_SUPABASE_PUBLISHABLE_KEY:'fixture',
 ...Object.fromEntries(actions.map(key=>[key,'false']))};
 assert.equal(checkS05DeploymentScope(env).ok,true);
 for(const key of actions)for(const value of ['true',undefined])assert.equal(checkS05DeploymentScope({...env,[key]:value}).ok,false,key);
 assert.equal(checkS05DeploymentScope({...env,VERCEL_PROJECT_ID:'other'}).ok,false);
 assert.equal(checkS05DeploymentScope({...env,NEXT_PUBLIC_SUPABASE_URL:'https://igayfjorjmucthlfoasf.supabase.co'}).ok,false);
 assert.equal(checkS05DeploymentScope({...env,VERCEL_ENV:'production',NEXT_PUBLIC_SUPABASE_URL:'https://igayfjorjmucthlfoasf.supabase.co',SOCIAL_SUPABASE_URL:'https://igayfjorjmucthlfoasf.supabase.co',SUPABASE_SECRET_KEY:'fixture'}).ok,false);
});
