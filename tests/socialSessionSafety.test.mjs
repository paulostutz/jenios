import test from 'node:test';
import assert from 'node:assert/strict';
import {createScopedFeedClient} from '../lib/social/session-client.mjs';
import {createSessionFence} from '../lib/social/session-fence.mjs';
import {postView,youtubeFromBody} from '../lib/social/feed-view.mjs';
const A='11111111-1111-4111-8111-111111111111';
const B='22222222-2222-4222-8222-222222222222';
const session=(id,access_token='test-token')=>({data:{session:{user:{id},access_token}}});
test('a delayed token from another account never publishes',async()=>{
 const fence=createSessionFence(),ticket=fence.change(A);let release,calls=0;
 const api=createScopedFeedClient({fence,ticket,auth:{getSession:()=>new Promise(r=>{release=r;})},fetchImpl:async()=>{calls++;}});
 const action=api.createPost({body:'A private draft',media:[]});
 fence.change(B);release(session(B));
 await assert.rejects(action,e=>e.code==='SESSION_CHANGED');assert.equal(calls,0);
});
test('even a matching old token is rejected after sign out',async()=>{
 const fence=createSessionFence(),ticket=fence.change(A);let calls=0;
 fence.change();const api=createScopedFeedClient({fence,ticket,auth:{getSession:async()=>session(A)},fetchImpl:async()=>{calls++;}});
 await assert.rejects(api.likePost(A),e=>e.code==='SESSION_CHANGED');assert.equal(calls,0);
});
test('renewed tokens for the same owner and epoch continue working',async()=>{
 const fence=createSessionFence(),ticket=fence.change(A);let authorization;
 const api=createScopedFeedClient({fence,ticket,auth:{getSession:async()=>session(A,'renewed-token')},fetchImpl:async(_url,o)=>{authorization=o.headers.Authorization;return {ok:true,status:200,json:async()=>({post:{id:B}})};}});
 assert.equal((await api.getPost(B)).post.id,B);assert.equal(authorization,'Bearer renewed-token');
});
test('wrong identity without an auth event still cannot use an old action',async()=>{
 const fence=createSessionFence(),ticket=fence.change(A);
 const api=createScopedFeedClient({fence,ticket,auth:{getSession:async()=>session(B)},fetchImpl:async()=>assert.fail('must not fetch')});
 await assert.rejects(api.deletePost(B),e=>e.code==='SESSION_CHANGED');
});
test('video carousel and YouTube remain playable after server reload',()=>{
 const p=postView({id:A,author_id:B,body:'Minha publicação\nhttps://youtu.be/abcdefghijk',created_at:'2026-10-15T12:00:00Z',media:[{type:'image',url:'https://example.test/a.jpg'},{type:'video',url:'https://example.test/b.mp4'}]});
 assert.equal(p.imagens[1].tipo,'video');assert.equal(p.youtubeUrl,'https://www.youtube.com/watch?v=abcdefghijk');
 assert.equal(youtubeFromBody('https://youtube.com.evil.test/watch?v=abcdefghijk'),'');
 assert.equal(youtubeFromBody('javascript:alert(1)'),'');
});
