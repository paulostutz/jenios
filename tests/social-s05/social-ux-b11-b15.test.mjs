import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {validateHandle,parseAvailability} from '../../lib/social/handle-policy.mjs';
import {handleAvailabilityRequest} from '../../lib/social/handle-server.mjs';
import {accountDeletionRequest} from '../../lib/social/account-deletion.mjs';

const load=path=>readFileSync(path,'utf8');
const page=load('app/social/page.js');
const hook=load('app/components/useSocialFeed.js');
const postAPI=load('app/api/social/posts/route.js');
const profileAPI=load('app/api/social/profiles/route.js');
const css=load('app/social/jenios-theme.css');

test('B11 persisted post uses database insert and profile reload uses database read',()=>{
 assert.match(postAPI,/\.from\(["']posts["']\)[\s\S]*?\.insert\(/);
 assert.match(profileAPI,/\.from\(['"]posts['"]\)\.select\(/);
 assert.match(hook,/await client\.createPost\(/);
 assert.match(hook,/await clientFor\(ticket\)\.listPosts\(/);
 assert.doesNotMatch(hook,/\blocalStorage\b|\bindexedDB\b/i);
});
test('B11 successful delete reconciles feed, profile grid and owner count without cross-session leakage',()=>{
 assert.match(hook,/await client\.deletePost\(id\)/);
 assert.match(hook,/setPosts\(old=>old\.filter\(p=>p\.id!==id\)\)/);
 assert.match(hook,/setProfile\(p=>\(\{\.\.\.p,postsCount:Math\.max\(0,/);
 assert.match(page,/setProfilePosts\(old=>old\.filter\(p=>p\.id!==id\)\)/);
 assert.match(page,/if\(owner!==sessionOwnerRef\.current\)return;/);
});
test('B12 reserved handles denied, availability suggestions valid and capped at four',()=>{
 for(const blocked of ['admin','jenios','support'])assert.equal(validateHandle(blocked).ok,false);
 const row=parseAvailability({handle:'paulo',available:false,suggestions:['paulo1','admin','paulo2','paulo2','invalid name','paulo3','paulo4','paulo5']},'@Paulo');
 assert.deepEqual(row.suggestions,['paulo1','paulo2','paulo3','paulo4']);
 assert.match(page,/validateHandle\(draft\.handle\)/);
 assert.doesNotMatch(page,/jenios_social_usuarios_registrados/);
});
test('B12 handle lookup uses RPC, does not invent availability on failure',async()=>{
 const notReady=await handleAvailabilityRequest(new Request('https://example.test/api/social/handles?handle=paulo'),{database:async()=>null});
 assert.equal(notReady.status,503);
 const occupied=await handleAvailabilityRequest(new Request('https://example.test/api/social/handles?handle=paulo'),{database:async()=>({rpc:async()=>({data:{handle:'paulo',available:false,suggestions:['paulo1']},error:null})})});
 assert.equal(occupied.status,200);
 assert.deepEqual((await occupied.json()).suggestions,['paulo1']);
});
test('B13 mobile layout moves real sidebar and validator before post composer',()=>{
 assert.match(page,/className="social-feed-layout"/);
 assert.match(page,/className="social-feed-tools"/);
 assert.match(page,/className="social-feed-primary"/);
 assert.match(page,/id="jenios-cripto-mobile"/);
 assert.match(page,/className="social-mobile-quick-nav"/);
 assert.match(css,/@media\s*\(max-width:900px\)/);
 assert.match(css,/\.social-feed-tools\s*\{order:-1/);
 assert.match(css,/\.social-feed-layout\s*\{display:flex\s*!important/);
});
test('B14 account removal request remains pending, authenticated and non-destructive',async()=>{
 const response=await accountDeletionRequest(new Request('https://example.test/api/social/account-deletion'),{context:async()=>({error:true,status:401})});
 assert.equal(response.status,401);
 const deletion=load('lib/social/account-deletion.mjs');
 assert.match(deletion,/RECENT_AUTH_MS=15\*60\*1000/);
 assert.match(deletion,/accountDeleted:false/);
 assert.doesNotMatch(deletion,/auth\.admin\.deleteUser|\.delete\(\)\s*\.eq\(['"]user_id['"]/);
});
test('B15 production-critical checkout, BankScore, validator and pay route hashes remain frozen',()=>{
 const lock=JSON.parse(load('docs/s05/CRITICAL-API-SHA256.json'));
 for(const [path,digest] of Object.entries(lock)){
  assert.equal(createHash('sha256').update(readFileSync(path)).digest('hex'),digest,path);
 }
});
