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
let lives=[{id:oldId,host_id:B,title:'Live compartilhada',youtube_video_id:'abcdefghijk',created_at:new Date().toISOString()}];
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
 if(u.pathname==='/api/social/lives'){if(req.method()==='POST'){const data=req.postDataJSON();lives.unshift({id:postId,host_id:id,title:data.title,youtube_video_id:data.videoId});return json(r,{live:lives[0]},201);}if(req.method()==='DELETE'){lives=lives.filter(x=>x.id!==u.searchParams.get('id')||x.host_id!==id);return json(r,{deleted:true});}return json(r,{lives,nextOffset:null});}
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
await ctx.addInitScript(({key,value})=>{try{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(value));}catch{}},{key,value:session(A)});
async function signal(value,event='SIGNED_IN'){
 await page.evaluate(({key,value,event})=>{if(value)localStorage.setItem(key,JSON.stringify(value));else localStorage.removeItem(key);const channel=new BroadcastChannel(key);channel.postMessage({event,session:value});setTimeout(()=>channel.close(),100);},{key,value,event});
}
try{
 await page.goto(base+'/social',{waitUntil:'domcontentloaded'});await page.getByText('Publicação compartilhada de teste',{exact:true}).waitFor();
 await page.getByRole('button',{name:'🔴 Lives',exact:true}).click();await page.getByText('Live compartilhada',{exact:true}).waitFor();
 await page.getByLabel('Título da transmissão').fill('Minha Live QA');await page.getByLabel('Link da Live do YouTube').fill('https://www.youtube.com/watch?v=12345678901');await page.getByRole('button',{name:'Adicionar Live do YouTube',exact:true}).click();await page.getByText('Minha Live QA',{exact:true}).waitFor();
 await page.reload({waitUntil:'domcontentloaded'});await page.getByText('Publicação compartilhada de teste',{exact:true}).waitFor();await page.getByRole('button',{name:'🔴 Lives',exact:true}).click();await page.getByText('Minha Live QA',{exact:true}).waitFor();
 const ownLive=page.locator('article').filter({hasText:'Minha Live QA'});await ownLive.getByRole('button',{name:'Remover',exact:true}).click();await page.getByText('Minha Live QA',{exact:true}).waitFor({state:'hidden'});
 await page.locator('article').filter({hasText:'Live compartilhada'}).getByRole('button',{name:'Denunciar',exact:true}).click();await page.getByLabel('Motivo da denúncia da Live').selectOption('fraud');await page.getByRole('button',{name:'Enviar denúncia da Live',exact:true}).click();await page.getByRole('button',{name:'Denúncia enviada',exact:true}).waitFor();assert.equal(reportSaved.targetType,'live');assert.equal(reportSaved.targetId,oldId);console.log('PASS Lives load, publish, persist reload, owner delete and report through API');
 assert.deepEqual(errors,[]);console.log('PASS no browser exceptions; synthetic accounts and HTTP only.');
}catch(e){console.log((await page.locator('body').innerText()).slice(-7000));throw e;}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
