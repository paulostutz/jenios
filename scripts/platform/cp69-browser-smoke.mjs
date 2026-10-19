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
 pass(await evalExpr(`document.body.innerText.includes('Intenções: 1')`),'Cross-page journal carries Dashboard intention into Mesa');
 await clickText('Simular compra');
 pass(await evalExpr(`document.body.innerText.includes('Histórico de intenções fictícias') && document.body.innerText.includes('Intenções: 2')`),'Mesa appends its own simulated intention');
 await clickText('Pausar sessão');
 await clickText('Simular compra');
 pass(await evalExpr(`document.body.innerText.includes('Bloqueios simulados: 1')`),'Paused session blocks intention');
 await navigate('/dashboard');
 pass(await evalExpr(`([...document.querySelectorAll('button')].some(b=>(b.textContent||'').toLowerCase().includes('retomar simulação')))`),
  'Dashboard receives paused status from the Mesa for the same session');
 await clickText('Retomar simulação');
 await navigate('/mesa-operacoes');
 pass(await evalExpr(`document.body.innerText.includes('Pausar sessão')`),
  'Mesa sees simulation resumed in Dashboard');
 await screenshot('mesa-desktop');
 await navigate('/dashboard');
 pass(await evalExpr(`document.querySelectorAll('[class*="history"] ol li').length===2`),
  'Returning to Dashboard preserves both fictitious decisions');


 await navigate('/admin/login');
 pass(await evalExpr(`document.body.innerText.includes('Entrar no painel') && !document.body.innerText.includes('admin123')`),'Admin login does not expose demo password');
 await screenshot('admin-login-desktop');

 await navigate('/admin');
 pass(await evalExpr(`!document.body.innerText.includes('Carlos Silva') && !document.body.innerText.includes('R$ 142.850')`),'Admin mock data not rendered without privileges');
  await navigate('/admin/plataforma/permissoes');
  pass(await evalExpr(`!document.body.innerText.includes('Conceder permissão')`),
    'Anonymous visitor cannot view permission form');
  await navigate('/diagnostico');
  pass(await evalExpr(`document.body.innerText.includes('Passo 1') && !document.body.innerText.includes('Escolha o seu Modo Operacional')`),
    'Diagnostic wizard opens without forced manual/reverse choice');


 await navigate('/platform/entrar');
 pass(await evalExpr(`document.body.innerText.includes('Acesso da Platform')`),
  'Dedicated Platform login renders without shared Social credentials');
 pass(await evalExpr(`document.body.innerText.includes('Esqueci minha senha')`),
  'Dedicated login exposes isolated recovery');
 pass(await evalExpr(`!document.body.innerText.includes('Criar conta')`),
  'Public signup remains disabled without launch approval');
 await screenshot('platform-login-desktop');
 await navigate('/platform/recuperar');
 pass(await evalExpr(`document.body.innerText.includes('Recuperar acesso') && document.body.innerText.includes('Enviar instruções')`),
  'Password recovery renders with no Social authentication');
 await navigate('/platform/redefinir');
 pass(await evalExpr(`document.body.innerText.includes('Definir nova senha') && document.body.innerText.includes('link')`),
  'Password reset does not silently grant anonymous access');

 await navigate('/api/platform/admin/overview');
 pass(await evalExpr(`!document.body.innerText.includes('diagnostics') && !document.body.innerText.includes('adminPermissions')`),
  'Overview API does not disclose counts without Platform credentials');
 await navigate('/platform/admin');
 pass(await evalExpr(`!document.body.innerText.includes('Painel de homologação')`),
  'Dedicated Platform admin refuses unconfigured anonymous access');
 await navigate('/dashboard-logado');
 await sleep(650);
 pass(await evalExpr(`!document.body.innerText.includes('Simulador da conta') && !document.body.innerText.includes('Saldo virtual da sessão')`),
  'Isolated Platform simulation portal is never painted for an anonymous or Social-only visitor');
 pass(await evalExpr(`(location.pathname==='/platform/entrar' || document.body.innerText.includes('Homologação da Platform não configurada')) && !document.body.innerText.includes('Seu centro de controle')`),
  'Unauthenticated Platform user is redirected to its isolated login without Social fallback');

 await send('Emulation.setDeviceMetricsOverride',{width:768,height:900,deviceScaleFactor:1,mobile:false});
  await navigate('/dashboard');
  const tabletDash=await evalExpr(`({viewport:window.innerWidth,content:document.documentElement.scrollWidth})`);
  pass(tabletDash.content<=tabletDash.viewport+8,'Dashboard tablet safe width: '+JSON.stringify(tabletDash));
  await screenshot('dashboard-tablet');
  await navigate('/mesa-operacoes');
  const tabletDesk=await evalExpr(`({viewport:window.innerWidth,content:document.documentElement.scrollWidth})`);
  pass(tabletDesk.content<=tabletDesk.viewport+8,'Mesa tablet safe width: '+JSON.stringify(tabletDesk));
  await screenshot('mesa-tablet');

  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await navigate('/dashboard');
 const metrics=await evalExpr(`({viewport:window.innerWidth,content:document.documentElement.scrollWidth})`);
 pass(metrics.content<=metrics.viewport+8,'Dashboard mobile no major horizontal overflow: '+JSON.stringify(metrics));
 await screenshot('dashboard-mobile');

 await navigate('/mesa-operacoes');
 const mobileMesa=await evalExpr(`({viewport:window.innerWidth,content:document.documentElement.scrollWidth})`);
 pass(mobileMesa.content<=mobileMesa.viewport+8,'Mesa mobile no major horizontal overflow: '+JSON.stringify(mobileMesa));
 await screenshot('mesa-mobile');

 // B87 TradingView mobile portrait and physical-landscape Chromium validation.
 // External widget network availability is not a certified market quotation.
 pass(await evalExpr(`(()=>{const e=document.querySelector('[data-jenios-tv-chart]');
  return !!e&&!!document.querySelector('[data-tv-vertical]')&&!!document.querySelector('[data-tv-horizontal]');})()`),
  'TradingView orientation controls render in mobile portrait');
 const switched=await evalExpr(`(()=>{const b=document.querySelector('[data-tv-horizontal]');if(!b)return false;b.click();return true;})()`);
 pass(switched,'Touch can switch TradingView to horizontal mode');
 await waitFor(`document.querySelector('[data-jenios-tv-chart]')?.dataset.mode==='horizontal'`,5000);
 pass(await evalExpr(`(()=>{const e=document.querySelector('[data-jenios-tv-chart]');const b=e?.getBoundingClientRect();
  return !!b&&b.width>=window.innerWidth-3&&b.height>=window.innerHeight-3&&
  !!document.querySelector('[aria-label="Retornar ao gráfico vertical"]');})()`),
  'Horizontal TradingView fills viewport on portrait-locked phone');
 await screenshot('tradingview-horizontal-portrait');
 const exit=await evalExpr(`(()=>{const b=document.querySelector('[aria-label="Retornar ao gráfico vertical"]');if(!b)return false;b.click();return true;})()`);
 pass(exit,'Return to vertical is accessible by touch');
 await waitFor(`document.querySelector('[data-jenios-tv-chart]')?.dataset.mode==='vertical'`,5000);
 pass(await evalExpr(`document.documentElement.scrollWidth<=window.innerWidth+8`),
  'Back to portrait without horizontal page overflow');
 await send('Emulation.setDeviceMetricsOverride',{width:844,height:390,deviceScaleFactor:1,mobile:true});
 await navigate('/mesa-operacoes');
 pass(await evalExpr(`(()=>{const e=document.querySelector('[data-jenios-tv-chart]');
  return !!e&&e.getBoundingClientRect().height>240&&
  document.documentElement.scrollWidth<=window.innerWidth+8;})()`),
  'Physical landscape resizes TradingView without sideways overflow');
 await screenshot('tradingview-phone-landscape');
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});

 await navigate('/admin/login');
 const mobileAdmin=await evalExpr(`({viewport:window.innerWidth,content:document.documentElement.scrollWidth})`);
 pass(mobileAdmin.content<=mobileAdmin.viewport+8,'Admin login mobile no major overflow: '+JSON.stringify(mobileAdmin));
 await screenshot('admin-login-mobile');
 pass(await evalExpr(`document.querySelector('img[src*="jenios-logo-horizontal.webp"]')!==null`),
  'B110 Admin login uses approved new horizontal JENIOS logo');
 pass(await evalExpr(`(async()=>{const checks=await Promise.all(['/icon.png','/apple-icon.png','/favicon.ico'].map(async url=>{
   const r=await fetch(url,{cache:'no-store'});return r.ok&&Number(r.headers.get('content-length')||100)>0;
  }));return checks.every(Boolean)})()`),
  'B110 new favicon, Next icon and Apple touch icon are served by app');

 // B75 smartphone Chromium smoke, no real tokens or private data.
 await navigate('/social');
 pass(await evalExpr(`(()=>{const e=document.querySelector('.jenios-mobile-rail');return !!e&&getComputedStyle(e).display==='flex'&&e.getBoundingClientRect().width<=58;})()`),
  'Smartphone Social icon rail is visible and compact');
 await screenshot('social-mobile-collapsed');
 pass(await evalExpr(`([...document.querySelectorAll('.social-desktop-nav')].length===2 && [...document.querySelectorAll('.social-desktop-nav')].every(e=>getComputedStyle(e).display==='none'))`),
  'Smartphone repeated navigation rows are hidden');
 pass(await evalExpr(`(()=>{const f=document.querySelector('.social-feed-primary'),t=document.querySelector('.social-feed-tools');return !!f&&!!t&&Number(getComputedStyle(t).order)>Number(getComputedStyle(f).order);})()`),
  'Smartphone feed appears before heavy extra modules');
 const opened=await evalExpr(`(()=>{const toggle=document.querySelector('.jenios-mobile-rail-toggle');if(!toggle)return false;toggle.click();return true;})()`);
 pass(opened,'Smartphone menu control responds to touch');
 await waitFor(`!!document.querySelector('#jenios-mobile-rail-extra')`);
 await waitFor(`(()=>{const w=document.querySelector('.jenios-mobile-rail')?.getBoundingClientRect().width;return w>175&&w<=260;})()`,5000);
 pass(await evalExpr(`(()=>{const w=document.querySelector('.jenios-mobile-rail')?.getBoundingClientRect().width;return w>175&&w<=260;})()`),
  'Smartphone expanded rail stays narrow after transition');
 pass(await evalExpr(`document.querySelector('#jenios-mobile-rail-extra')?.innerText.includes('BankScore')`),
  'Expanded rail contains BankScore');
 await screenshot('social-mobile');
 pass(await evalExpr(`document.querySelector('img[src*="jenios-logo-horizontal.webp"]')!==null
  &&document.querySelector('footer[aria-label*="Rodapé institucional JENIOS Social"]')!==null`),
  'B110 Social shows minimal JENIOS logo and institutional footer on phone');
 await navigate('/lp');
 pass(await evalExpr(`document.querySelector('img[src*="jenios-logo-horizontal.webp"]')!==null
  &&document.querySelector('footer[aria-label*="Rodapé institucional JENIOS Platform"]')!==null`),
  'B110 landing page logo and footer match the approved brand');
 await screenshot('jenios-b110-lp-mobile');
 await navigate('/dashboard');
 pass(await evalExpr(`document.body.innerText.includes('HUB JENIOS') && document.body.innerText.includes('Radar de Baleias') && !document.body.innerText.includes('Fonte institucional não conectada')`),
  'Dashboard uses shared JENIOS Hub instead of hardcoded empty whales');
 pass(await evalExpr(`document.querySelector('img[src*="jenios-logo-horizontal.webp"]')!==null
  &&document.querySelector('footer[aria-label*="Rodapé institucional JENIOS Platform"]')!==null`),
  'B110 Dashboard logo and footer use approved JENIOS identity');
 await screenshot('jenios-b110-dashboard-mobile');

 console.log('CP69_BROWSER_SMOKE_PASS='+checks);
}finally{
 try{socket?.close();}catch{}
 try{chrome.kill('SIGTERM');}catch{}
}
