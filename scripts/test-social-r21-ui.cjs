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
 if(u.pathname==='/api/social/posts'){
  if(req.method()==='POST'){const p={id:req.postDataJSON().media?.length?'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa':'55555555-5555-4555-8555-555555555555',author_id:id,body:req.postDataJSON().body,media:req.postDataJSON().media||[],created_at:'2026-10-15T13:00:00Z'};posts=[p,...posts];return json(r,{post:p},201);}
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
  return json(r,{profile:profile(who),posts:posts.filter(p=>p.author_id===who),postsCount:posts.filter(p=>p.author_id===who).length,nextOffset:null});
 }
 if(u.pathname==='/api/social/likes'){if(u.searchParams.has('ids')){batchRequests++;return json(r,{stats:u.searchParams.get('ids').split(',').map(post_id=>({post_id,count:0,liked:false}))});}singleLikeRequests++;if(req.method()==='POST')liked=true;if(req.method()==='DELETE')liked=false;return json(r,{count:liked?1:0,liked});}
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
 assert.equal(batchRequests,1);assert.equal(singleLikeRequests,0);console.log('PASS initial feed uses one batch likes call');
 await page.getByPlaceholder('Compartilhe uma análise, setup HFT ou visão de mercado...').fill('Nova publicação R21');
 await page.getByRole('button',{name:'Publicar no Feed 🚀',exact:true}).click();await page.getByText('Nova publicação R21',{exact:true}).waitFor();
 await page.getByRole('button',{name:'👤 Meu Perfil',exact:true}).click();await page.getByRole('button',{name:'Abrir publicação de Conta QA A',exact:true}).waitFor();
 await page.reload({waitUntil:'domcontentloaded'});await page.getByText('Nova publicação R21',{exact:true}).waitFor();await page.getByRole('button',{name:'👤 Meu Perfil',exact:true}).click();await page.getByRole('button',{name:'Abrir publicação de Conta QA A',exact:true}).waitFor();console.log('PASS publish appears on own profile and survives reload');
 await page.goto(base+'/social?perfil=qa_b');await page.getByRole('button',{name:'+ Seguir',exact:true}).click();await page.getByRole('button',{name:'✓ Seguindo',exact:true}).waitFor();
 await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'✓ Seguindo',exact:true}).waitFor();
 await page.getByRole('button',{name:'Mensagens',exact:true}).click();await page.getByRole('log',{name:'Mensagens recebidas e enviadas',exact:true}).waitFor();assert.equal(recipient,B);console.log('PASS follow persists and header Messages opens the visited profile recipient');
 await page.getByRole('button',{name:'Fechar',exact:true}).click();await page.getByRole('button',{name:'💬 Enviar Mensagem',exact:true}).click();await page.getByRole('log',{name:'Mensagens recebidas e enviadas',exact:true}).waitFor();console.log('PASS profile message button opens same real Direct component');
 await page.getByRole('button',{name:'Fechar',exact:true}).click();await page.goto(base+'/social');
 for(const id of [postId,'55555555-5555-4555-8555-555555555555']){
  const card=page.locator('#jenios-post-'+id);await card.getByRole('button',{name:'↗️ Compartilhar',exact:true}).click();
  const share=page.getByRole('dialog',{name:'Compartilhar publicação'});await share.getByRole('button',{name:'Adicionar aos meus Stories',exact:true}).click();await share.waitFor({state:'hidden'});
  assert.equal(shared.shared_post_id,id);await page.getByRole('button',{name:'Ver meus Stories',exact:true}).click();await page.getByRole('button',{name:'Ver publicação original',exact:true}).waitFor();
  await page.getByRole('button',{name:'Ver publicação original',exact:true}).click();await page.locator('#jenios-post-'+id).waitFor();
 }
 console.log('PASS own and other posts share into Stories immediately, with original post link');
 await page.evaluate(()=>window.__qaSameDocument=123);
 await page.getByRole('link',{name:'Abrir Hub de Tendências ↗',exact:true}).click();await page.getByRole('heading',{name:'Hub de Tendências',exact:true}).waitFor();
 assert.equal(await page.getByText('Fonte da última leitura',{exact:true}).count(),0);assert.equal(await page.getByText(/GeckoTerminal\/CoinGecko/).count(),0);
 await page.getByRole('link',{name:'Voltar à Social',exact:true}).click();await page.getByText('Nova publicação R21',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>window.__qaSameDocument),123);console.log('PASS Hub and return use client navigation; source card removed');
 await page.locator('input[type=file][accept="image/*,video/*"]').setInputFiles('/tmp/jenios-r21-video.webm');
 await page.locator('video[src^="blob:"]').waitFor();await page.getByPlaceholder('Compartilhe uma análise, setup HFT ou visão de mercado...').fill('Vídeo R21');
 await page.getByRole('button',{name:'Publicar no Feed 🚀',exact:true}).click();await page.locator('#jenios-post-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa').waitFor();
 assert.equal(uploadedBytes,7*1024*1024);assert.equal(uploadChunks.length,2);assert.equal(posts[0].media[0].type,'video');console.log('PASS signed resumable 7 MB video in two chunks with real browser TUS client and mocked storage');
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
 await page.screenshot({path:'/tmp/jenios-r21-mobile.png'});assert.deepEqual(errors,[]);console.log('PASS mobile fit, zero browser exceptions; synthetic accounts and mocked HTTP');
}catch(error){console.log('PAGE',await page.locator('body').innerText());console.log('POSTS',posts);throw error;}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
