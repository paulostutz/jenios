import test from 'node:test';
import assert from 'node:assert/strict';
import {checkSyntheticAuth} from '../../scripts/check-s04-staging-auth-e2e.mjs';
const id='11111111-1111-4111-8111-111111110941';
const email='s04-lab-positive-941@invalid.example';
const password='S04_PASSWORD_FOR_SYNTHETIC_UNIT_TEST_12345!';
const session={access_token:'fake_only_for_unit_tests'};
function f(){
 let signedOut=false;
 const db={
  auth:{signInWithPassword:async()=>({data:{session,user:{id}},error:null}),getUser:async()=>({data:{user:{id}},error:null}),signOut:async()=>{signedOut=true;}},
  from:(table)=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{id,handle:'s04_lab_941'},error:null})}),limit:async()=>({data:[],error:null})})})
 };
 return {db,email,password,wasSignedOut:()=>signedOut};
}
test('synthetic GoTrue login checks authenticated identity, own profile and private table denial',async()=>{
 const c=f();const r=await checkSyntheticAuth(c);
 assert.equal(r.passwordSignIn,'ok');assert.equal(r.profile,'own-profile');assert.equal(r.trialLedger,'not-readable');assert.equal(c.wasSignedOut(),true);
});
test('real email addresses are never allowed as synthetic fixtures',async()=>{
 await assert.rejects(()=>checkSyntheticAuth({...f(),email:'somebody@gmail.com'}),/S04_SYNTHETIC_ACCOUNT_REQUIRED/);
});
test('password fixture cannot be blank or short',async()=>{
 await assert.rejects(()=>checkSyntheticAuth({...f(),password:'short'}),/S04_SYNTHETIC_PASSWORD_REQUIRED/);
});
test('GoTrue sign-in failure never becomes authorized',async()=>{
 const c=f();c.db.auth.signInWithPassword=async()=>({error:{message:'invalid credentials'},data:{}});
 await assert.rejects(()=>checkSyntheticAuth(c),/S04_STAGING_SIGNIN_FAILED/);
});
test('token auth user mismatch fails and signs out',async()=>{
 const c=f();c.db.auth.getUser=async()=>({data:{user:{id:'bad-id'}},error:null});
 await assert.rejects(()=>checkSyntheticAuth(c),/S04_AUTH_TOKEN_USER_MISMATCH/);
 assert.equal(c.wasSignedOut(),true);
});
test('profile mismatch fails authorization and signs out',async()=>{
 const c=f();c.db.from=(table)=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:null,error:null})}),limit:async()=>({data:[],error:null})})});
 await assert.rejects(()=>checkSyntheticAuth(c),/S04_AUTH_PROFILE_RLS_READ_FAILED/);
 assert.equal(c.wasSignedOut(),true);
});
test('exposed privileged ledger fails the smoke',async()=>{
 const c=f();c.db.from=(table)=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{id,handle:'s04_lab_941'},error:null})}),limit:async()=>({data:table==='jenios_platform_trial_ledger_v1'?[{subject_digest:'x'}]:[],error:null})})});
 await assert.rejects(()=>checkSyntheticAuth(c),/S04_AUTH_TRIAL_LEDGER_EXPOSED/);
 assert.equal(c.wasSignedOut(),true);
});
test('exposed staging guard fails the smoke',async()=>{
 const c=f();c.db.from=(table)=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{id,handle:'s04_lab_941'},error:null})}),limit:async()=>({data:table==='jenios_s04_staging_guard_20261017'?[{marker:'oops'}]:[],error:null})})});
 await assert.rejects(()=>checkSyntheticAuth(c),/S04_AUTH_STAGING_GUARD_EXPOSED/);
 assert.equal(c.wasSignedOut(),true);
});
