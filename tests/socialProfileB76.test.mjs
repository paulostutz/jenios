import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(path,'utf8');

test('B76 only own authenticated profile displays owner controls, no private owner menu on visitors',()=>{
 const page=read('app/social/page.js');
 const marker="perfilVisitado.id===meuPerfil.id && meuPerfil.autenticado";
 assert.match(page,/perfilVisitado\.id===meuPerfil\.id && meuPerfil\.autenticado/);
 const own=page.slice(page.indexOf(marker),page.indexOf('<SocialPinnedPosts ownerId=',page.indexOf(marker)));
 for(const feature of ['Meu Perfil','Arquivados','Usuários bloqueados','Lives','Reels','Destaques','Editar perfil','Meus Insights'])
  assert.ok(own.includes(feature),feature);
 assert.match(page,/perfilVisitado\.id===meuPerfil\.id && meuPerfil\.autenticado && <div>/);
 assert.doesNotMatch(page,/<b>—<\/b>\{' '\}[\n ]*views \(30 dias\)/);
});
test('B76 access public and own profile feed have distinct names and owner-only archives',()=>{
 const s=read('app/social/page.js');
 assert.match(s,/\['feed','🌐 Acesso Público'\]/);
 assert.match(s,/Feed de \{perfilVisitado\.nome\}/);
 assert.match(s,/\['posts', 'Feed'\]/);
 assert.match(s,/p\.authorId === perfilVisitado\.id/);
 assert.match(s,/perfilVisitado\.id === meuPerfil\.id/);
 assert.match(s,/abaGaleria==='arquivados'\?feed\.archivedPosts:profilePosts/);
 const api=read('app/api/social/profiles/route.js');
 assert.match(api,/\.eq\('author_id', id\)\.is\('archived_at',null\)/);
 assert.match(api,/\.range\(offset,offset\+19\)/);
});
test('B76 all published content is written to persisted posts, no client-only stand-in',()=>{
 const publish=read('app/api/social/posts/route.js');
 const ui=read('app/social/page.js');
 assert.match(publish,/\.insert\(\{ author_id: ctx\.userId, body: body\.trim\(\), \.\.\.storedMedia\(media\) \}\)/);
 assert.match(publish,/POST_NOT_SAVED/);
 assert.match(ui,/const created=await feed\.publish/);
 assert.match(ui,/setProfilePosts\(old=>\[ownPost/);
 assert.match(ui,/setProfilePosts\(old=>offset\?\[\.\.\.old/);
 assert.match(ui,/feed\.loadArchived/);
 assert.match(ui,/window\.confirm\('Excluir definitivamente esta publicação/);
});
test('B76 three-dot menu is the only collapsed mobile launcher, desktop main nav remains separate',()=>{
 const nav=read('app/components/SocialMobileRail.js'),css=read('app/social/jenios-theme.css'),page=read('app/social/page.js');
 assert.match(nav,/aria-label=\{expanded\?'Fechar menu':'Abrir menu de três pontos'\}/);
 assert.match(nav,/authenticated&&button\('perfil'/);
 assert.match(nav,/jenios-mobile-rail-open/);
 assert.match(css,/max-width:600px/);
 assert.match(css,/\.jenios-mobile-rail:not\(\.jenios-mobile-rail-open\)/);
 assert.match(page,/social-desktop-nav/);
});
test('B76 header has only Sala de Controle, notifications and Sair actions for logged owner',()=>{
 const page=read('app/social/page.js');
 const header=page.slice(page.indexOf('{/* CABEÇALHO */}'),page.indexOf('{/* PERFIL HEADER */}'));
 assert.match(header,/Sala de Controle/);
 assert.match(header,/aria-label="Notificações"/);
 assert.match(header,/>\s*Sair\s*</);
 assert.doesNotMatch(header,/meuPerfil\.handle/);
 assert.doesNotMatch(header,/href="\/social\/reels"|href="\/social\/destaques"|Conheça a Tecnologia JENIOS/);
});
test('B76 Direct floats lower right with preserved server authentication and only profile-initiated new chats',()=>{
 const page=read('app/social/page.js');
 const direct=read('app/components/SocialDirect.js');
 const api=read('lib/social/directService.mjs');
 assert.match(page,/jenios-social-direct-fab/);
 assert.match(page,/jenios-social-direct-drawer/);
 assert.match(page,/initialPerson=\{chatAtivo\}/);
 assert.match(page,/setChatAtivo\(perfilVisitado\)/);
 assert.doesNotMatch(page,/jenios_social_directs|localStorage\.setItem\(/);
 assert.match(direct,/api\.threads\(user\.id\)/);
 assert.match(direct,/api\.open\(user\.id,person\.user_id\)/);
 assert.match(direct,/api\.send\(user\.id,target,text\)/);
 assert.match(direct,/showInbox/);
 assert.doesNotMatch(direct,/Buscar pelo @/);
 assert.match(api,/await identity\(id\)/);
 const publicPage=read('app/social/perfil/[id]/page.js');
 assert.match(publicPage,/viewerId!==data\.profile\?\.id/);
 assert.match(publicPage,/&direct=1/);
});
test('B76 preserves paid APIs, dedicated Platform auth and owner-only archive controls',()=>{
 const social=read('app/social/page.js');
 assert.match(social,/p\.authorId===meuPerfil\.id && perfilVisitado\.id===meuPerfil\.id/);
 const guard=read('app/components/platform/PlatformAuthGuard.js');
 assert.match(guard,/platformSupabase\.auth\.getUser/);
 for(const api of ['app/api/bankscore/detailed/route.js','app/api/crypto-validator/detailed/route.js']){
  const src=read(api);
  assert.match(src,/requirePrelaunchReportAccess/);
 }
});
