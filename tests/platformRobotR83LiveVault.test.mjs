import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sealR83LiveCredentials,openR83LiveCredentials,requireR83PrivateVaultGate}
 from '../lib/platform/connections/alpaca-live-vault-r83.mjs';
const user='4d238a7a-8c7b-4d8e-9a10-1c5c82db59a7';
const connection='50b85e9d-339c-4d32-b2bf-82c467673832';
const other='0d8caf6a-4d0a-4f79-b4d5-fd3087ea834c';
const scope={ownerUserId:user,connectionId:connection,kind:'ALPACA_API_KEY_PAIR'};
const credentials={kind:'ALPACA_API_KEY_PAIR',apiKey:'alpacaSyntheticKeyXYZ123',secret:'paperNotUsedLiveSyntheticSECRET'};
const env={VERCEL_ENV:'preview',JENIOS_R83_PRIVATE_NODE_WORKER:'true',
 JENIOS_R83_LIVE_VAULT_ENABLED:'true',JENIOS_REAL_EXECUTION_ENABLED:'false',
 JENIOS_R82_ALPACA_LIVE_ORDER_EXECUTION_ENABLED:'false',
 JENIOS_R83_LIVE_VAULT_KEY_ID:'k1',
 JENIOS_R83_LIVE_VAULT_KEY_B64:Buffer.alloc(32,77).toString('base64'),
 JENIOS_R82_LIVE_ACCOUNT_DIGEST_KEY_B64:Buffer.alloc(32,55).toString('base64')};
test('R83 seals API credentials with independent random nonce, exact owner-bound AAD',()=>{
 const first=sealR83LiveCredentials(scope,credentials,{env});
 const second=sealR83LiveCredentials(scope,credentials,{env});
 assert.notEqual(first.iv,second.iv);assert.notEqual(first.data,second.data);
 assert.deepEqual(openR83LiveCredentials(scope,first,{env}),credentials);
 assert.equal(JSON.stringify(first).includes(credentials.secret),false);
 assert.equal(JSON.stringify(first).includes(credentials.apiKey),false);
 assert.equal(first.kid,'k1');assert.equal(first.v,1);
});
test('R83 vault rejects cross-user replay, wrong connection and modified ciphertext/AAD',()=>{
 const sealed=sealR83LiveCredentials(scope,credentials,{env});
 for(const swapped of [{...scope,ownerUserId:other},{...scope,connectionId:other}]){
  assert.throws(()=>openR83LiveCredentials(swapped,sealed,{env}),/R83_VAULT_DECRYPT_DENIED/);
 }
 for(const altered of [
  {...sealed,data:Buffer.from('tamper').toString('base64')},
  {...sealed,tag:Buffer.alloc(16,0).toString('base64')},
  {...sealed,kid:'k2'},{...sealed,unexpected:'allowOrders'}
 ])assert.throws(()=>openR83LiveCredentials(scope,altered,{env}));
});
test('R83 OAuth token can be encrypted for future approved Connect flow but has no transport',()=>{
 const auth={kind:'ALPACA_OAUTH_ACCESS_TOKEN',accessToken:'opaqueOAuthSyntheticTokenNoOrders12345'};
 const oauthScope={...scope,kind:'ALPACA_OAUTH_ACCESS_TOKEN'};
 const box=sealR83LiveCredentials(oauthScope,auth,{env});
 assert.deepEqual(openR83LiveCredentials(oauthScope,box,{env}),auth);
 assert.throws(()=>openR83LiveCredentials(scope,box,{env}));
});
test('R83 denies public Vercel, live execution, key reuse, absent encryption key and unknown credentials',()=>{
 for(const e of [
  {...env,VERCEL_ENV:'production'},
  {...env,JENIOS_R83_PRIVATE_NODE_WORKER:'false'},
  {...env,JENIOS_R83_LIVE_VAULT_ENABLED:'false'},
  {...env,JENIOS_REAL_EXECUTION_ENABLED:'true'},
  {...env,JENIOS_R82_ALPACA_LIVE_ORDER_EXECUTION_ENABLED:'true'}
 ])assert.throws(()=>sealR83LiveCredentials(scope,credentials,{env:e}),/R83_VAULT_DISABLED/);
 for(const e of [
  {...env,JENIOS_R83_LIVE_VAULT_KEY_B64:undefined},
  {...env,JENIOS_R83_LIVE_VAULT_KEY_B64:env.JENIOS_R82_LIVE_ACCOUNT_DIGEST_KEY_B64},
  {...env,JENIOS_DEMO_VAULT_KEY_B64:env.JENIOS_R83_LIVE_VAULT_KEY_B64},
  {...env,JENIOS_R83_LIVE_VAULT_KEY_ID:'bad key!'}
 ])assert.throws(()=>sealR83LiveCredentials(scope,credentials,{env:e}),/R83_PRIVATE_VAULT_KEY_UNAVAILABLE/);
 assert.throws(()=>sealR83LiveCredentials(scope,{...credentials,liveExecutionEnabled:true},{env}));
 assert.throws(()=>sealR83LiveCredentials(scope,{...credentials,secret:'bad\nsecret'},{env}));
});
test('R83 never provides an HTTP route, plain-text logging or network order transport',()=>{
 const source=readFileSync(new URL('../lib/platform/connections/alpaca-live-vault-r83.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(source,/console\.(log|error)|fetch\(|\/v2\/orders|method:\s*'POST'/);
 assert.match(source,/aes-256-gcm/);
 assert.match(source,/setAAD/);
});
