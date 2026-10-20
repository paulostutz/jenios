/** B148 local browser fixtures only. All authenticated data and payment responses are synthetic.
 * Never run this script against production; no real customer, bank or model is contacted.
 */
import {spawn} from 'node:child_process';
import {mkdtemp,rm,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setTimeout as sleep} from 'node:timers/promises';
import assert from 'node:assert/strict';
const base=new URL(process.env.JENIOS_B148_UI_BASE_URL||'http://127.0.0.1:3127');
assert.ok(['localhost','127.0.0.1','[::1]'].includes(base.hostname)&&base.protocol==='http:','Local fixture only');
const profile=await mkdtemp(join(tmpdir(),'jenios-b148-')),port=9353;
const browser=spawn(process.env.CHROME_BIN||'google-chrome',['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--no-first-run','--disable-background-networking','--remote-allow-origins=*','--remote-debugging-port='+port,'--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
let socket,seq=0,checks=0,spawnError;const pending=new Map(),browserErrors=[];browser.on('error',e=>spawnError=e);
function call(method,params={}){return new Promise((resolve,reject)=>{const id=++seq,timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout '+method));},12000);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));});}
async function evaluate(expression){const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});assert.ok(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result?.value;}
async function waitFor(expression){for(let n=0;n<70;n++){if(await evaluate(expression))return;await sleep(150);}throw Error('UI state not reached: '+expression);}
const pass=(value,label)=>{assert.ok(value,label);checks++;console.log('PASS B148 '+label);};
const fixture=`(()=>{
 if(!['127.0.0.1','localhost'].includes(location.hostname))throw Error('Local fixture only');
 const userId=localStorage.getItem('b148-fixture-owner')||'b1480000-0000-4000-8000-000000000001';
 const guest=userId==='visitor';
 const metadata=JSON.parse(localStorage.getItem('b148-fixture-metadata:'+userId)||'{}');
 const user={id:userId,aud:'authenticated',role:'authenticated',email:'b148-fixture@example.invalid',is_anonymous:false,user_metadata:metadata,app_metadata:{provider:'email'},created_at:'2026-10-20T00:00:00Z'};
 const session={access_token:'eyJhbGciOiJIUzI1NiJ9.'+btoa(JSON.stringify({sub:userId,exp:Math.floor(Date.now()/1000)+3600,iat:Math.floor(Date.now()/1000),aud:'authenticated',role:'authenticated'}))+'.'+'x'.repeat(43),refresh_token:'b148-fixture-only',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,token_type:'bearer',user};
 if(guest)localStorage.removeItem('sb-social-qa-auth-token');else localStorage.setItem('sb-social-qa-auth-token',JSON.stringify(session));
 const original=window.fetch.bind(window);window.__b148Checkout=[];window.__b148Preference=[];window.__b148Free=[];window.__b148Requests=[];
 const response=(body,status=200)=>Promise.resolve(new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}}));
 window.fetch=(input,init={})=>{
  const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url,location.origin),method=init.method||input.method||'GET';
  window.__b148Requests.push({host:url.hostname,path:url.pathname,method});
  if(url.hostname==='social-qa.invalid'){
   if(url.pathname==='/auth/v1/user'){
    if(method==='PUT'){const payload=JSON.parse(init.body);Object.assign(user.user_metadata,payload.data);localStorage.setItem('b148-fixture-metadata:'+userId,JSON.stringify(user.user_metadata));window.__b148Preference.push(payload.data);}
    return response(user);
   }
   if(url.pathname==='/auth/v1/token')return response(session);
   if(url.pathname==='/rest/v1/posts')return response([{id:'b1480000-0000-4000-8000-000000000011',author_id:userId,body:'Publicação fictícia B148 — prévia de foto e vídeo',created_at:'2026-10-20T12:00:00Z',archived_at:null,media_type:'video',media_path:JSON.stringify([{url:'https://media.example.invalid/fixture.png',type:'image'},{url:'https://media.example.invalid/fixture.mp4',type:'video'}])}]);
   if(url.pathname==='/rest/v1/profiles')return response({id:userId,display_name:'Conta fictícia B148',handle:'b148fixture',bio:'',avatar_url:null});
   return response([]);
  }
  if(url.pathname==='/api/social/promotions/readiness')return response({ready:true,method:'pix',message:'Fixture only'});
  if(url.pathname==='/api/jenios-pay/products')return response({checkoutReady:true,paymentsEnabled:true,products:[{code:'social-boost',price_cents:0,variable_amount:true,active:true,serviceReady:true}]});
  if(url.pathname==='/api/jenios-pay/checkout'){window.__b148Checkout.push(JSON.parse(init.body));return response({error:'Cobrança fictícia interceptada; nenhum pedido real foi criado.'},503);}
  if(url.pathname==='/api/assistant/free'){const body=JSON.parse(init.body);window.__b148Free.push(body);return response({ok:true,persona:body.persona,name:body.persona==='genia'?'Gênia':'Gênio',paidAi:false,explanation:'Resposta gratuita fictícia de navegação.',articles:[]});}
  if(url.pathname.startsWith('/api/social/'))return response({ok:true,conversations:[],messages:[],items:[],posts:[],notifications:[]});
  if(url.origin!==location.origin)return response({},503);
  return original(input,init);
 };
 window.__b148Set=(label,value)=>{const l=[...document.querySelectorAll('label')].find(x=>x.textContent.trim().startsWith(label));if(!l)throw Error('Missing label '+label);const el=l.querySelector('input,select,textarea');const proto=el.tagName==='SELECT'?HTMLSelectElement.prototype:el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));};
})();`;
try{
 let target;for(let n=0;n<60;n++){if(spawnError)throw spawnError;try{const tabs=await(await fetch('http://127.0.0.1:'+port+'/json')).json();target=tabs.find(t=>t.type==='page')?.webSocketDebuggerUrl;if(target)break;}catch{}await sleep(150);}assert.ok(target);
 socket=new WebSocket(target);await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
 socket.onmessage=event=>{const r=JSON.parse(event.data);if(r.method==='Runtime.exceptionThrown')browserErrors.push(r.params.exceptionDetails?.exception?.description||r.params.exceptionDetails?.text);const p=pending.get(r.id);if(!p)return;clearTimeout(p.timer);pending.delete(r.id);r.error?p.reject(Error(r.error.message)):p.resolve(r.result||{});};
 await call('Page.enable');await call('Runtime.enable');await call('Network.enable');
 await call('Emulation.setDeviceMetricsOverride',{width:1360,height:1000,deviceScaleFactor:1,mobile:false});
 await call('Page.navigate',{url:new URL('/api/social/promotions/readiness',base).href});
 await waitFor(`document.body?.innerText.includes('ready')`);
 pass(await evaluate(`(()=>{const d=JSON.parse(document.body.innerText);return d.ready===false&&!JSON.stringify(d).includes('SECRET');})()`),'real local readiness blocks unconfigured finance and contains no secret');
 await call('Page.addScriptToEvaluateOnNewDocument',{source:fixture});
 await call('Network.setBlockedURLs',{urls:['https://media.example.invalid/*']});
 await call('Page.navigate',{url:new URL('/impulsionar',base).href});
 await waitFor(`!!document.querySelector('[data-boost-preview]')`);
 pass(await evaluate(`document.querySelector('[data-boost-preview]').textContent.includes('Publicação fictícia B148')&&!!document.querySelector('[data-boost-preview] img')&&!!document.querySelector('[data-boost-preview] video')`),'selected post shows actual decoded text, image and video fields');
 await evaluate(`window.__b148Set('Objetivo','whatsapp')`);await waitFor(`document.body.innerText.includes('País do WhatsApp')`);
 pass(await evaluate(`[...document.querySelectorAll('label')].find(x=>x.textContent.startsWith('País do WhatsApp')).querySelector('select option').value==='BR'`),'Brazil is the first default WhatsApp country');
 await evaluate(`window.__b148Set('DDD e número','(11) 99999-9999')`);
 await waitFor(`document.body.innerText.includes('https://wa.me/5511999999999')`);
 pass(await evaluate(`!document.querySelector('input[type="url"]')`),'WhatsApp requires a phone number, not a manually written URL');
 await evaluate(`window.__b148Set('Faixa de idade','range')`);await waitFor(`document.body.innerText.includes('Idade mínima')`);
 await evaluate(`window.__b148Set('Idade mínima','25');window.__b148Set('Idade máxima','45');window.__b148Set('Sexo','female')`);await sleep(150);
 pass(await evaluate(`document.querySelector('input[type="checkbox"]')?.checked===false`),'campaign changes require a fresh confirmation');
 await evaluate(`document.querySelector('input[type="checkbox"]').click()`);await waitFor(`[...document.querySelectorAll('button')].some(x=>x.textContent.includes('Gerar pagamento Pix')&&!x.disabled)`);
 await evaluate(`[...document.querySelectorAll('button')].find(x=>x.textContent.includes('Gerar pagamento Pix')).click()`);await waitFor(`window.__b148Checkout.length===1`);
 const purchase=await evaluate(`window.__b148Checkout[0]`);
 pass(purchase.productCode==='social-boost'&&purchase.target.destination==='https://wa.me/5511999999999'&&purchase.target.ageMin===25&&purchase.target.ageMax===45&&purchase.target.sex==='female','one explicit checkout carries WhatsApp and the complete audience, with no bank call');
 for(const [width,height,mobile] of [[390,844,true],[844,390,true],[768,900,false]]){await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile});await sleep(100);pass(await evaluate(`document.documentElement.scrollWidth<=innerWidth+8`),'boost layout fits '+width+'px');}
 await call('Page.navigate',{url:new URL('/social',base).href});
 await waitFor(`!!document.querySelector('[data-jenios-assistant="social-free"]')`);
 pass(await evaluate(`document.querySelector('[data-jenios-assistant="social-free"]').dataset.persona==='unselected'`),'first use has no automatically assumed persona');
 await evaluate(`document.querySelector('[data-jenios-assistant="social-free"] button[aria-controls]').click()`);
 await waitFor(`document.body.innerText.includes('Com quem deseja conversar?')`);
 await evaluate(`[...document.querySelectorAll('button')].find(x=>x.textContent==='Conversar com Gênia').click()`);
 await waitFor(`document.querySelector('[data-jenios-assistant="social-free"]').dataset.persona==='genia'&&!!document.querySelector('#jenios-free-question')`);
 pass(await evaluate(`document.querySelector('[data-jenios-assistant="social-free"] button[aria-controls]').textContent==='Gênia'&&!!document.querySelector('[data-jenios-assistant="social-free"] button[aria-controls] img')`),'launcher displays the chosen name and image');
 await waitFor(`window.__b148Preference.some(x=>x.jenios_assistant_persona==='genia')`);
 pass(true,'signed-in preference is synchronized using only own visual user metadata');
 await call('Page.reload',{ignoreCache:true});await waitFor(`document.querySelector('[data-jenios-assistant="social-free"]')?.dataset.persona==='genia'`);
 pass(true,'chosen character survives page reload');
 await evaluate(`document.querySelector('[data-jenios-assistant="social-free"] button[aria-controls]').click()`);await waitFor(`!!document.querySelector('#jenios-free-question')`);
 await evaluate(`[...document.querySelectorAll('button')].find(x=>x.textContent==='Trocar assistente').click()`);await waitFor(`document.body.innerText.includes('Com quem deseja conversar?')`);
 await evaluate(`[...document.querySelectorAll('button')].find(x=>x.textContent==='Conversar com Gênio').click()`);await waitFor(`document.querySelector('[data-jenios-assistant="social-free"]')?.dataset.persona==='genio'`);
 pass(true,'the user can change the remembered character');
 await evaluate(`document.querySelector('[data-jenios-assistant="social-free"] button[aria-controls]').click()`);
 await waitFor(`!!document.querySelector('.jenios-social-direct-fab')`);
 for(const [width,height,mobile] of [[1360,1000,false],[390,844,true],[844,390,true]]){
  await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile});await sleep(100);
  pass(await evaluate(`(()=>{const d=document.querySelector('.jenios-social-direct-fab').getBoundingClientRect(),a=document.querySelector('[data-jenios-assistant="social-free"] button[aria-controls]').getBoundingClientRect();return d.left<40&&a.right>innerWidth-40&&d.right<a.left;})()`),'Direct stays left and assistant right without button overlap at '+width+'px');
 }
 await evaluate(`localStorage.setItem('b148-fixture-owner','b1480000-0000-4000-8000-000000000099')`);await call('Page.reload',{ignoreCache:true});await waitFor(`document.querySelector('[data-jenios-assistant="social-free"]')?.dataset.persona==='unselected'`);
 pass(true,'another account does not inherit the first account persona');
 await evaluate(`localStorage.setItem('b148-fixture-owner','visitor')`);await call('Page.reload',{ignoreCache:true});await waitFor(`!!document.querySelector('[data-jenios-assistant="social-free"] button[aria-controls]')`);
 await evaluate(`document.querySelector('[data-jenios-assistant="social-free"] button[aria-controls]').click()`);await waitFor(`document.body.innerText.includes('Com quem deseja conversar?')`);
 await evaluate(`[...document.querySelectorAll('button')].find(x=>x.textContent==='Conversar com Gênia').click()`);await waitFor(`!!document.querySelector('#jenios-free-question')`);
 await evaluate(`window.__b148Set('Sua pergunta','Como funciona a JENIOS?')`);
 await evaluate(`document.querySelector('#jenios-free-question').closest('form').requestSubmit()`);await waitFor(`window.__b148Free.length===1`);
 pass(await evaluate(`window.__b148Free[0].persona==='genia'&&window.__b148Checkout.length===0`),'visitor can use chosen free assistant without paid generation or checkout');
 console.log('B148_BROWSER_SMOKE_PASS='+checks+'; synthetic localhost fixtures only');
}catch(error){
 console.error('B148_LOCAL_FIXTURE_DIAGNOSTIC',JSON.stringify(await evaluate(`({path:location.pathname,body:document.body?.innerText.slice(0,5000),storageKeys:Object.keys(localStorage),requests:window.__b148Requests?.slice(-30)})`).catch(()=>({}))),JSON.stringify(browserErrors));
 throw error;
}finally{
 if(socket?.readyState===1){try{await mkdir('.jenios-platform-qa/screenshots',{recursive:true});const shot=await call('Page.captureScreenshot',{format:'png'});await writeFile('.jenios-platform-qa/screenshots/b148-browser-final.png',Buffer.from(shot.data,'base64'));}catch{}}
 for(const p of pending.values())clearTimeout(p.timer);try{socket?.close();}catch{}try{browser.kill('SIGTERM');}catch{}await rm(profile,{recursive:true,force:true}).catch(()=>{});
}
