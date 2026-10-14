import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import assert from 'node:assert/strict';

const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3010';
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  for (const [path, heading] of [['/admin/cobrancas','Preços e cobranças'],['/checkout','Escolha seu plano mensal'],['/impulsionar','Impulsionar publicação'],['/social/cobrancas','Minhas cobranças']]) {
    await page.goto(base + path, { waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: heading, exact: true }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, path + ' mobile overflow');
    console.log('PASS mobile ' + path);
  }
  await page.goto(base + '/checkout', { waitUntil: 'networkidle' });
  for (const name of ['Nacional — B3','Global Crypto — B3 + Cripto','Internacional Pro']) await page.getByRole('heading', { name, exact: true }).waitFor();
  await page.getByRole('button', { name: /Contratar plano mensal/ }).click();
  await page.getByRole('status').filter({ hasText: /Configure sua conta|Entre na sua conta/ }).waitFor();
  assert.deepEqual(errors, []);
  console.log('PASS plans, unauthenticated purchase and zero browser exceptions');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(base + '/admin/cobrancas', { waitUntil: 'networkidle' });
  if (process.env.QA_SCREENSHOT_PATH) await page.screenshot({ path: process.env.QA_SCREENSHOT_PATH, fullPage: true });
} finally { await browser.close(); }
