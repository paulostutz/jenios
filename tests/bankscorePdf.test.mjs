import test from 'node:test';
import assert from 'node:assert/strict';
import { createReportPdf } from '../app/api/bankscore/laudo/pdf/route.js';
import { montarLaudo } from '../lib/bankscore/report-core.mjs';

test('gera um PDF real e não vazio para download', async () => {
  const report = montarLaudo({
    codigo: '123',
    nome: 'Banco de Homologação',
    periodo: 202606,
    tipo: 'Banco múltiplo',
    percentual: 14,
    revisao: 'PROVISORIO'
  });
  const bytes = await createReportPdf(report);
  assert.ok(bytes.length > 1000);
  assert.equal(Buffer.from(bytes.subarray(0, 4)).toString('ascii'), '%PDF');
});
