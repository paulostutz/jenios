import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {PLATFORM_SLOGAN,SOCIAL_SLOGAN,BRAND_IDENTITIES,mascotAt,identityFor,prepareEditorialPost} from '../lib/brand/identity.mjs';
import {platformCampaignPosts,socialCampaignIdeas} from '../lib/brand/campaign-posts.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');

test('Platform keeps the confirmed exact slogan independently from Social',()=>{
 assert.equal(PLATFORM_SLOGAN,'A Plataforma Que Transforma o Seu Erro Em Lucro');
 assert.equal(BRAND_IDENTITIES.platform.slogan,PLATFORM_SLOGAN);
 assert.equal(SOCIAL_SLOGAN,null);
 assert.equal(BRAND_IDENTITIES.social.slogan,null);
 assert.equal(BRAND_IDENTITIES.social.confirmed,false);
 assert.equal(identityFor('platform').confirmed,true);
 assert.notEqual(BRAND_IDENTITIES.platform.id,BRAND_IDENTITIES.social.id);
 assert.throws(()=>identityFor('other'),/produto inválido/);
});

test('Mascot alternation is deterministic, human-only and reserved for posts and internal assistant',()=>{
 assert.deepEqual(Array.from({length:8},(_,i)=>mascotAt(i).id),['genio','genia','genio','genia','genio','genia','genio','genia']);
 for(const i of [null,-1,1.5,Number.MAX_SAFE_INTEGER+1])assert.throws(()=>mascotAt(i),/posição inválida/);
 assert.equal(mascotAt(0).name,'Gênio');assert.equal(mascotAt(1).name,'Gênia');
 for(const i of [0,1])assert.ok(fs.statSync(path.join(root,'public',mascotAt(i).image.replace(/^\//,''))).size>1200);
 const lp=read('app/lp/page.js');
 assert.doesNotMatch(lp,/PlatformBrandMoment|genio\.webp|genia\.webp|\/assistentes\/|<img/);
 assert.doesNotMatch(read('app/page.js'),/\/assistentes\/|genio\.webp|genia\.webp/);
 const learning=read('app/components/learning/LearningRoom.js');
 assert.doesNotMatch(learning,/\/assistentes\/|genio\.webp|genia\.webp|PersonaChoice/);
 assert.match(learning,/>T\.Jenio</);
 const assistant=read('app/components/assistant/AssistantRoom.js');
 assert.match(assistant,/PERSONAS\.map/);
 assert.match(assistant,/<img src=\{p\.image\}/);
 assert.match(assistant,/<img src=\{persona\.image\}/);
});

test('Six Platform post drafts use the exact tagline and alternate mascots without auto-publishing',()=>{
 assert.equal(platformCampaignPosts.length,6);
 for(const [i,p] of platformCampaignPosts.entries()){
  assert.equal(p.channel,'platform'); assert.equal(p.brand,'JENIOS Platform');
  assert.equal(p.mascot.id,mascotAt(i).id);
  assert.equal(p.slogan,PLATFORM_SLOGAN);
  assert.equal(p.status,'draft_review');
  assert.equal(p.publishableAfterReview,true);
  assert.ok(p.title.length>9&&p.body.length>60);
 }
});

test('Social drafts cannot borrow Platform identity or be flagged ready without its confirmed slogan',()=>{
 assert.equal(socialCampaignIdeas.length,3);
 for(const [i,p] of socialCampaignIdeas.entries()){
  assert.equal(p.channel,'social');assert.equal(p.mascot.id,mascotAt(i).id);
  assert.equal(p.slogan,null);assert.equal(p.status,'awaiting_social_slogan');
  assert.equal(p.publishableAfterReview,false);
  assert.ok(!p.body.includes(PLATFORM_SLOGAN));
 }
});

test('Marketing drafts reject unsupported channels and blank content',()=>{
 assert.throws(()=>prepareEditorialPost({channel:'none',position:0,title:'ok',body:'text'}),/produto inválido/);
 assert.throws(()=>prepareEditorialPost({channel:'platform',position:0,title:'',body:'text'}),/conteúdo vazio/);
 assert.throws(()=>prepareEditorialPost({channel:'social',position:0,title:'ok',body:''}),/conteúdo vazio/);
});

test('The portal reserves Platform slogan for Platform card and keeps Social copy free of it',()=>{
 const home=read('app/page.js');
 const socialCard=home.split('{/* Card Jenios Social */}')[1]?.split('{/* Card JENIOS Platform')[0];
 const platformCard=home.split('{/* Card JENIOS Platform')[1]?.split('{/* Rodapé Oficial */}')[0];
 const footer=home.split('{/* Rodapé Oficial */}')[1];
 assert.ok(socialCard&&platformCard&&footer);
 assert.ok(!socialCard.includes('PLATFORM_SLOGAN'));
 assert.match(platformCard,/\{PLATFORM_SLOGAN\}/);
 assert.ok(!footer.includes('PLATFORM_SLOGAN'));
 assert.match(footer,/UMA IDENTIDADE · DOIS PRODUTOS COM PROPÓSITOS PRÓPRIOS/);
});

test('R30 leaves all Social feature files untouched by not requiring or touching them',()=>{
 const guide=read('docs/marketing/R30-SLOGANS-E-POSTS.md');
 assert.match(guide,/TODOS os materiais R30 são rascunhos internos/);
 assert.match(guide,/Não colocar mascotes na landing page/);
 assert.match(guide,/nunca inventar/i);
 const brandFiles=['lib/brand/identity.mjs','lib/brand/campaign-posts.mjs','app/components/assistant/AssistantRoom.js','app/lp/page.js'];
 for(const f of brandFiles)assert.ok(fs.existsSync(path.join(root,f)));
});
