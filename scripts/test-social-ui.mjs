import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const { chromium } = createRequire(import.meta.url)('playwright');
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3010';
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = []; page.on('pageerror', error => errors.push(error.message));
let checks = 0;
function pass(label) { checks++; console.log('PASS browser ' + label); }
try {
  for (const [path, heading] of [['/social/cobrancas', 'Minhas cobranças'], ['/social/consulta-detalhada', 'Consulta detalhada de criptoativos'], ['/especialistas', 'Área do Especialista'], ['/especialistas/atendimentos', 'Meus atendimentos'], ['/impulsionar/campanhas', 'Minhas campanhas']]) {
    await page.goto(base + path, { waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: heading, exact: true }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, path + ' overflow');
    pass('mobile page ' + path);
  }
  const snapshot = { disponivel: true, fonte: 'CoinGecko Search Trending', atualizadoEm: '2026-10-15T00:00:00Z', tokens: [{ id: 'bitcoin', nome: 'Bitcoin SINTÉTICO QA', simbolo: 'BTC', rankingMercado: 1 }], megapulse: [], baleias: [], modulos: { tokens: { disponivel: true }, megapulse: { disponivel: false, mensagem: 'Fonte B3 não conectada — fixture.' }, baleias: { disponivel: false, mensagem: 'Fonte institucional não conectada — fixture.' } } };
  let fail = false;
  await page.route('**/api/tendencias', route => route.fulfill({ status: fail ? 503 : 200, contentType: 'application/json', body: JSON.stringify(fail ? { mensagem: 'Falha sintética de QA' } : snapshot) }));
  await page.goto(base + '/tendencias', { waitUntil: 'networkidle' });
  await page.getByRole('link', { name: 'Bitcoin SINTÉTICO QA' }).waitFor();
  await page.getByText('LEITURA VÁLIDA', { exact: true }).waitFor(); pass('fresh trend read labeled correctly');
  fail = true;
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.getByText('DADOS DA ÚLTIMA LEITURA', { exact: true }).waitFor();
  assert.equal(await page.getByRole('link', { name: 'Bitcoin SINTÉTICO QA' }).count(), 1); pass('transport failure preserves explicitly stale snapshot');
  fail = false;
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.getByText('LEITURA VÁLIDA', { exact: true }).waitFor(); pass('trend recovery clears stale status');
  await page.getByRole('button', { name: /MegaPulse B3/ }).click();
  await page.getByText('Fonte B3 não conectada — fixture.', { exact: true }).waitFor();
  assert.equal(await page.getByRole('link', { name: 'Bitcoin SINTÉTICO QA' }).count(), 0); pass('B3 tab never relabels crypto data');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true); pass('hub mobile layout');
  assert.deepEqual(errors, []); pass('zero browser JavaScript exceptions');
  console.log(`${checks} browser checks passed; unauthenticated/local mocked sources, not payment homologation.`);
} finally { await browser.close(); }
