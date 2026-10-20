/** Local browser verification only. No real account, payment or provider request. */
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setTimeout as sleep} from 'node:timers/promises';
import assert from 'node:assert/strict';

const base=new URL(process.env.JENIOS_UNIVERSITY_UI_BASE_URL||'http://127.0.0.1:3127');
assert.ok(['localhost','127.0.0.1','[::1]'].includes(base.hostname)&&base.protocol==='http:','Run this smoke only against a local server.');
const profile=await mkdtemp(join(tmpdir(),'jenios-b147-university-'));
const port=Number(process.env.JENIOS_UNIVERSITY_CDP_PORT||9352);
assert.ok(Number.isSafeInteger(port)&&port>=1024&&port<=65535,'Invalid local debugging port.');
const browser=spawn(process.env.CHROME_BIN||'google-chrome',[
 '--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--no-first-run',
 '--disable-background-networking','--disable-extensions','--remote-allow-origins=*',
 '--remote-debugging-port='+port,'--user-data-dir='+profile,'about:blank'
],{stdio:'ignore'});
let spawnError,socket,sequence=0,checks=0;const pending=new Map(),requests=[];
browser.on('error',error=>{spawnError=error;});
function call(method,params={}){return new Promise((resolve,reject)=>{
 const id=++sequence,timer=setTimeout(()=>{pending.delete(id);reject(Error('Browser command timed out: '+method));},10000);
 pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));
});}
async function evaluate(expression){
 const value=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
 assert.ok(!value.exceptionDetails,'Browser script failed: '+JSON.stringify(value.exceptionDetails));
 return value.result?.value;
}
async function waitFor(expression){
 for(let n=0;n<50;n++){if(await evaluate(expression))return;await sleep(200);}
 throw Error('Browser state not reached: '+expression.slice(0,100));
}
const pass=(value,label)=>{assert.ok(value,label);checks++;console.log('PASS B147 '+label);};
try{
 let target;
 for(let n=0;n<50;n++){
  if(spawnError)throw spawnError;
  try{const value=await (await fetch('http://127.0.0.1:'+port+'/json')).json();target=value.find(item=>item.type==='page')?.webSocketDebuggerUrl;if(target)break;}catch{}
  await sleep(200);
 }
 assert.ok(target,'Browser did not start. Set CHROME_BIN to a Chrome/Chromium executable.');
 socket=new WebSocket(target);
 await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
 socket.onmessage=event=>{
  const value=JSON.parse(event.data);
  if(value.method==='Network.requestWillBeSent')requests.push({url:value.params.request.url,method:value.params.request.method});
  const entry=pending.get(value.id);if(!entry)return;
  clearTimeout(entry.timer);pending.delete(value.id);
  if(value.error)entry.reject(Error(value.error.message));else entry.resolve(value.result||{});
 };
 await call('Page.enable');await call('Runtime.enable');await call('Network.enable');
 await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 await call('Page.navigate',{url:new URL('/universidade',base).href});
 await waitFor(`document.body?.innerText.includes('Entrar para contratar')`);
 pass(await evaluate(`document.title.includes('R$ 49,90')&&document.querySelector('h1')?.textContent==='Conhecimento para o seu próximo passo.'`),'public page shows the approved monthly University offer');
 pass(await evaluate(`document.body.innerText.includes('R$ 49,90')&&document.body.innerText.includes('por mês')&&document.body.innerText.includes('sem nenhum plano da Platform')`),'standalone monthly price does not require a Platform plan');
 pass(await evaluate(`document.body.innerText.includes('Sem débito automático')&&document.body.innerText.includes('renovação mensal confirmada por você')`),'monthly Pix renewal is explicit and does not promise automatic debit');
 pass(await evaluate(`document.body.innerText.includes('R$ 149,90 e R$ 199,90')&&document.body.innerText.includes('não inclui franquia ou créditos de IA Pro')`),'included plans and separate Pro credit policy are visible');
 pass(await evaluate(`!!document.querySelector('a[href="/universidade/entrar"]')&&!!document.querySelector('a[href="/universidade/cadastro"]')&&!document.querySelector('input[type="checkbox"]')&&!document.querySelector('#university-pix-code')`),'guest must sign in before consent or payment is available');
 pass(await evaluate(`document.querySelectorAll('#conteudo ol li').length===5&&document.body.innerText.includes('15 aulas')`),'existing five trails and fifteen lessons are described without a rebuilt course');
 pass(await evaluate(`!!document.querySelector('a[href="/platform/aprender"]')&&!!document.querySelector('a[href="/social"]')&&!!document.querySelector('a[href="/genios-pro"]')`),'study room, free Social and Pro stay linked');
 for(const [width,height,mobile] of [[768,900,false],[390,844,true],[844,390,true]]){
  await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile});await sleep(150);
  pass(await evaluate(`document.documentElement.scrollWidth<=innerWidth+8`),'monthly offer has no horizontal overflow at '+width+'px');
 }
 pass(requests.every(r=>!r.url.includes('/api/assistant/university/')&&!r.url.includes('/api/assistant/pro/')&&!r.url.includes('/api/jenios-pay/')),'guest browsing never creates a private purchase or checks a paid provider');
 await call('Page.navigate',{url:new URL('/platform/aprender',base).href});
 await waitFor(`document.body?.innerText.includes('Seu próximo passo começa aqui')`);
 pass(await evaluate(`document.querySelector('a[href="/universidade"]')?.textContent.includes('49,90')`),'locked study room leads to the separate University subscription');
 pass(await evaluate(`document.body.innerText.includes('R$ 149,90 e R$ 199,90')&&!!document.querySelector('a[href="/social"]')`),'study access explains included plans and preserves the free assistant link');
 const gates=await evaluate(`(async()=>{const out=[];for(const [path,method] of [['access','GET'],['checkout','POST'],['status?orderId=10000000-0000-4000-8000-000000000001','GET']]){const response=await fetch('/api/assistant/university/'+path,{method,cache:'no-store',...(method==='POST'?{headers:{'content-type':'application/json'},body:'{}'}:{})});const body=await response.json();out.push({path,status:response.status,ok:body.ok,private:!!(body.orderId||body.order||body.pixCode||body.checkoutUrl||body.access?.active)});}return out;})()`);
 for(const gate of gates)pass(gate.status===401&&gate.ok===false&&!gate.private,'University '+gate.path.split('?')[0]+' rejects unauthenticated financial access');
 await call('Page.navigate',{url:new URL('/universidade/entrar',base).href});
 await waitFor(`!!document.querySelector('input[type="email"]')&&!!document.querySelector('input[type="password"]')`);
 pass(await evaluate(`document.title.includes('Entrar na Universidade')&&!document.querySelector('#signup-name')&&!!document.querySelector('form')`),'University login reuses the existing authentication form');
 await call('Page.navigate',{url:new URL('/universidade/cadastro',base).href});
 await waitFor(`!!document.querySelector('#signup-name')`);
 pass(await evaluate(`document.title.includes('Criar conta para a Universidade')&&!!document.querySelector('input[type="email"]')&&!!document.querySelector('input[type="password"]')`),'University signup reuses the existing free account form');
 console.log('B147_UNIVERSITY_BROWSER_SMOKE_PASS='+checks);
}finally{
 for(const entry of pending.values())clearTimeout(entry.timer);
 try{socket?.close();}catch{}
 try{browser.kill('SIGTERM');}catch{}
 await rm(profile,{recursive:true,force:true}).catch(()=>{});
}
