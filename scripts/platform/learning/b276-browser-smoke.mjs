/** B276 guest and responsive browser smoke; only localhost, no real user/account/payment. */
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setTimeout as sleep} from 'node:timers/promises';
import assert from 'node:assert/strict';
const profile=await mkdtemp(join(tmpdir(),'jenios-b276-'));
const port=9362,root='http://127.0.0.1:3127';
const browser=spawn(process.env.CHROME_BIN||'google-chrome',['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--no-first-run','--disable-background-networking','--remote-allow-origins=*','--remote-debugging-port='+port,'--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
let socket,seq=0,checks=0,error;browser.on('error',e=>error=e);
const pending=new Map(),requests=[];
function call(method,params={}){return new Promise((resolve,reject)=>{const id=++seq,timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout '+method));},12000);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));});}
async function evalJS(expression){const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});assert.ok(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result?.value;}
async function waitFor(x){for(let i=0;i<50;i++){if(await evalJS(x))return;await sleep(200);}throw Error('Unready '+x);}
const pass=(cond,msg)=>{assert.ok(cond,msg);checks++;console.log('PASS B276 '+msg);};
try{
 let ws;for(let i=0;i<65;i++){if(error)throw error;try{const tabs=await(await fetch('http://127.0.0.1:'+port+'/json')).json();ws=tabs.find(x=>x.type==='page')?.webSocketDebuggerUrl;if(ws)break;}catch{}await sleep(150);}
 assert.ok(ws,'Chromium unavailable');socket=new WebSocket(ws);await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
 socket.onmessage=e=>{const x=JSON.parse(e.data);if(x.method==='Network.requestWillBeSent')requests.push(x.params.request.url);const p=pending.get(x.id);if(!p)return;clearTimeout(p.timer);pending.delete(x.id);x.error?p.reject(Error(x.error.message)):p.resolve(x.result||{});};
 await call('Page.enable');await call('Runtime.enable');await call('Network.enable');
 for(const [width,height,mobile] of [[1440,900,false],[768,900,false],[390,844,true],[320,700,true],[844,390,true]]){
  await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile});
  await call('Page.navigate',{url:root+'/universidade'});
  await waitFor("document.body?.innerText.includes('Entrar para contratar')");
  pass(await evalJS('document.documentElement.scrollWidth <= innerWidth+8'),'public University no overflow '+width);
  await call('Page.navigate',{url:root+'/platform/aprender'});
  await waitFor("document.body?.innerText.includes('Seu próximo passo começa aqui')");
  pass(await evalJS("document.documentElement.scrollWidth <= innerWidth+8"),'locked study room no overflow '+width);
  pass(await evalJS("!!document.querySelector('a[href=\"/universidade/entrar\"]') && !document.body.innerText.includes('Oficinas práticas opcionais')"),'guest cannot read workshops without access '+width);
 }
 const res=await evalJS("(async()=>{let r=await fetch('/api/platform/learning',{cache:'no-store'});return {status:r.status,body:await r.json()};})()");
 pass([401,402,503].includes(res.status)&&res.body.ok===false&&!res.body.learning,'private learning data never exposed to guest');
 pass(requests.every(x=>!x.includes('/api/jenios-pay/checkout')&&!x.includes('/api/platform/broker-execution')),'no payment or trade execution requests');
 console.log('B276_UNIVERSITY_BROWSER_PASS='+checks);
}finally{for(const p of pending.values())clearTimeout(p.timer);try{socket?.close()}catch{}try{browser.kill('SIGTERM')}catch{}await rm(profile,{recursive:true,force:true}).catch(()=>{});}
