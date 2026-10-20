import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
const base='5094cf21005549973664b619307472139ea98a57';
const allowed=new Set([
 '.github/workflows/jenios-s05-platform-cp70-integration.yml',
 'app/components/assistant/SocialFreeLauncher.js','app/components/assistant/FreeAssistantRoom.js',
 'app/social/layout.js','app/social/floating-controls-b148.css',
 'app/impulsionar/page.js','app/impulsionar/boost.module.css','app/components/PromotedPost.js',
 'app/api/social/promotions/readiness/route.js',
 'lib/assistant/persona-preference.mjs','lib/social/boost-audience.mjs','lib/social/boost-whatsapp.mjs',
 'lib/social/boost-readiness.mjs','lib/social/boost-serving.mjs','lib/pay/purchase.mjs',
 'scripts/platform/b148-integrity.mjs','scripts/platform/b148-browser-smoke.mjs',
 'tests/jeniosBoostB148.test.mjs','tests/jeniosAssistantPreferenceB148.test.mjs',
 'docs/platform/B148-BOOST-ASSISTANT-VALIDATION.md'
]);
const changed=execFileSync('git',['diff','--name-only',base,'HEAD'],{encoding:'utf8'}).trim().split('\n').filter(Boolean);
assert.deepEqual(changed.filter(p=>!allowed.has(p)),[],'Unreviewed change outside B148');
assert.equal(execFileSync('git',['diff','--diff-filter=D','--name-only',base,'HEAD'],{encoding:'utf8'}).trim(),'','B148 deletes no existing files');
const before=p=>execFileSync('git',['show',base+':'+p],{encoding:'utf8'});
const current=p=>readFileSync(p,'utf8');
const purchase=current('lib/pay/purchase.mjs')
 .replace("import { boostDemographicTarget } from '../social/boost-audience.mjs';\n",'')
 .replace("  if (quote.productCode === 'social-boost') Object.assign(quote.target, boostDemographicTarget(body?.target));\n",'');
assert.equal(purchase,before('lib/pay/purchase.mjs'),'Existing PAY quote semantics must be unchanged except approved boost demographics');
for(const path of ['app/api/jenios-pay/checkout/route.js','lib/pay/checkout.mjs','lib/pay/catalog.mjs','lib/pay/gateway.mjs','lib/pay/inter-pix.mjs','lib/social/boost.mjs','lib/social/boost-proof.mjs','app/components/SocialDirect.js','app/components/SocialChargeButton.js','app/social/page.js','app/social/jenios-theme.css','app/api/assistant/free/route.js','package.json','package-lock.json','next.config.js'])assert.equal(current(path),before(path),'Preserved B147 file: '+path);
const forbidden=['app/bankscore/','lib/bankscore/','app/api/bankscore/','app/genios-pro/','app/universidade/','lib/platform/','app/components/platform/','app/mesa-operacoes/','app/mesa-operacao/','db/','supabase/'];
assert.deepEqual(changed.filter(p=>forbidden.some(prefix=>p.startsWith(prefix))),[]);
assert.match(current('app/social/floating-controls-b148.css'),/direct-fab\{left:18px!important;right:auto!important/);
assert.match(current('app/impulsionar/page.js'),/select\(POST_FIELDS\)/);
assert.match(current('lib/social/boost-serving.mjs'),/boostAudienceMatches\(campaign.target, demographics\)/);
console.log('B148_INTEGRITY_PASS='+changed.length+' reviewed paths; B147 protected modules and financial transport preserved');
