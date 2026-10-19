import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { adjacentStoryId, storyGroups, storyMedia, storyTapDirection, STORY_IMAGE_MS, STORY_VIDEO_MAX_SECONDS } from '../lib/social/story-playback.mjs';
const now = Date.parse('2026-10-16T03:00:00Z');
const s = (id, author, minutes = 0) => ({ id, authorId: author, criadoEm: new Date(now - 60000 - minutes * 60000).toISOString(), expiresAt: new Date(now + 3600000).toISOString(), src: '/media.png', tipo: 'imagem' });
test('R24 groups one bubble per stable author and orders their stories oldest first', () => {
  const groups = storyGroups([s('a2', 'a'), s('b1', 'b'), s('a1', 'a', 1)], now);
  assert.deepEqual(groups.map(g => g.map(x => x.id)), [['a1', 'a2'], ['b1']]);
});
test('R24 excludes expired, future and duplicate stories without touching input', () => {
  const items = [s('a','a'), s('a','a'), s('old','a', 1440), { ...s('future','a'), criadoEm: new Date(now + 1000).toISOString() }];
  assert.deepEqual(storyGroups(items, now).flat().map(x=>x.id), ['a']); assert.equal(items.length, 4);
});
test('R24 next crosses author boundary, previous returns and end closes', () => {
  const sequence = storyGroups([s('a','a'), s('b','b')], now).flat();
  assert.equal(adjacentStoryId(sequence,'a',1),'b'); assert.equal(adjacentStoryId(sequence,'b',-1),'a');
  assert.equal(adjacentStoryId(sequence,'b',1),null); assert.equal(adjacentStoryId(sequence,'a',-1),null);
});
test('R24 taps navigate; long holds and drags never skip stories', () => {
  assert.equal(storyTapDirection(20,20,300,120),-1); assert.equal(storyTapDirection(180,182,300,120),1);
  assert.equal(storyTapDirection(180,182,300,300),0); assert.equal(storyTapDirection(180,220,300,120),0);
});
test('R24 shared posts and direct videos use the same playback media selection', () => {
  const clip={url:'/video.mp4',type:'video'};
  assert.deepEqual(storyMedia({sharedPost:{media:[clip]}}),clip);
  assert.deepEqual(storyMedia({src:'/video.mp4',tipo:'video'}),clip);
  assert.equal(storyMedia({sharedPost:{body:'text'}}),null);
  assert.equal(STORY_IMAGE_MS,5000); assert.equal(STORY_VIDEO_MAX_SECONDS,90);
});
test('B110 approved J replaces the obsolete R24 purple favicon across browser and iPhone',()=>{
 const home=readFileSync('app/page.js','utf8');
 assert.match(home,/BrandMark size=\{72\}/);
 for(const path of ['app/icon.png','app/apple-icon.png','app/favicon.ico',
  'public/brand/jenios-j.webp','public/brand/jenios-logo-horizontal.webp']){
  assert.equal(existsSync(path),true,path);
 }
 assert.equal(existsSync('app/icon.svg'),false);
 assert.equal(existsSync('app/apple-icon.js'),false);
 assert.equal(readFileSync('app/icon.png').subarray(0,8).toString('hex'),'89504e470d0a1a0a');
 assert.equal(readFileSync('app/apple-icon.png').subarray(0,8).toString('hex'),'89504e470d0a1a0a');
 assert.equal(readFileSync('app/favicon.ico').subarray(0,4).toString('hex'),'00000100');
 assert.match(readFileSync('app/components/brand/BrandSignature.js','utf8'),/jenios-j\.webp/);
});
test('R24 profile still loads persisted author posts independently of the feed', () => {
  const route=readFileSync('app/api/social/profiles/route.js','utf8'),page=readFileSync('app/social/page.js','utf8');
  assert.match(route,/\.eq\('author_id', id\)/); assert.match(route,/\.is\('archived_at',null\)/);
  assert.match(page,/feed\.visit\(usuario,offset\)/); assert.match(page,/feed\.archivedPosts:profilePosts/);
  assert.match(page,/await feed\.publish/); assert.match(readFileSync('app/social/profile-grid.css','utf8'),/repeat\(3, minmax\(0, 1fr\)\)/);
});
