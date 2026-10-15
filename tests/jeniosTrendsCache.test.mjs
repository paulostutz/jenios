import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createTrendsService, getJeniosTrends, normalizeCoinGeckoTrending } from '../lib/jeniosTrends.mjs';
const coin = { item: { id: 'bitcoin', name: 'Bitcoin', symbol: 'btc', market_cap_rank: 1, score: 0 } };
const success = () => ({ disponivel: true, atualizadoEm: '2026-10-15T00:00:00Z', fonte: 'CoinGecko Search Trending', tokens: [{ id: 'bitcoin' }], megapulse: [], baleias: [], modulos: { tokens: { disponivel: true } } });
const failure = () => ({ disponivel: false, tokens: [], megapulse: [], baleias: [], modulos: { tokens: { disponivel: false, mensagem: 'offline' } } });

test('cache deduplicates concurrent calls and protects snapshot from caller mutation', async () => {
  let calls = 0, release;
  const service = createTrendsService({ now: () => 1000, loader: async () => { calls++; await new Promise(resolve => { release = resolve; }); return success(); } });
  const a = service(), b = service(); release();
  const result = await a; await b; assert.equal(calls, 1);
  result.tokens[0].id = 'changed';
  assert.equal((await service()).tokens[0].id, 'bitcoin'); assert.equal(calls, 1);
});
test('failed refresh preserves old snapshot only with explicit offline/stale status', async () => {
  let time = 1000, calls = 0;
  const service = createTrendsService({ now: () => time, freshMs: 100, staleMs: 1000, retryMs: 50, loader: async () => ++calls === 1 ? success() : failure() });
  await service(); time += 101;
  const result = await service();
  assert.equal(result.disponivel, false); assert.equal(result.stale, true); assert.equal(result.modulos.tokens.disponivel, false); assert.equal(result.tokens.length, 1);
  assert.equal(result.atualizadoEm, '2026-10-15T00:00:00Z');
  await service(); assert.equal(calls, 2);
});
test('expired snapshot is not indefinitely presented as usable data', async () => {
  let time = 1000, calls = 0;
  const service = createTrendsService({ now: () => time, freshMs: 100, staleMs: 1000, retryMs: 10, loader: async () => ++calls === 1 ? success() : failure() });
  await service(); time += 1001; const result = await service();
  assert.equal(result.disponivel, false); assert.equal(result.stale, false); assert.deepEqual(result.tokens, []);
});
test('provider rate limit uses backoff, not one request per page refresh', async () => {
  let time = 1000, calls = 0;
  const service = createTrendsService({ now: () => time, loader: async () => { calls++; return { ...failure(), retryAfterSeconds: 300 }; } });
  await service(); time += 60000; await service(); assert.equal(calls, 1);
  time += 300000; await service(); assert.equal(calls, 2);
});
test('loader exception also respects retry delay and never fabricates data', async () => {
  let calls = 0;
  const service = createTrendsService({ now: () => 1000, loader: async () => { calls++; throw Error('offline'); } });
  const result = await service(); await service();
  assert.equal(result.disponivel, false); assert.deepEqual(result.tokens, []); assert.equal(calls, 1);
});
test('recovery replaces stale state with a new valid read', async () => {
  let time = 1000, calls = 0;
  const service = createTrendsService({ now: () => time, freshMs: 100, retryMs: 50, loader: async () => ++calls === 2 ? failure() : success() });
  await service(); time += 101; assert.equal((await service()).stale, true); time += 51;
  assert.equal((await service()).stale, false); assert.equal(calls, 3);
});
test('Demo and Pro keys use fixed hosts and headers, never public payload or query params', async () => {
  for (const pro of [false, true]) {
    let sent;
    const result = await getJeniosTrends({ env: pro ? { COINGECKO_PRO_API_KEY: 'secret-value' } : { COINGECKO_DEMO_API_KEY: 'secret-value' }, fetchImpl: async (url, options) => { sent = { url, options }; return { ok: true, json: async () => ({ coins: [coin] }) }; } });
    assert.equal(sent.url, 'https://' + (pro ? 'pro-api' : 'api') + '.coingecko.com/api/v3/search/trending');
    assert.equal(sent.options.headers[pro ? 'x-cg-pro-api-key' : 'x-cg-demo-api-key'], 'secret-value');
    assert.equal(sent.options.redirect, 'error'); assert.ok(!JSON.stringify(result).includes('secret-value'));
  }
});
test('429 and authorization errors remain explicit without exposing upstream body', async () => {
  for (const status of [429, 401, 403]) {
    const result = await getJeniosTrends({ env: {}, fetchImpl: async () => ({ ok: false, status }) });
    assert.equal(result.disponivel, false); assert.equal(result.retryAfterSeconds, status === 429 ? 300 : 60);
    assert.equal(result.modulos.megapulse.disponivel, false); assert.equal(result.modulos.baleias.disponivel, false);
  }
});
test('normalizer removes duplicates, invalid IDs and overlong labels', () => {
  const result = normalizeCoinGeckoTrending({ coins: [coin, coin, { item: { ...coin.item, id: '../evil' } }, { item: { ...coin.item, id: 'long', name: 'x'.repeat(161) } }] });
  assert.equal(result.length, 1);
});
test('page guards stale responses, hidden tab polling and stale data labels', () => {
  const source = readFileSync(new URL('../app/tendencias/page.js', import.meta.url), 'utf8');
  assert.match(source, /AbortController/); assert.match(source, /epoch.current/); assert.match(source, /visibilityState/); assert.match(source, /DADOS DA ÚLTIMA LEITURA/);
  assert.doesNotMatch(source, /FONTE ONLINE/);
});
test('legacy dashboard no longer calls aggregate volume an institutional detection or new token', () => {
  const source = readFileSync(new URL('../app/dashboard/page.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /Fluxo Institucional Detectado|Influxo de Capital Ativo|ATIVOS RECENTES|FLUXO MACRO EM TEMPO REAL/);
  assert.match(source, /\/api\/tendencias/); assert.match(source, /Volume agregado de 24h não comprova/);
});
