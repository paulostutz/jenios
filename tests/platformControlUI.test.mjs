import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const page = path => readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('acesso admin nunca usa credenciais hardcoded',()=>{
 const s=page('app/admin/login/page.js');
 assert.match(s,/signInWithPassword/);
 assert.match(s,/adminFetch\('\/api\/admin\/access'\)/);
 assert.doesNotMatch(s,/admin123|senha ===/i);
});
test('admin root exige permissões de servidor antes de renderizar',()=>{
 const s=page('app/admin/page.js');
 assert.match(s,/AdminAccess permission/);
 assert.match(s,/reports\.run/);
 assert.match(s,/finance\.manage/);
 assert.match(s,/permissions\.manage/);
 assert.doesNotMatch(s,/R\$ 142\.850|Carlos Silva|Resetar Senha|cadastrarClienteAdmin/);
});
test('o gate existente continua aceitando uma permissão única',()=>{
 const s=page('app/components/AdminAccess.js');
 assert.match(s,/Array\.isArray\(permission\)/);
 assert.match(s,/permissions\.includes\(permission\)/);
 assert.match(s,/adminFetch\('\/api\/admin\/access'\)/);
});
test('sala logada preserva pagamentos reais e entrada direta no simulador',()=>{
 const s=page('app/dashboard-logado/page.js');
 assert.match(s,/PlatformBillingStatus/);
 assert.match(s,/href="\/dashboard"/);
 assert.match(s,/href="\/mesa-operacoes"/);
 assert.match(s,/loadAccountDiagnostic/);
 assert.doesNotMatch(s,/R\$ 45\.820|R\$ 5\.630|API Key gerada|novaSenha/);
});
test('dashboard não permite editar seu plano no navegador',()=>{
 const s=page('app/dashboard/page.js');
 assert.doesNotMatch(s,/setPlanoUsuario|value=\{planoUsuario\}/);
 assert.match(s,/Minha assinatura/);
 assert.match(s,/onClick=\{solicitarContaReal\}/);
});
test('dashboard mostra só intenções fictícias e pausa reversível',()=>{
 const s=page('app/dashboard/page.js');
 assert.match(s,/setIntencoesFicticias/);
 assert.match(s,/writeSimulationPaused\(window\.sessionStorage,operadorId,paused\)/);
 assert.match(s,/SIMULAR COMPRA|Simular compra/i);
 assert.doesNotMatch(s,/Roteamento HFT via API executado|17 operações impulsivas evitadas/);
});
test('mesa tem capital inicial dentro de 5% e bloqueia real',()=>{
 const s=page('app/mesa-operacoes/page.js');
 assert.match(s,/useState\(1000\)/);
 assert.match(s,/saldoSimulado \* 0\.05/);
 assert.match(s,/tipoConta !== 'simulada'/);
 assert.doesNotMatch(s,/Conta real conectada com sucesso|setPlanoUsuario/);
});
test('mesa oferece diário e comando de pausar e retomar',()=>{
 const s=page('app/mesa-operacoes/page.js');
 assert.match(s,/setIntencoes/);
 assert.match(s,/setPausaManual/);
 assert.match(s,/Retomar sessão/);
 assert.match(s,/Histórico de intenções fictícias/);
});
test('grids de negociação respeitam dispositivos móveis',()=>{
 const c=page('app/components/platform/Terminal.module.css');
 assert.match(c,/@media\(max-width:1050px\)/);
 assert.match(c,/@media\(max-width:560px\)/);
 const d=page('app/dashboard/page.js'),m=page('app/mesa-operacoes/page.js');
 assert.match(d,/terminal\.workspace/);assert.match(m,/terminal\.workspace/);
});
test('admin e dashboard logada mantêm estilos móveis',()=>{
 assert.match(page('app/admin/page.module.css'),/@media\(max-width:580px\)/);
 assert.match(page('app/dashboard-logado/control.module.css'),/@media\(max-width:640px\)/);
});
