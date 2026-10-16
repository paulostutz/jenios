import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const route = readFileSync('app/social/perfil/[id]/page.js','utf8');
const css = readFileSync('app/social/profile-grid.css','utf8');

test('R33 standalone public-profile route displays a dedicated 3-column grid rather than vertical list',()=>{
  assert.match(route,/className="jenios-public-profile-grid"/);
  assert.match(route,/className="jenios-public-profile-tile"/);
  assert.match(css,/\.jenios-public-profile-grid\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
  assert.doesNotMatch(route,/<article key=\{post\.id\}/);
});

test('R33 standalone gallery thumbnails remain square and cropped, including phone viewport',()=>{
  assert.match(css,/\.jenios-public-profile-tile\s*\{[^}]*aspect-ratio:\s*1/);
  assert.match(css,/\.jenios-public-profile-tile\s*>\s*img\s*\{[^}]*object-fit:\s*cover/);
  assert.doesNotMatch(route,/gridTemplateColumns:/);
});

test('R33 standalone gallery reloads owner saved posts from server independent of feed',()=>{
  assert.match(route,/api\/social\/profiles\?id=/);
  assert.match(route,/cache: 'no-store'/);
  assert.match(route,/authorization: 'Bearer ' \+ auth\.session\.access_token/);
  assert.match(route,/setData\(\{ \.\.\.result, posts:/);
});

test('R33 standalone profile paginates beyond the first 20 posts without duplicating',()=>{
  assert.match(route,/data\.nextOffset == null/);
  assert.match(route,/['"]&offset=['"] \+ data\.nextOffset/);
  assert.match(route,/const previous = new Set\(old\.posts\.map\(post => post\.id\)\)/);
  assert.match(route,/!previous\.has\(post\.id\)/);
  assert.match(route,/nextOffset: result\.nextOffset/);
  assert.match(route,/Carregar mais publicações/);
  assert.doesNotMatch(route,/Até 20 publicações/);
});

test('R33 standalone profile discards stale page results after account or route changes',()=>{
  assert.match(route,/const version = \+\+epoch\.current/);
  assert.match(route,/if \(version !== epoch\.current\) return/);
  assert.match(route,/epoch\.current\+\+; moreBusy\.current = false/);
  assert.match(route,/setData\(null\); setSelectedPost\(null\)/);
});

test('R33 standalone profile opens thumbnails without unnecessary video autoplay',()=>{
  assert.match(route,/onClick=\{\(\) => setSelectedPost\(post\)\}/);
  assert.match(route,/role="dialog" aria-modal="true"/);
  assert.match(route,/setSelectedPost\(null\)/);
  assert.match(route,/event.key === 'Escape'/);
  assert.match(route,/preload="metadata" src=\{media\.url\}/);
  assert.doesNotMatch(route,/autoPlay/);
});

test('R33 standalone profile never renders unsafe media scheme from unexpected server response',()=>{
  assert.match(route,/url\.protocol === 'https:'/);
  assert.match(route,/!url\.username && !url\.password/);
  assert.match(route,/const validMedia = post/);
  assert.match(route,/validMedia\(selectedPost\)/);
});

test('R33 route is read-only and respects existing RLS rules',()=>{
  assert.doesNotMatch(route,/method:\s*'POST'|method:\s*'DELETE'|method:\s*'PATCH'/);
  const routeAPI=readFileSync('app/api/social/profiles/route.js','utf8');
  assert.match(routeAPI,/\.eq\('author_id', id\)\.is\('archived_at',null\)/);
  assert.match(routeAPI,/\.range\(offset,offset\+19\)/);
});
