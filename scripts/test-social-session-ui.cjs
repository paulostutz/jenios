// Local browser QA with synthetic accounts and mocked HTTP. Never touches real user data.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const base=process.env.TEST_BASE_URL||'http://localhost:3041';
const A='11111111-1111-4111-8111-111111111111', B='22222222-2222-4222-8222-222222222222';
const postId='33333333-3333-4333-8333-333333333333', oldId='44444444-4444-4444-8444-444444444444';
const key='sb-qa-jenios-auth-token';
const profile=id=>({id,handle:id===A?'qa_a':'qa_b',display_name:id===A?'Conta QA A':'Conta QA B',bio:'Perfil sintético de teste',avatar_url:null});
function session(id){const user={id,aud:'authenticated',role:'authenticated',email:'qa@example.invalid',app_metadata:{},user_metadata:{},is_anonymous:false};return {access_token:Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:id,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.cWE',refresh_token:'test-only',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user};}
const owner=req=>{try{return JSON.parse(Buffer.from(req.headers().authorization.split('.')[1],'base64url')).sub;}catch{return null;}};
(async()=>{
const browser=await chromium.launch({executablePath:process.env.TEST_CHROMIUM_PATH||undefined,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const ctx=await browser.newContext({viewport:{width:1440,height:1000}});const page=await ctx.newPage();page.setDefaultTimeout(15000);
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
const json=(r,body,status=200)=>r.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
let posts=[{id:postId,author_id:B,body:'Publicação compartilhada de teste',created_at:'2026-10-15T12:00:00Z',media:[]}],comments=[],liked=false,fail=false,release=null,delayNext=false,saved=false,followed=false,storyDeleted=false,commentLiked=false,reportSaved=null,blocked=false,moderationStatus='pending',moderationHidden=false;
const decisions=[];
await ctx.route('https://qa-jenios.supabase.co/**',async r=>{
 const req=r.request(),u=new URL(req.url()),id=owner(req);
 if(req.method()==='OPTIONS')return r.fulfill({status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'*'}});
 if(u.pathname.endsWith('/auth/v1/user'))return json(r,session(id||A).user);
 if(u.pathname.endsWith('/rest/v1/profiles')){
  if(req.method()==='POST')return json(r,[profile(id)]);
  const ids=u.searchParams.get('id')||'';let rows=[profile(A),profile(B)].filter(p=>!ids||ids.includes(p.id));
  return json(r,(req.headers().accept||'').includes('object')?rows[0]:rows.map(p=>({...p,user_id:p.id})));
 }
 if(u.pathname.includes('/rest/v1/jenios_direct_'))return json(r,[]);
 if(u.pathname.endsWith('/rest/v1/jenios_social_notifications'))return json(r,[]);
 return json(r,[]);
});
await ctx.route('**/api/**',async r=>{
 const req=r.request(),u=new URL(req.url()),id=owner(req);
 if(u.pathname==='/api/social/posts'){
  if(req.method()==='POST'){const p={id:'55555555-5555-4555-8555-555555555555',author_id:id,body:req.postDataJSON().body,media:[],created_at:'2026-10-15T13:00:00Z'};posts=[p,...posts];return json(r,{post:p},201);}
  if(u.searchParams.has('id'))return json(r,{post:{id:oldId,author_id:B,body:'Publicação antiga da notificação',created_at:'2026-09-01T00:00:00Z',media:[]}});
  if(delayNext){delayNext=false;await new Promise(resolve=>{release=resolve;});return json(r,{posts:[{id:postId,author_id:A,body:'RESPOSTA ATRASADA DA CONTA A',created_at:'2026-10-15T13:00:00Z',media:[]}],nextBefore:null});}
  if(fail)return json(r,{error:'FEED_UNAVAILABLE'},503);
  return json(r,{posts: id===B?[]:posts.filter(p=>!blocked||p.author_id!==B),nextBefore:null});
 }
 if(u.pathname==='/api/social/blocks'){
  if(req.method()==='POST'){blocked=true;return json(r,{blocked:true});}if(req.method()==='DELETE'){blocked=false;return json(r,{blocked:false});}
  return json(r,{profiles:blocked?[profile(B)]:[],nextOffset:null});
 }
 if(u.pathname==='/api/social/moderation'){
  if(id!==A)return json(r,{error:'Acesso exclusivo para moderadores autorizados.'},403);
  if(req.method()==='POST'){const input=req.postDataJSON();assert.equal(input.expectedStatus,moderationStatus);decisions.push(input);moderationHidden=input.decision==='hide';moderationStatus=moderationHidden?'resolved':'reviewing';return json(r,{report:{status:moderationStatus}});}
  return json(r,{reports:u.searchParams.get('status')===moderationStatus?[{id:'88888888-8888-4888-8888-888888888888',target_type:'post',target_id:postId,reason:'fraud',details:'Denúncia sintética para moderação',status:moderationStatus,post_body:'Conteúdo sintético para análise',hidden:moderationHidden}]:[],nextOffset:null});
 }
 if(u.pathname==='/api/social/stories'){
  if(req.method()==='DELETE'){storyDeleted=true;return json(r,{deleted:true});}
  return json(r,{stories:storyDeleted?[]:[{id:'77777777-7777-4777-8777-777777777777',author_id:A,media_type:'image',media_path:'data:image/gif;base64,R0lGODlhAQABAAAAACw=',created_at:new Date(Date.now()-10000).toISOString(),expires_at:new Date(Date.now()+86000000).toISOString()}],nextOffset:null});
 }
 if(u.pathname==='/api/social/saved'){
  if(req.method()==='POST')saved=true;if(req.method()==='DELETE')saved=false;
  if(u.searchParams.has('ids'))return json(r,{ids:saved?[postId]:[]});
  return json(r,{posts:saved?posts.filter(p=>p.id===postId):[],nextOffset:null,saved});
 }
 if(u.pathname==='/api/social/follows'){
  if(req.method()==='POST')followed=true;if(req.method()==='DELETE')followed=false;
  if(u.searchParams.has('list'))return json(r,{profiles:followed?[profile(B)]:[],nextOffset:null});
  return json(r,{followers:followed?1:0,following:followed?1:0,followed});
 }
 if(u.pathname==='/api/social/profiles'){
  const who=u.searchParams.get('id')||(u.searchParams.get('handle')==='qa_a'?A:B);
  return json(r,{profile:profile(who),posts:posts.filter(p=>p.author_id===who),postsCount:posts.filter(p=>p.author_id===who).length,nextOffset:null});
 }
 if(u.pathname==='/api/social/likes'){if(req.method()==='POST')liked=true;if(req.method()==='DELETE')liked=false;return json(r,{count:liked?1:0,liked});}
 if(u.pathname==='/api/social/comment-likes'){commentLiked=req.method()==='POST';return json(r,{liked:commentLiked});}
 if(u.pathname==='/api/social/reports'){reportSaved=req.postDataJSON();return json(r,{report:{id:'88888888-8888-4888-8888-888888888888',status:'pending'}},201);}
 if(u.pathname==='/api/social/comments'){
  if(req.method()==='POST'){const input=req.postDataJSON(),c={id:'66666666-6666-4666-8666-666666666666',author_id:id,body:input.body,parent_id:input.parentId,post_id:postId,created_at:'2026-10-15T13:00:00Z'};comments.push(c);return json(r,{comment:c},201);}
  return json(r,{comments:comments.map(c=>({...c,likes:commentLiked?1:0,liked:commentLiked}))});
 }
 if(u.pathname==='/api/tendencias')return json(r,{tokens:[],megapulse:[],baleias:[],modulos:{}});
 return json(r,{noticias:[],ranking:[],candidatos:[],items:[]});
});
await ctx.addInitScript(({key,value})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(value));},{key,value:session(A)});
async function signal(value,event='SIGNED_IN'){
 await page.evaluate(({key,value,event})=>{if(value)localStorage.setItem(key,JSON.stringify(value));else localStorage.removeItem(key);const channel=new BroadcastChannel(key);channel.postMessage({event,session:value});setTimeout(()=>channel.close(),100);},{key,value,event});
}
try{
 await page.goto(base+'/social',{waitUntil:'domcontentloaded'});await page.getByText('Publicação compartilhada de teste',{exact:true}).waitFor();
 const draft=page.getByPlaceholder('Compartilhe uma análise, setup HFT ou visão de mercado...');
 await draft.fill('Rascunho preservado ao retornar');await signal(session(A));
 await page.waitForFunction(()=>document.querySelector('textarea')?.value==='Rascunho preservado ao retornar');assert.equal(await draft.inputValue(),'Rascunho preservado ao retornar');console.log('PASS same-account SIGNED_IN preserves draft');
 const card=page.locator('#jenios-post-'+postId);
 await card.getByRole('button',{name:'🤍 Curtir',exact:true}).click();await card.getByText('1 curtidas',{exact:true}).waitFor();
 await card.getByRole('button',{name:'💬 Comentar',exact:true}).click();await card.getByPlaceholder('Adicione um comentário...').fill('Comentário persistido de teste');await card.getByRole('button',{name:'Publicar',exact:true}).click();await card.getByText('Comentário persistido de teste',{exact:true}).waitFor();console.log('PASS feed likes and comments use HTTP');
 await card.getByRole('button',{name:'♡ Curtir',exact:true}).click();await card.getByRole('button',{name:'❤️ Curtir (1)',exact:true}).waitFor();
 await page.reload({waitUntil:'domcontentloaded'});await card.getByRole('button',{name:'💬 Comentar',exact:true}).click();await card.getByRole('button',{name:'❤️ Curtir (1)',exact:true}).waitFor();await card.getByRole('button',{name:'❤️ Curtir (1)',exact:true}).click();await card.getByRole('button',{name:'♡ Curtir',exact:true}).waitFor();console.log('PASS comment like persists and unlike updates count');
 await card.getByRole('button',{name:'Opções da publicação',exact:true}).click();await card.getByRole('button',{name:'⚠️ Denunciar publicação',exact:true}).click();
 const report=page.getByRole('dialog',{name:'Denunciar publicação'});await report.getByLabel('Motivo da denúncia').selectOption('fraud');await report.getByLabel('Detalhes da denúncia').fill('Relato sintético de teste');await report.getByRole('button',{name:'Enviar denúncia',exact:true}).click();await report.waitFor({state:'hidden'});assert.equal(reportSaved.postId,postId);assert.equal(reportSaved.reason,'fraud');console.log('PASS report records reason and correct post through API');
 await card.getByRole('button',{name:'Opções da publicação',exact:true}).click();await card.getByRole('button',{name:'Bloquear usuário',exact:true}).click();await page.getByText('Publicação compartilhada de teste',{exact:true}).waitFor({state:'hidden'});
 await page.getByRole('button',{name:'Usuários bloqueados',exact:true}).click();const blocksDialog=page.getByRole('dialog',{name:'Usuários bloqueados'});await blocksDialog.getByRole('button',{name:'Desbloquear',exact:true}).click();await blocksDialog.getByText('Você não bloqueou nenhum usuário.',{exact:true}).waitFor();await blocksDialog.getByRole('button',{name:'Fechar bloqueios',exact:true}).click();await page.getByText('Publicação compartilhada de teste',{exact:true}).waitFor();console.log('PASS block removes author and unblock restores server feed');
 await draft.fill('Nova publicação de teste');await page.getByRole('button',{name:'Publicar no Feed 🚀',exact:true}).click();await page.getByText('Nova publicação de teste',{exact:true}).waitFor();await page.reload({waitUntil:'domcontentloaded'});await page.getByText('Nova publicação de teste',{exact:true}).waitFor();console.log('PASS published post survives reload through API');
 await page.locator('#jenios-post-'+postId).getByRole('button',{name:'🏷️ Salvar',exact:true}).click();
 await page.locator('#jenios-post-'+postId).getByRole('button',{name:'🔖 Salvo',exact:true}).waitFor();
 await page.reload({waitUntil:'domcontentloaded'});await page.locator('#jenios-post-'+postId).getByRole('button',{name:'🔖 Salvo',exact:true}).waitFor();
 await page.getByRole('button',{name:'🔖 Salvos',exact:true}).click();await page.getByRole('button',{name:'Abrir publicação de Conta QA B',exact:true}).waitFor();console.log('PASS save survives reload and saved gallery uses API');
 await page.goto(base+'/social?perfil=qa_b');await page.getByRole('button',{name:'+ Seguir',exact:true}).click();await page.getByRole('button',{name:'✓ Seguindo',exact:true}).waitFor();
 await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'✓ Seguindo',exact:true}).waitFor();await page.getByRole('button',{name:'✓ Seguindo',exact:true}).click();await page.getByRole('button',{name:'+ Seguir',exact:true}).waitFor();console.log('PASS profile URL and follow/unfollow persist through API');
 await page.goto(base+'/social');await page.getByText('Publicação compartilhada de teste',{exact:true}).waitFor();await page.getByRole('button',{name:'Ver meus Stories',exact:true}).click();await page.getByRole('button',{name:'Excluir meu Story',exact:true}).waitFor();
 await page.getByRole('button',{name:'Excluir meu Story',exact:true}).click();await page.getByRole('button',{name:'Excluir meu Story',exact:true}).waitFor({state:'hidden'});await page.reload({waitUntil:'domcontentloaded'});await page.getByText('Publicação compartilhada de teste',{exact:true}).waitFor();await page.getByRole('button',{name:'Ver meus Stories',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Excluir meu Story',exact:true}).count(),0);assert.equal(storyDeleted,true);console.log('PASS server Stories load and deletion survives reload');
 await page.goto(base+'/social?post='+oldId);await page.locator('#jenios-post-'+oldId).waitFor();assert.match(await page.locator('#jenios-post-'+oldId).getAttribute('style'),/outline.*2px/);console.log('PASS notification deep link loads post outside first feed page');
 await page.goto(base+'/social?direct=1');await page.getByRole('heading',{name:'Mensagens · Direct'}).waitFor();console.log('PASS Direct notification opens authenticated dialog');await page.getByRole('button',{name:'Fechar',exact:true}).click();
 await draft.fill('Rascunho privado da conta A');await signal(session(B));await page.getByText('Nenhuma publicação disponível.',{exact:true}).waitFor();assert.equal(await draft.inputValue(),'');assert.equal(await page.getByText('Nova publicação de teste',{exact:true}).count(),0);console.log('PASS account switch clears posts and draft');
 // Switch while the previous account's request is still pending.
 delayNext=true;await signal(session(A));await page.waitForTimeout(100);for(let i=0;i<30&&!release;i++)await page.waitForTimeout(50);assert.ok(release);
 await signal(session(B));await page.getByText('Nenhuma publicação disponível.',{exact:true}).waitFor();release();await page.waitForTimeout(200);assert.equal(await page.getByText('RESPOSTA ATRASADA DA CONTA A',{exact:true}).count(),0);console.log('PASS late account-A response cannot repopulate account B');
 fail=true;await signal(session(A));await page.getByRole('button',{name:'Tentar novamente',exact:true}).waitFor();await page.getByRole('button',{name:'Mensagens',exact:true}).waitFor();fail=false;await page.getByRole('button',{name:'Tentar novamente',exact:true}).click();await page.getByText('Nova publicação de teste',{exact:true}).waitFor();console.log('PASS failed feed preserves layout and can retry');
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);assert.equal(await page.locator('.social-profile-stats').evaluate(el=>Array.from(el.children).filter(c=>getComputedStyle(c).display!=='none').every(c=>c.getBoundingClientRect().right<=el.getBoundingClientRect().right)),true);console.log('PASS mobile page and all profile indicators fit');
 await page.screenshot({path:'/tmp/jenios-r9-mobile.png'});
 await signal(null,'SIGNED_OUT');await page.getByText('Entre na sua conta para acompanhar as publicações.',{exact:true}).waitFor();assert.equal(await draft.inputValue(),'');assert.deepEqual(errors,[]);console.log('PASS sign-out clears feed; zero browser exceptions');
 await page.goto(base+'/admin/moderacao',{waitUntil:'domcontentloaded'});await page.getByText('Conteúdo sintético para análise',{exact:true}).waitFor();await page.getByLabel('Justificativa 88888888-8888-4888-8888-888888888888').fill('Violação confirmada em teste');await page.getByRole('button',{name:'Ocultar publicação',exact:true}).click();await page.getByText('Nenhuma denúncia neste estado.',{exact:true}).waitFor();await page.getByLabel('Estado da denúncia').selectOption('resolved');await page.getByRole('button',{name:'Restaurar publicação',exact:true}).waitFor();await page.getByLabel('Justificativa 88888888-8888-4888-8888-888888888888').fill('Revisão concluída em teste');await page.getByRole('button',{name:'Restaurar publicação',exact:true}).click();await page.getByText('Nenhuma denúncia neste estado.',{exact:true}).waitFor();assert.deepEqual(decisions.map(d=>d.decision),['hide','restore']);console.log('PASS moderator queue hides and restores with justification');
 await signal(session(B));await page.getByText('Acesso exclusivo para moderadores autorizados.',{exact:true}).waitFor();assert.equal(await page.getByText('Conteúdo sintético para análise',{exact:true}).count(),0);assert.deepEqual(errors,[]);console.log('PASS moderator session switch clears private queue and shows denial');
 console.log('18 browser checks passed. Mocked sessions and HTTP, not live-account homologation.');
}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
