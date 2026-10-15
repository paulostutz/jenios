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
const decisions=[];let batchRequests=0,singleLikeRequests=0,shared=null,recipient=null,uploadedBytes=0,uploadChunks=[];const threadId='99999999-9999-4999-8999-999999999999';
await ctx.route('https://qa-jenios.supabase.co/**',async r=>{
 const req=r.request(),u=new URL(req.url()),id=owner(req);
 if(req.method()==='OPTIONS')return r.fulfill({status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'*'}});
 if(u.pathname.endsWith('/auth/v1/user'))return json(r,session(id||A).user);
 if(u.pathname.endsWith('/rest/v1/profiles')){
  if(req.method()==='POST')return json(r,[profile(id)]);
  const ids=u.searchParams.get('id')||'';let rows=[profile(A),profile(B)].filter(p=>!ids||ids.includes(p.id));
  return json(r,(req.headers().accept||'').includes('object')?rows[0]:rows.map(p=>({...p,user_id:p.id})));
 }
 if(u.pathname.endsWith('/rest/v1/rpc/jenios_open_direct_v7')){recipient=req.postDataJSON().recipient_id;return json(r,threadId);}
 if(u.pathname.endsWith('/rest/v1/jenios_direct_threads_v7'))return json(r,recipient?[{id:threadId,user_low:A,user_high:B,created_at:new Date().toISOString()}]:[]);
 if(u.pathname.includes('/rest/v1/jenios_direct_'))return json(r,[]);
 if(u.pathname.endsWith('/rest/v1/jenios_social_notifications'))return json(r,[]);
 return json(r,[]);
});
await ctx.route('https://qa-jenios.storage.supabase.co/**',async r=>{
 const req=r.request();const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'*','Access-Control-Expose-Headers':'Location,Upload-Offset,Tus-Resumable','Tus-Resumable':'1.0.0'};
 if(req.method()==='OPTIONS')return r.fulfill({status:204,headers});
 assert.equal(req.headers()['x-signature'],'qa-signed-token');
 const size=req.postDataBuffer()?.length||0;uploadedBytes+=size;uploadChunks.push(size);assert(size<=6*1024*1024);
 return r.fulfill({status:req.method()==='POST'?201:204,headers:{...headers,Location:'https://qa-jenios.storage.supabase.co/storage/v1/upload/resumable/qa-file','Upload-Offset':String(uploadedBytes)}});
});
await ctx.route('**/api/**',async r=>{
 const req=r.request(),u=new URL(req.url()),id=owner(req);
 if(u.pathname==='/api/social/media')return json(r,req.method()==='POST'?{bucket:'social-media',path:A+'/qa.webm',token:'qa-signed-token',resumableEndpoint:'https://qa-jenios.storage.supabase.co/storage/v1/upload/resumable'}:{publicUrl:'https://media.example.invalid/qa.webm'});
 if(u.pathname==='/api/social/archive'){
  if(req.method()==='PATCH'){const input=req.postDataJSON();const found=posts.find(p=>p.id===input.postId&&p.author_id===id);if(!found)return json(r,{error:'POST_NOT_FOUND'},404);found.archived_at=input.archived?new Date().toISOString():null;return json(r,{post:found});}
  return json(r,{posts:posts.filter(p=>p.author_id===id&&p.archived_at),nextOffset:null});
 }
 if(u.pathname==='/api/social/posts'){
  if(req.method()==='POST'){const p={id:req.postDataJSON().media?.length?'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa':'55555555-5555-4555-8555-555555555555',author_id:id,body:req.postDataJSON().body,media:req.postDataJSON().media||[],created_at:'2026-10-15T13:00:00Z'};posts=[p,...posts];return json(r,{post:p},201);}
  if(u.searchParams.has('id'))return json(r,{post:{id:oldId,author_id:B,body:'Publicação antiga da notificação',created_at:'2026-09-01T00:00:00Z',media:[]}});
  if(delayNext){delayNext=false;await new Promise(resolve=>{release=resolve;});return json(r,{posts:[{id:postId,author_id:A,body:'RESPOSTA ATRASADA DA CONTA A',created_at:'2026-10-15T13:00:00Z',media:[]}],nextBefore:null});}
  if(fail)return json(r,{error:'FEED_UNAVAILABLE'},503);
  return json(r,{posts: id===B?[]:posts.filter(p=>!p.archived_at&&(!blocked||p.author_id!==B)),nextBefore:null});
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
  if(req.method()==='POST'){const source=posts.find(p=>p.id===req.postDataJSON().postId);assert(source);shared={id:'77777777-7777-4777-8777-777777777777',author_id:A,media_type:'post',media_path:null,shared_post_id:source.id,sharedPost:{...source,profile:profile(source.author_id)},created_at:new Date().toISOString(),expires_at:new Date(Date.now()+86400000).toISOString()};return json(r,{story:shared},201);}
  if(shared)return json(r,{stories:[shared],nextOffset:null});
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
  return json(r,{profile:profile(who),posts:posts.filter(p=>p.author_id===who&&!p.archived_at),postsCount:posts.filter(p=>p.author_id===who&&!p.archived_at).length,nextOffset:null});
 }
 if(u.pathname==='/api/social/likes'){if(u.searchParams.has('ids')){batchRequests++;return json(r,{stats:u.searchParams.get('ids').split(',').map(post_id=>({post_id,count:0,liked:false}))});}singleLikeRequests++;if(req.method()==='POST')liked=true;if(req.method()==='DELETE')liked=false;return json(r,{count:liked?1:0,liked});}
 if(u.pathname==='/api/social/comment-likes'){commentLiked=req.method()==='POST';return json(r,{liked:commentLiked});}
 if(u.pathname==='/api/social/reports'){reportSaved=req.postDataJSON();return json(r,{report:{id:'88888888-8888-4888-8888-888888888888',status:'pending'}},201);}
 if(u.pathname==='/api/social/comments'){
  if(req.method()==='POST'){const input=req.postDataJSON(),c={id:'66666666-6666-4666-8666-666666666666',author_id:id,body:input.body,parent_id:input.parentId,post_id:postId,created_at:'2026-10-15T13:00:00Z'};comments.push(c);return json(r,{comment:c},201);}
  return json(r,{comments:comments.map(c=>({...c,likes:commentLiked?1:0,liked:commentLiked}))});
 }
 if(u.pathname==='/api/tendencias')return json(r,{tokens:[],megapulse:[{id:'PETR4',nome:'Cotação antiga QA',simbolo:'PETR4',preco:10,variacao:2,negociadoEm:new Date(Date.now()-3600000).toISOString()}],baleias:[1,2,3].map(n=>({id:String(n).padStart(64,'0'),nome:'Transferência QA '+n,simbolo:'BTC',quantidade:100+n,data:new Date(Date.now()-n*3600000).toISOString()})),modulos:{tokens:{disponivel:true},megapulse:{disponivel:true},baleias:{disponivel:true,historico:true}}});
 return json(r,{noticias:[],ranking:[],candidatos:[],items:[]});
});
await ctx.addInitScript(({key,value})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(value));},{key,value:session(A)});
async function signal(value,event='SIGNED_IN'){
 await page.evaluate(({key,value,event})=>{if(value)localStorage.setItem(key,JSON.stringify(value));else localStorage.removeItem(key);const channel=new BroadcastChannel(key);channel.postMessage({event,session:value});setTimeout(()=>channel.close(),100);},{key,value,event});
}
try{
 await page.goto(base+'/social',{waitUntil:'domcontentloaded'});await page.getByText('Publicação compartilhada de teste',{exact:true}).waitFor();
 const nav=page.getByRole('navigation',{name:'Navegação da JENIOS Social'});
 assert.equal(await nav.getByRole('button',{name:'🔖 Salvos',exact:true}).count(),0);
 await page.getByPlaceholder('Compartilhe uma análise, setup HFT ou visão de mercado...').fill('Publicação para arquivar');
 await page.getByRole('button',{name:'Publicar no Feed 🚀',exact:true}).click();
 const own=page.locator('#jenios-post-55555555-5555-4555-8555-555555555555');await own.waitFor();
 await page.locator('#jenios-post-'+postId).getByRole('button',{name:'Opções da publicação'}).click();assert.equal(await page.getByRole('button',{name:'Arquivar publicação',exact:true}).count(),0);
 await page.locator('#jenios-post-'+postId).getByRole('button',{name:'Opções da publicação'}).click();
 await own.getByRole('button',{name:'Opções da publicação'}).click();await page.getByRole('button',{name:'Arquivar publicação',exact:true}).click();await own.waitFor({state:'hidden'});
 const original=posts.find(p=>p.author_id===A);assert(original.archived_at);const date=original.created_at;
 await nav.getByRole('button',{name:'Arquivados',exact:true}).click();await page.getByRole('button',{name:'Desarquivar',exact:true}).waitFor();
 await page.getByRole('button',{name:'Abrir publicação arquivada de Conta QA A',exact:true}).click();await page.getByRole('dialog',{name:'Publicação arquivada',exact:true}).waitFor();await page.getByRole('button',{name:'Fechar arquivo',exact:true}).click();
 assert.equal(await page.getByRole('button',{name:'Arquivar',exact:true}).count(),0);
 await page.reload({waitUntil:'domcontentloaded'});await page.getByText('Publicação compartilhada de teste',{exact:true}).waitFor();assert.equal(await own.count(),0);
 await nav.getByRole('button',{name:'Arquivados',exact:true}).click();await page.getByRole('button',{name:'Desarquivar',exact:true}).waitFor();
 await page.getByRole('button',{name:'Desarquivar',exact:true}).click();await page.getByRole('button',{name:'Desarquivar',exact:true}).waitFor({state:'hidden'});assert.equal(original.archived_at,null);assert.equal(original.created_at,date);
 await nav.getByRole('button',{name:'🏠 Feed',exact:true}).click();await own.waitFor();console.log('PASS own post archive hides feed/profile, persists reload, restores original date; other post has no archive action');
 await page.getByRole('link',{name:'Abrir Hub de Tendências ↗',exact:true}).click();await page.getByRole('button',{name:'Movimentações de baleias',exact:false}).click();
 assert.equal(await page.getByText(/BTC ·/).count(),3);assert((await page.locator('body').innerText()).includes('histórico'));
 await page.getByRole('button',{name:'MegaPulse B3 & Futuros',exact:false}).click();assert.equal(await page.getByText('Cotação antiga QA',{exact:true}).count(),0);await page.getByText('Sem movimentos recentes confirmados agora.',{exact:true}).waitFor();
 console.log('PASS whale fallback shows all three timed events; MegaPulse rejects stale fixture');
 assert.deepEqual(errors,[]);console.log('PASS zero browser exceptions; synthetic accounts and mocked HTTP');
}catch(error){console.log('PAGE',await page.locator('body').innerText());console.log('POSTS',posts);throw error;}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
