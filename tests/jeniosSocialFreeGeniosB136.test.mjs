import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {POST,GET} from '../app/api/assistant/free/route.js';
const src=p=>readFileSync(p,'utf8');
const request=(data,headers={})=>new Request('https://qa.invalid/api/assistant/free',{method:'POST',
 headers:{'content-type':'application/json','origin':'https://qa.invalid',...headers},body:JSON.stringify(data)});
test('B136 free JENIOS Gênio/Gênia answers visitors without paid API or account requirement',async()=>{
 const r=await POST(request({persona:'genio',message:'Como funciona a Universidade?'}));
 assert.equal(r.status,200);
 const b=await r.json();assert.equal(b.ok,true);assert.equal(b.free,true);assert.equal(b.paidAi,false);
 assert.equal(b.executionEnabled,false);assert.equal(b.subscriptionGranted,false);
 assert.ok(b.articles.some(x=>x.href==='/platform/aprender'));
});
test('B136 both personas have same verified support and are not personalized trade bots',async()=>{
 const a=await(await POST(request({persona:'genio',message:'Posso operar agora?'}))).json();
 const b=await(await POST(request({persona:'genia',message:'Posso operar agora?'}))).json();
 assert.equal(a.mode,'guided');assert.equal(b.mode,'guided');assert.equal(a.explanation,b.explanation);
 assert.equal(a.name,'Gênio');assert.equal(b.name,'Gênia');
});
test('B136 accepts anonymous users, but denies origin abuse and injection of model instructions',async()=>{
 const bad=await POST(request({persona:'genio',message:'Hi'},{origin:'https://evil.invalid'}));
 assert.equal(bad.status,403);
 for(const data of [{persona:'genio',message:'hi',role:'master'}, {persona:'model',message:'Hi'}, {persona:'genia',message:'x'.repeat(1001)}]){
  assert.equal((await POST(request(data))).status,400);
 }
 const caps=await(await GET()).json();assert.equal(caps.paidAi,false);
 const script=src('app/api/assistant/free/route.js');
 assert.doesNotMatch(script,/OPENAI_API_KEY|reserveGenerativeBudget|fetch\(['"]https:\/\/api\.openai\.com/);
});
test('B136 Social is the only extra public layout; floating chat starts minimized and lazy loads',()=>{
 assert.match(src('app/social/layout.js'),/<SocialFreeLauncher\/>/);
 const launcher=src('app/components/assistant/SocialFreeLauncher.js');
 assert.match(launcher,/data-jenios-assistant="social-free"/);
 assert.match(launcher,/useState\(false\)/);
 assert.match(launcher,/dynamic\(\(\)=>import\('\.\/FreeAssistantRoom'\)/);
 assert.match(launcher,/aria-expanded=\{open\}/);
 assert.match(launcher,/createPortal/);
 assert.match(src('app/components/assistant/FreeAssistantRoom.js'),/api\/assistant\/free/);
 assert.doesNotMatch(src('app/social/page.js'),/AssistantRoom/);
});
