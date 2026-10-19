import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const page = name => readFileSync(new URL('../app/'+name+'/page.js', import.meta.url),'utf8');
test('dashboard-logado abre negociação sem desvio obrigatório para diagnóstico',()=>{
 const s=page('dashboard-logado');
 assert.match(s,/href="\/dashboard"/);
 assert.match(s,/href="\/mesa-operacoes"/);
 assert.doesNotMatch(s,/Protocolo Obrigatório/);
});
test('dashboard inclui CTA do laudo e nega autorização real pelo navegador',()=>{
 const s=page('dashboard');
 assert.match(s,/Diagnóstico Comportamental/);
 assert.match(s,/href="\/diagnostico"/);
 assert.match(s,/onClick=\{solicitarContaReal\}/);
 assert.doesNotMatch(s,/Roteamento HFT via API executado/);
});
test('questionário não força escolha e solicita laudo por usuário no servidor',()=>{
 const s=page('diagnostico');
 assert.match(s,/submitAccountDiagnostic\(supabase, respostas, timelineSelecionada\)/);
 assert.match(s,/Modo inicial sugerido/);
 assert.doesNotMatch(s,/Escolha o seu Modo Operacional/);
 assert.equal((s.match(/p: "tecnico_positivo", v: 2/g)||[]).length,5);
});
test('rota antiga da seleção direciona para mesa atual',()=>{
 const s=page('mesa-operacao');
 assert.match(s,/redirect\('\/mesa-operacoes'\)/);
 assert.doesNotMatch(s,/Ativar Modo/);
});
test('mesa não permite selecionar conta real localmente ou fingir ordem executada',()=>{
 const s=page('mesa-operacoes');
 assert.match(s,/onClick=\{solicitarContaReal\}/);
 assert.match(s,/tipoConta !== 'simulada'/);
 assert.doesNotMatch(s,/Conta real conectada com sucesso/);
 assert.doesNotMatch(s,/Token de segurança da API/);
});
test('LP não contém estatísticas sem lastro nem promete lucro automático',()=>{
 const s=page('lp');
 assert.doesNotMatch(s,/Mais de 95% dos operadores/);
 assert.doesNotMatch(s,/falência da sua conta ocorrerá em menos de 90 dias/);
 assert.doesNotMatch(s,/transformamos o seu erro em lucro automatizado/);
 assert.match(s,/envolvem risco de perdas/);
});
