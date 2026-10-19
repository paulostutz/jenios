import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {evaluatePrivateAcceptance,OFFLINE_CRITERIA,AUTH_CRITERIA,TRADING_CRITERIA}
 from '../lib/platform/private-acceptance.mjs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const proof=JSON.parse(read('docs/platform/CP70-EVIDENCIAS.json'));
const offline=Object.fromEntries(OFFLINE_CRITERIA.map(key=>[key,true]));

test('CP70 acceptance uses a real previously completed GitHub run, never declares a planned run finished',()=>{
 assert.equal(proof.github_actions_run_id,39258731670);
 assert.equal(proof.source_commit,'410827b42e0b0554f582af6290bc3a4dbd13cef0');
 assert.equal(proof.jobs.find(j=>j.name==='authenticated-qa').conclusion,'success');
 assert.equal(proof.jobs.find(j=>j.name==='authenticated-qa').authenticated_checks,15);
});
test('CP70 remote evaluation covers all four authenticated acceptance criteria',()=>{
 assert.deepEqual(AUTH_CRITERIA.filter(key=>proof.remote_acceptance[key]!==true),[]);
 const result=evaluatePrivateAcceptance({...offline,...proof.remote_acceptance});
 assert.equal(result.privateOfflineReady,true);
 assert.equal(result.authenticatedHomologationReady,true);
 assert.equal(result.unverifiedCriteria.authentication.length,0);
});
test('CP70 authenticated milestone cannot release real-money trading',()=>{
 const result=evaluatePrivateAcceptance({...offline,...proof.remote_acceptance});
 assert.equal(result.realTradingReady,false);
 assert.equal(result.noGoForMoney,true);
 assert.deepEqual(result.unverifiedCriteria.trading,[...TRADING_CRITERIA]);
 assert.equal(proof.no_real_orders,true);
});
test('CP70 removes fake identities and confirms no leftover data',()=>{
 assert.equal(proof.jobs.find(j=>j.name==='authenticated-qa').synthetic_account_cleanup,'passed');
 assert.deepEqual(Object.values(proof.dedicated_supabase.post_qa_counts),[0,0,0,0,0]);
});
test('CP70 does not accidentally claim deployment or merge approval',()=>{
 assert.equal(proof.no_public_deploy,true);
 assert.equal(proof.no_production_merge,true);
 assert.equal(proof.milestone_internal_percent,70);
 assert.equal(proof.baseline_percent,69.5);
});
test('CP70 only certifies dedicated Platform database, not Social or Chefe',()=>{
 assert.equal(proof.dedicated_supabase.ref,'xaicvhagftzjkqphnbgx');
 assert.notEqual(proof.dedicated_supabase.ref,'igayfjorjmucthlfoasf');
 assert.notEqual(proof.dedicated_supabase.ref,'rebzztxlzofxpfwjvbee');
 assert.notEqual(proof.dedicated_supabase.ref,'vpnselfrbqxsetifrmhh');
});
test('CP70 traceability includes run ID and rollback in human-readable report',()=>{
 const report=read('docs/platform/CP70-ACEITE-AUTENTICADO.md');
 assert.match(report,/39258731670/);
 assert.match(report,/118081525072/);
 assert.match(report,/69,5% -> 70,0%/);
 assert.match(report,/Nenhum merge/);
});
test('CP70 does not embed project server secrets in evidence',()=>{
 const file=read('docs/platform/CP70-EVIDENCIAS.json');
 assert.doesNotMatch(file,/sb_secret_|eyJhbGciOiJIUzI1NiIs/);
 assert.doesNotMatch(file,/Bearer\s+[A-Za-z0-9._~+/-]{30}/);
});
