import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const base='0e2952961d150c8b5a808a0345c522c2ef8cb3e1';
const changed=execFileSync('git',['diff','--no-renames','--name-status',base,'HEAD'],{encoding:'utf8'}).trim().split('\n').filter(Boolean);
const modified=new Set(['app/integracoes/page.js','app/dashboard-logado/page.js','app/mesa-operacoes/page.js','app/components/assistant/FreeAssistantRoom.js','app/components/assistant/SocialFreeLauncher.js','lib/assistant/knowledge.mjs','lib/assistant/reply.mjs','app/api/assistant/free/route.js']);
const added=/^(lib\/platform\/connections\/[^/]+\.mjs|scripts\/platform\/connections\/[^/]+\.mjs|app\/genios-pro\/layout\.js|app\/integracoes\/connections\.module\.css|app\/components\/platform\/BrokerGuideLinks\.js|tests\/platformConnectionGuides\.test\.mjs|docs\/platform\/B155-B160-[A-Z-]+\.md|\.github\/workflows\/jenios-b160-connections\.yml)$/;
for(const row of changed){const [status,path]=row.split('\t');assert.ok(status==='M'&&modified.has(path)||status==='A'&&added.test(path),'Unreviewed change: '+row);}
const before=p=>execFileSync('git',['show',base+':'+p],{encoding:'utf8'});
const after=p=>execFileSync('git',['show','HEAD:'+p],{encoding:'utf8'});
for(const path of ['lib/pay/checkout.mjs','lib/pay/gateway.mjs','lib/pay/catalog.mjs','lib/platform/pilot-prep/adapters.mjs','lib/platform/pilot-prep/paper-ledger.mjs','lib/platform/pilot-prep/risk.mjs','lib/assistant/pro-service.mjs','lib/assistant/pro-provider.mjs','lib/assistant/pro-input.mjs','app/genios-pro/page.js','package.json','package-lock.json'])assert.equal(after(path),before(path),'Protected file changed '+path);
// The brokerage changes inside the existing trading page are an imported help component,
// one modal replacement, a title and bounded modal sizing. Trading functions stay exact.
const mesa=after('app/mesa-operacoes/page.js'),oldMesa=before('app/mesa-operacoes/page.js');
const oldPrefix=oldMesa.slice(0,oldMesa.indexOf('      {modalBrokerAberto &&'));
const prefix=mesa.slice(0,mesa.indexOf('      {modalBrokerAberto &&')).replace("import BrokerGuideLinks from '../components/platform/BrokerGuideLinks';\n",'').replace('<a href="/integracoes">Conexões e guias</a>','');
assert.equal(prefix,oldPrefix,'Trading logic outside broker-help modal must be untouched');
assert.equal(mesa.slice(mesa.indexOf('      <PlatformStrategyLab')),oldMesa.slice(oldMesa.indexOf('      <PlatformStrategyLab')));
console.log('B160_PRESERVATION_PASS='+changed.length+' reviewed paths; original robots, PAY, paid AI and trading logic preserved');
