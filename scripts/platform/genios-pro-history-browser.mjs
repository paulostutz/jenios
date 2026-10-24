/** G44: focused localhost-only Pro history checks; all APIs and identities are fixtures. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {setTimeout as pause} from 'node:timers/promises';
const require=createRequire(import.meta.url),{chromium}=require('playwright');
const origin=new URL(process.env.JENIOS_HISTORY_UI_URL||'http://127.0.0.1:3144');
assert.ok(origin.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(origin.hostname));
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||chromium.executablePath(),headless:true,args:['--no-sandbox','--disable-background-networking','--disable-extensions']});
const context=await browser.newContext({viewport:{width:1280,height:900},serviceWorkers:'block'});
const userA=randomUUID(),userB=randomUUID(),errors=[],historyCalls=[],generationCalls=[],externalBlocked=[];
let mode='ok',checks=0,deferA=false,releaseA,finishA;
const deferredA=new Promise(resolve=>{releaseA=resolve;}),finishedA=new Promise(resolve=>{finishA=resolve;});
const check=(condition,label)=>{assert.ok(condition,label);checks++;console.log('PASS GENIOS_PRO_HISTORY_UI '+label);};
const waitFor=async predicate=>{for(let i=0;i<200;i++){if(await predicate())return;await pause(25);}throw Error('UI condition did not settle.');};
const ownerOf=request=>{try{return JSON.parse(Buffer.from((request.headers().authorization||'').split('.')[1],'base64url').toString()).sub;}catch{return null;}};
const userFor=id=>({id,aud:'authenticated',role:'authenticated',email:'fixture@example.invalid',is_anonymous:false,user_metadata:{},app_metadata:{provider:'email'},created_at:'2026-10-24T00:00:00Z'});
const row=(owner,state='settled',source='included',amount=200,index=0)=>({id:randomUUID(),requestKey:randomUUID(),task:'advanced_question',persona:'genio',createdAt:new Date(Date.parse('2026-10-24T12:00:00Z')-index*60000).toISOString(),state,source,chargedNanoUsd:amount,answer:state==='settled'?'Resposta exclusiva da conta '+(owner===userA?'A':'B')+'.':null});
const historyFor=(owner,currentMode)=>{
 if(currentMode==='malformed')return {ok:true,status:'verified',items:[null],hasMore:false};
 if(currentMode==='not_provisioned')return {ok:true,status:'not_provisioned',items:[],hasMore:false};
 if(currentMode==='empty')return {ok:true,status:'verified',items:[],hasMore:false};
 const items=currentMode==='many'?Array.from({length:50},(_,i)=>row(owner,'settled','included',200,i)):owner===userA?
  [row(owner,'settled','prepaid'),row(owner,'released','included',0,1),row(owner,'needs_reconciliation','included',0,2),row(owner,'unknown','included',100,3),row(owner,'settled','included',1,4)]:[row(owner)];
 return {ok:true,status:'verified',items,hasMore:currentMode==='many'};
};
const json=(route,body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)}).catch(()=>{});
await context.addInitScript(()=>{
 if(!['localhost','127.0.0.1'].includes(location.hostname))return;
 window.__geniosHistorySetIdentity=id=>{
  const key='sb-genios-ui-test-auth-token';
  if(!id){localStorage.removeItem(key);const c=new BroadcastChannel(key);c.postMessage({event:'SIGNED_OUT',session:null});c.close();return;}
  const user={id,aud:'authenticated',role:'authenticated',email:'fixture@example.invalid',is_anonymous:false,user_metadata:{},app_metadata:{provider:'email'},created_at:'2026-10-24T00:00:00Z'};
  const session={access_token:'eyJhbGciOiJIUzI1NiJ9.'+btoa(JSON.stringify({sub:id,exp:Math.floor(Date.now()/1000)+3600,aud:'authenticated',role:'authenticated'}))+'.'+('x'.repeat(43)),refresh_token:'local-fixture-only',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,token_type:'bearer',user};
  localStorage.setItem(key,JSON.stringify(session));const c=new BroadcastChannel(key);c.postMessage({event:'SIGNED_IN',session});c.close();
 };
});
await context.route('**/*',async route=>{
 const request=route.request(),url=new URL(request.url()),owner=ownerOf(request);
 if(url.hostname==='genios-ui-test.invalid')return json(route,url.pathname==='/auth/v1/user'?userFor(owner):[]);
 if(url.origin!==origin.origin){externalBlocked.push(url.hostname);return route.abort();}
 if(url.pathname==='/api/assistant/conversations')return json(route,{ok:true,available:false});
 if(url.pathname==='/api/assistant/pro/access')return json(route,{ok:true,planCode:null,proIncluded:false,universityIncluded:false,paidGenerationEnabled:false,pendingRequests:0,wallet:{status:'not_provisioned'},allowance:{status:'not_included'},tasks:[],marketSymbols:[],marketTimeframes:[],readinessMessage:'Somente leitura na fixture.'});
 if(url.pathname==='/api/assistant/pro/history'){
  historyCalls.push(owner);const currentMode=mode;
  assert.ok([userA,userB].includes(owner),'History requires the fixture account Bearer token.');
  if(deferA&&owner===userA){deferA=false;const body=historyFor(owner,'ok');await deferredA;await json(route,body);finishA();return;}
  return currentMode==='error'?json(route,{ok:false,error:'Histórico indisponível na fixture.'},503):json(route,historyFor(owner,currentMode));
 }
 if(url.pathname.startsWith('/api/')){generationCalls.push(url.pathname);return json(route,{ok:false,error:'API não autorizada nesta fixture.'},503);}
 return route.continue();
});
const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
const history=page.locator('section[aria-labelledby="pro-history-title"]');
const rows=history.locator('ol > li');
const refresh=()=>history.getByRole('button',{name:'Atualizar histórico e conversa',exact:true}).click();
try{
 await page.goto(new URL('/genios-pro',origin).href);
 await page.getByRole('heading',{name:'Entre para acessar o Pro',exact:true}).waitFor();
 check(await history.count()===0&&historyCalls.length===0,'guest cannot see or request a private statement');
 await page.evaluate(id=>window.__geniosHistorySetIdentity(id),userA);await waitFor(async()=>await rows.count()===5);
 check(await history.isVisible(),'authenticated account without an active plan can inspect its historical consumption');
 const first=rows.nth(0),released=rows.nth(1),pending=rows.nth(2),unknown=rows.nth(3);
 check((await first.innerText()).includes('US$\u00a00,0000002')&&(await released.innerText()).includes('US$\u00a00,00')&&(await pending.innerText()).includes('Valor a confirmar')&&(await unknown.innerText()).includes('Status a verificar'),'confirmed fractional values and uncertain states remain distinct');
 await first.getByText('Ver resposta',{exact:true}).click();await first.getByText('Resposta exclusiva da conta A.',{exact:true}).waitFor();
 check((await first.innerText()).includes('Créditos adquiridos anteriormente')&&await page.getByRole('button',{name:/comprar créditos|adicionar créditos|recarregar saldo/i}).count()===0,'historical prepaid response is readable without a new credit sale');
 mode='many';await refresh();await waitFor(async()=>await rows.count()===50);
 check(await history.getByText('Existem consultas anteriores. Este extrato exibe somente as 50 mais recentes.',{exact:true}).isVisible()&&await history.getByRole('button',{name:/carregar mais|próxima página/i}).count()===0,'API limit and hasMore are explicit without inventing cursor pagination');
 await page.setViewportSize({width:390,height:844});
 check(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'statement fits a 390px mobile viewport');
 mode='error';await refresh();await history.getByRole('alert').waitFor();
 check((await history.getByRole('alert').innerText()).includes('Histórico indisponível na fixture.')&&await rows.count()===0,'read failure hides stale statement rows and offers an explicit retry');
 mode='empty';await refresh();await history.getByText('Nenhuma consulta Pro registrada nesta conta.',{exact:true}).waitFor();
 check(await history.getByRole('alert').count()===0,'a confirmed empty statement is distinct from a read failure');
 mode='not_provisioned';await refresh();await history.getByText('O histórico Pro ainda não está disponível nesta conta. Nenhum valor foi confirmado por esta consulta.',{exact:true}).waitFor();
 check(await history.getByText('Nenhuma consulta Pro registrada nesta conta.',{exact:true}).count()===0,'unprovisioned ledger does not claim confirmed zero consumption');
 mode='malformed';await refresh();await history.getByRole('alert').waitFor();
 check((await history.getByRole('alert').innerText()).includes('Não foi possível confirmar o histórico.')&&await rows.count()===0,'malformed history fails visibly without crashing or inventing values');
 mode='ok';await refresh();await waitFor(async()=>await rows.count()===5);
 const before=historyCalls.length;deferA=true;await refresh();await waitFor(()=>historyCalls.length>before);
 await page.evaluate(id=>window.__geniosHistorySetIdentity(id),userB);await waitFor(async()=>await rows.count()===1);
 releaseA();await finishedA;await pause(100);
 await rows.first().getByText('Ver resposta',{exact:true}).click();await rows.first().getByText('Resposta exclusiva da conta B.',{exact:true}).waitFor();
 check(await history.getByText('Resposta exclusiva da conta A.',{exact:true}).count()===0&&await rows.count()===1,'late response from the previous account never replaces the new owner statement');
 await page.evaluate(()=>window.__geniosHistorySetIdentity(null));await page.getByRole('heading',{name:'Entre para acessar o Pro',exact:true}).waitFor();
 check(await history.count()===0,'sign-out removes the statement from the page');
 check(errors.length===0,'no uncaught browser errors');
 check(generationCalls.length===0&&!externalBlocked.some(host=>/openai|anthropic|generativelanguage/.test(host)),'reading and refreshing history do not generate answers or call a real provider');
 console.log(JSON.stringify({result:'PASS',checks,historyRequests:historyCalls.length,scope:'synthetic localhost Pro history only; no real account, model, database or payment'}));
}finally{releaseA();await context.close();await browser.close();}
