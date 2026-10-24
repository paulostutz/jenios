import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createR67ProtocolFixture } from './fixtures/r67-private-protocol-fixture.mjs';
import { createR67LoopbackObservationSender } from '../lib/platform/research/robot-r67-loopback-transport.mjs';
import { canonicalR67Json, verifyR67PrivateObservationRecord, createR67IntakeAcknowledgement,
  inspectR67IntakeAcknowledgement } from '../lib/platform/research/robot-r67-private-protocol.mjs';
async function server(t, handler) {
  const s = createServer(handler);
  await new Promise(resolve => s.listen(0, '127.0.0.1', resolve));
  t.after(async () => { s.closeAllConnections(); await new Promise(resolve => s.close(resolve)); });
  return 'http://127.0.0.1:' + s.address().port;
}
test('R67 transport refuses hosted URLs, DNS names, aliases, credentials and disabled sources', async () => {
  const f = await createR67ProtocolFixture();
  for (const origin of ['https://example.com', 'http://localhost:4320', 'http://127.1:4320',
    'http://127.0.0.1:4320/', 'http://127.0.0.1:4320/path', 'http://user@127.0.0.1:4320',
    'https://127.0.0.1:4320', 'http://127.0.0.1']) assert.throws(() =>
      createR67LoopbackObservationSender({ origin, trustedSource: f.trustedSource }), /R67_LOOPBACK_ORIGIN_REQUIRED/);
  assert.throws(() => createR67LoopbackObservationSender({ origin: 'http://127.0.0.1:4320',
    trustedSource: { ...f.trustedSource, enabled: false } }), /R67_TRUST_ROOT/);
});
test('R67 sends exact signed batch to its own path and binds complete ACK', async t => {
  const f = await createR67ProtocolFixture(); let received = null;
  const origin = await server(t, async (req, res) => {
    assert.equal(req.method, 'POST'); assert.equal(req.url, '/api/platform/robot-private-observations');
    const chunks = []; for await (const part of req) chunks.push(part);
    received = Buffer.concat(chunks).toString('utf8');
    const verified = verifyR67PrivateObservationRecord(JSON.parse(received), { trustedSource: f.trustedSource, nowMs: Date.now() });
    res.writeHead(202, { 'content-type': 'application/json' });
    res.end(JSON.stringify(createR67IntakeAcknowledgement({ receipt: verified.receipt, record: verified.record }, 'STORED')));
  });
  const send = createR67LoopbackObservationSender({ origin, trustedSource: f.trustedSource });
  const response = await send(f.record), body = await response.json();
  assert.equal(received, canonicalR67Json(f.record));
  assert.equal(inspectR67IntakeAcknowledgement(body, f.record, response.status).body.captureCount, 3);
});
test('R67 refuses redirects without following them or accepting an alternate path', async t => {
  const f = await createR67ProtocolFixture(); let count = 0;
  const origin = await server(t, (req, res) => { count++; res.writeHead(307, { location: '/other' }); res.end(); });
  await assert.rejects(createR67LoopbackObservationSender({ origin, trustedSource: f.trustedSource })(f.record), /R67_LOOPBACK_REQUEST_UNCONFIRMED/);
  assert.equal(count, 1);
});
test('R67 deadline covers a response body that never finishes', async t => {
  const f = await createR67ProtocolFixture();
  const origin = await server(t, (req, res) => { req.resume(); res.writeHead(202, { 'content-type': 'application/json' }); res.write('{'); });
  const started = Date.now();
  await assert.rejects(createR67LoopbackObservationSender({ origin, trustedSource: f.trustedSource, timeoutMs: 100 })(f.record),
    /R67_LOOPBACK_REQUEST_UNCONFIRMED/);
  assert.ok(Date.now() - started < 3000);
});
test('R67 bounds ACK bytes and rejects expired records before HTTP', async t => {
  const f = await createR67ProtocolFixture(); let count = 0;
  const origin = await server(t, (req, res) => { count++; req.resume(); res.writeHead(202, { 'content-type': 'application/json' }); res.end(' '.repeat(8193)); });
  const send = createR67LoopbackObservationSender({ origin, trustedSource: f.trustedSource });
  await assert.rejects(send(f.record), /R67_LOOPBACK_RESPONSE_TOO_LARGE/);
  const old = await createR67ProtocolFixture({ nowMs: Date.now() - 120000, privateKeyPem: f.privateKeyPem });
  await assert.rejects(send(old.record), /R67_RECORD_TIME/);
  assert.equal(count, 1);
});
