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
 assert.match(css,/\.jenios-mobile-rail-open/);
 assert.match(css,/\.jenios-mobile-rail-toggle/);
 assert.match(css,/\.jenios-mobile-rail-open/);
 assert.match(css,/\.social-feed-tools \{order:1 !important/);
 assert.match(css,/\.social-feed-primary \{order:0 !important/);
});
test('B76 three-dot rail is touch and keyboard accessible and only exposes public shortcuts',()=>{
 const src=read('app/components/SocialMobileRail.js');
 for(const label of ['Acesso Público','Meu Perfil','Hub de Tendências','BankScore','Validador de Tokens','Sala de Controle'])
  assert.ok(src.includes(label),'missing '+label);
 for(const privateLabel of ['Usuários bloqueados','Arquivados','Editar perfil','Meus Insights','Lives','Destaques'])
  assert.ok(!src.includes(privateLabel),'owner-only shortcut leaked into public menu: '+privateLabel);
 assert.match(src,/aria-expanded=\{expanded\}/);
 assert.match(src,/onClick=\{\(\)=>setExpanded\(v=>!v\)\}/);
 assert.match(src,/e\.key==='Escape'/);
 assert.match(src,/authenticated&&button\('perfil'/);
 assert.match(src,/Abrir menu de três pontos/);
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
