/**
 * R61 browser acceptance with opt-in R62 boundary checks. Run after the required
 * Next build, in CI only. The original 33 R61 cases remain the default battery.
 * The application receives fixture flags, no inherited service credentials, and
 * listens only on loopback. Browser routing blocks external/API/mutating/socket
 * traffic; this is not a claim of host-wide or server-side network isolation.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const ORIGIN = 'http://127.0.0.1:4317';
const ROUTE = '/platform/homologacao/robos';
const REVISION = process.env.JENIOS_ROBOT_QA_ACCEPTANCE_REVISION || 'R61';
assert.ok(['R61', 'R62', 'R63'].includes(REVISION), 'Unsupported robot acceptance revision.');
const PREFIX = REVISION.toLowerCase();
const ARTIFACT_DIR = resolve(process.env.ROBOT_QA_ARTIFACT_DIR || process.env.R61_ARTIFACT_DIR || resolve(process.env.RUNNER_TEMP || tmpdir(), `jenios-${PREFIX}-evidence`));
const FILES = {
  report: resolve(ARTIFACT_DIR, `${PREFIX}-browser-acceptance.json`),
  log: resolve(ARTIFACT_DIR, `${PREFIX}-next-servers.log`),
  desktop: resolve(ARTIFACT_DIR, `${PREFIX}-browser-desktop.png`),
  mobile: resolve(ARTIFACT_DIR, `${PREFIX}-browser-mobile.png`),
  failure: resolve(ARTIFACT_DIR, `${PREFIX}-browser-failure.png`),
  evolution: resolve(ARTIFACT_DIR, `${PREFIX}-evolution-mobile.png`),
};
const FLAGS = Object.freeze({
  VERCEL_ENV: 'preview',
  JENIOS_QA_CANDIDATE_ENABLED: 'true',
  JENIOS_ROBOT_QA_ENABLED: 'true',
  JENIOS_REAL_EXECUTION_ENABLED: 'false',
  JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED: 'false',
  JENIOS_PRIVATE_PAPER_EXECUTOR: 'false',
  JENIOS_ROBOT_EVOLUTION_ENABLED: REVISION === 'R63' ? 'true' : 'false',
});
const started = Date.now();
const attempts = { externalRequests: 0, apiRequests: 0, mutations: 0, webSockets: 0 };
const report = {
  schema: `JENIOS_${REVISION}_BROWSER_ACCEPTANCE_V1`, status: 'FAIL',
  startedAt: new Date(started).toISOString(), commit: process.env.GITHUB_SHA || null,
  coverage: { baseline: 'R61', baselineCases: 33, additionalBoundaryCases: REVISION === 'R61' ? 0 : 8, additionalEvolutionCases: REVISION === 'R63' ? 11 : 0 },
  scope: {
    evidenceKind: 'SYNTHETIC_FIXTURE', origin: ORIGIN,
    networkRestriction: 'BROWSER_REQUESTS_AND_WEBSOCKETS_ONLY',
    authenticatedAccountTested: false, brokerConnectionTested: false,
    productionDeploymentTested: false, commercialPerformanceCertified: false,
    actualBrokerPnl: null, actualLossesAvoided: null, realTradeAccuracy: null,
  },
  runtime: { node: process.version, expectedPlaywright: '1.56.1' },
  cases: [], gateResults: [], attempts, networkEvents: [], pageErrors: [], consoleErrors: [],
  artifacts: {}, errors: [],
};
let browser, context, page, expect, server;
let serverLog = '';
let zeroOrderChecks = 0;
const checks = [];
const check = (id, category, run) => checks.push({ id, category, run });
const pause = (ms) => new Promise((done) => setTimeout(done, ms));
const printableError = (error) => String(error?.stack || error).slice(0, 12000);
const safeUrl = (value) => {
  try { const url = new URL(value); return `${url.origin}${url.pathname}`; }
  catch { return String(value).slice(0, 300); }
};
function log(message) {
  // Bound diagnostic memory without ever logging the inherited environment.
  if (serverLog.length < 2_000_000) serverLog += message;
}
async function bounded(promise, ms, label) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms} ms`)), ms);
    })]);
  } finally { clearTimeout(timer); }
}

async function stopServer() {
  const current = server;
  if (!current) return;
  if (current.child.exitCode === null && current.child.signalCode === null) {
    current.child.kill('SIGTERM');
    try { await bounded(current.exited, 5000, 'Next SIGTERM'); }
    catch {
      current.child.kill('SIGKILL');
      await bounded(current.exited, 5000, 'Next SIGKILL');
    }
  }
  if (server === current) server = undefined;
}

async function startServer(overrides = {}) {
  await stopServer();
  const env = { NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1', ...FLAGS };
  // Copy operating-system settings only, never app/broker/DB credentials.
  for (const key of ['PATH', 'HOME', 'TMPDIR', 'TMP', 'TEMP', 'SystemRoot', 'LANG', 'LC_ALL', 'TZ']) {
    if (process.env[key] !== undefined) env[key] = process.env[key];
  }
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete env[key];
    else env[key] = value;
  }
  log(`\n${REVISION} server flags: ${JSON.stringify(Object.fromEntries(Object.keys(FLAGS).map((key) => [key, env[key] ?? '<absent>'])))}\n`);
  const child = spawn(process.execPath, [resolve(ROOT, 'node_modules/next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', '4317'], {
    cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'],
  });
  const current = { child, error: null };
  current.exited = new Promise((done) => child.once('exit', (code, signal) => {
    log(`\nNext exit: code=${code}; signal=${signal}\n`);
    done();
  }));
  child.once('error', (error) => { current.error = error; });
  child.stdout.on('data', (chunk) => log(chunk.toString()));
  child.stderr.on('data', (chunk) => log(chunk.toString()));
  server = current;
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    if (current.error) throw current.error;
    if (child.exitCode !== null || child.signalCode !== null) throw new Error('Next exited before readiness; see server log.');
    try {
      const response = await fetch(`${ORIGIN}${ROUTE}`, { redirect: 'manual', signal: AbortSignal.timeout(1500) });
      await response.arrayBuffer();
      if (response.status === 200 || response.status === 404) return;
    } catch { /* The bounded readiness loop tolerates startup connection refusal. */ }
    await pause(150);
  }
  throw new Error('Next did not become ready on 127.0.0.1:4317 within 45 seconds.');
}

async function setupBrowser() {
  const modulePath = process.env.JENIOS_ROBOT_QA_PLAYWRIGHT_MODULE || process.env.JENIOS_R61_PLAYWRIGHT_MODULE;
  assert.ok(modulePath && isAbsolute(modulePath), 'The Playwright module must be an absolute @playwright/test/index.mjs path.');
  const packageJson = JSON.parse(await readFile(resolve(dirname(modulePath), 'package.json'), 'utf8'));
  assert.equal(packageJson.version, '1.56.1', 'The acceptance runner requires pinned Playwright 1.56.1.');
  assert.ok(['@playwright/test', 'playwright'].includes(packageJson.name), 'Unexpected Playwright module package.');
  report.runtime.playwright = packageJson.version;
  const playwright = await import(pathToFileURL(modulePath).href);
  assert.equal(typeof playwright.chromium?.launch, 'function', 'The module must export chromium.');
  assert.equal(typeof playwright.expect, 'function', 'The module must export expect.');
  expect = playwright.expect.configure({ timeout: 6000 });
  browser = await playwright.chromium.launch({ headless: true, timeout: 30000 });
  report.runtime.chromium = browser.version();
  context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
  context.setDefaultTimeout(8000);
  context.setDefaultNavigationTimeout(30000);
  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const reasons = [];
    if (url.origin !== ORIGIN) { attempts.externalRequests += 1; reasons.push('EXTERNAL_ORIGIN'); }
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) { attempts.apiRequests += 1; reasons.push('API'); }
    if (!['GET', 'HEAD'].includes(request.method())) { attempts.mutations += 1; reasons.push('MUTATING_METHOD'); }
    if (reasons.length) {
      report.networkEvents.push({ url: safeUrl(url.href), method: request.method(), reasons });
      await route.abort('blockedbyclient');
    } else await route.continue();
  });
  await context.routeWebSocket(/.*/, async (socket) => {
    attempts.webSockets += 1;
    report.networkEvents.push({ url: safeUrl(socket.url()), reasons: ['WEBSOCKET'] });
    await socket.close({ code: 1008, reason: 'R61 fixture console has no socket transport' });
  });
  context.on('page', (opened) => {
    opened.on('pageerror', (error) => report.pageErrors.push(printableError(error)));
    opened.on('console', (message) => {
      if (message.type() === 'error' && report.consoleErrors.length < 100) report.consoleErrors.push(message.text().slice(0, 1500));
    });
  });
  page = await context.newPage();
}

async function noOrders(result) {
  await expect(result).toContainText(/Ordens reais:\s*0\.\s*Paper externo:\s*0\./);
  zeroOrderChecks += 1;
}
async function assisted(mode, action, side, reason) {
  await page.getByTestId('assisted-evaluate').click();
  const result = page.getByTestId('assisted-result');
  await expect(result).toHaveAttribute('data-action', action);
  await expect(result).toHaveAttribute('data-suggested-side', side);
  await expect(page.getByTestId('assisted-mode')).toHaveValue(mode);
  await noOrders(result);
  if (reason) await expect(page.getByTestId('assisted-reasons')).toContainText(reason);
  return { mode, action: await result.getAttribute('data-action'), suggestedSide: await result.getAttribute('data-suggested-side') };
}
async function ultra(status, allow, events) {
  const result = page.getByTestId('ultra-result');
  await expect(result).toHaveAttribute('data-status', status);
  await expect(result).toHaveAttribute('data-allow', String(allow));
  if (events !== undefined) await expect(result).toHaveAttribute('data-events', String(events));
  await noOrders(result);
  return {
    status: await result.getAttribute('data-status'),
    allowSyntheticDecision: (await result.getAttribute('data-allow')) === 'true',
    eventCount: Number(await result.getAttribute('data-events')),
    sessionId: await result.getAttribute('data-session-id'),
  };
}
async function ultraEvent(scenario) {
  await page.getByTestId('ultra-scenario').selectOption(scenario);
  await page.getByTestId('ultra-step').click();
}
async function expectEmptyUltra() {
  await expect(page.getByTestId('ultra-result')).toHaveCount(0);
  await expect(page.getByTestId('ultra-empty')).toBeVisible();
  for (const id of ['ultra-step', 'ultra-pause', 'ultra-resume']) await expect(page.getByTestId(id)).toBeDisabled();
}
async function ultraGates() {
  return JSON.parse(await page.getByTestId('ultra-result').locator('pre').textContent());
}
async function screenshot(kind) {
  await page.screenshot({ path: FILES[kind], fullPage: true, timeout: 15000 });
  report.artifacts[kind] = FILES[kind];
}

check('preview_route_parent_link_and_scope', 'access', async () => {
  const response = await page.goto(`${ORIGIN}/platform/homologacao`, { waitUntil: 'networkidle' });
  assert.equal(response.status(), 200);
  await page.locator(`a[href="${ROUTE}"]`).click();
  await expect(page).toHaveURL(`${ORIGIN}${ROUTE}`);
  await expect(page.getByTestId('robot-acceptance-console')).toBeVisible();
  await expect(page.getByTestId('real-evidence-boundary')).toContainText('permanecem nulos');
  await expect(page.getByTestId('real-evidence-boundary')).toContainText('R15 permanece preservado');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await expect(page.getByTestId('assisted-empty')).toBeVisible();
  await expectEmptyUltra();
  report.gateResults.push({ scenario: 'preview_all_required_flags', expectedStatus: 200, status: 200, consoleRendered: true });
  return { parentLink: true, syntheticBoundaryVisible: true, noindex: true };
});

check('manual_stress_preserves_operator_control', 'manual', async () => {
  const result = await assisted('manual', 'MANUAL_CONTROL', 'buy', 'SUGGEST_PAUSE_AND_REVIEW');
  await expect(page.getByTestId('assisted-reasons')).toContainText('SESSION_RISK_WARNING');
  await expect(page.getByTestId('operator-side')).toHaveValue('buy');
  return result;
});
check('manual_requested_help_and_low_confidence', 'manual', async () => {
  await page.getByTestId('confidence').fill('0.50');
  await page.getByTestId('operator-help').check();
  const result = await assisted('manual', 'MANUAL_CONTROL', 'buy', 'OFFER_CONTEXTUAL_ANALYSIS');
  await expect(page.getByTestId('assisted-reasons')).toContainText('LOW_SIGNAL_CONFIDENCE');
  return result;
});
check('assisted_edit_discards_previous_result', 'invalidation', async () => {
  await page.getByTestId('confidence').fill('0.64');
  await expect(page.getByTestId('assisted-result')).toHaveCount(0);
  await expect(page.getByTestId('assisted-empty')).toBeVisible();
});
check('hybrid_below_065_does_not_intervene', 'hybrid', async () => {
  await page.getByTestId('assisted-mode').selectOption('hybrid');
  return assisted('hybrid', 'KEEP_OPERATOR_DECISION', 'buy', 'LOW_CONFIDENCE_OR_NO_SIDE');
});
check('hybrid_at_065_advises_without_mode_switch', 'hybrid', async () => {
  await page.getByTestId('confidence').fill('0.65');
  const evidence = await assisted('hybrid', 'ADVISE_REVIEW', 'sell', 'MATERIAL_DISAGREEMENT');
  const result = page.getByTestId('assisted-result');
  await result.locator('summary').click();
  await expect(result).toContainText('Limiar: 0.65.');
  await expect(result).toContainText('R57_FROZEN_POLICY');
  await expect(page.getByTestId('operator-side')).toHaveValue('buy');
  return { ...evidence, alignmentGuard: 0.65 };
});
check('hybrid_aligned_operator_is_preserved', 'hybrid', async () => {
  await page.getByTestId('technical-side').selectOption('buy');
  return assisted('hybrid', 'KEEP_OPERATOR_DECISION', 'buy', 'OPERATOR_ALREADY_ALIGNED');
});
check('reverse_at_065_selective_synthetic_reference', 'reverse', async () => {
  await page.getByTestId('assisted-mode').selectOption('reverse');
  await page.getByTestId('technical-side').selectOption('sell');
  const evidence = await assisted('reverse', 'REVERSE_REFERENCE', 'sell');
  await expect(page.getByTestId('losseshometro')).toContainText('Losseshômetro sintético: 2 R');
  await expect(page.getByTestId('losseshometro')).toContainText('Não é dinheiro nem perda real evitada');
  await expect(page.getByTestId('assisted-result')).toContainText('Limiar: 0.65.');
  return { ...evidence, alignmentGuard: 0.65, hypotheticalLossAvoidedR: 2 };
});
check('reverse_megatrend_exception', 'reverse', async () => {
  await page.getByTestId('megatrend').check();
  const evidence = await assisted('reverse', 'KEEP_OPERATOR_DECISION', 'buy', 'MEGATREND_EXCEPTION');
  await expect(page.getByTestId('losseshometro')).toContainText('sintético: 0 R');
  return evidence;
});
check('reverse_low_confidence_does_not_reverse', 'reverse', async () => {
  await page.getByTestId('megatrend').uncheck();
  await page.getByTestId('confidence').fill('0.64');
  return assisted('reverse', 'KEEP_OPERATOR_DECISION', 'buy', 'LOW_CONFIDENCE');
});
check('reverse_aligned_operator_does_not_reverse', 'reverse', async () => {
  await page.getByTestId('confidence').fill('0.85');
  await page.getByTestId('technical-side').selectOption('buy');
  return assisted('reverse', 'KEEP_OPERATOR_DECISION', 'buy', 'NO_MATERIAL_DISAGREEMENT');
});
check('assisted_invalid_html_input_cannot_keep_result', 'invalidation', async () => {
  await page.getByTestId('confidence').fill('2');
  await page.getByTestId('assisted-evaluate').click();
  assert.equal(await page.getByTestId('confidence').evaluate((input) => input.validity.rangeOverflow), true);
  await expect(page.getByTestId('assisted-result')).toHaveCount(0);
  await page.getByTestId('confidence').fill('0.85');
  await page.getByTestId('technical-side').selectOption('sell');
});

check('ultrafast_start_contains_two_normal_snapshots', 'ultrafast', async () => {
  await expect(page.getByTestId('ultra-symbol')).toHaveValue('BTC-USD');
  await page.getByTestId('ultra-start').click();
  const evidence = await ultra('RUNNING', true, 2);
  assert.ok(evidence.sessionId);
  const gates = await ultraGates();
  assert.equal(gates.freshness.allow, true);
  assert.equal(gates.hysteresis.state, 'ALLOWED');
  assert.equal(gates.risk.equityR, 0);
  return evidence;
});
check('ultrafast_pause_revokes_readiness_and_disables_steps', 'ultrafast', async () => {
  await page.getByTestId('ultra-pause').click();
  const evidence = await ultra('PAUSED', false, 3);
  await expect(page.getByTestId('ultra-step')).toBeDisabled();
  await expect(page.getByTestId('ultra-pause')).toBeDisabled();
  await expect(page.getByTestId('ultra-resume')).toBeEnabled();
  return evidence;
});
check('ultrafast_resume_requires_two_fresh_normal_events', 'ultrafast', async () => {
  await page.getByTestId('ultra-resume').click();
  const resumed = await ultra('RUNNING', false, 4);
  await ultraEvent('normal');
  const first = await ultra('RUNNING', false, 5);
  await ultraEvent('normal');
  const second = await ultra('RUNNING', true, 6);
  return { resumed, first, second };
});
for (const [scenario, reason] of [
  ['stale_book', 'R47_STALE_MARKET_DATA'],
  ['cost_shock', 'R53_ASSET_NOT_ELIGIBLE'],
  ['maintenance', 'MARKET_NOT_OPEN'],
  ['unknown_exposure', 'RECOVERY_NOT_READY'],
  ['missing_entitlement', 'REQUIRES_GLOBAL_CRYPTO_OR_PRO'],
]) {
  check(`ultrafast_${scenario}_blocks_then_requires_two_normals`, 'ultrafast_fault', async () => {
    const before = await ultra('RUNNING', true);
    await ultraEvent(scenario);
    const fault = await ultra('RUNNING', false, before.eventCount + 1);
    await expect(page.getByTestId('ultra-reasons')).toContainText(reason);
    await ultraEvent('normal');
    const first = await ultra('RUNNING', false, before.eventCount + 2);
    await ultraEvent('normal');
    const second = await ultra('RUNNING', true, before.eventCount + 3);
    assert.equal(second.sessionId, before.sessionId);
    return { scenario, reason, fault, first, second };
  });
}
check('ultrafast_halt_persists_and_cannot_resume', 'ultrafast', async () => {
  const before = await ultra('RUNNING', true);
  await ultraEvent('risk_halt');
  const halted = await ultra('HALTED', false, before.eventCount + 1);
  await expect(page.getByTestId('ultra-reasons')).toContainText('R61_NEW_SESSION_REQUIRED');
  for (const id of ['ultra-step', 'ultra-pause', 'ultra-resume']) await expect(page.getByTestId(id)).toBeDisabled();
  await page.getByTestId('ultra-scenario').selectOption('normal');
  const retained = await ultra('HALTED', false, halted.eventCount);
  assert.equal(retained.sessionId, halted.sessionId);
  assert.equal((await ultraGates()).risk.halted, true);
  return retained;
});
check('ultrafast_new_session_is_required_after_halt', 'ultrafast', async () => {
  const halted = await ultra('HALTED', false);
  await page.getByTestId('ultra-start').click();
  const restarted = await ultra('RUNNING', true, 2);
  assert.notEqual(restarted.sessionId, halted.sessionId);
  assert.equal((await ultraGates()).risk.halted, false);
  return { oldSessionId: halted.sessionId, ...restarted };
});

for (const [field, value, kind, verify] of [
  ['ultra-capital', '1200', 'fill', (gates) => assert.equal(gates.plan.notional, 120)],
  ['ultra-leverage', '3', 'fill', (gates) => assert.equal(gates.plan.notional, 180)],
  ['ultra-symbol', 'ETH-USD', 'selectOption', (gates) => assert.equal(gates.asset.symbol, 'ETH-USD')],
]) {
  check(`${field.replaceAll('-', '_')}_edit_discards_session`, 'invalidation', async () => {
    const previous = await ultra('RUNNING', true);
    await page.getByTestId(field)[kind](value);
    await expectEmptyUltra();
    await page.getByTestId('ultra-start').click();
    const next = await ultra('RUNNING', true, 2);
    assert.notEqual(next.sessionId, previous.sessionId);
    verify(await ultraGates());
    return { field, value, ...next };
  });
}
check('ultrafast_plan_edit_invalidates_and_denies_unentitled_plan', 'invalidation', async () => {
  await page.getByTestId('ultra-plan').selectOption('platform-nacional');
  await expectEmptyUltra();
  await page.getByTestId('ultra-start').click();
  const evidence = await ultra('RUNNING', false, 2);
  await expect(page.getByTestId('ultra-reasons')).toContainText('REQUIRES_GLOBAL_CRYPTO_OR_PRO');
  assert.equal((await ultraGates()).entitlement.allowed, false);
  return evidence;
});
for (const field of ['ultra-capital', 'ultra-leverage']) {
  check(`${field.replaceAll('-', '_')}_invalid_value_clears_authorization`, 'invalidation', async () => {
    await page.getByTestId(field).fill('0');
    await page.getByTestId('ultra-start').click();
    await expect(page.getByTestId('ultra-error')).toBeVisible();
    await expect(page.getByTestId('ultra-result')).toHaveCount(0);
    await expect(page.getByTestId('ultra-step')).toBeDisabled();
    await page.getByTestId(field).fill(field === 'ultra-capital' ? '1000' : '2');
  });
}
check('reload_discards_all_local_evaluations', 'invalidation', async () => {
  await page.getByTestId('ultra-plan').selectOption('platform-global-crypto');
  await page.getByTestId('ultra-start').click();
  await ultra('RUNNING', true, 2);
  await assisted('reverse', 'REVERSE_REFERENCE', 'sell');
  await screenshot('desktop');
  const response = await page.reload({ waitUntil: 'networkidle' });
  assert.equal(response.status(), 200);
  await expect(page.getByTestId('assisted-result')).toHaveCount(0);
  await expect(page.getByTestId('assisted-empty')).toBeVisible();
  await expectEmptyUltra();
  await expect(page.getByTestId('assisted-mode')).toHaveValue('manual');
  await expect(page.getByTestId('ultra-capital')).toHaveValue('1000');
  await expect(page.getByTestId('ultra-symbol')).toHaveValue('BTC-USD');
});
check('mobile_controls_results_and_no_horizontal_overflow', 'mobile', async () => {
  await page.setViewportSize({ width: 375, height: 812 });
  await assisted('manual', 'MANUAL_CONTROL', 'buy', 'SUGGEST_PAUSE_AND_REVIEW');
  await page.getByTestId('ultra-start').click();
  await ultra('RUNNING', true, 2);
  await page.getByTestId('assisted-result').locator('summary').click();
  await page.getByTestId('ultra-result').locator('summary').click();
  const measurements = [];
  for (const width of [375, 320]) {
    await page.setViewportSize({ width, height: 812 });
    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      document: document.documentElement.scrollWidth,
      body: document.body.scrollWidth,
    }));
    assert.ok(Math.max(dimensions.document, dimensions.body) <= dimensions.viewport + 1, JSON.stringify(dimensions));
    measurements.push(dimensions);
  }
  await screenshot('mobile');
  return measurements;
});

if (REVISION === 'R62' || REVISION === 'R63') {
  const { registerR62SessionLimitCases } = await import('./r62-session-limit-cases.mjs');
  const { registerR62ExecutionFlagCases } = await import('./r62-execution-flag-cases.mjs');
  const harness = {
    check, getPage: () => page, getExpect: () => expect, startServer,
    ultra, ultraEvent, expectEmptyUltra, origin: ORIGIN, route: ROUTE, report, screenshot,
  };
  // Limits need the enabled fixture server; flag-denial cases run afterwards.
  registerR62SessionLimitCases(harness);
  if (REVISION === 'R63') {
    const { registerR63EvolutionCases } = await import('./r63-evolution-cases.mjs');
    registerR63EvolutionCases(harness);
  }
  registerR62ExecutionFlagCases(harness);
}

for (const [id, overrides] of [
  ['production_is_404_even_with_qa_flags', { VERCEL_ENV: 'production' }],
  ['missing_robot_qa_flag_is_404', { JENIOS_ROBOT_QA_ENABLED: undefined }],
]) {
  check(id, 'negative_gate', async () => {
    await startServer(overrides);
    const response = await page.goto(`${ORIGIN}${ROUTE}`, { waitUntil: 'networkidle' });
    const result = { scenario: id, expectedStatus: 404, status: response.status(), consoleRendered: await page.getByTestId('robot-acceptance-console').count() > 0 };
    report.gateResults.push(result);
    assert.equal(result.status, 404);
    assert.equal(result.consoleRendered, false);
    if (overrides.VERCEL_ENV !== 'production') {
      const parentResponse = await page.goto(`${ORIGIN}/platform/homologacao`, { waitUntil: 'networkidle' });
      assert.equal(parentResponse.status(), 200);
      await expect(page.locator(`a[href="${ROUTE}"]`)).toHaveCount(0);
      result.parentLinkAbsent = true;
    }
    return result;
  });
}
check('zero_external_api_mutation_socket_attempts_and_page_errors', 'transport_boundary', async () => {
  assert.deepEqual(attempts, { externalRequests: 0, apiRequests: 0, mutations: 0, webSockets: 0 });
  assert.deepEqual(report.pageErrors, []);
  return { ...attempts, pageErrors: report.pageErrors.length, renderedZeroOrderChecks: zeroOrderChecks };
});

assert.equal(checks.length, REVISION === 'R63' ? 52 : REVISION === 'R62' ? 41 : 33, 'The complete planned acceptance battery must be registered.');
assert.equal(new Set(checks.map((entry) => entry.id)).size, checks.length, 'Acceptance case IDs must be unique.');

try {
  await mkdir(ARTIFACT_DIR, { recursive: true });
  await setupBrowser();
  await startServer();
  for (const entry of checks) {
    const begin = Date.now();
    const record = { id: entry.id, category: entry.category, status: 'FAIL' };
    report.cases.push(record);
    try {
      const evidence = await entry.run();
      if (evidence !== undefined) record.evidence = evidence;
      record.status = 'PASS';
    } catch (error) {
      record.error = printableError(error);
      throw error;
    } finally { record.durationMs = Date.now() - begin; }
  }
  report.status = 'PASS';
} catch (error) {
  report.errors.push(printableError(error));
  process.exitCode = 1;
  if (page && !page.isClosed()) {
    try { await screenshot('failure'); }
    catch (captureError) { report.errors.push(`Failure screenshot: ${printableError(captureError)}`); }
  }
} finally {
  try { if (browser) await bounded(browser.close(), 10000, 'Browser cleanup'); }
  catch (error) { report.errors.push(printableError(error)); report.status = 'FAIL'; process.exitCode = 1; }
  try { await stopServer(); }
  catch (error) { report.errors.push(printableError(error)); report.status = 'FAIL'; process.exitCode = 1; }
  if (Object.values(attempts).some((count) => count !== 0) || report.pageErrors.length > 0) {
    report.status = 'FAIL'; process.exitCode = 1;
  }
  const completedIds = new Set(report.cases.map((entry) => entry.id));
  for (const entry of checks) if (!completedIds.has(entry.id)) report.cases.push({ id: entry.id, category: entry.category, status: 'NOT_RUN' });
  report.counts = {
    total: checks.length,
    passed: report.cases.filter((entry) => entry.status === 'PASS').length,
    failed: report.cases.filter((entry) => entry.status === 'FAIL').length,
    notRun: report.cases.filter((entry) => entry.status === 'NOT_RUN').length,
    pageErrors: report.pageErrors.length,
    renderedZeroOrderChecks: zeroOrderChecks,
  };
  report.finishedAt = new Date().toISOString();
  report.durationMs = Date.now() - started;
  report.artifacts.report = FILES.report;
  report.artifacts.log = FILES.log;
  try {
    await mkdir(ARTIFACT_DIR, { recursive: true });
    await writeFile(FILES.log, serverLog, 'utf8');
    await writeFile(FILES.report, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  } catch (error) {
    report.errors.push(`Artifact persistence: ${printableError(error)}`);
    report.status = 'FAIL'; process.exitCode = 1;
  }
  console.log(`${REVISION}_BROWSER_ACCEPTANCE ${JSON.stringify(report)}`);
}
