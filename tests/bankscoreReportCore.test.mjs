import test from 'node:test';
import assert from 'node:assert/strict';
import { montarLaudo } from '../lib/bankscore/report-core.mjs';

test('laudo suspende conclusão quando o indicador está sob revisão', () => {
  const report = montarLaudo({ percentual: 14, revisao: 'INDICADOR_INCONSISTENTE' });
  assert.equal(report.classificacao, 'DADO SOB REVISÃO');
  assert.match(report.conclusao, /suspenso/i);
});

test('laudo não transforma índice favorável em rating de crédito', () => {
  const report = montarLaudo({ percentual: 15, revisao: 'PROVISORIO' });
  assert.equal(report.classificacao, 'SINAL FAVORÁVEL DE CAPITALIZAÇÃO');
  assert.match(report.criterio, /não são.*rating/i);
});

test('laudo preserva lista de verificações complementares', () => {
  const report = montarLaudo({ percentual: 10, revisao: 'PROVISORIO' });
  assert.ok(report.pendencias.length >= 4);
  assert.match(report.interpretacao, /menor folga/i);
});
