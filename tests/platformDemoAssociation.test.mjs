import test from 'node:test';
import assert from 'node:assert/strict';
import {buildDemoAssociation,assertDemoAssociationOwner,publicDemoAssociation} from '../lib/platform/connections/demo-association.mjs';

const now=1792519200000;
const user='4d238a7a-8c7b-4d8e-9a10-1c5c82db59a7';
const digest='a'.repeat(64);
const observation={ok:true,provider:'binance',environment:'testnet',accountReadConfirmed:true,
 summary:{accountType:'SPOT',assetsReported:2,permissionsVerified:false},linkedToJenios:false,
 liveExecution:false,ordersSent:0,credentialsStored:false,observedAtMs:now-1000};

test('B162 authenticated test read can be bound to one Platform user without claiming a connection',()=>{
 const association=buildDemoAssociation({userId:user,provider:'binance',environment:'testnet',externalReferenceDigest:digest,observation},{now:()=>now});
 assert.equal(association.ownerUserId,user);assert.equal(association.associationConfirmed,true);
 assert.equal(association.connected,false);assert.equal(association.liveExecution,false);assert.equal(association.permissionsVerified,false);
 assert.equal(assertDemoAssociationOwner(user,association),association);
 const publicView=publicDemoAssociation(association,now);
 assert.equal(publicView.associationConfirmed,true);assert.equal(publicView.stale,false);
 assert.ok(!JSON.stringify(publicView).includes(user));assert.ok(!JSON.stringify(publicView).includes(digest));
});

test('B162 Alpaca Paper is accepted only with matching authenticated read',()=>{
 const o={...observation,provider:'alpaca',environment:'paper',summary:{status:'ACTIVE',accountTradingBlocked:false,permissionsVerified:false}};
 const a=buildDemoAssociation({userId:user,provider:'alpaca',environment:'paper',externalReferenceDigest:'b'.repeat(64),observation:o},{now:()=>now});
 assert.equal(a.provider,'alpaca');assert.equal(a.environment,'paper');assert.equal(a.connected,false);
});

for(const [name,patch,code] of [
 ['live environment',{environment:'live'},'DEMO_ENVIRONMENT_REQUIRED'],
 ['other owner',{userId:'bad'},'INVALID_PLATFORM_USER'],
 ['missing account reference',{externalReferenceDigest:''},'INVALID_ACCOUNT_REFERENCE']
])test('B162 rejects '+name,()=>{
 assert.throws(()=>buildDemoAssociation({userId:user,provider:'binance',environment:'testnet',externalReferenceDigest:digest,observation,...patch},{now:()=>now}),{message:code});
});

test('B162 stale, mismatched or unsafe reader evidence cannot create association',()=>{
 assert.throws(()=>buildDemoAssociation({userId:user,provider:'binance',environment:'testnet',externalReferenceDigest:digest,observation:{...observation,observedAtMs:now-31000}},{now:()=>now}),/STALE_AUTHENTICATED_READ/);
 assert.throws(()=>buildDemoAssociation({userId:user,provider:'binance',environment:'testnet',externalReferenceDigest:digest,observation:{...observation,provider:'alpaca'}},{now:()=>now}),/AUTHENTICATED_READ_REQUIRED/);
 assert.throws(()=>buildDemoAssociation({userId:user,provider:'binance',environment:'testnet',externalReferenceDigest:digest,observation:{...observation,ordersSent:1}},{now:()=>now}),/UNSAFE_READER_STATE/);
 assert.throws(()=>buildDemoAssociation({userId:user,provider:'binance',environment:'testnet',externalReferenceDigest:digest,observation:{...observation,summary:{...observation.summary,permissionsVerified:true}}},{now:()=>now}),/PERMISSIONS_NOT_EXPLICITLY_UNVERIFIED/);
});

test('B162 ownership is exact and cannot be reassigned by caller input',()=>{
 const a=buildDemoAssociation({userId:user,provider:'binance',environment:'testnet',externalReferenceDigest:digest,observation},{now:()=>now});
 assert.throws(()=>assertDemoAssociationOwner('b8e32748-9c47-4eb1-9c5f-1a7cc0d2e496',a),/ACCOUNT_OWNER_MISMATCH/);
});
