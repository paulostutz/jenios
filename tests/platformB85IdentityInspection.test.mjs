import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {describeIndependentSessions,inspectIndependentSessions} from '../lib/platform/identity-inspection.mjs';
const s='11111111-1111-4111-8111-111111111111',p='22222222-2222-4222-8222-222222222222';
const user=id=>({id,email:'same@example.com',is_anonymous:false});
const client=u=>({auth:{getUser:async()=>({data:{user:u},error:null})}});
test('B85 same email in both providers never upgrades account link or finances',()=>{
 const z=describeIndependentSessions(user(s),user(p),true);
 assert.equal(z.state,'both_unlinked');assert.equal(z.linkVerified,false);
 assert.equal(z.canReadPrivatePlatformDataFromSocial,false);
 assert.equal(z.canUsePaidPlatformFromSocial,false);assert.equal(z.canAdminPlatformFromSocial,false);
});
test('B85 Social-only session remains simulation-only, absent a profile returns guest',()=>{
 assert.equal(describeIndependentSessions(user(s),null,true).state,'social_simulation_only');
 assert.equal(describeIndependentSessions(user(s),null,false).state,'guest');
});
test('B85 two remote verifications and matching profile required',async()=>{
 const z=await inspectIndependentSessions({
  socialClient:client(user(s)),platformClient:client(user(p)),
  socialProfileGate:async()=>({status:'ready',userId:s})
 });
 assert.equal(z.state,'both_unlinked');assert.equal(z.linkVerified,false);
});
test('B85 session switch during profile lookup revokes Social verification',async()=>{
 let count=0;
 const social={auth:{getUser:async()=>({data:{user:user(++count>1?p:s)},error:null})}};
 const x=await inspectIndependentSessions({socialClient:social,socialProfileGate:async()=>({status:'ready',userId:s})});
 assert.equal(x.socialVerified,false);
});
test('B85 private link cannot be forged with a browser-side profile or local storage',()=>{
 const src=readFileSync('lib/platform/identity-inspection.mjs','utf8');
 assert.doesNotMatch(src,/getSession\(|localStorage|setItem\(|service_role|clientMayCharge:true/);
 const ui=readFileSync('app/components/platform/PlatformIdentityInspection.js','utf8');
 assert.match(ui,/não certificado/);
});
