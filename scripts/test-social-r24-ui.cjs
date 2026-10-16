// Local QA only: synthetic accounts, in-memory HTTP fixtures, no production writes.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const base = process.env.TEST_BASE_URL || 'http://localhost:3074';
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
const id=n=>String(n).repeat(8)+'-'+String(n).repeat(4)+'-4'+String(n).repeat(3)+'-8'+String(n).repeat(3)+'-'+String(n).repeat(12);
const image = 'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320"><rect width="320" height="320" fill="#7c3aed"/><text x="120" y="180" fill="white" font-size="70">QA</text></svg>');
const profile = who => ({id:who,handle:who===A?'qa_a':'qa_b',display_name:who===A?'Conta QA A':'Conta QA B',avatar_url:image,bio:'Perfil sintético',cargo:''});
const user = {id:A,aud:'authenticated',role:'authenticated',email:'qa@example.invalid',is_anonymous:false,app_metadata:{},user_metadata:{}};
const session = {access_token:Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:A,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.cWE',refresh_token:'qa-only',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user};
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.TEST_CHROMIUM_PATH||undefined,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const page=await context.newPage();page.setDefaultTimeout(15000);const errors=[];page.on('pageerror',error=>errors.push(error.message));
 const videoBytes=Buffer.from(await page.evaluate(async()=>{
  const canvas=document.createElement('canvas');canvas.width=64;canvas.height=64;const drawing=canvas.getContext('2d'),stream=canvas.captureStream(12),chunks=[];
  const recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8'});
  const done=new Promise(resolve=>{recorder.ondataavailable=event=>chunks.push(event.data);recorder.onstop=async()=>resolve(Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer())));});
  recorder.start();const timer=setInterval(()=>{drawing.fillStyle='#7c3aed';drawing.fillRect(0,0,64,64);drawing.fillStyle='#fff';drawing.fillRect(Date.now()%40,8,10,10);},60);
  await new Promise(resolve=>setTimeout(resolve,1100));clearInterval(timer);recorder.stop();const bytes=await done;stream.getTracks().forEach(track=>track.stop());return bytes;
 }));
 let posts=[{id:id(3),author_id:B,body:'Feed público sintético',media:[],created_at:new Date().toISOString()},...Array.from({length:6},(_,n)=>({id:'aaaaaaaa-aaaa-4aaa-8aaa-'+String(n+1).padStart(12,'0'),author_id:A,body:'Post persistido '+n,media:[{url:image,type:'image'}],created_at:new Date(Date.now()-1000*(n+1)).toISOString()}))];
 const stories=[{id:id(4),author_id:A,media_type:'image',media_path:image},{id:id(5),author_id:A,media_type:'image',media_path:image},{id:id(6),author_id:B,media_type:'video',media_path:base+'/qa-story.webm'}].map((s,n)=>({...s,created_at:new Date(Date.now()-60000+n*1000).toISOString(),expires_at:new Date(Date.now()+86400000).toISOString()}));
 const json=(r,body,status=200)=>r.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
 await context.route('**/qa-story.webm',r=>r.fulfill({status:200,contentType:'video/webm',body:videoBytes}));
 await context.route('https://qa-jenios.supabase.co/**',r=>{
  const url=new URL(r.request().url());
  if(url.pathname.endsWith('/auth/v1/user'))return json(r,user);
  if(url.pathname.endsWith('/rest/v1/profiles')){const match=url.searchParams.get('id')||'';const rows=[profile(A),profile(B)].filter(p=>!match||match.includes(p.id));return json(r,(r.request().headers().accept||'').includes('object')?rows[0]:rows);}
  return json(r,[]);
 });
 await context.route('**/api/**',r=>{
  const req=r.request(),url=new URL(req.url());
  if(url.pathname==='/api/social/posts'){
   if(req.method()==='POST'){const input=req.postDataJSON(),post={id:id(7),author_id:A,body:input.body,media:input.media||[],created_at:new Date().toISOString()};posts=[post,...posts];return json(r,{post},201);}
   if(url.searchParams.has('id'))return json(r,{post:posts.find(p=>p.id===url.searchParams.get('id'))});
   // Deliberately exclude own older posts: the profile must use its independent persisted query.
   return json(r,{posts:posts.filter(p=>p.author_id===B),nextBefore:null});
  }
  if(url.pathname==='/api/social/profiles'){const who=url.searchParams.get('id')||(url.searchParams.get('handle')==='qa_a'?A:B),rows=posts.filter(p=>p.author_id===who);return json(r,{profile:profile(who),posts:rows,postsCount:rows.length,nextOffset:null});}
  if(url.pathname==='/api/social/stories')return json(r,{stories,nextOffset:null});
  if(url.pathname==='/api/social/follows')return json(r,{followers:0,following:0,followed:false});
  if(url.pathname==='/api/social/likes')return json(r,{stats:(url.searchParams.get('ids')||'').split(',').map(post_id=>({post_id,count:0,liked:false})),count:0,liked:false});
  if(url.pathname==='/api/social/comments')return json(r,{comments:[]});
  if(url.pathname==='/api/tendencias')return json(r,{tokens:[],megapulse:[],baleias:[],modulos:{}});
  return json(r,{noticias:[],ranking:[],items:[],candidatos:[],posts:[],nextOffset:null});
 });
 await context.addInitScript(session=>localStorage.setItem('sb-qa-jenios-auth-token',JSON.stringify(session)),session);
 await page.goto(base+'/social');await page.getByText('Feed público sintético',{exact:true}).waitFor();
 await page.getByPlaceholder('Compartilhe uma análise, setup HFT ou visão de mercado...').fill('Publicação R24 permanece após recarregar');
 await page.getByRole('button',{name:'Publicar no Feed 🚀',exact:true}).click();
 await page.getByText('Publicado no feed e no seu perfil.',{exact:true}).waitFor();assert.equal(posts.filter(p=>p.author_id===A).length,7);
 await page.goto(base+'/social?perfil=qa_a');
 const grid=page.locator('div[style*="grid-template-columns"][style*="minmax(160px"]');await grid.waitFor();
 assert.equal(await grid.locator(':scope > div').count(),7);
 assert.ok((await grid.innerText()).includes('Publicação R24 permanece'));
 for(const width of [390,1440]){await page.setViewportSize({width,height:1000});const layout=await grid.evaluate(g=>({columns:getComputedStyle(g).gridTemplateColumns.split(' ').length,box:(()=>{const r=g.querySelector('button > div').getBoundingClientRect();return {w:r.width,h:r.height};})()}));assert.equal(layout.columns,3);assert.ok(Math.abs(layout.box.w-layout.box.h)<2,JSON.stringify(layout));}
 await page.reload();await grid.waitFor();assert.equal(await grid.locator(':scope > div').count(),7);console.log('PASS: posting, independent profile query, reload, square 3-column grid at 390/1440px');
 await page.setViewportSize({width:390,height:844});await page.goto(base+'/social');await page.getByText('Feed público sintético',{exact:true}).waitFor();
 const open=async()=>{await page.evaluate(()=>window.dispatchEvent(new Event('jenios:abrir-meu-story')));await page.getByRole('dialog',{name:'Visualizar Story'}).waitFor();};
 const position=()=>page.locator('[aria-label="Story 1 de 2"]');
 await open();await page.getByRole('button',{name:'Pausar Story',exact:true}).click();await page.waitForTimeout(5500);assert.equal(await position().count(),1);
 await page.getByRole('button',{name:'Continuar Story',exact:true}).click();await page.locator('[aria-label="Story 2 de 2"]').waitFor({timeout:7500});console.log('PASS: image auto-advance and pause/resume');
 await page.getByRole('button',{name:'Story anterior',exact:true}).click();await position().waitFor();
 const stage=page.locator('[data-story-stage]');let rect=await stage.boundingBox();
 await page.mouse.move(rect.x+rect.width*.75,rect.y+rect.height*.5);await page.mouse.down();await page.waitForTimeout(5500);assert.equal(await position().count(),1);await page.mouse.up();assert.equal(await position().count(),1);
 await page.touchscreen.tap(rect.x+rect.width*.75,rect.y+rect.height*.5);await page.locator('[aria-label="Story 2 de 2"]').waitFor();
 rect=await stage.boundingBox();await page.touchscreen.tap(rect.x+rect.width*.15,rect.y+rect.height*.5);await position().waitFor();
 await page.keyboard.press('ArrowRight');await page.locator('[aria-label="Story 2 de 2"]').waitFor();console.log('PASS: touch next/previous, long hold does not skip, keyboard navigation');
 await page.getByRole('button',{name:'Próximo Story',exact:true}).click();
 await page.getByRole('dialog').getByText('Conta QA B',{exact:true}).waitFor();await page.getByRole('dialog').waitFor({state:'detached',timeout:8000});console.log('PASS: crosses authors, actual video ends and final story closes');
 await open();await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),0);
 await page.goto(base+'/');const iconHref=await page.locator('link[rel="icon"]').last().getAttribute('href');assert.ok(iconHref.startsWith('/icon.svg'));
 const icon=await page.request.get(base+iconHref);assert.equal(icon.status(),200);assert.ok((await icon.text()).includes('#8b5cf6'));
 const appleHref=await page.locator('link[rel="apple-touch-icon"]').getAttribute('href');const apple=await page.request.get(base+appleHref);assert.equal(apple.status(),200);assert.ok(apple.headers()['content-type'].includes('image/png'));assert.equal((await apple.body()).subarray(1,4).toString(),'PNG');
 assert.deepEqual(errors,[]);console.log('PASS: favicon SVG, Apple PNG, Escape closes, no browser runtime errors');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
