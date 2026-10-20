import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {PERSONAS,assistantPath} from '../lib/assistant/contracts.mjs';
import {LEARNING_PRODUCTS} from '../lib/learning/access.mjs';
const read=p=>readFileSync(p,'utf8');
test('B125 original male/female persona names, images and persistent contract restored',()=>{
 assert.deepEqual(PERAS_NAMES(),['Gênio','Gênia']);
 assert.equal(existsSync('public/assistentes/genio.webp'),true);
 assert.equal(existsSync('public/assistentes/genia.webp'),true);
 assert.match(read('app/components/assistant/AssistantRoom.js'),/PERSONAS/);
 assert.match(read('app/components/assistant/AssistantRoom.js'),/Universidade JENIOS/);
});
function PERAS_NAMES(){return PERSONAS.map(x=>x.name);}
test('B125 University keeps subscription security and its original five learning tracks',()=>{
 assert.equal(LEARNING_PRODUCTS.length,2);
 const s=read('lib/learning/access.mjs');
 assert.match(read('lib/assistant/pro-access.mjs'),/jenios_pay_subscriptions/);assert.match(read('lib/assistant/pro-access.mjs'),/current_period_end/);
 assert.match(s,/SUBSCRIPTION_REQUIRED/);
 assert.match(read('app/components/learning/LearningRoom.js'),/Universidade JENIOS/);
 assert.equal(existsSync('app/platform/aprender/page.js'),true);
});
test('B125 master preview is server authorized and never grants paid subscription',()=>{
 const s=read('lib/learning/access.mjs');
 assert.match(s,/isMasterAdmin\(user,env\)/);
 assert.doesNotMatch(s,/user_metadata\?\.role/);
});
test('B131 restored services keep paid AI disabled without explicit model, budget and protected key',()=>{
 for(const route of ['app/api/platform/assistant/route.js','app/api/platform/learning/route.js']){
  const s=read(route);assert.match(s,/configuredGenerativeEnv\(process\.env\)/);
 }
 const assistant=read('lib/assistant/contracts.mjs');
 assert.match(assistant,/executionEnabled:false/);
});
test('B125 assistant shortcut is discoverable on Dashboard, never mounted in the Social feed',()=>{
 assert.match(read('app/dashboard-logado/layout.js'),/<PlatformAuthGuard>\{children\}<\/PlatformAuthGuard>/);
 const page=read('app/dashboard-logado/page.js');
 assert.match(page,/href="\/platform\/assistente"/);
 assert.match(page,/href="\/platform\/aprender"/);
 assert.doesNotMatch(read('app/social/page.js'),/AssistantEntry/);
 assert.equal(assistantPath('/social'),false);
});
