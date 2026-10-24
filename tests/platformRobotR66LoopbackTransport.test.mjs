import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { generateKeyPairSync } from 'node:crypto';
import { createR66LoopbackObservationSender, R66_OBSERVATION_PATH } from '../lib/platform/research/robot-r66-loopback-transport.mjs';
import { createR65ObservationSource } from '../lib/platform/research/robot-r65-observation-source.mjs';
import { createR65EvolutionState } from '../lib/platform/research/robot-r65-evolution-engine.mjs';

function fixture() {
  const { privateKey } = generateKeyPairSync('ed25519');
  const scopeId = 'scope:0000000000000066', sessionId = 'session:0000000000000066';
  const state = createR65EvolutionState({ scopeId, nowMs: Date.now() - 10000 });
  const source = createR65ObservationSource({ enabled: true, domain: 'R61_SYNTHETIC_RUNTIME',
    scopeId, sourceId: 'source:0000000000000066', sessionId, initialSequence: 1,
    privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }), getActiveState: () => state,
    ultraConfig: { evidenceKind: 'SYNTHETIC_FIXTURE', sessionId,
      planCode: 'platform-global-crypto', symbol: 'BTC-USD', capital: 1000, leverage: 2 } });
  const record = source.captureAssisted({ operationId: 'op:' + '1'.repeat(32),
    input: { source: 'synthetic_fixture', mode: 'manual', operatorSide: 'buy', technicalSide: 'sell', confidence: 0.85 } });
  return { source, record };
}

async function serve(run, operation) {
  const server = createServer(run);
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  try { return await operation('http://127.0.0.1:' + server.address().port); }
  finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}

test('R66 sender rejects hosted, DNS, noncanonical, credential-bearing and path targets before network', () => {
  const { source } = fixture();
  for (const origin of ['https://jenios.com.br', 'http://localhost:4567', 'http://127.0.0.1:4567/',
    'http://127.0.0.1:4567/path', 'http://127.0.0.1:4567?x=1', 'http://127.0.0.1:4567#x',
    'http://u:p@127.0.0.1:4567', 'http://127.1:4567', 'http://127.0.0.1', 'https://127.0.0.1:4567'])
    assert.throws(() => createR66LoopbackObservationSender({ origin, trustedSource: source.trustedSource }),
      { code: 'R66_LOOPBACK_ORIGIN_REQUIRED' });
  for (const timeoutMs of [0, 49, 10001, NaN, '100']) assert.throws(() =>
    createR66LoopbackObservationSender({ origin: 'http://127.0.0.1:4567', trustedSource: source.trustedSource, timeoutMs }),
    { code: 'R66_LOOPBACK_TIMEOUT_INVALID' });
});

test('R66 sender posts the signed observation to the fixed local route and carries response unchanged', async () => {
  const { source, record } = fixture();
  let requests = 0;
  await serve(async (request, response) => {
    requests++;
    assert.equal(request.method, 'POST'); assert.equal(request.url, R66_OBSERVATION_PATH);
    assert.equal(request.headers.authorization, undefined);
    const bytes = []; for await (const chunk of request) bytes.push(chunk);
    assert.deepEqual(JSON.parse(Buffer.concat(bytes).toString()), record);
    response.writeHead(202, { 'content-type': 'application/json' }); response.end('{"status":"fixture"}');
  }, async origin => {
    const send = createR66LoopbackObservationSender({ origin, trustedSource: source.trustedSource });
    const response = await send(record);
    assert.equal(response.status, 202); assert.deepEqual(await response.json(), { status: 'fixture' });
  });
  assert.equal(requests, 1);
});

test('R66 sender rejects altered signatures without making any HTTP request', async () => {
  const { source, record } = fixture(); let requests = 0;
  await serve((request, response) => { requests++; response.end('{}'); }, async origin => {
    const changed = structuredClone(record); changed.envelope.payload.event.decision = 'ALLOW';
    const send = createR66LoopbackObservationSender({ origin, trustedSource: source.trustedSource });
    await assert.rejects(send(changed));
  });
  assert.equal(requests, 0);
});

test('R66 sender does not follow a redirect, including a redirect to another loopback path', async () => {
  const { source, record } = fixture(); let requests = 0;
  await serve((request, response) => {
    requests++; response.writeHead(307, { location: '/redirected' }); response.end();
  }, async origin => {
    const send = createR66LoopbackObservationSender({ origin, trustedSource: source.trustedSource });
    await assert.rejects(send(record), { code: 'R66_LOOPBACK_REQUEST_UNCONFIRMED' });
  });
  assert.equal(requests, 1);
});

test('R66 sender bounds an oversized response and never reports a successful acknowledgement', async () => {
  const { source, record } = fixture();
  await serve((request, response) => {
    response.writeHead(202, { 'content-type': 'application/json' }); response.end('x'.repeat(4097));
  }, async origin => {
    const send = createR66LoopbackObservationSender({ origin, trustedSource: source.trustedSource });
    await assert.rejects(send(record), { code: 'R66_LOOPBACK_RESPONSE_TOO_LARGE' });
  });
});

test('R66 sender deadline covers a body that never completes, after valid HTTP headers', async () => {
  const { source, record } = fixture();
  await serve((request, response) => {
    response.writeHead(202, { 'content-type': 'application/json' }); response.write('{');
  }, async origin => {
    const send = createR66LoopbackObservationSender({ origin, trustedSource: source.trustedSource, timeoutMs: 100 });
    await assert.rejects(send(record), { code: 'R66_LOOPBACK_REQUEST_UNCONFIRMED' });
  });
});
