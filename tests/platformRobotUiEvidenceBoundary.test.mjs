import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const reverse = source('app/engenharia-reversa/page.js');
const risk = source('app/risco/page.js');

test('robot reversal demonstration cannot fabricate executed corrections or monetary performance', () => {
  assert.match(reverse, /DEMONSTRAÇÃO LOCAL/);
  assert.match(reverse, /Sem conexão com corretora/);
  assert.match(reverse, /Exemplo local · nenhuma ordem/);
  assert.match(reverse, /desaparecem ao recarregar/);
  assert.doesNotMatch(reverse, /Lucro Registrado|Capital Preservado|Retificados|Correções Automáticas|Ativado Instantaneamente|assume o controlo|em Tempo Real|processar simulação HFT/i);
  assert.doesNotMatch(reverse, /R\$\s*[\d.,]+|20:45:12|19:30:50/);
});

test('robot risk draft cannot claim server persistence or effective trading protection', () => {
  assert.match(risk, /RASCUNHO LOCAL DE RISCO/);
  assert.match(risk, /serão descartados ao recarregar/);
  assert.match(risk, /Nenhuma regra é salva em servidor ou aplicada ao motor/);
  assert.match(risk, /Nenhuma proteção foi ativada/);
  assert.doesNotMatch(risk, /atualizados com sucesso na infraestrutura|Guardar Regras de Risco|motor bloqueia novas entradas automaticamente|Ativar Trava Automática|Intercepta cliques emocionais/);
});

test('unintegrated robot demonstration pages cannot silently gain transport or persistence', () => {
  for (const page of [reverse, risk]) {
    const imports = [...page.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((match) => match[1]);
    assert.deepEqual(imports, ['react'], 'a new dependency needs an explicit integration review');
    assert.doesNotMatch(page, /\bfetch\s*\(|\bXMLHttpRequest\b|\bWebSocket\b|\bsendBeacon\s*\(|\bimport\s*\(|\blocalStorage\b|\bsessionStorage\b|\bsetTimeout\s*\(/);
  }
});
