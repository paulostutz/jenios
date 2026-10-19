/** Navegador local e sintético CP63: zero login real, zero corretora e zero deploy. */
import {spawn} from 'node:child_process';
import {setTimeout as sleep} from 'node:timers/promises';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';

const dir='.jenios-platform-qa/screenshots';
await mkdir(dir,{recursive:true});
const binary=process.env.CHROME_BIN||'google-chrome';
const chrome=spawn(binary,[
  '--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',
  '--no-first-run','--disable-background-networking','--disable-extensions',
  '--remote-debugging-port=9337','--remote-allow-origins=*',
  '--user-data-dir=/tmp/jenios-cp63-chrome','about:blank'
],{stdio:'ignore'});
let socket, counter=0;
const pending=new Map();
async function connect(){
 for(let i=0;i<45;i++){
  if(chrome.exitCode!==null)throw Error('Chrome exited before startup');
  try{
    const response=await fetch('http://127.0.0.1:9337/json');
    const targets=await response.json();
    const url=targets.find(x=>x.type==='page')?.webSocketDebuggerUrl;
    if(url){socket=new WebSocket(url);break;}
  }catch{}
  await sleep(400);
 }
 if(!socket)throw Error('Could not connect to Chromium via DevTools');
 await new Promise((resolve,reject)=>{
  socket.onopen=resolve; socket.onerror=reject;
 });
 socket.onmessage=message=>{
  let data;try{data=JSON.parse(message.data);}catch{return;}
  if(!data.id)return;
  const p=pending.get(data.id);if(!p)return;pending.delete(data.id);
  if(data.error)p.reject(Error(data.error.message));else p.resolve(data.result||{});
 };
}
function send(method,params={}){
 return new Promise((resolve,reject)=>{
  const id=++counter;
  pending.set(id,{resolve,reject});
  socket.send(JSON.stringify({id,method,params}));
  setTimeout(()=>{if(pending.has(id)){pending.delete(id);reject(Error('CDP timeout: '+method))}},12000);
 });
}
async function evalExpr(expression){
 const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
 if(result.exceptionDetails)throw Error('Browser JavaScript exception: '+result.exceptionDetails.text);
 return result.result?.value;
}
async function waitFor(predicate,ms=18000){
 const start=Date.now();
 while(Date.now()-start<ms){
   if(await evalExpr(predicate))return;
   await sleep(350);
 }
 throw Error('Page content timeout '+predicate.slice(0,100));
}
async function navigate(route){
 await send('Page.navigate',{url:'http://127.0.0.1:3127'+route});
 await waitFor(`document.readyState==='complete' && document.body && document.body.innerText.length>20`);
 await sleep(1000);
}
async function clickText(label){
 const ok=await evalExpr(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent?.toLowerCase().includes(${JSON.stringify(label.toLowerCase())}));if(b){b.click();return true;}return false;})()`);
 assert.equal(ok,true,'Button not found '+label);
 await sleep(420);
}
async function screenshot(name){
 const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
 await writeFile(dir+'/'+name+'.png',Buffer.from(shot.data,'base64'));
}
let checks=0;
function pass(ok,name){
 assert.ok(ok,name);
 checks++;process.stdout.write('PASS '+name+'\n');
}
try {
 await connect();
 await send('Page.enable');await send('Runtime.enable');
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
 await navigate('/dashboard');
 pass(await evalExpr(`document.body.innerText.includes('Diagnóstico Comportamental')`),'Dashboard diagnostic accessible');
 pass(await evalExpr(`document.body.innerText.includes('SIMULAR COMPRA')`),'Trading buttons explicitly fictitious');
 await clickText('SIMULAR COMPRA');
 pass(await evalExpr(`document.body.innerText.includes('Diário de intenções fictícias') && document.body.innerText.includes('Intenção de negociação fictícia')`),'Dashboard study journal');
 await screenshot('dashboard-desktop');

 await navigate('/mesa-operacoes');
 pass(await evalExpr(`document.body.innerText.includes('Acesso à simulação')||document.body.innerText.includes('Acesso à simulação liberado')`),'Mesa opens without diagnostic');
 await clickText('Simular compra');
 pass(await evalExpr(`document.body.innerText.includes('Histórico de intenções fictícias') && document.body.innerText.includes('Intenções: 1')`),'Mesa records simulated intention');
 await clickText('Pausar sessão');
 await clickText('Simular compra');
 pass(await evalExpr(`document.body.innerText.includes('Bloqueios simulados: 1')`),'Paused session blocks intention');
 await clickText('Retomar sessão');
 await screenshot('mesa-desktop');

 await navigate('/admin/login');
 pass(await evalExpr(`document.body.innerText.includes('Entrar no painel') && !document.body.innerText.includes('admin123')`),'Admin login does not expose demo password');
 await screenshot('admin-login-desktop');

 await navigate('/admin');
 pass(await evalExpr(`!document.body.innerText.includes('Carlos Silva') && !document.body.innerText.includes('R$ 142.850')`),'Admin mock data not rendered without privileges');

 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await navigate('/dashboard');
 const metrics=await evalExpr(`({viewport:window.innerWidth,content:document.documentElement.scrollWidth})`);
 pass(metrics.content<=metrics.viewport+8,'Dashboard mobile no major horizontal overflow: '+JSON.stringify(metrics));
 await screenshot('dashboard-mobile');

 await navigate('/mesa-operacoes');
 const mobileMesa=await evalExpr(`({viewport:window.innerWidth,content:document.documentElement.scrollWidth})`);
 pass(mobileMesa.content<=mobileMesa.viewport+8,'Mesa mobile no major horizontal overflow: '+JSON.stringify(mobileMesa));
 await screenshot('mesa-mobile');

 await navigate('/admin/login');
 const mobileAdmin=await evalExpr(`({viewport:window.innerWidth,content:document.documentElement.scrollWidth})`);
 pass(mobileAdmin.content<=mobileAdmin.viewport+8,'Admin login mobile no major overflow: '+JSON.stringify(mobileAdmin));
 await screenshot('admin-login-mobile');

 console.log('CP63_BROWSER_SMOKE_PASS='+checks);
}finally{
 try{socket?.close();}catch{}
 try{chrome.kill('SIGTERM');}catch{}
}
