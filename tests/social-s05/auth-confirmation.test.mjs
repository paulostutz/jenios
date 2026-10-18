import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseConfirmationUrl,verifySocialConfirmation} from '../../lib/social/confirmation-flow.mjs';
const id='11111111-1111-4111-8111-111111112002';
const code='A'.repeat(48),hash='b'.repeat(64),origin='https://preview.invalid/auth/confirm';
function client({error=false,profile={id},user={id},exchangeError=false}={}){
 let exchanges=0,lookups=0;
 return {get calls(){return {exchanges,lookups}},auth:{
   exchangeCodeForSession:async c=>{exchanges++;assert.equal(c,code);return{error:exchangeError?new Error('invalid'):null}},
   verifyOtp:async x=>{exchanges++;assert.deepEqual(x,{token_hash:hash,type:'signup'});return{error:exchangeError?new Error('invalid'):null}},
   getUser:async()=>({data:{user},error:error?new Error('server error'):null})
 },from(t){assert.equal(t,'profiles');return {select(field){assert.equal(field,'id');return this},eq(field,value){assert.equal(field,'id');assert.equal(value,id);return this},async maybeSingle(){lookups++;return{data:profile,error:null}}}}};
}
for(const input of ['not-an-url',origin+'?error=access_denied',origin+'#error_code=otp_expired',origin+'?token_hash=short&type=signup',origin+'?token_hash='+hash+'&type=admin',origin+'?code='+code+'&token_hash='+hash]){
 test('reject untrusted or invalid callback '+input.slice(-22),()=>assert.equal(parseConfirmationUrl(input).kind,'invalid'));
}
test('recognized code and signup token are never reflected to caller',async()=>{
 for(const raw of [origin+'?code='+code,origin+'?token_hash='+hash+'&type=signup']){
  const c=client(),value=await verifySocialConfirmation(c,raw);
  assert.deepEqual(value,{status:'ready',userId:id});assert.equal(c.calls.exchanges,1);assert.equal(c.calls.lookups,1);
  assert.equal(JSON.stringify(value).includes(code),false);assert.equal(JSON.stringify(value).includes(hash),false);
 }
});
test('a previously signed-in session is checked against its owned profile',async()=>{
 const c=client();assert.deepEqual(await verifySocialConfirmation(c,origin),{status:'ready',userId:id});assert.equal(c.calls.exchanges,0);
});
for(const candidate of [{profile:null},{profile:{id:'another'}},{user:null},{user:{id,is_anonymous:true}},{exchangeError:true}]){
 test('failed confirmation or Social profile never grants access '+JSON.stringify(candidate),async()=>{
  const r=await verifySocialConfirmation(client(candidate),origin+'?code='+code);assert.notEqual(r.status,'ready');
 });
}
test('confirmation page strips URL secrets and avoids external redirect',()=>{
 const source=readFileSync('app/auth/confirm/page.js','utf8');
 assert.match(source,/history\.replaceState/);assert.doesNotMatch(source,/dangerouslySetInnerHTML|window\.location\.assign|router\.push\(.*query/);
 const middleware=readFileSync('middleware.js','utf8');assert.match(middleware,/Referrer-Policy.*no-referrer/);
});
test('email redirect to owned confirmation page is same-origin only',()=>{
 const source=readFileSync('app/components/SocialAccessForm.js','utf8');
 assert.match(source,/window\.location\.origin}\/auth\/confirm/);
 assert.doesNotMatch(source,/emailRedirectTo:.*https:\/\//);
});
