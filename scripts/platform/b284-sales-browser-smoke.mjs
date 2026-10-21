/** B284 browser smoke against LOCAL Next.js only; no banks, AI bills or orders. */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setTimeout as sleep} from 'node:timers/promises';
const origin=new URL(process.env.JENIOS_B284_BASE_URL||'http://127.0.0.1:3127');
assert.equal(origin.protocol,'http:');
assert.ok(['localhost','127.0.0.1','[::1]'].includes(origin.hostname));
const profile=await mkdtemp(join(tmpdir(),'jenios-b284-sales-'));
const port=9364,chrome=spawn(process.env.CHROME_BIN||'google-chrome',[
 '--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',
 '--no-first-run','--disable-background-networking','--disable-extensions',
 '--remote-allow-origins=*','--remote-debugging-port='+port,
 '--user-data-dir='+profile,'about:blank'
],{stdio:'ignore'});
let socket,serial=0,checks=0,spawnError;
const pending=new Map(),urls=[];
chrome.on('error',e=>spawnError=e);
function cd(method,params={}){
 return new Promise((resolve,reject)=>{
  const id=++serial,timer=setTimeout(()=>{pending.delete(id);reject(Error('B284_CDP_TIMEOUT '+method));},14000);
  pending.set(id,{resolve,reject,timer});
  socket.send(JSON.stringify({id,method,params}));
 });
}
async function evaluate(expression){
 const value=await cd('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
 assert.equal(value.exceptionDetails,undefined,'B284_BROWSER_EXPRESSION_ERROR '+JSON.stringify(value.exceptionDetails));
 return value.result?.value;
}
async function wait(expression){
 for(let i=0;i<75;i++){if(await evaluate(expression))return;await sleep(170);}
 throw Error('B284_DOM_STATE_NOT_REACHED '+expression);
}
function pass(ok,msg){assert.ok(ok,msg);checks++;console.log('PASS B284 '+msg);}
const nav=async pathname=>cd('Page.navigate',{url:new URL(pathname,origin).href});
const dock='[data-jenios-assistant="social-free"]';
try{
 let addr;
 for(let i=0;i<65;i++){
  if(spawnError)throw spawnError;
  try{const tabs=await(await fetch('http://127.0.0.1:'+port+'/json')).json();
   addr=tabs.find(x=>x.type==='page')?.webSocketDebuggerUrl;if(addr)break;}catch{}
  await sleep(180);
 }
 assert.ok(addr,'B284_CHROME_UNAVAILABLE');
 socket=new WebSocket(addr);
 await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
 socket.onmessage=event=>{
  const data=JSON.parse(event.data);
  if(data.method==='Network.requestWillBeSent')urls.push(data.params.request?.url);
  const job=pending.get(data.id);if(!job)return;
  clearTimeout(job.timer);pending.delete(data.id);
  data.error?job.reject(Error(data.error.message)):job.resolve(data.result||{});
 };
 await cd('Page.enable');await cd('Runtime.enable');await cd('Network.enable');
 await cd('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
 await nav('/lp');
 await wait('document.querySelector('+JSON.stringify(dock)+')!==null');
 pass(await evaluate('document.querySelector('+JSON.stringify(dock)+')?.dataset.persona==="unselected"'),
  'LP has the reusable free sales launcher');
 await evaluate('document.querySelector('+JSON.stringify(dock+' button[aria-controls]')+').click()');
 await wait('document.body.innerText.includes("Com quem deseja conversar?")');
 await evaluate('[...document.querySelectorAll("button")].find(x=>x.textContent==="Conversar com Gênio").click()');
 await wait('document.querySelector("#jenios-free-question")!==null');
 pass(true,'LP visitor selects Gênio without Social login');
 await evaluate('(()=>{const el=document.getElementById("jenios-free-question");Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,"value").set.call(el,"Quero conhecer o plano de R$ 149,90");el.dispatchEvent(new Event("input",{bubbles:true}));})()');
 await wait('document.getElementById("jenios-free-question")?.value.includes("149,90")');
 await evaluate('document.querySelector("#jenios-free-question").closest("form").requestSubmit()');
 await wait('document.body.innerText.includes("O plano Global Crypto")');
 pass(await evaluate('document.body.innerText.includes("R$ 149,90")'),
  'Sales reply uses approved price without contacting external model');
 pass(await evaluate('document.querySelector('+JSON.stringify(dock+' a[href="/checkout"]')+')!==null'),
  'Sales flow exposes official checkout link');
 for(const [w,h] of [[390,844],[360,780],[320,740]]){
  await cd('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:1,mobile:true});
  await sleep(100);
  pass(await evaluate('(()=>{const el=document.querySelector('+JSON.stringify(dock+' section[role="dialog"]')+');const r=el.getBoundingClientRect();return r.width<=innerWidth+2&&r.left>=-3&&r.right<=innerWidth+3;})()'),
   'Sales chat remains inside mobile '+w+'px');
 }
 await cd('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
 await nav('/platform/assistente');
 await wait('document.body.innerText.includes("Atendimento JENIOS")');
 pass(await evaluate('document.querySelector("#jenios-free-question")!==null'),
  'Platform has same free support room without Pro entitlement');
 pass(await evaluate('document.querySelector('+JSON.stringify('a[href="/checkout"]')+')!==null'),
  'Platform directs visitors to official checkout');
 await nav('/planos');
 await wait('location.pathname==="/checkout"');
 pass(true,'Legacy /planos redirects to dynamic checkout rather than static Pix');
 pass(urls.every(x=>!x?.includes('api.openai.com')&&!x?.includes('cdpj.partners.bancointer.com.br')),
  'No external model or Banco Inter calls occurred during local browser acceptance');
 console.log('B284_SALES_BROWSER_ACCEPTANCE='+checks+' localhost-only');
}finally{
 for(const x of pending.values())clearTimeout(x.timer);
 try{socket?.close();}catch{}
 try{chrome.kill('SIGTERM');}catch{}
 await rm(profile,{recursive:true,force:true}).catch(()=>{});
}
