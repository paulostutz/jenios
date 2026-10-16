import test from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';
import { bankscoreCoverage, bankscoreTarget, lastClosedQuarter, loadBankscoreCoverage, withBankscoreAvailability, assertBankscoreDetailedReady } from '../lib/bankscore/coverage.mjs';
import { createReportPdf } from '../app/api/bankscore/laudo/pdf/route.js';
const row = { codigo_instituicao: '123', nome_instituicao: 'Banco sintético', periodo: 202606, tipo_instituicao: 1, indice_basileia_bruto: .14, indice_basileia_percentual_provisorio: 14 };
test('coverage never upgrades a provisional indicator into complete solvency analysis', () => {
  const report = bankscoreCoverage(row, [row], [], new Date('2026-10-15T00:00:00Z'));
  assert.equal(report.coverage.detailedAvailable, false); assert.equal(report.coverage.dimensions[0].state, 'provisional');
  assert.ok(report.coverage.dimensions.slice(1).every(item => item.state === 'not_validated'));
  assert.equal(report.coverage.latestClosedCalendarQuarter, 202609); assert.equal(report.coverage.olderThanClosedQuarter, true);
});
test('calendar boundary includes year rollover without inventing data publication', () => {
  for (const [date, expected] of [['2026-01-01', 202512], ['2026-04-01', 202603], ['2026-07-01', 202606], ['2026-10-01', 202609]]) assert.equal(lastClosedQuarter(new Date(date)), expected);
});
test('duplicates and inconsistent historical values are not plotted as valid percentages', () => {
  const report = bankscoreCoverage(row, [row, { ...row }, { ...row, periodo: 202603, indice_basileia_percentual_provisorio: 99 }]);
  assert.equal(report.coverage.series[0].revisao, 'DUPLICADO'); assert.equal(report.coverage.series[0].percentual, null); assert.equal(report.coverage.series[1].percentual, null);
});
test('missing supplemental values remain null and units are never inferred', () => {
  const report = bankscoreCoverage(row, [row], [{ codigo_indicador: 'unknown', nome_indicador: 'Teste', valor_bruto: null }, { codigo_indicador: 'other', valor_bruto: 100 }]);
  assert.equal(report.coverage.supplementalIndicators[0].rawValue, null); assert.equal(report.coverage.supplementalIndicators[1].rawValue, 100); assert.equal(report.coverage.supplementalIndicators[1].unit, 'não validada');
  assert.equal(report.coverage.detailedAvailable, false);
});
test('invalid code/period rejected before database access', async () => {
  assert.throws(() => bankscoreTarget({ codigo: 'fake' }), { status: 400 });
  assert.throws(() => bankscoreTarget({ codigo: '123', periodo: '202613' }), { status: 400 });
  assert.throws(() => bankscoreCoverage({ ...row, periodo: 202613 }), { status: 409 });
  await assert.rejects(loadBankscoreCoverage({ db: { from() { throw Error('No query'); } }, target: { codigo: 'invalid' } }), { status: 400 });
});
test('catalog offers the existing capitalization report; missing backend still blocks checkout', async () => {
  await assert.rejects(assertBankscoreDetailedReady(), { status: 503 });
  const product = withBankscoreAvailability({ code: 'social-bankscore-report', price_cents: 990, active: true });
  assert.equal(product.price_cents, 990); assert.equal(product.serviceReady, true);
  assert.equal(withBankscoreAvailability({ code: 'social-crypto-validator' }).serviceReady, undefined);
});
test('coverage PDF paginates long supplemental evidence without replacing the basic report', async () => {
  const report = bankscoreCoverage(row, [row], Array.from({ length: 50 }, (_, i) => ({ codigo_indicador: String(i), nome_indicador: 'Indicador sem unidade validada', valor_bruto: i, fonte: 'fonte'.repeat(150) })));
  const bytes = await createReportPdf(report);
  assert.ok((await PDFDocument.load(bytes)).getPageCount() > 2);
});
