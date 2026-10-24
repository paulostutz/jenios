/** Process-only R69 acceptance client. Every target is ephemeral loopback TLS.
 * Trust is installed at process startup with NODE_EXTRA_CA_CERTS, never by
 * disabling verification or changing the production sender's options.
 */
import assert from 'node:assert/strict';
import { createR69HttpsObservationSender } from '../../lib/platform/research/robot-r69-https-transport.mjs';

let size = 0, input = '';
for await (const chunk of process.stdin) {
  size += chunk.length;
  if (size > 524288) throw Error('R69_FIXTURE_INPUT_LIMIT');
  input += chunk;
}
try {
  const command = JSON.parse(input), origin = new URL(command.origin);
  assert.equal(origin.protocol, 'https:'); assert.equal(origin.hostname, '127.0.0.1');
  assert.equal(origin.origin, command.origin); assert.equal(origin.username, '');
  assert.equal(origin.password, ''); assert.ok(origin.port);
  let response;
  if (command.action === 'send') {
    const send = createR69HttpsObservationSender({ origin: command.origin,
      trustedSource: command.trustedSource, timeoutMs: 3000 });
    response = await send(command.record);
  } else {
    assert.equal(command.action, 'request');
    assert.ok(['/api/platform/robot-private-observations',
      '/api/platform/admin/robot-private-observations',
      '/api/platform/admin/robot-private-observations?scopeId=caller-cannot-select'].includes(command.path));
    assert.ok(['GET', 'POST'].includes(command.method || 'GET'));
    const headers = {};
    if (command.token) headers.Authorization = 'Bearer ' + command.token;
    if (command.body !== undefined) headers['Content-Type'] = command.contentType || 'application/json';
    response = await fetch(command.origin + command.path, { method: command.method || 'GET',
      headers, body: command.body === undefined ? undefined : JSON.stringify(command.body),
      redirect: 'manual', signal: AbortSignal.timeout(5000) });
  }
  const text = await response.text(); assert.ok(Buffer.byteLength(text) <= 524288);
  process.stdout.write(JSON.stringify({ ok: true, status: response.status,
    cacheControl: response.headers.get('cache-control'), body: text ? JSON.parse(text) : null }) + '\n');
} catch (error) {
  const code = /^R(?:67|69)_[A-Z0-9_]+$/.test(error?.code || '') ? error.code : 'R69_FIXTURE_REQUEST_UNCONFIRMED';
  process.stdout.write(JSON.stringify({ ok: false, code }) + '\n');
  process.exitCode = 2;
}
