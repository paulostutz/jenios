import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {trialRequest,trialStatus} from '../../lib/platform/trial/trial-http.mjs';
import {TRIAL_DURATION_MS,trialAccessWindow} from '../../lib/platform/trial/person-ledger.mjs';

const source=readFileSync('app/api/platform/trial/route.js','utf8');
test('S05-B39 trial has a two-key independent activation gate and never charges',()=>{
 assert.match(source,/JENIOS_TRIAL_ENABLED==='true'&&process\.env\.JENIOS_TRIAL_ACTIVATION_APPROVED==='true'/);
 assert.doesNotMatch(source,/paymentIntent|chargeCustomer|PAY_ADMIN_TOKEN|inter\\/pix/i);
});
test('S05-B39 disabled POST returns 503 without authentication, identity verification, or ledger activity',async()=>{
 const response=await trialRequest(new Request('https://staging.invalid/api/platform/trial',{method:'POST'}),{enabled:false,context(){throw Error('AUTH_CALL')},db:{rpc(){throw Error('DB_CALL')}},verifyIdentity(){throw Error('PROVIDER_CALL')}});
 assert.equal(response.status,503);
 assert.equal((await response.json()).code,'TRIAL_NOT_AVAILABLE');
});
test('S05-B39 disabled GET returns 503 without exposing a user trial status',async()=>{
 const response=await trialStatus(new Request('https://staging.invalid/api/platform/trial'),{enabled:false,context(){throw Error('AUTH_CALL')},db:{from(){throw Error('DB_CALL')}}});
 assert.equal(response.status,503);
 assert.equal((await response.json()).code,'TRIAL_NOT_AVAILABLE');
});
test('S05-B39 trial duration remains exactly 168 hours from verified start',()=>{
 assert.equal(TRIAL_DURATION_MS,168*3600000);
 const start='2026-10-18T00:00:00Z';
 assert.equal(trialAccessWindow(start,Date.parse(start)+TRIAL_DURATION_MS-1000).active,true);
 assert.equal(trialAccessWindow(start,Date.parse(start)+TRIAL_DURATION_MS).active,false);
});
