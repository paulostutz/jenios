import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const page=readFileSync('app/social/page.js','utf8');
const sidebar=readFileSync('app/components/SocialSidebarPremium.js','utf8');
test('S05-B41 mobile navigation links to the five approved modules',()=>{
 const links=[...page.matchAll(/<a href="#(jenios-[a-z-]+)">([^<]+)<\/a>/g)];
 const names=links.map(([,id,label])=>label);
 for(const label of ['Ranking','Tendências','BankScore','Notícias','Criptos'])
   assert.ok(names.includes(label),'missing '+label);
 assert.ok(links.length>=5);
});
test('S05-B41 every mobile hash navigation destination actually exists',()=>{
 for(const [,id] of page.matchAll(/href="#(jenios-[a-z-]+)"/g))
  assert.ok(page.includes('id="'+id+'"')||sidebar.includes('id="'+id+'"'),id);
});
test('S05-B41 mobile sidebar appears above feed without hiding desktop columns',()=>{
 const css=readFileSync('app/social/jenios-theme.css','utf8');
 assert.match(page,/className="social-feed-tools"/);
 assert.match(page,/className="social-feed-primary"/);
 assert.match(css,/\.social-feed-tools\s*\{order:-1/);
 assert.match(css,/\.social-feed-layout\s*\{display:flex\s*!important/);
});
