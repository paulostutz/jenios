import test from 'node:test';
import assert from 'node:assert/strict';
import { createSocialFeedClient, SocialFeedError } from '../lib/social/feed-client.mjs';
const uid='a1234567-1234-4123-8123-123456789012';
test('feed autenticado e paginação', async () => {
 let url, opts;
 const api=createSocialFeedClient({getAccessToken:async()=> 'test-session', fetchImpl:async(u,o)=>{url=u;opts=o;return {ok:true,status:200,json:async()=>({posts:[]})}}});
 await api.listPosts({limit:10,cursor:{before:'2026-10-14T00:00:00Z',beforeId:uid}});
 assert.match(url,/beforeId=/);assert.equal(opts.headers.Authorization,'Bearer test-session');assert.equal(opts.cache,'no-store');
});
test('sem sessão não chama API', async()=>{let called=false;const api=createSocialFeedClient({getAccessToken:async()=>null,fetchImpl:async()=>{called=true}});await assert.rejects(api.listPosts(),e=>e.code==='AUTH_REQUIRED');assert.equal(called,false)});
test('erro HTTP não vira sucesso local',async()=>{const api=createSocialFeedClient({getAccessToken:async()=> 'session',fetchImpl:async()=>({ok:false,status:503,json:async()=>({error:'FEED_UNAVAILABLE'})})});await assert.rejects(api.listPosts(),e=>e instanceof SocialFeedError && e.code==='FEED_UNAVAILABLE')});
test('post é enviado apenas após sessão',async()=>{let opts;const api=createSocialFeedClient({getAccessToken:async()=> 'session',fetchImpl:async(u,o)=>{opts=o;return {ok:true,status:201,json:async()=>({post:{id:uid}})}}});const result=await api.createPost({body:'Teste',media:[]});assert.equal(opts.method,'POST');assert.equal(JSON.parse(opts.body).body,'Teste');assert.equal(result.post.id,uid)});
test('cursor incompleto rejeitado',()=>{const api=createSocialFeedClient({getAccessToken:async()=> 'session'});assert.throws(()=>api.listPosts({cursor:{before:'2026-10-14'}}),/INVALID_CURSOR/)});
