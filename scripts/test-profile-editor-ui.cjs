const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:process.env.TEST_CHROMIUM_PATH,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});try{
const ctx=await browser.newContext(),page=await ctx.newPage(),id='11111111-1111-4111-8111-111111111111';
const user={id,aud:'authenticated',role:'authenticated',email:'qa@example.invalid',is_anonymous:false,app_metadata:{},user_metadata:{full_name:'QA Perfil'}};
const token=Buffer.from('{"alg":"HS256"}').toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:id,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.fixture';
let saved=null,fail=false,mediaCalls=0;
await ctx.addInitScript(({user,token})=>localStorage.setItem('sb-qa-jenios-auth-token',JSON.stringify({access_token:token,refresh_token:'qa',expires_at:Math.floor(Date.now()/1000)+3600,token_type:'bearer',user})),{user,token});
await ctx.route('https://qa-jenios.supabase.co/**',r=>{const q=r.request(),u=new URL(q.url());let data=[];
 if(u.pathname.endsWith('/user'))data=user;
 if(u.pathname.endsWith('/profiles')){if(q.method()==='POST'){if(fail)return r.fulfill({status:409,contentType:'application/json',body:JSON.stringify({code:'23505'})});saved=q.postDataJSON();data=saved;}else data=saved?[saved]:[];}
 return r.fulfill({contentType:'application/json',body:JSON.stringify(data)});
});
await ctx.route('**/api/**',r=>{const u=new URL(r.request().url());if(u.pathname.endsWith('/media')){mediaCalls++;return r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Upload indisponível. Dados preservados.'})});}return r.fulfill({contentType:'application/json',body:JSON.stringify({posts:[],stories:[],ids:[],followers:0,following:0,notifications:[],items:[],noticias:[],lives:[]})});});
const base=process.env.TEST_BASE_URL;
await page.goto(base+'/social',{waitUntil:'networkidle'});await page.getByRole('button',{name:/Editar Perfil/}).click();let form=page.getByRole('form',{name:'Editar perfil'});
const inputs=form.locator('input[type=text]');await inputs.nth(2).fill('@paulostutz');await inputs.nth(3).fill('CEO');await form.locator('textarea').fill('Bio de teste');
assert(!(await page.locator('.social-profile-row').innerText()).includes('@paulostutz'));
fail=true;await form.getByRole('button',{name:'Salvar Alterações'}).click();await form.getByRole('alert').filter({hasText:'já está em uso'}).waitFor();assert.equal(await inputs.nth(2).inputValue(),'@paulostutz');assert.equal(mediaCalls,0);
fail=false;await form.getByRole('button',{name:'Salvar Alterações'}).click();await form.waitFor({state:'hidden'});assert.equal(saved.handle,'paulostutz');assert.equal(saved.cargo,'CEO');assert.equal(saved.avatar_url,null);console.log('PASS draft isolation, duplicate handle keeps draft, default avatar skipped, profile and cargo saved');
await page.reload({waitUntil:'networkidle'});await page.getByRole('button',{name:/Editar Perfil/}).click();form=page.getByRole('form',{name:'Editar perfil'});assert.equal(await form.locator('input[type=text]').nth(2).inputValue(),'@paulostutz');assert.equal(await form.locator('input[type=text]').nth(3).inputValue(),'CEO');
await form.locator('input[type=file]').setInputFiles({name:'avatar.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aJXcAAAAASUVORK5CYII=','base64')});await page.waitForTimeout(100);await form.getByRole('button',{name:'Salvar Alterações'}).click();await form.getByRole('alert').filter({hasText:'Dados preservados'}).waitFor();assert.equal(await form.locator('input[type=text]').nth(2).inputValue(),'@paulostutz');assert.equal(mediaCalls,1);console.log('PASS profile survives reload and upload failure preserves draft; mocked services');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
