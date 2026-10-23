/** FC05: real local Next server + Chromium; fault responses are explicitly labelled fixtures. */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setTimeout as sleep} from 'node:timers/promises';
const origin=new URL(process.env.JENIOS_FC05_BASE_URL||'http://127.0.0.1:3055');
assert.equal(origin.protocol,'http:');assert.ok(['localhost','127.0.0.1','[::1]'].includes(origin.hostname));
const output=process.env.JENIOS_FC05_OUTPUT||'/tmp/jenios-fc05-browser';await mkdir(output,{recursive:true});
const profile=await mkdtemp(join(tmpdir(),'jenios-fc05-')),port=Number(process.env.JENIOS_FC05_CDP_PORT||9365);
const chrome=spawn(process.env.CHROME_BIN||'google-chrome',['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--no-first-run','--disable-background-networking','--disable-extensions','--remote-allow-origins=*','--remote-debugging-address=127.0.0.1','--remote-debugging-port='+port,'--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
const canceledRequests=new Set(),interceptions=new Set(),canceledInterceptions=[];
const checks=[],faultsApplied=[],blocked=[],responses=[],exceptions=[],interceptionErrors=[],pending=new Map();
let socket,serial=0,spawnError,fault=null,success=false;
chrome.on('error',e=>spawnError=e);
function cd(method,params={}){return new Promise((resolve,reject)=>{const id=++serial,timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP_TIMEOUT '+method));},20000);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));});}
async function evaluate(expression){const r=await cd('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});assert.equal(r.exceptionDetails,undefined,JSON.stringify(r.exceptionDetails));return r.result?.value;}
async function wait(expression){for(let i=0;i<180;i++){if(await evaluate(expression))return;await sleep(250);}throw Error('DOM_STATE_NOT_REACHED '+expression);}
function pass(value,label){assert.ok(value,label);checks.push(label);console.log('PASS FC05 '+label);}
async function nav(path,expression){await cd('Page.navigate',{url:new URL(path,origin).href});await wait('location.pathname==='+JSON.stringify(path)+' && document.readyState==="complete"');if(expression)await wait(expression);}
async function screenshot(name){const r=await cd('Page.captureScreenshot',{format:'png'});await writeFile(join(output,name+'.png'),Buffer.from(r.data,'base64'));}
const element=selector=>'document.querySelector('+JSON.stringify(selector)+')';
const bodyIncludes=text=>'document.body.innerText.includes('+JSON.stringify(text)+')';
async function click(selector){
 const position=await evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});el.scrollIntoView({block:'center'});const r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
 await cd('Input.dispatchMouseEvent',{type:'mousePressed',...position,button:'left',clickCount:1});
 await cd('Input.dispatchMouseEvent',{type:'mouseReleased',...position,button:'left',clickCount:1});
}
async function question(text){
 await click('#jenios-free-question');await evaluate('document.querySelector("#jenios-free-question").select()');
 await cd('Input.insertText',{text});
 await wait('!document.querySelector("#jenios-free-question").closest("form").querySelector("button").disabled');
 await click('#jenios-free-question + button');
}
async function intercept(p){
 const u=new URL(p.request.url);
 if(u.origin!==origin.origin){blocked.push({origin:u.origin,path:u.pathname});await cd('Fetch.failRequest',{requestId:p.requestId,errorReason:'BlockedByClient'});return;}
 if(fault&&u.pathname==='/api/assistant/free'&&p.request.method==='POST'){
  const simulated=fault;assert.equal(JSON.parse(p.request.postData).message,simulated.message);faultsApplied.push(simulated.label);
  if(simulated.network){await cd('Fetch.failRequest',{requestId:p.requestId,errorReason:'Failed'});return;}
  await cd('Fetch.fulfillRequest',{requestId:p.requestId,responseCode:simulated.status||200,responseHeaders:[{name:'content-type',value:'application/json'}],body:Buffer.from(typeof simulated.body==='string'?simulated.body:JSON.stringify(simulated.body)).toString('base64')});return;
 }
 await cd('Fetch.continueRequest',{requestId:p.requestId});
}
try{
 let addr;for(let i=0;i<300;i++){if(spawnError)throw spawnError;try{addr=(await(await fetch('http://127.0.0.1:'+port+'/json')).json()).find(x=>x.type==='page')?.webSocketDebuggerUrl;if(addr)break;}catch{}await sleep(200);}assert.ok(addr,'Chrome unavailable');
 socket=new WebSocket(addr);await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
 socket.onmessage=e=>{const d=JSON.parse(e.data);if(d.method==='Network.loadingFailed'&&d.params.canceled===true)canceledRequests.add(d.params.requestId);if(d.method==='Fetch.requestPaused'){const task=intercept(d.params).catch(e=>interceptionErrors.push({message:e.message,networkId:d.params.networkId,url:new URL(d.params.request.url).pathname}));interceptions.add(task);void task.finally(()=>interceptions.delete(task));}if(d.method==='Runtime.exceptionThrown')exceptions.push(d.params.exceptionDetails.exception?.description||d.params.exceptionDetails.text);if(d.method==='Network.responseReceived'&&d.params.response.url.startsWith(origin.origin+'/api/'))responses.push({url:new URL(d.params.response.url).pathname,status:d.params.response.status});const j=pending.get(d.id);if(j){clearTimeout(j.timer);pending.delete(d.id);d.error?j.reject(Error(d.error.message)):j.resolve(d.result||{});}};
 await cd('Page.enable');await cd('Runtime.enable');await cd('Network.enable');await cd('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]});
 await cd('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
 await nav('/platform/assistente','document.querySelector("#jenios-free-question")!==null');
 await click('button[aria-pressed="false"]');
 await wait(element('button[aria-pressed="true"]')+'.textContent.trim()==="Gênia"');
 await click('button[aria-pressed="false"]');
 await wait(element('button[aria-pressed="true"]')+'.textContent.trim()==="Gênio"');
 pass(true,'visitor selects both personas through actual browser clicks before asking');
 await question('O que está incluído no plano de R$ 149,90?');await wait(bodyIncludes('O plano Global Crypto'));
 pass(await evaluate(element('a[href="/checkout"]')+'!==null'),'visitor → free assistant → actual local API → approved plan and checkout link');
 for(const [name,response] of [
  ['missing links',{body:{ok:true,persona:'genio',paidAi:false,name:'Gênio',explanation:'Resposta incompleta simulada'}}],
  ['invalid link collection',{body:{ok:true,persona:'genio',paidAi:false,name:'Gênio',explanation:'Resposta simulada',links:{}}}],
  ['non-JSON',{body:'<html>Unavailable</html>'}],
  ['service unavailable',{status:503,body:{ok:false,error:'Serviço temporariamente indisponível.'}}],
  ['network failure',{network:true}]
 ]){
  const message='Pergunta de recuperação '+name;fault={...response,label:name,message};const previous=faultsApplied.length;await question(message);
  for(let i=0;i<200&&faultsApplied.length===previous;i++)await sleep(25);assert.equal(faultsApplied.length,previous+1,name+' response intercepted');
  await wait('document.querySelector("[role=alert]")!==null && !document.querySelector("#jenios-free-question").disabled');
  pass(exceptions.length===0,'fault fixture '+name+' keeps the conversation usable');
  pass(await evaluate(bodyIncludes('O plano Global Crypto')),'fault fixture '+name+' preserves previous verified reply');
  if(name==='missing links')await screenshot('assistant-malformed-recovered');
 }
 pass(faultsApplied.length===5,'all five dependency faults were actually injected');
 fault=null;await question('Como contratar a JENIOS?');await wait('document.querySelector("#jenios-free-question").value==="" && !document.querySelector("#jenios-free-question").disabled');
 pass(await evaluate('document.querySelector("[role=alert]")===null'),'actual local assistant API recovers after fault fixtures');
 const pages=[
  ['/lp',bodyIncludes('CLAREZA ANTES DO CLIQUE')],
  ['/social',element('a[href="/lp"]')+'!==null'],
  ['/platform/assistente','document.querySelector("#jenios-free-question")!==null'],
  ['/universidade',bodyIncludes('Entrar para contratar')],
  ['/platform/aprender',bodyIncludes('Seu próximo passo começa aqui')],
  ['/checkout',bodyIncludes('Assinaturas em preparação')],
  ['/relatorios',bodyIncludes('Ainda não há resultados de operações reais verificados')],
  ['/platform/entrar',bodyIncludes('Acesso da Platform')],
  ['/platform/recuperar',bodyIncludes('Recuperar acesso')],
  ['/admin/login',bodyIncludes('Entrar no painel')],
  ['/admin/emails',bodyIncludes('Entre com sua conta de administrador.')],
  ['/platform/admin',bodyIncludes('Entre com sua conta Master da JENIOS Social.')]
 ];
 for(const width of [1280,390,320]){
  await cd('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<600});
  for(const [path,ready] of pages){await nav(path,ready);pass(await evaluate('document.documentElement.scrollWidth<=innerWidth+2'),path+' '+width+'px no horizontal overflow');pass(exceptions.length===0,path+' '+width+'px no uncaught render errors');await screenshot(path.slice(1).replaceAll('/','-')+'-'+width);}
 }
 await nav('/checkout',bodyIncludes('Assinaturas em preparação'));
 pass(await evaluate('![...document.querySelectorAll("button")].some(b=>/Contratar plano mensal/.test(b.textContent))'),'fallback catalog has no payment creation action');
 await nav('/universidade',bodyIncludes('Entrar para contratar'));
 pass(await evaluate('!document.querySelector("input[type=checkbox], #university-pix-code")'),'University guest cannot consent to purchase or see a Pix code');
 await nav('/admin/emails',bodyIncludes('Entre com sua conta de administrador.'));
 pass(await evaluate(`(()=>{const el=document.querySelector('[role=status]');const bg=el.closest('main');const luminance=color=>{const rgb=color.match(/[\\d.]+/g).slice(0,3).map(Number).map(x=>{const v=x/255;return v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4;});return rgb[0]*0.2126+rgb[1]*0.7152+rgb[2]*0.0722;};const background=luminance(getComputedStyle(bg).backgroundColor);return [el,el.querySelector('a')].every(e=>{const fg=luminance(getComputedStyle(e).color);return (Math.max(fg,background)+0.05)/(Math.min(fg,background)+0.05)>=4.5;});})()`),'Master denial text and login link remain readable against their background');
 pass(await evaluate('!document.body.innerText.includes("Liberação de e-mails")'),'Master email data never renders for guest');
 await nav('/relatorios',bodyIncludes('Ainda não há resultados de operações reais verificados'));
 pass(await evaluate('!document.body.innerText.includes("86.5%") && !document.body.innerText.includes("1.395") && ![...document.querySelectorAll("button")].some(b=>/PDF|Exportar/i.test(b.textContent))'),'reports show no invented performance or fake export action');
 for(const [path,method] of [['/api/admin/access','GET'],['/api/admin/email-health','GET'],['/api/platform/admin/access','GET'],['/api/assistant/university/access','GET'],['/api/assistant/university/checkout','POST'],['/api/assistant/university/status?orderId=00000000-0000-4000-8000-000000000005','GET']]){
  const r=await evaluate(`(async()=>{const r=await fetch(${JSON.stringify(path)},{method:${JSON.stringify(method)},headers:{'content-type':'application/json'},${method==='POST'?"body:'{}',":''}cache:'no-store'});return {status:r.status,body:await r.json()};})()`);
  pass(r.status===401&&!r.body.order&&!r.body.access&&!r.body.permissions,'actual local API rejects unauthenticated '+method+' '+path);
 }
 await nav('/social',element('a[href="/lp"]')+'!==null');
 await evaluate(element('a[href="/lp"]')+'.click()');await wait('location.pathname==="/lp" && document.body.innerText.includes("CLAREZA ANTES DO CLIQUE")');pass(true,'Social link reaches Platform introduction');
 await cd('Page.navigate',{url:new URL('/planos',origin).href});await wait('location.pathname==="/checkout"');pass(true,'legacy plans route reaches guarded checkout');
 await cd('Page.navigate',{url:new URL('/dashboard-logado',origin).href});await wait('location.pathname==="/platform/entrar"');pass(true,'guest account page redirects to Platform login');
 await Promise.allSettled([...interceptions]);
 // A navigation may cancel a paused request before Fetch.continue/fail reaches Chrome.
 // Accept only the matching Network cancellation; unknown interception failures still fail.
 for(let i=interceptionErrors.length-1;i>=0;i--){const e=interceptionErrors[i];if(e.networkId&&canceledRequests.has(e.networkId)&&/Invalid InterceptionId/i.test(e.message)){canceledInterceptions.push(e);interceptionErrors.splice(i,1);}}
 pass(interceptionErrors.length===0,'network interception completed without errors '+JSON.stringify(interceptionErrors));pass(exceptions.length===0,'no uncaught browser errors in accepted flows');success=true;
 console.log('FC05_BROWSER_ACCEPTANCE='+checks.length+' localhost-only; authenticated acceptance remains pending');
}finally{
 await writeFile(join(output,'BROWSER_EVIDENCE.json'),JSON.stringify({schema:'JENIOS_FC05_BROWSER_V1',success,checks,faultsApplied,blockedExternalRequests:blocked,localAPIResponses:responses,uncaughtErrors:exceptions,interceptionErrors,canceledInterceptions,faultsAreFixtures:true,authenticatedAcceptance:false,productionTouched:false,realOrdersSent:0,externalPaperOrdersSent:0,realEmailsSent:0,chargesCreated:0},null,2));
 for(const p of pending.values())clearTimeout(p.timer);try{socket?.close();}catch{}try{chrome.kill('SIGTERM');}catch{}await rm(profile,{recursive:true,force:true}).catch(()=>{});
}
