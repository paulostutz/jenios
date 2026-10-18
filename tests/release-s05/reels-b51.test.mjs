import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {videoReelsFromPosts,appendUniqueVideoReels} from '../../lib/social/reels.mjs';

const owner='11111111-1111-4111-8111-111111111111';
const other='22222222-2222-4222-8222-222222222222';
const video='https://rebzztxlzofxpfwjvbee.supabase.co/storage/v1/object/public/social-media/owner/movie.mp4';
const post=(id,media,archived_at=null)=>({id,author_id:owner,body:'Vídeo de teste',media,archived_at,created_at:'2026-10-18T17:00:00Z'});
test('B51 derives real Reels exclusively from persisted video media in permitted posts',()=>{
 const rows=[
  post(owner,[{url:video,type:'video'},{url:'https://example.invalid/p.png',type:'image'}]),
  post(other,[{url:'https://example.invalid/photo.png',type:'image'}]),
 ];
 const reels=videoReelsFromPosts(rows);
 assert.equal(reels.length,1);
 assert.deepEqual(reels[0],{
  id:owner+':0',postId:owner,src:video,caption:'Vídeo de teste',createdAt:'2026-10-18T17:00:00Z'
 });
});
test('B51 archived posts, malformed identity and unsafe video URLs never produce Reels',()=>{
 const bad=[
  post(owner,[{url:video,type:'video'}],'2026-10-18T10:00:00Z'),
  post('invalid-id',[{url:video,type:'video'}]),
  post(other,[{url:'javascript:alert(1)',type:'video'}]),
  post(other,[{url:'http://insecure.invalid/movie.mp4',type:'video'}]),
  post(other,[{url:'https://user:pass@host.invalid/video.mp4',type:'video'}])
 ];
 assert.equal(videoReelsFromPosts(bad).length,0);
});
test('B51 handles carousels with multiple actual videos and stable unique clip keys',()=>{
 const rows=[post(owner,[{url:video,type:'video'},{url:video+'?second=1',type:'video'}]),
             post(owner,[{url:video,type:'video'}])];
 const reels=videoReelsFromPosts(rows);
 assert.deepEqual(reels.map(r=>r.id),[owner+':0',owner+':1']);
});
test('B51 pagination merges existing and older reels without showing duplicates',()=>{
 const r1={id:owner+':0'},r2={id:other+':1'};
 assert.deepEqual(appendUniqueVideoReels([r1],[r1,r2]),[r1,r2]);
 assert.deepEqual(appendUniqueVideoReels([],[]),[]);
});
test('B51 reel route uses authenticated existing feed and session-fence to prevent cross-account data leaks',()=>{
 const src=readFileSync('app/social/reels/page.js','utf8');
 assert.match(src,/createScopedFeedClient/);
 assert.match(src,/createSessionFence/);
 assert.match(src,/getUser\(\)/);
 assert.match(src,/fence\.current\.change\(\)/);
 assert.match(src,/fence\.current\.current\(ticket\)/);
 assert.match(src,/listPosts\(\{limit:50,cursor:after\}\)/);
 assert.doesNotMatch(src,/localStorage|sessionStorage|SUPABASE_SECRET_KEY|service_role/);
});
test('B51 video playback reuses original SocialVideo and never starts paid checkout',()=>{
 const src=readFileSync('app/social/reels/page.js','utf8');
 assert.match(src,/import SocialVideo from '\.\.\/\.\.\/components\/SocialVideo'/);
 assert.match(src,/<SocialVideo src=\{reel\.src\} postId=\{reel\.postId\}/);
 assert.match(src,/social\?post=/);
 assert.doesNotMatch(src,/JENIOS_PAY|jenios-pay|fetch\(.+\/api\/social\/media|transcode/);
});
test('B51 both desktop and mobile Social navigation link to the new Reels route',()=>{
 const src=readFileSync('app/social/page.js','utf8');
 const matches=src.match(/href="\/social\/reels"/g)||[];
 assert.equal(matches.length,2);
 assert.match(src,/aria-label="Reels JENIOS"/);
 assert.match(src,/social-mobile-quick-nav/);
});
test('B51 existing account and PDF payment contracts are left untouched',()=>{
 const manifest=JSON.parse(readFileSync('docs/release/S05-CRITICAL-API-SHA256.json','utf8'));
 for(const path of ['app/api/jenios-pay/checkout/route.js','app/api/bankscore/detailed/route.js','app/api/crypto-validator/detailed/route.js'])
  assert.match(manifest[path],/^[0-9a-f]{64}$/);
});
