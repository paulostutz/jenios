/** B160 localhost only; guest guide/browser checks. No account, broker, bank or paid model. */
import {spawn} from 'node:child_process';
import {mkdtemp,rm,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setTimeout as sleep} from 'node:timers/promises';
import assert from 'node:assert/strict';
import {CONNECTION_GUIDES} from '../../../lib/platform/connections/catalog.mjs';
const base=new URL(process.env.JENIOS_CONNECTIONS_QA_URL||'http://127.0.0.1:3127');
assert.ok(['localhost','127.0.0.1','[::1]'].includes(base.hostname)&&base.protocol==='http:');
const profile=await mkdtemp(join(tmpdir(),'jenios-b160-')),port=9360;
const child=spawn(process.env.CHROME_BIN||'google-chrome',['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--no-first-run','--disable-extensions','--disable-background-networking','--remote-allow-origins=*','--remote-debugging-port='+port,'--user-data-dir='+profile,'about:blank'],{stdio:['ignore','ignore','pipe']});
let ws,seq=0,count=0,spawnError=null,exited=false,chromeLog='';const pending=new Map(),errors=[];
child.once('error',e=>{spawnError=e;});child.once('exit',()=>{exited=true;});
child.stderr.on('data',chunk=>{chromeLog=(chromeLog+chunk.toString()).slice(-6000);});
function call(method,params={}){return new Promise((resolve,reject)=>{const id=++seq,t=setTimeout(()=>{pending.delete(id);reject(Error(method+' timed out'));},12000);pending.set(id,{resolve,reject,t});ws.send(JSON.stringify({id,method,params}));});}
async function value(expression){const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});assert.ok(!r.exceptionDetails,'Browser script error: '+JSON.stringify(r.exceptionDetails));return r.result?.value;}
async function wait(expression){for(let i=0;i<80;i++){if(await value(expression))return;await sleep(100);}throw Error('UI condition failed: '+expression);}
function pass(condition,label){assert.ok(condition,label);count++;console.log('PASS B160 '+label);}
async function shot(name){const r=await call('Page.captureScreenshot',{format:'png'});await mkdir('.jenios-connections-qa/screenshots',{recursive:true});await writeFile('.jenios-connections-qa/screenshots/'+name+'.png',Buffer.from(r.data,'base64'));}
try{
 let target;const deadline=Date.now()+30000;
 while(Date.now()<deadline){
  if(spawnError)throw spawnError;if(exited)throw Error('Chrome exited before debugging became ready: '+chromeLog);
  try{const response=await fetch('http://127.0.0.1:'+port+'/json',{signal:AbortSignal.timeout(1000)});if(response.ok){const tabs=await response.json();target=tabs.find(t=>t.type==='page')?.webSocketDebuggerUrl;if(target)break;}}catch{}
  await sleep(200);
 }
 assert.ok(target,'Chrome startup timed out; diagnostics: '+chromeLog);
 ws=new WebSocket(target);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
 ws.onmessage=e=>{const r=JSON.parse(e.data);if(r.method==='Runtime.exceptionThrown')errors.push(r.params.exceptionDetails.text);const p=pending.get(r.id);if(!p)return;clearTimeout(p.t);pending.delete(r.id);r.error?p.reject(Error(r.error.message)):p.resolve(r.result||{});};
 await call('Page.enable');await call('Runtime.enable');await call('Emulation.setDeviceMetricsOverride',{width:1360,height:1000,deviceScaleFactor:1,mobile:false});
 await call('Page.navigate',{url:new URL('/integracoes',base).href});await wait(`!!document.querySelector('[data-provider="binance"]')`);
 pass(await value(`document.body.innerText.includes('Sua corretora.')&&!document.body.innerText.includes('Gateway Operacional')&&!document.body.innerText.includes('jn_live_')`),'legacy fictitious gateway replaced');
 pass(await value(`document.querySelectorAll('[data-provider]').length===12`),'all 12 documented providers are discoverable');
 for(const g of CONNECTION_GUIDES){
  await value(`document.querySelector('[data-provider="${g.id}"]').click()`);await wait(`document.querySelector('[data-connection-guide]')?.dataset.connectionGuide==='${g.id}'`);
  pass(await value(`new URLSearchParams(location.search).get('provider')==='${g.id}'&&document.querySelectorAll('article input[type="checkbox"]').length===6&&document.querySelector('article').innerText.includes('Campos e permissões explicados')`),g.name+' deep link and six steps');
 }
 pass(await value(`document.querySelectorAll('input[type="password"]').length===0&&document.body.innerText.includes('não recebe credenciais')`),'no secret intake on guide');
 await value(`document.querySelector('[data-provider="binance"]').click()`);await wait(`document.querySelector('[data-connection-guide]')?.dataset.connectionGuide==='binance'`);
 await value(`document.querySelectorAll('article input[type="checkbox"]').forEach(x=>x.click())`);
 await wait(`[...document.querySelectorAll('article input[type="checkbox"]')].every(x=>x.checked)`);
 await value(`[...document.querySelectorAll('button')].find(b=>b.textContent==='Conferir meu checklist').click()`);
 await wait(`document.body.innerText.includes('Isso não confirma conexão')`);pass(true,'completed checklist never declares a connected account');
 await shot('b160-binance-desktop');
 await value(`document.querySelector('[data-provider="profit"]').click()`);await wait(`document.querySelector('[data-connection-guide]')?.dataset.connectionGuide==='profit'`);
 pass(await value(`[...document.querySelectorAll('article input[type="checkbox"]')].every(x=>!x.checked)`),'provider changes clear checklist');
 await value(`document.querySelector('article details summary').click()`);pass(await value(`document.querySelector('article details').open`),'troubleshooting is accessible');
 await call('Page.navigate',{url:new URL('/integracoes?provider=binance',base).href});await wait(`document.querySelector('[data-connection-guide]')?.dataset.connectionGuide==='binance'&&!!document.querySelector('[data-jenios-assistant] button[aria-controls]')`);
 await value(`document.querySelector('[data-jenios-assistant] button[aria-controls]').click()`);await wait(`document.body.innerText.includes('Com quem deseja conversar?')`);
 await value(`[...document.querySelectorAll('button')].find(b=>b.textContent==='Conversar com Gênia').click()`);await wait(`!!document.querySelector('#jenios-free-question')`);
 await wait(`[...document.querySelectorAll('button')].some(b=>b.textContent==='Como conectar Binance Spot à JENIOS?')`);
 await value(`[...document.querySelectorAll('button')].find(b=>b.textContent==='Como conectar Binance Spot à JENIOS?').click()`);
 await wait(`document.querySelector('[aria-label="Atendimento gratuito da JENIOS"]')?.innerText.includes('1. Escolha o ambiente')`);
 pass(await value(`document.querySelector('[data-jenios-assistant]').dataset.persona==='genia'`),'Genia answers actual free endpoint with provider-specific steps');
 await shot('b160-genia-guide');
 await call('Page.reload',{ignoreCache:true});await wait(`document.querySelector('[data-jenios-assistant]')?.dataset.persona==='genia'`);pass(true,'existing saved character survives reload');
 for(const [width,height,mobile] of [[390,844,true],[844,390,true],[768,900,false]]){
  await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile});await sleep(100);
  pass(await value(`document.documentElement.scrollWidth<=innerWidth+8`),'guide fits '+width+'px');
  await shot('b160-guide-'+width+'px');
 }
 await shot('b160-guide-mobile');
 const replies=[];for(const persona of ['genio','genia']){const r=await fetch(new URL('/api/assistant/free',base),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({persona,message:'Como conectar MetaTrader 5 à JENIOS?'})});assert.equal(r.status,200);replies.push(await r.json());}
 pass(replies[0].explanation===replies[1].explanation&&replies.every(x=>x.paidAi===false&&x.executionEnabled===false&&x.articles[0].id==='connection-mt5'),'both personas share reviewed knowledge without paid AI');
 const secret=await fetch(new URL('/api/assistant/free',base),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({persona:'genio',message:'api_key: '+ 'X'.repeat(64)})});const text=await secret.text();pass(secret.status===400&&!text.includes('X'.repeat(64)),'server rejects test secret and never reflects it');
 const foreign=await fetch(new URL('/api/assistant/free',base),{method:'POST',headers:{'content-type':'application/json',origin:'https://untrusted.invalid'},body:JSON.stringify({persona:'genio',message:'Como conectar Binance?'})});pass(foreign.status===403,'foreign-origin request remains denied');
 await call('Page.navigate',{url:new URL('/integracoes?provider=not-supported',base).href});await wait(`document.querySelector('[data-connection-guide]')?.dataset.connectionGuide==='binance'`);pass(true,'unknown query does not create a provider or activate anything');
 pass(errors.length===0,'no unhandled browser exception');
 console.log('B160_BROWSER_PASS='+count+'; no credentials or real accounts used');
}catch(e){await shot('b160-failure').catch(()=>{});console.error('B160_BROWSER_FAILED',e.message);await mkdir('.jenios-connections-qa/ci',{recursive:true});await writeFile('.jenios-connections-qa/ci/chrome-startup.log',chromeLog);throw e;}
finally{for(const p of pending.values())clearTimeout(p.t);try{ws?.close();}catch{}child.kill('SIGTERM');await rm(profile,{recursive:true,force:true}).catch(()=>{});}
