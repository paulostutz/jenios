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
test('R24 J favicon uses the homepage gradient, replaces the test icon and provides Apple PNG', () => {
  const svg=readFileSync('app/icon.svg','utf8'),home=readFileSync('app/page.js','utf8');
  for(const color of ['#8b5cf6','#6d28d9']) { assert.ok(home.includes(color)); assert.ok(svg.includes(color)); }
  assert.match(svg,/viewBox="0 0 52 52"/); assert.match(svg,/rx="14"/); assert.doesNotMatch(svg,/<image|data:image/);
  assert.equal(existsSync('app/icon.png'),false); assert.match(readFileSync('app/apple-icon.js','utf8'),/image\/png/);
});
test('R24 profile still loads persisted author posts independently of the feed', () => {
  const route=readFileSync('app/api/social/profiles/route.js','utf8'),page=readFileSync('app/social/page.js','utf8');
  assert.match(route,/\.eq\('author_id', id\)/); assert.match(route,/\.is\('archived_at',null\)/);
  assert.match(page,/feed\.visit\(usuario,offset\)/); assert.match(page,/feed\.archivedPosts:profilePosts/);
  assert.match(page,/await feed\.publish/); assert.match(readFileSync('app/social/profile-grid.css','utf8'),/repeat\(3, minmax\(0, 1fr\)\)/);
});
