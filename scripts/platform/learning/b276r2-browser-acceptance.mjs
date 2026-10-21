/** B276 authenticated University acceptance in localhost only, with synthetic browser API.
 * NO real accounts, payments, remote model calls or provider credentials.
 */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setTimeout as sleep} from 'node:timers/promises';
import {TRACKS,LESSONS} from '../../../lib/learning/catalog.mjs';
import {initialState,projectLesson} from '../../../lib/learning/engine.mjs';

const base=new URL(process.env.JENIOS_B276_UI_BASE_URL||'http://127.0.0.1:3127');
assert.ok(base.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(base.hostname),'B276_LOCAL_BROWSER_ONLY');
const denial=await fetch(new URL('/api/platform/learning',base));
assert.ok([401,402,503].includes(denial.status),'Unauthenticated learning route must fail closed');
const anonymousBody=await denial.json();assert.equal(anonymousBody.ok,false);assert.equal(anonymousBody.learning,undefined);
const DATA={
 tracks:TRACKS,
 lessons:LESSONS.map(x=>({id:x.id,title:x.title,trackId:x.trackId,minutes:x.minutes})),
 views:Object.fromEntries(LESSONS.map(x=>[x.id,projectLesson(initialState(),x.id)]))
};
const A='b2760000-0000-4000-8000-000000000001',B='b2760000-0000-4000-8000-000000000002';
const bootstrap=[
 '(()=>{',
 'if(!["localhost","127.0.0.1"].includes(location.hostname))throw Error("B276_NOT_LOCAL");',
 'const CATALOG='+JSON.stringify(DATA)+';',
 'const A='+JSON.stringify(A)+';const B='+JSON.stringify(B)+';',
 'const owner=localStorage.getItem("b276-owner")||A;',
 'const guest=owner==="visitor";const denied=owner==="unpaid";',
 'const user={id:owner,aud:"authenticated",role:"authenticated",email:"b276-fixture@example.invalid",is_anonymous:false,user_metadata:{},app_metadata:{provider:"email"},created_at:"2026-10-21T00:00:00Z"};',
 'const seconds=Math.floor(Date.now()/1000);',
 'const token="eyJhbGciOiJIUzI1NiJ9."+btoa(JSON.stringify({sub:owner,exp:seconds+3600,iat:seconds,aud:"authenticated",role:"authenticated"}))+"."+"x".repeat(43);',
 'const session={access_token:token,refresh_token:"b276-synthetic-only",expires_in:3600,expires_at:seconds+3600,token_type:"bearer",user};',
 'if(guest)localStorage.removeItem("sb-social-qa-auth-token");else localStorage.setItem("sb-social-qa-auth-token",JSON.stringify(session));',
 'const KEY="b276-progress:"+owner;',
 'const initial=()=>({revision:0,completedLessons:[],reviewDiary:[]});',
 'function read(){try{const data=JSON.parse(localStorage.getItem(KEY)||"null");return data&&Array.isArray(data.completedLessons)&&Number.isSafeInteger(data.revision)?data:initial();}catch{return initial();}}',
 'function write(data){localStorage.setItem(KEY,JSON.stringify(data));}',
 'function project(){const p=read();return {ok:true,access:{kind:"subscription",productCode:"platform-global-crypto"},learning:{revision:p.revision,route:CATALOG.tracks.map(t=>({...t,unlocked:true,lessons:CATALOG.lessons.filter(l=>l.trackId===t.id).map(l=>({...l,completed:p.completedLessons.includes(l.id)}))})),dailyStudy:{reviewedToday:p.reviewDiary},tutorBudget:{limit:40,used:0},notice:"Estudo livre e sem autorização de negociação.",executionEnabled:false}};}',
 'const respond=(data,status=200)=>Promise.resolve(new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json","Cache-Control":"private, no-store"}}));',
 'const original=window.fetch.bind(window);window.__b276Requests=[];window.__b276DelayLesson=null;',
 'window.fetch=(input,init={})=>{',
 ' const url=new URL(typeof input==="string"?input:input instanceof URL?input.href:input.url,location.origin);const method=init.method||input?.method||"GET";',
 ' window.__b276Requests.push({host:url.hostname,path:url.pathname,method});',
 ' if(url.hostname==="social-qa.invalid"){',
 '  if(url.pathname==="/auth/v1/user")return guest?respond({msg:"missing auth"},401):respond(user);',
 '  if(url.pathname==="/auth/v1/token")return guest?respond({},401):respond(session);',
 '  return respond({},503);',
 ' }',
 ' if(url.pathname==="/api/platform/learning"){',
 '  if(guest)return respond({ok:false,code:"AUTH_REQUIRED",error:"Entre na sua conta."},401);',
 '  if(denied)return respond({ok:false,code:"SUBSCRIPTION_REQUIRED",error:"Assinatura necessária."},402);',
 '  if(method==="GET"&&url.searchParams.has("lesson")){',
 '   const id=url.searchParams.get("lesson");const detail=CATALOG.views[id];',
 '   if(!detail)return respond({ok:false,error:"Aula não encontrada"},403);',
 '   const value={ok:true,lesson:detail};',
 '   if(window.__b276DelayLesson===id)return new Promise(done=>setTimeout(()=>done(new Response(JSON.stringify(value),{status:200,headers:{"Content-Type":"application/json"}})),800));',
 '   return respond(value);',
 '  }',
 '  if(method==="GET")return respond(project());',
 '  if(method==="POST"){let body;try{body=JSON.parse(init.body);}catch{return respond({ok:false,error:"JSON inválido"},400);}',
 '   const p=read();',
 '   if(body.revision!==p.revision)return respond({ok:false,code:"REVISION_CONFLICT",error:"Progresso alterado em outra aba.",revision:p.revision},409);',
 '   if(body.action==="complete_lesson"&&CATALOG.views[body.lessonId]){if(!p.completedLessons.includes(body.lessonId))p.completedLessons.push(body.lessonId);}',
 '   else if(body.action==="review_lesson"&&p.completedLessons.includes(body.lessonId)){if(!p.reviewDiary.includes(body.lessonId))p.reviewDiary.push(body.lessonId);}',
 '   else return respond({ok:false,error:"Ação não autorizada."},403);',
 '   p.revision++;write(p);return respond(project());',
 '  }',
 '  return respond({ok:false},405);',
 ' }',
 ' if(url.origin!==location.origin)return respond({},503);',
 ' return original(input,init);',
 '};',
 '})();'
].join('\n');

const profile=await mkdtemp(join(tmpdir(),'jenios-b276-university-'));
const port=Number(process.env.JENIOS_B276_CDP_PORT||9366);
assert.ok(Number.isSafeInteger(port)&&port>=1024&&port<=65535);
const browser=spawn(process.env.CHROME_BIN||'google-chrome',[
 '--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',
 '--no-first-run','--disable-background-networking','--disable-extensions',
 '--remote-allow-origins=*','--remote-debugging-port='+port,
 '--user-data-dir='+profile,'about:blank'
],{stdio:'ignore'});
let socket,seq=0,checks=0,spawnError;const pending=new Map(),browserErrors=[],network=[];
browser.on('error',e=>spawnError=e);
function call(method,params={}){
 return new Promise((resolve,reject)=>{
  const id=++seq,timer=setTimeout(()=>{pending.delete(id);reject(Error('B276_CDP_TIMEOUT '+method));},12000);
  pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));
 });
}
async function evaluate(expression){
 const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
 assert.ok(!r.exceptionDetails,'Browser expression failed: '+JSON.stringify(r.exceptionDetails));
 return r.result?.value;
}
async function waitFor(expression){
 for(let i=0;i<90;i++){if(await evaluate(expression))return;await sleep(180);}
 throw Error('B276_BROWSER_STATE_NOT_REACHED '+expression);
}
function pass(check,label){assert.ok(check,label);checks++;console.log('PASS B276 '+label);}
const routeSelector='[aria-label="Escolher trilha de estudos"] button';
const lessonSelector='nav[aria-label="Aulas disponíveis"] button';
async function choose(index){
 await evaluate('document.querySelectorAll('+JSON.stringify(routeSelector)+')['+index+'].click()');
 await waitFor('document.querySelectorAll('+JSON.stringify(routeSelector)+')['+index+'].getAttribute("aria-pressed")==="true"');
}
async function navigate(){await call('Page.navigate',{url:new URL('/platform/aprender',base).href});}
try{
 let target;
 for(let n=0;n<65;n++){
  if(spawnError)throw spawnError;
  try{const list=await(await fetch('http://127.0.0.1:'+port+'/json')).json();target=list.find(x=>x.type==='page')?.webSocketDebuggerUrl;if(target)break;}catch{}
  await sleep(180);
 }
 assert.ok(target,'Headless Chromium unavailable');
 socket=new WebSocket(target);
 await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
 socket.onmessage=event=>{
  const data=JSON.parse(event.data);
  if(data.method==='Runtime.exceptionThrown')browserErrors.push(data.params.exceptionDetails?.text);
  if(data.method==='Network.requestWillBeSent')network.push({url:data.params.request?.url,method:data.params.request?.method});
  const pendingCall=pending.get(data.id);if(!pendingCall)return;
  clearTimeout(pendingCall.timer);pending.delete(data.id);
  data.error?pendingCall.reject(Error(data.error.message)):pendingCall.resolve(data.result||{});
 };
 await call('Page.enable');await call('Runtime.enable');await call('Network.enable');
 await call('Emulation.setDeviceMetricsOverride',{width:1440,height:960,deviceScaleFactor:1,mobile:false});
 await call('Page.addScriptToEvaluateOnNewDocument',{source:bootstrap});
 await navigate();
 await waitFor('document.body?.innerText.includes("Por onde você quer começar?")');
 pass(await evaluate('document.querySelectorAll('+JSON.stringify(routeSelector)+').length===5'),'five free-to-choose tracks visible');
 pass(await evaluate('document.querySelectorAll('+JSON.stringify(lessonSelector)+').length===3'),'three lessons per selected track');
 pass(await evaluate('document.body.innerText.includes("Seu histórico de leitura está salvo (0 de 15 aulas)")'),'initial progress clear without placement');
 pass(await evaluate('document.querySelectorAll("details ul li").length===56'),'56 original video resources remain available');
 for(let i=0;i<5;i++){
  await choose(i);
  pass(await evaluate('document.querySelectorAll('+JSON.stringify(lessonSelector)+').length===3&&document.querySelectorAll("section[aria-label=\"Oficinas de estudo\"] details").length===2'),'track '+(i+1)+' has 3 lessons and 2 optional workshops');
  await evaluate('document.querySelector("section[aria-label=\"Oficinas de estudo\"] summary")?.click()');
  pass(await evaluate('document.body.innerText.includes("Exemplo didático:")'),'workshop opens without any graded test on track '+(i+1));
 }
 const laboratory=TRACKS.findIndex(t=>t.id==='laboratorio');
 const advanced=LESSONS.find(l=>l.trackId==='laboratorio').id;
 await choose(laboratory);
 await evaluate('document.querySelectorAll('+JSON.stringify(lessonSelector)+')[0].click()');
 await waitFor('document.querySelector("article h2")!==null');
 pass(await evaluate('document.querySelector("article h2")?.textContent==='+JSON.stringify(LESSONS.find(l=>l.id===advanced).title)),'advanced lesson opens first without placement');
 await evaluate('[...document.querySelectorAll("button")].find(b=>b.textContent==="Marcar aula como lida")?.click()');
 await waitFor('document.body.innerText.includes("1 de 15 aulas")');
 pass(await evaluate('document.body.innerText.includes("1 de 15 aulas")'),'advanced completion persisted by fixture storage');
 await call('Page.reload',{ignoreCache:true});
 await waitFor('document.body?.innerText.includes("1 de 15 aulas")');
 pass(true,'advanced course completion survives reload of same account');
 await choose(0);
 await evaluate('window.__b276DelayLesson='+JSON.stringify(LESSONS.find(l=>l.trackId==='fundamentos').id));
 await evaluate('document.querySelectorAll('+JSON.stringify(lessonSelector)+')[0].click()');
 await choose(1);
 await sleep(1050);
 pass(await evaluate('document.querySelector("article h2")===null'),'delayed previous-track lesson cannot appear after switching tracks');
 const dims=[[1440,960,false],[1024,768,false],[768,900,false],[390,844,true],[360,780,true],[320,740,true],[844,390,true]];
 for(const [width,height,mobile] of dims){
  await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile});
  await sleep(150);
  pass(await evaluate('document.documentElement.scrollWidth<=innerWidth+8'),'no page horizontal overflow at '+width+'px');
  pass(await evaluate('[...document.querySelectorAll('+JSON.stringify(lessonSelector)+')].every(x=>x.getBoundingClientRect().height>=44)'),'lesson buttons accessible touch targets at '+width+'px');
 }
 await evaluate('localStorage.setItem("b276-owner",'+JSON.stringify(B)+')');
 await call('Page.reload',{ignoreCache:true});
 await waitFor('document.body?.innerText.includes("Por onde você quer começar?")');
 pass(await evaluate('document.body.innerText.includes("0 de 15 aulas")'),'different user cannot inherit prior account reading history');
 await evaluate('localStorage.setItem("b276-owner","unpaid")');
 await call('Page.reload',{ignoreCache:true});
 await waitFor('document.body?.innerText.includes("Seu próximo passo começa aqui")');
 pass(await evaluate('!document.body.innerText.includes("Por onde você quer começar?")'),'unpaid user cannot load private course');
 await evaluate('localStorage.setItem("b276-owner","visitor")');
 await call('Page.reload',{ignoreCache:true});
 await waitFor('document.body?.innerText.includes("Seu próximo passo começa aqui")');
 pass(await evaluate('!document.body.innerText.includes("Por onde você quer começar?")'),'guest sees no private course');
 await evaluate('localStorage.setItem("b276-owner",'+JSON.stringify(A)+')');
 await call('Page.reload',{ignoreCache:true});
 await waitFor('document.body?.innerText.includes("1 de 15 aulas")');
 pass(true,'original owner sees own historical lesson again');
 pass(network.every(r=>!r.url?.includes('/api/jenios-pay/checkout')&&!r.url?.includes('/api/assistant/university/checkout')&&!r.url?.includes('/api/platform/broker-execution')),'browser sends no checkout or broker order');
 console.log('B276_AUTHENTICATED_CHROMIUM_PASS='+checks+'; localhost synthetic users, no real payments or orders');
}finally{
 for(const p of pending.values())clearTimeout(p.timer);
 try{socket?.close();}catch{}
 try{browser.kill('SIGTERM');}catch{}
 await rm(profile,{recursive:true,force:true}).catch(()=>{});
}
