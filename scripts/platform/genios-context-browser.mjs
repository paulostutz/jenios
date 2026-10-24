/** Local UI acceptance with mocked APIs only. Never targets a hosted deployment. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {setTimeout as pause} from 'node:timers/promises';
import {PRO_UI_TASKS} from '../../app/genios-pro/pro-client.mjs';
const require=createRequire(import.meta.url),{chromium}=require('playwright');
const origin=new URL(process.env.JENIOS_CONTEXT_UI_URL||'http://127.0.0.1:3143');
assert.ok(origin.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(origin.hostname));
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||chromium.executablePath(),headless:true,args:['--no-sandbox','--disable-background-networking','--disable-extensions']});
const context=await browser.newContext({viewport:{width:1280,height:900},serviceWorkers:'block'});
const conversations=new Map(),metadata=new Map(),ledgers=new Map(),freeCalls=[],proCalls=[],quoteCalls=[],feedbackCalls=[],externalBlocked=[];
let mode='ok',freeDelay=350,proDelay=350,syncPendingNext=false,checks=0;
const ownerOf=request=>{
 const auth=request.headers()['authorization']||'';
 try{return JSON.parse(Buffer.from(auth.split('.')[1],'base64url').toString()).sub||'visitor';}catch{return 'visitor';}
};
const userFor=id=>({id,aud:'authenticated',role:'authenticated',email:'fixture@example.invalid',is_anonymous:false,user_metadata:metadata.get(id)||{},app_metadata:{provider:'email'},created_at:'2026-10-24T00:00:00Z'});
const json=(route,body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)}).catch(()=>{});
const check=(condition,label)=>{assert.ok(condition,label);checks++;console.log('PASS GENIOS_CONTEXT_UI '+label);};
const access=()=>({ok:true,planCode:'platform-global-crypto',proIncluded:true,universityIncluded:true,paidGenerationEnabled:true,pendingRequests:0,
 wallet:{status:'not_provisioned'},allowance:{status:'configured',totalNanoUsd:1000000000,spentNanoUsd:0,reservedNanoUsd:0,availableNanoUsd:1000000000},
 tasks:PRO_UI_TASKS.map(t=>({...t,available:true})),marketSymbols:['BTC-USD'],marketTimeframes:['1h'],readinessMessage:'Local fixture only'});
await context.addInitScript(()=>{
 if(!['localhost','127.0.0.1'].includes(location.hostname))return;
 window.__geniosFixtureSetIdentity=id=>{
  const key='sb-genios-ui-test-auth-token';
  if(!id){localStorage.removeItem(key);const c=new BroadcastChannel(key);c.postMessage({event:'SIGNED_OUT',session:null});c.close();return;}
  const user={id,aud:'authenticated',role:'authenticated',email:'fixture@example.invalid',is_anonymous:false,user_metadata:{},app_metadata:{provider:'email'},created_at:'2026-10-24T00:00:00Z'};
  const session={access_token:'eyJhbGciOiJIUzI1NiJ9.'+btoa(JSON.stringify({sub:id,exp:Math.floor(Date.now()/1000)+3600,aud:'authenticated',role:'authenticated'}))+'.'+('x'.repeat(43)),refresh_token:'local-fixture-only',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,token_type:'bearer',user};
  localStorage.setItem(key,JSON.stringify(session));const c=new BroadcastChannel(key);c.postMessage({event:'SIGNED_IN',session});c.close();
 };
});
await context.route('**/*',async route=>{
 const request=route.request(),url=new URL(request.url()),owner=ownerOf(request);
 let body={};try{body=request.postDataJSON()||{};}catch{}
 if(url.hostname==='genios-ui-test.invalid'){
  if(url.pathname==='/auth/v1/user'){if(request.method()==='PUT')metadata.set(owner,{...(metadata.get(owner)||{}),...body.data});return json(route,userFor(owner));}
  return json(route,[]);
 }
 if(url.origin!==origin.origin){externalBlocked.push(url.hostname);return route.abort();}
 if(url.pathname==='/api/assistant/conversations'){
  if(mode==='unavailable')return json(route,{ok:true,available:false});
  if(mode==='error')return json(route,{ok:false,available:false,error:'Falha temporária de memória da fixture.'},503);
  const channel=url.searchParams.get('channel')||body.channel||'support',id=url.searchParams.get('id')||body.conversationId;
  if(request.method()==='GET'){
   if(id){const c=conversations.get(id);return c?.owner===owner?json(route,{ok:true,available:true,conversation:c}):json(route,{ok:false,error:'Conversa não encontrada.'},404);}
   return json(route,{ok:true,available:true,conversations:[...conversations.values()].filter(c=>c.owner===owner&&c.channel===channel).map(c=>({id:c.id,title:c.turns[0]?.question||'Conversa da fixture'}))});
  }
  if(body.action==='create'){
   const c={id:randomUUID(),channel:body.channel,persona:body.persona,revision:0,remember:body.remember,expiresAt:new Date(Date.now()+86400000).toISOString(),turns:[],summary:{version:1},owner};
   conversations.set(c.id,c);return json(route,{ok:true,available:true,conversation:c});
  }
  const c=conversations.get(id);if(!c||c.owner!==owner)return json(route,{ok:false,error:'Outra conta não acessa esta conversa.'},404);
  if(body.action==='persona'){assert.equal(body.revision,c.revision);c.persona=body.persona;c.revision++;return json(route,{ok:true,available:true,conversation:c});}
  if(body.action==='delete'){assert.equal(body.revision,c.revision);conversations.delete(id);return json(route,{ok:true,available:true,deleted:true});}
  if(body.action==='feedback'){feedbackCalls.push(body);return json(route,{ok:true,available:true,feedback:{saved:true}});}
  return json(route,{ok:false,error:'Ação inválida.'},400);
 }
 if(url.pathname==='/api/assistant/free'){
  freeCalls.push({owner,...body});
  assert.equal(body.history,undefined);assert.equal(body.summary,undefined);
  const c=conversations.get(body.conversationId);
  if(c){assert.equal(c.owner,owner);assert.equal(body.revision,c.revision);c.turns.push({turnId:body.turnId,question:body.message,answer:'',articles:[],status:'pending',createdAt:new Date().toISOString()});c.revision++;}
  await pause(freeDelay);
  const answer='Resposta local: '+body.message;
  if(c){Object.assign(c.turns.find(t=>t.turnId===body.turnId),{answer,status:'completed'});c.revision++;}
  return json(route,{ok:true,free:true,paidAi:false,persona:body.persona,name:body.persona==='genia'?'Gênia':'Gênio',mode:'guided',explanation:answer,articles:[],...(c?{conversation:c}:{})});
 }
 if(url.pathname==='/api/assistant/pro/access')return json(route,access());
 if(url.pathname==='/api/assistant/pro/history')return json(route,{ok:true,items:ledgers.get(owner)||[]});
 if(url.pathname==='/api/assistant/pro/quote'){
  quoteCalls.push(body);return json(route,{ok:true,quote:{id:'fixture-quote-'+randomUUID(),source:'included',maxRetailNanoUsd:1000,expiresAt:new Date(Date.now()+300000).toISOString()}});
 }
 if(url.pathname==='/api/assistant/pro/chat'){
  proCalls.push({owner,...body});const c=conversations.get(body.conversationId);
  assert.ok(c&&c.owner===owner);assert.equal(body.conversationRevision,c.revision);
  const entry={id:randomUUID(),requestKey:body.requestKey,state:'dispatched',task:body.task,persona:body.persona,createdAt:new Date().toISOString(),source:'included',chargedNanoUsd:null};
  ledgers.set(owner,[entry,...(ledgers.get(owner)||[])]);
  c.turns.push({turnId:body.requestKey,question:body.prompt,answer:'',status:'pending',articles:[],createdAt:new Date().toISOString()});c.revision++;
  await pause(proDelay);
  const answer='Resposta Pro local: '+body.prompt;Object.assign(entry,{state:'settled',answer,chargedNanoUsd:100});
  Object.assign(c.turns.find(t=>t.turnId===body.requestKey),{answer,status:'completed'});c.revision++;
  const pending=syncPendingNext;syncPendingNext=false;
  return json(route,{ok:true,state:'settled',requestId:entry.id,answer,chargedNanoUsd:100,...(pending?{conversationSyncPending:true}:{conversation:c})});
 }
 if(url.pathname.startsWith('/api/'))return json(route,{ok:false,error:'API fora desta fixture local.'},503);
 return route.continue();
});
const page=await context.newPage(),errors=[];
page.on('pageerror',error=>errors.push(error.message));
const sendFree=async text=>{await page.getByLabel('Sua pergunta',{exact:true}).fill(text);await page.getByRole('button',{name:'Enviar pergunta',exact:true}).click();};
const quoteAndSend=async text=>{
 await page.locator('#pro-prompt').fill(text);
 await page.getByRole('button',{name:'Preparar consulta avançada',exact:true}).click();
 await page.getByLabel(/Autorizo enviar minha pergunta/).check();
 await page.getByRole('button',{name:/Confirmar e perguntar a/}).click();
};
try{
 await page.goto(new URL('/platform/assistente',origin).href);
 await page.getByRole('button',{name:'Enviar pergunta',exact:true}).waitFor();
 await sendFree('Quero o plano de R$ 149,90.');
 await page.getByText('Quero o plano de R$ 149,90.',{exact:true}).waitFor();
 check(freeCalls.length===1,'question appears while the request is pending');
 await page.getByText('Resposta local: Quero o plano de R$ 149,90.',{exact:true}).waitFor();
 await sendFree('E esse inclui gráficos?');
 await page.getByText('Resposta local: E esse inclui gráficos?',{exact:true}).waitFor();
 check(freeCalls[0].conversationId===freeCalls[1].conversationId&&freeCalls[1].revision>freeCalls[0].revision,'follow-up sends server conversation identity and revision');
 await page.getByRole('button',{name:'Gênia',exact:true}).click();
 await page.getByText('Resposta local: E esse inclui gráficos?',{exact:true}).waitFor();
 check(freeCalls.length===2,'persona switch preserves the transcript without generating another answer');
 await page.reload();
 await page.getByText('Resposta local: E esse inclui gráficos?',{exact:true}).waitFor();
 check(true,'reload restores the server transcript');
 await page.setViewportSize({width:390,height:844});
 check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+5),'standalone conversation fits mobile width');
 await page.setViewportSize({width:1280,height:900});
 freeDelay=1800;
 await sendFree('Pergunta demorada de contexto.');
 await page.getByRole('button',{name:'Parar espera',exact:true}).click();
 await pause(1900);
 await page.getByRole('button',{name:'Conferir resposta salva',exact:true}).click();
 await page.getByText('Resposta local: Pergunta demorada de contexto.',{exact:true}).waitFor();
 check(freeCalls.length===3,'cancelled wait reconciles the same turn without resending');
 await page.getByText('Memória e conversas',{exact:true}).click();
 await page.getByRole('button',{name:'Excluir conversa',exact:true}).click();
 await page.getByRole('button',{name:'Confirmar exclusão',exact:true}).click();
 await page.getByText('Conversa excluída.',{exact:true}).waitFor();
 check(await page.getByText('Resposta local: E esse inclui gráficos?',{exact:true}).count()===0,'explicit deletion clears the current transcript');
 mode='unavailable';await page.reload();await page.getByText('Memória e conversas · não disponível',{exact:true}).waitFor();
 freeDelay=50;await sendFree('Ajuda nesta visita.');
 await page.getByText('Resposta local: Ajuda nesta visita.',{exact:true}).waitFor();
 check(!freeCalls.at(-1).conversationId,'unavailable memory is explicit and does not invent persistence or determine response mode');
 mode='error';await page.reload();await page.getByText(/Falha temporária de memória da fixture/).last().waitFor();
 check(await page.getByRole('button',{name:'Enviar pergunta',exact:true}).isDisabled(),'infrastructure error is visible and does not silently fall back');
 mode='ok';
 const userA='a1000000-0000-4000-8000-000000000001',userB='b1000000-0000-4000-8000-000000000001';
 await page.evaluate(id=>window.__geniosFixtureSetIdentity(id),userA);await page.reload();
 await page.getByText('Memória e conversas',{exact:true}).click();
 await page.getByLabel('Salvar esta conversa na minha conta por até 30 dias',{exact:true}).check();
 await sendFree('Contexto privado da conta A.');
 await page.getByText('Resposta local: Contexto privado da conta A.',{exact:true}).waitFor();
 check(conversations.get(freeCalls.at(-1).conversationId)?.remember===true,'authenticated retention requires explicit opt-in');
 await page.evaluate(id=>window.__geniosFixtureSetIdentity(id),userB);
 await page.waitForFunction(()=>!document.body.innerText.includes('Contexto privado da conta A.'));
 check(true,'account change immediately clears the previous private transcript');
 await page.getByRole('button',{name:'Gênia',exact:true}).click();
 await page.goto(new URL('/genios-pro?task=university_tutor&lessonId=risco-basico',origin).href);
 await page.getByText('Esta conversa está vinculada à aula que você abriu na Universidade.',{exact:true}).waitFor();
 await page.waitForFunction(()=>document.querySelector('[aria-label="Escolha seu assistente Pro"] button[aria-pressed="true"]')?.textContent.includes('Gênia'));
 check(true,'Pro uses the shared character preference');
 check(await page.getByText('Comprar créditos',{exact:true}).count()===0,'Pro does not expose legacy credit purchases');
 syncPendingNext=true;await quoteAndSend('Explique o conceito desta aula.');
 await page.getByText('Resposta Pro local: Explique o conceito desta aula.',{exact:true}).waitFor();
 check(quoteCalls.at(-1).lessonId==='risco-basico'&&proCalls.at(-1).lessonId==='risco-basico','University lesson identity reaches quote and chat');
 await page.getByRole('button',{name:'Atualizar histórico e conversa',exact:true}).click();
 await page.getByText('Resposta Pro local: Explique o conceito desta aula.',{exact:true}).waitFor();
 check(proCalls.length===1,'settled response with pending memory is restored without another generation');
 await page.locator('#pro-task').selectOption('chart_screenshot');
 const image=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=128;c.height=128;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,128,128);return c.toDataURL('image/png').split(',')[1];});
 await page.locator('#pro-image').setInputFiles({name:'fixture-chart.png',mimeType:'image/png',buffer:Buffer.from(image,'base64')});
 await page.getByText('fixture-chart.png',{exact:true}).waitFor();
 await quoteAndSend('O que aparece nesta captura?');
 await page.getByText('Resposta Pro local: O que aparece nesta captura?',{exact:true}).waitFor();
 check(await page.getByText('fixture-chart.png',{exact:true}).count()===1,'the current image remains available for follow-up');
 await quoteAndSend('E o ponto que acabamos de comentar?');
 await page.getByText('Resposta Pro local: E o ponto que acabamos de comentar?',{exact:true}).waitFor();
 check(proCalls.at(-1).image.base64===proCalls.at(-2).image.base64&&proCalls.at(-1).conversationId===proCalls.at(-2).conversationId,'image follow-up carries the selected image and same conversation');
 proDelay=1800;await quoteAndSend('Consulta Pro demorada.');
 await page.getByRole('button',{name:'Parar espera',exact:true}).click();
 await pause(1900);
 await page.getByRole('button',{name:'Atualizar histórico e conversa',exact:true}).click();
 await page.getByText('Resposta Pro local: Consulta Pro demorada.',{exact:true}).waitFor();
 check(proCalls.length===4,'Pro cancel waits for reconciliation without duplicate requestKey');
 await page.goto(new URL('/lp',origin).href);
 await page.locator('[data-jenios-assistant="social-free"]').waitFor();
 check(true,'landing page includes the shared assistant launcher');
 check(!errors.length,'no uncaught browser errors');
 check(externalBlocked.every(host=>!host.includes('openai.com')),'no model request was made by the local browser fixture');
 console.log(JSON.stringify({result:'PASS',checks,freeRequests:freeCalls.length,proRequests:proCalls.length,scope:'synthetic localhost UI only; no real model, account, delivery or performance certification'}));
}finally{await context.close();await browser.close();}

