/** Local browser verification only. No real account, payment or provider request. */
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setTimeout as sleep} from 'node:timers/promises';
import assert from 'node:assert/strict';

const base=new URL(process.env.JENIOS_PRO_UI_BASE_URL||'http://127.0.0.1:3127');
assert.ok(['localhost','127.0.0.1','[::1]'].includes(base.hostname)&&base.protocol==='http:','Run this smoke only against a local server.');
const profile=await mkdtemp(join(tmpdir(),'jenios-b145-pro-'));
const port=Number(process.env.JENIOS_PRO_CDP_PORT||9351);
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
const pass=(value,label)=>{assert.ok(value,label);checks++;console.log('PASS B145 '+label);};
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
 await call('Page.navigate',{url:new URL('/genios-pro',base).href});
 await waitFor(`document.body?.innerText.includes('Entre para acessar o Pro')`);
 pass(await evaluate(`document.querySelector('h1')?.textContent==='Gênio Pro e Gênia Pro'`),'guest sees both Pro assistants');
 pass(await evaluate(`document.body.innerText.includes('sem cadastro')&&!!document.querySelector('a[href="/social"]')&&!!document.querySelector('a[href="/platform/aprender"]')`),'free Social and University remain accessible by link');
 pass(await evaluate(`!document.body.innerText.includes('US$ 10')&&!document.body.innerText.includes('US$ 10')&&!document.querySelector('[aria-label="Créditos comprados"]')`),'guest is not shown an invented balance or unapproved package');
 pass(await evaluate(`document.querySelector('form button[type="submit"]')?.disabled&&[...document.querySelectorAll('button')].find(b=>b.textContent==='Comprar créditos')?.disabled`),'generation and purchase stay disabled for guests');
 pass(await evaluate(`(()=>{const buttons=[...document.querySelectorAll('[aria-label="Escolha seu assistente Pro"] button')];const genia=buttons.find(b=>b.textContent.includes('Gênia'));genia?.click();return buttons.length===2;})()`),'guest can inspect the character choices');
 await waitFor(`[...document.querySelectorAll('[aria-label="Escolha seu assistente Pro"] button')].some(b=>b.textContent.includes('Gênia')&&b.getAttribute('aria-pressed')==='true')`);
 pass(true,'Gênia selection responds without sending a paid request');
 await evaluate(`(()=>{const select=document.querySelector('#pro-task');select.value='chart_screenshot';select.dispatchEvent(new Event('change',{bubbles:true}));})()`);
 await waitFor(`!!document.querySelector('#pro-image')`);
 pass(await evaluate(`document.querySelector('#pro-image')?.disabled&&document.querySelector('#pro-image')?.accept==='image/png,image/jpeg,image/webp'&&!document.querySelector('input[type="url"]')`),'image flow uses local files and cannot be submitted by a guest');
 await evaluate(`(()=>{const select=document.querySelector('#pro-task');select.value='market_moment';select.dispatchEvent(new Event('change',{bubbles:true}));})()`);
 await waitFor(`!!document.querySelector('#pro-symbol')`);
 pass(await evaluate(`document.querySelector('#pro-symbol')?.disabled&&document.querySelector('#pro-timeframe')?.disabled`),'market controls require the verified server list');
 for(const [width,height,mobile] of [[768,900,false],[390,844,true],[844,390,true]]){
  await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile});await sleep(150);
  pass(await evaluate(`document.documentElement.scrollWidth<=innerWidth+8`),'layout has no horizontal overflow at '+width+'px');
 }
 pass(requests.every(r=>!r.url.includes('/api/assistant/pro/')&&!/^https?:\/\/(?:[^/]+\.)?openai\.com\//.test(r.url)),'public interactions never call the private Pro API or model');
 const gates=await evaluate(`(async()=>{const out=[];for(const [path,method] of [['access','GET'],['history','GET'],['quote','POST'],['chat','POST']]){const response=await fetch('/api/assistant/pro/'+path,{method,cache:'no-store',...(method==='POST'?{headers:{'content-type':'application/json'},body:'{}'}:{})});const body=await response.json();out.push({path,status:response.status,ok:body.ok,private:!!(body.wallet||body.items||body.answer||body.quote)});}return out;})()`);
 for(const gate of gates)pass(gate.status===401&&gate.ok===false&&!gate.private,gate.path+' rejects missing authentication before exposing private information');
 console.log('B145_PRO_BROWSER_SMOKE_PASS='+checks);
}finally{
 for(const entry of pending.values())clearTimeout(entry.timer);
 try{socket?.close();}catch{}
 try{browser.kill('SIGTERM');}catch{}
 await rm(profile,{recursive:true,force:true}).catch(()=>{});
}
