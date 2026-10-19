import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
test('B75 smartphone rail replaces repeated button rows but preserves them for desktop',()=>{
 const page=read('app/social/page.js'),css=read('app/social/jenios-theme.css');
 assert.match(page,/import SocialMobileRail/);
 assert.match(page,/<SocialMobileRail/);
 assert.match(page,/social-desktop-nav/);
 assert.match(css,/@media \(max-width:600px\)/);
 assert.match(css,/\.social-desktop-nav,/);
 assert.match(css,/\.jenios-mobile-rail/);
 assert.match(css,/width:42px !important;max-width:42px !important/);
 assert.match(css,/\.jenios-mobile-rail-open \{width:min\(244px/);
 assert.match(css,/\.social-feed-tools \{order:1 !important/);
 assert.match(css,/\.social-feed-primary \{order:0 !important/);
});
test('B75 rail has all protected shortcuts, is touch and keyboard accessible',()=>{
 const src=read('app/components/SocialMobileRail.js');
 for(const label of ['Sala de Controle','Feed','Meu perfil','Mensagens','Ranking','Lives','Reels','Destaques','Arquivados','BankScore','Insights','Impulsionar','Validador de Tokens','Notificações','Sair'])
  assert.ok(src.includes(label),'missing shortcut '+label);
 assert.match(src,/aria-expanded=\{expanded\}/);
 assert.match(src,/onClick=\{\(\)=>setExpanded\(v=>!v\)\}/);
 assert.match(src,/e\.key==='Escape'/);
 assert.match(src,/signed\(onEdit\)/);
 assert.match(src,/authenticated\?button/);
 assert.doesNotMatch(src,/localStorage|service_role|SUPABASE_SERVICE_ROLE_KEY/);
});
test('B75 smartphone renders feed before optional tools and defers offscreen paints',()=>{
 const css=read('app/social/jenios-theme.css');
 assert.match(css,/\.social-feed-tools \{order:1 !important/);
 assert.match(css,/content-visibility:auto/);
 assert.match(css,/contain-intrinsic-size:auto 550px/);
 const page=read('app/social/page.js');
 for(const id of ['jenios-megapulse','jenios-ranking','jenios-bankscore','jenios-cripto-mobile'])
  assert.ok(page.includes(id)||read('app/components/SocialSidebarPremium.js').includes(id));
});
