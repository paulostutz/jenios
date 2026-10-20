import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
test('B128 minimizes the assistant by default and mounts only on authorized Platform screens',()=>{
 const code=read('app/components/assistant/AssistantEntry.js');
 assert.match(code,/PAGES=new Set\(\['\/dashboard-logado','\/dashboard','\/mesa-operacoes'\]\)/);
 assert.match(code,/createPortal/);
 assert.match(code,/everOpened&&<AssistantRoom/);
 assert.match(code,/aria-expanded=\{open\}/);
 assert.match(code,/Minimizar atendimento/);
 assert.match(code,/Expandir janela/);
 assert.match(code,/key=\{access\.id\}/);
});
test('B128 route layouts preserve the original PlatformAuthGuard and do not change Social',()=>{
 for(const path of ['app/dashboard-logado/layout.js','app/dashboard/layout.js','app/mesa-operacoes/layout.js'])
  assert.match(read(path),/<AssistantEntry\/>/);
 assert.match(read('app/dashboard-logado/layout.js'),/<PlatformAuthGuard>\{children\}<\/PlatformAuthGuard>/);
 assert.doesNotMatch(read('app/layout.js'),/AssistantEntry|AssistantRoom/);
 assert.doesNotMatch(read('app/social/page.js'),/AssistantEntry|AssistantRoom/);
});
test('B128 widget reuses the original Gênio/Gênia consent, preference and tools',()=>{
 const room=read('app/components/assistant/AssistantRoom.js');
 const support=read('lib/assistant/service.mjs');
 assert.match(room,/PERSONAS\.map/);
 assert.match(room,/onPersonaChange\(a\.persona\)/);
 assert.match(room,/function AssistantRoom\(\{embedded=false,onPersonaChange=null\}\)/);
 assert.match(room,/setChat\(/);
 assert.match(support,/reserveAssistant/);
 for(const id of ['trends','bankscore_search','bankscore_basic','bankscore_full','crypto_basic','crypto_full'])
  assert.match(read('lib/assistant/tools.mjs'),new RegExp(id));
});
test('B128 dock uses responsive scrollable layout and retains University',()=>{
 const css=read('app/components/assistant/AssistantEntry.module.css');
 assert.match(css,/position:fixed/);
 assert.match(css,/z-index:2147483000/);
 assert.match(css,/@media\(max-width:600px\)/);
 assert.match(css,/calc\(100vw - 16px\)/);
 assert.match(read('app/components/assistant/AssistantEntry.js'),/href="\/platform\/aprender"/);
 assert.match(read('app/components/assistant/AssistantRoom.module.css'),/\.embedded \.layout/);
});
test('B128 never confuses Social login with a Platform entitlement or activates cost',()=>{
 const dock=read('app/components/assistant/AssistantEntry.js');
 assert.match(dock,/access\.source==='platform'/);
 assert.match(dock,/Conecte sua conta da JENIOS Social/);
 assert.match(read('app/api/platform/assistant/route.js'),/OPENAI_API_KEY:''/);
 assert.match(read('app/api/platform/learning/route.js'),/OPENAI_API_KEY:''/);
});
