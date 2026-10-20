import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {encryptDemo,digestDemoAccount} from '../lib/platform/connections/demo-vault.mjs';
import {verifyPrivatePaperAccountRead} from '../lib/platform/connections/b196-private-account-preflight.mjs';
const now=1792526000000;
const user='4d238a7a-8c7b-4d8e-9a10-1c5c82db59a7';
const id='50b85e9d-339c-4d32-b2bf-82c467673832';
const env={JENIOS_PRIVATE_PAPER_REHEARSAL:'true',JENIOS_PRIVATE_PAPER_ACCOUNT_PREFLIGHT:'true',
 JENIOS_DEMO_VAULT_KEY_B64:Buffer.alloc(32,7).toString('base64')};
const session={userId:user,authenticated:true,diagnosticCompleted:true};
const credentials={apiKey:'fixture_paper_api_key_01234',secret:'fixture_paper_api_secret_01234'};
const accountRef='account-11111111-2222-4333-8444-555555555555';
const credential_box=encryptDemo(credentials,{userId:user,id,provider:'alpaca',environment:'paper',kind:'credentials'},env);
const storedConnection={id,user_id:user,provider:'alpaca',environment:'paper',status:'active',
 identity_verified:true,last_sync_at:new Date(now-1000).toISOString(),created_at:new Date(now-100000).toISOString(),
 external_digest:digestDemoAccount(accountRef,{userId:user,provider:'alpaca',environment:'paper'},env),
 credential_box};
const snapshot={provider:'alpaca',environment:'paper',complete:true,accountReadConfirmed:true,
 observedAtMs:now,positions:[],openOrders:[]};
const observation={summary:{permissionsVerified:false},liveExecution:false,ordersSent:0};
const reader=async input=>{
 assert.deepEqual(input,{provider:'alpaca',environment:'paper',...credentials});
 return {accountRef,identityVerified:true,snapshot,observation};
};
const input={session,storedConnection,nowMs:now};
const deps={env,refreshConnection:async()=>storedConnection,reader};
const fail=async (params,opts,code)=>assert.rejects(verifyPrivatePaperAccountRead(params,opts),e=>e?.code===code);
test('B196 private Paper GET preflight is credential-sanitized and non-executable',async()=>{
 const result=await verifyPrivatePaperAccountRead(input,deps);
 assert.equal(result.accountReferenceMatched,true);
 assert.equal(result.independentProviderEvidenceCertified,false);
 assert.equal(result.brokerPermissionsVerified,false);
 assert.equal(result.paperOrderPermission,false);
 assert.equal(result.ordersSent,0);
 for(const text of [credentials.apiKey,credentials.secret,accountRef,storedConnection.external_digest])
  assert.equal(JSON.stringify(result).includes(text),false);
});
test('B196 refuses public/production runtime, missing opt-in and missing secure vault',async()=>{
 for(const patch of [{VERCEL:'1'},{VERCEL_ENV:'preview'},
  {JENIOS_PRIVATE_PAPER_REHEARSAL:'false'},{JENIOS_PRIVATE_PAPER_ACCOUNT_PREFLIGHT:'false'},
  {JENIOS_DEMO_VAULT_KEY_B64:'broken'}])
  await fail(input,{...deps,env:{...env,...patch}},'PRIVATE_READ_ONLY_PREFLIGHT_DISABLED');
});
test('B196 requires fresh verified owner account and private server-role refresh',async()=>{
 await fail({...input,session:{...session,userId:'other'}},deps,'PLATFORM_SESSION_REQUIRED');
 await fail({...input,session:{...session,diagnosticCompleted:false}},deps,'AUTHENTICATED_PAPER_SESSION_REQUIRED');
 await fail({...input,storedConnection:{...storedConnection,last_sync_at:new Date(now-300001).toISOString()}},deps,'ACCOUNT_REQUIRES_FRESH_READ');
 await fail(input,{...deps,refreshConnection:null},'SERVER_ROLE_ACCOUNT_REFRESH_REQUIRED');
 await fail(input,{...deps,refreshConnection:async()=>({...storedConnection,status:'revoked'})},'ACCOUNT_REVOKED_ROTATED_OR_CHANGED');
});
test('B196 credential rotation or different owner fails before broker reads',async()=>{
 let reads=0;const counting=async x=>{reads++;return reader(x);};
 await fail(input,{...deps,reader:counting,refreshConnection:async()=>({...storedConnection,
  credential_box:{...credential_box,data:'rotated'}})},'ACCOUNT_REVOKED_ROTATED_OR_CHANGED');
 await fail(input,{...deps,reader:counting,refreshConnection:async()=>({...storedConnection,user_id:'other'})},'ACCOUNT_REVOKED_ROTATED_OR_CHANGED');
 assert.equal(reads,0);
});
test('B196 refuses account digest drift and incomplete/misleading provider read',async()=>{
 await fail(input,{...deps,reader:async()=>({...await reader({provider:'alpaca',environment:'paper',...credentials}),
  accountRef:'different-account'})},'EXTERNAL_BROKER_ACCOUNT_CHANGED');
 await fail(input,{...deps,reader:async()=>({accountRef,identityVerified:true,snapshot,
  observation:{...observation,summary:{permissionsVerified:true}}})},'PAPER_READ_PROOF_INCOMPLETE');
 await fail(input,{...deps,reader:async()=>{throw Error('remote secret details not for UI')}},'OFFICIAL_PAPER_GET_NOT_CONFIRMED');
});
