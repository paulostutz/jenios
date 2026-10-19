import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 isPlatformSignupEnabled,validPlatformPassword,normalizedPlatformEmail,
 registerPlatformAccount,requestPlatformPasswordReset,changePlatformPassword,
 clearPlatformLocalState,signOutPlatform
} from '../lib/platform/account-access.mjs';
import {journalKey} from '../lib/platform/simulation-journal.mjs';
import {sessionModeKey} from '../lib/platform/diagnostic-client.mjs';
import {simulationBalanceKey,simulationPauseKey} from '../lib/platform/simulation-account.mjs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const memory=()=>{const m=new Map();return {m,getItem:k=>m.get(k),setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};};
const password='Example#Password2026!';

test('CP69 signup is disabled by default and only true string enables it',()=>{
 for(const v of [undefined,null,false,true,'TRUE','1','false',''])assert.equal(isPlatformSignupEnabled(v),false);
 assert.equal(isPlatformSignupEnabled('true'),true);
});
test('CP69 validates strong password and rejects weak or long values',()=>{
 assert.equal(validPlatformPassword(password),true);
 for(const x of ['123456789012','password1234','Abcd12345678','Abcdef#0000',
  'AA1!aaaaa','A'.repeat(129),null,123])assert.equal(validPlatformPassword(x),false);
});
test('CP69 normalizes platform email and rejects invalid addresses',()=>{
 assert.equal(normalizedPlatformEmail(' Tester@Example.com '),'tester@example.com');
 for(const input of ['',null,'broken','foo@','foo bar@example.com'])
 assert.throws(()=>normalizedPlatformEmail(input));
});
test('CP69 closed registration never calls Supabase signUp',async()=>{
 let called=false;
 const auth={signUp(){called=true;throw Error('Must not call')}};
 await assert.rejects(()=>registerPlatformAccount(auth,'x@example.com',password,password,
  'https://jenios.com.br',undefined),/Cadastros/);
 assert.equal(called,false);
});
test('CP69 enabled registration uses only dedicated auth and explicit confirmation redirect',async()=>{
 const calls=[];
 const auth={async signUp(value){calls.push(value);return{data:{session:null},error:null};}};
 const result=await registerPlatformAccount(auth,'USER@EXAMPLE.COM',password,password,
  'https://private-preview.vercel.app','true');
 assert.equal(result.session,false);assert.equal(calls.length,1);
 assert.equal(calls[0].email,'user@example.com');
 assert.equal(calls[0].options.emailRedirectTo,'https://private-preview.vercel.app/platform/entrar');
 assert.equal(calls[0].password,password);
});
test('CP69 cannot register with mismatched confirmation',async()=>{
 let called=false;
 await assert.rejects(()=>registerPlatformAccount({signUp(){called=true}},'x@example.com',password,'Different#2026',
  'https://preview.example.com','true'),/não corresponde/);
 assert.equal(called,false);
});
test('CP69 never issues auth redirections to unsafe protocol or nonlocal plaintext',async()=>{
 const auth={async signUp(){throw Error('Should not be called')}};
 await assert.rejects(()=>registerPlatformAccount(auth,'x@example.com',password,password,'http://production.example.com','true'),/Origem/);
 await assert.rejects(()=>registerPlatformAccount(auth,'x@example.com',password,password,'javascript:alert(1)','true'),/Origem/);
});
test('CP69 reset requests use Platform auth without leaking whether email exists',async()=>{
 const calls=[];
 const auth={async resetPasswordForEmail(email,options){calls.push({email,options});return{error:null};}};
 const result=await requestPlatformPasswordReset(auth,'X@example.com','https://qa.example.com');
 assert.match(result,/Se este endereço estiver cadastrado/);
 assert.deepEqual(calls,[{email:'x@example.com',options:{redirectTo:'https://qa.example.com/platform/redefinir'}}]);
});
test('CP69 password change requires verified Platform user and matching password',async()=>{
 let updated=0;
 const auth={async getUser(){return{data:{user:{id:'uuid',is_anonymous:false}},error:null};},
  async updateUser(body){updated++;assert.equal(body.password,password);return{error:null};}};
 assert.equal(await changePlatformPassword(auth,password,password),true);
 assert.equal(updated,1);
 await assert.rejects(()=>changePlatformPassword(auth,password,'different'),/não corresponde/);
 assert.equal(updated,1);
});
test('CP69 password change fails closed on anonymous session',async()=>{
 const auth={async getUser(){return{data:{user:{id:'qa',is_anonymous:true}},error:null};},
  async updateUser(){throw Error('Must not call')}};
 await assert.rejects(()=>changePlatformPassword(auth,password,password),/sessão é inválida/);
});
test('CP69 logout clears only Platform user session state, preserves Social',async()=>{
 const storage=memory(),id='platform-one';
 const keys=[journalKey(id),simulationBalanceKey(id),simulationPauseKey(id),sessionModeKey(id)];
 for(const k of keys)storage.setItem(k,'x');
 storage.setItem('jenios_saldo_simulado','123');
 storage.setItem('jenios-social-saved','social-stays');
 storage.setItem(journalKey('different-account'),'private-other');
 let called=0;
 await signOutPlatform({async signOut(){called++;return{error:null};}},storage,id);
 assert.equal(called,1);
 for(const key of keys)assert.equal(storage.getItem(key),undefined);
 assert.equal(storage.getItem('jenios_saldo_simulado'),'123');
 assert.equal(storage.getItem('jenios-social-saved'),'social-stays');
 assert.equal(storage.getItem(journalKey('different-account')),'private-other');
});
test('CP69 signout never clears an invalid target account',()=>{
 const storage=memory();storage.setItem(journalKey('guest'),'keep');
 assert.equal(clearPlatformLocalState(storage,'../../'),false);
 assert.equal(storage.getItem(journalKey('guest')),'keep');
});
test('CP69 signout failure is surfaced and not described as success',async()=>{
 const storage=memory();storage.setItem(journalKey('A'),'keep');
 await assert.rejects(()=>signOutPlatform({async signOut(){return{error:Error('offline')}}},storage,'A'),/Não foi possível encerrar/);
 assert.equal(storage.getItem(journalKey('A')),'keep');
});
test('CP69 dedicated login recovery and reset interfaces do not import Social auth',()=>{
 for(const p of ['app/platform/entrar/page.js','app/platform/recuperar/page.js','app/platform/redefinir/page.js']){
  const s=read(p);
  assert.match(s,/platformSupabase/);
  assert.doesNotMatch(s,/from ['"](?:\.\.\/)+lib\/supabase['"]|getJeniosPayAdmin/);
 }
 assert.match(read('app/platform/entrar/page.js'),/NEXT_PUBLIC_PLATFORM_SIGNUP_ENABLED/);
 assert.match(read('app/platform/entrar/page.js'),/href="\/platform\/recuperar"/);
});
test('CP69 protected Dashboard exposes isolated signout and leaves Social unchanged',()=>{
 const s=read('app/dashboard-logado/page.js');
 assert.match(s,/signOutPlatform\(supabase\?\.auth,window\.sessionStorage,session\?\.user\?\.id\)/);
 assert.match(s,/Sair da Platform/);
 const social=read('app/components/PaymentStatement.js');
 assert.match(social,/from ['"]\.\.\/\.\.\/lib\/supabase['"]/);
});
