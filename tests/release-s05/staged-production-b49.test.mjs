import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const smoke=readFileSync('scripts/check-s05-staged-production.mjs','utf8');
test('S05-B49 production staging requires project Vercel host, not a public site',()=>{
 assert.match(smoke,/S05_STAGED_URL_MUST_BE_JENIOS_DEPLOYMENT/);
 assert.match(smoke,/url\.protocol!=='https:'/);
 assert.match(smoke,/jenios-ecossistem/);
});
test('S05-B49 stages must prove BankScore AND PAY database healthy before promotion',()=>{
 assert.match(smoke,/BANKSCORE_PRODUCTION_DATA/);
 assert.match(smoke,/PAY_PRODUCTION_DB/);
 assert.match(smoke,/ranking\.length>0/);
 assert.match(smoke,/database==='connected'/);
});
test('S05-B49 both free consultations refuse paid checkout with 409 in staged build',()=>{
 assert.match(smoke,/social-bankscore-report/);
 assert.match(smoke,/social-crypto-validator/);
 assert.match(smoke,/r\.status===409/);
 assert.match(smoke,/gratuito/);
});
test('S05-B49 staged smoke sends no credentials or login mutations',()=>{
 assert.doesNotMatch(smoke,/service_role|SUPABASE_SECRET_KEY|Authorization:|signInWithPassword|\/auth\/v1\/signup|\/auth\/v1\/admin/);
 assert.match(smoke,/GUEST_DENIED_/);
 assert.match(smoke,/PLATFORM_TRIAL_DISABLED/);
});
