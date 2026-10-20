import test from 'node:test';
import assert from 'node:assert/strict';
import {encryptDemo,decryptDemo,digestDemoAccount,vaultReady} from '../lib/platform/connections/demo-vault.mjs';
const env={JENIOS_DEMO_VAULT_KEY_B64:Buffer.alloc(32,9).toString('base64')};
const scope={userId:'4d238a7a-8c7b-4d8e-9a10-1c5c82db59a7',id:'50b85e9d-339c-4d32-b2bf-82c467673832',provider:'binance',environment:'testnet',kind:'credentials'};
const secret={apiKey:'fixture_api_01234567890123',secret:'fixture_secret_01234567890123'};
test('B165 encryption is randomized, isolated and secret never in ciphertext',()=>{
 const one=encryptDemo(secret,scope,env),two=encryptDemo(secret,scope,env);
 assert.notEqual(one.data,two.data);assert.notEqual(one.iv,two.iv);
 assert.ok(!JSON.stringify(one).includes(secret.secret));assert.deepEqual(decryptDemo(one,scope,env),secret);
 assert.throws(()=>decryptDemo(one,{...scope,userId:'b8e32748-9c47-4eb1-9c5f-1a7cc0d2e496'},env),/VAULT_DECRYPT_DENIED/);
 assert.throws(()=>decryptDemo(one,{...scope,kind:'snapshot'},env),/VAULT_DECRYPT_DENIED/);
});
test('B165 tampering and invalid configuration fail closed',()=>{
 const one=encryptDemo(secret,scope,env);
 assert.throws(()=>decryptDemo({...one,tag:Buffer.alloc(16,1).toString('base64')},scope,env),/VAULT_DECRYPT_DENIED/);
 assert.equal(vaultReady({}),false);assert.equal(vaultReady(env),true);
 assert.throws(()=>encryptDemo(secret,scope,{JENIOS_DEMO_VAULT_KEY_B64:'bad'}),/VAULT_NOT_CONFIGURED/);
});
test('B165 account fingerprints are per-owner and cannot be reversed from response',()=>{
 const a=digestDemoAccount('paper-account',scope,env);
 const b=digestDemoAccount('paper-account',{...scope,userId:'b8e32748-9c47-4eb1-9c5f-1a7cc0d2e496'},env);
 assert.match(a,/^[a-f0-9]{64}$/);assert.notEqual(a,b);assert.ok(!a.includes('paper-account'));
});
