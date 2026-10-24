/** Public protocol fixtures only. TLS peers and CAs are ephemeral local tests;
 * no private executable, hosted deployment or real identity is attested here. */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:https';
import { createServer as createTcpServer } from 'node:net';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createR69HttpsObservationSender, R69_HTTPS_LIMITS,
  R69_HTTPS_TRANSPORT_BOUNDARIES } from '../lib/platform/research/robot-r69-https-transport.mjs';
import { canonicalR67Json, verifyR67PrivateObservationRecord, createR67IntakeAcknowledgement,
  inspectR67IntakeAcknowledgement } from '../lib/platform/research/robot-r67-private-protocol.mjs';
import { createR67ProtocolFixture, R67_PROTOCOL_FIXTURE_KIND } from './fixtures/r67-private-protocol-fixture.mjs';

const root = fileURLToPath(new URL('../', import.meta.url)), execute = promisify(execFile);
const denied = (fn, code) => assert.throws(fn, error => error.code === code);
let tlsDirectory, caFile, serverKey, goodCertificate, wrongCertificate, untrustedCertificate;
async function openssl(args) { await execute('openssl', args, { timeout: 10000, maxBuffer: 65536 }); }
before(async () => {
  tlsDirectory = mkdtempSync('/tmp/jenios-r69-https-');
  const caKey = join(tlsDirectory, 'ca.key'); caFile = join(tlsDirectory, 'ca.pem');
  const key = join(tlsDirectory, 'server.key'), csr = join(tlsDirectory, 'server.csr');
  await openssl(['req', '-x509', '-newkey', 'rsa:2048', '-sha256', '-nodes', '-days', '1',
    '-subj', '/CN=JENIOS R69 ephemeral test CA', '-addext', 'basicConstraints=critical,CA:TRUE',
    '-addext', 'keyUsage=critical,keyCertSign,cRLSign', '-keyout', caKey, '-out', caFile]);
  await openssl(['req', '-new', '-newkey', 'rsa:2048', '-sha256', '-nodes',
    '-subj', '/CN=127.0.0.1', '-keyout', key, '-out', csr]);
  for (const [name, san, serial] of [['good', 'IP:127.0.0.1,DNS:localhost', '1'],
    ['wrong', 'DNS:wrong-r69.example.invalid', '2']]) {
    const ext = join(tlsDirectory, name + '.ext');
    writeFileSync(ext, `subjectAltName=${san}\nbasicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\n`, { mode: 0o600 });
    await openssl(['x509', '-req', '-in', csr, '-CA', caFile, '-CAkey', caKey, '-set_serial', serial,
      '-out', join(tlsDirectory, name + '.pem'), '-days', '1', '-sha256', '-extfile', ext]);
  }
  await openssl(['req', '-x509', '-key', key, '-sha256', '-days', '1', '-subj', '/CN=127.0.0.1',
    '-addext', 'subjectAltName=IP:127.0.0.1', '-addext', 'basicConstraints=critical,CA:FALSE',
    '-out', join(tlsDirectory, 'untrusted.pem')]);
  serverKey = readFileSync(key); goodCertificate = readFileSync(join(tlsDirectory, 'good.pem'));
  wrongCertificate = readFileSync(join(tlsDirectory, 'wrong.pem'));
  untrustedCertificate = readFileSync(join(tlsDirectory, 'untrusted.pem'));
});
after(() => { if (tlsDirectory) rmSync(tlsDirectory, { force: true, recursive: true }); });

async function server(t, handler, certificate = goodCertificate) {
  const s = createServer({ key: serverKey, cert: certificate, requestTimeout: 10000, headersTimeout: 10000 }, handler);
  s.on('tlsClientError', () => {});
  await new Promise((resolve, reject) => { s.once('error', reject); s.listen(0, '127.0.0.1', resolve); });
  t.after(async () => { s.closeAllConnections(); await new Promise(resolve => s.close(resolve)); });
  return 'https://127.0.0.1:' + s.address().port;
}
const childCode = `
  import { createR69HttpsObservationSender } from './lib/platform/research/robot-r69-https-transport.mjs';
  const chunks=[]; for await(const chunk of process.stdin) chunks.push(chunk);
  const input=JSON.parse(Buffer.concat(chunks).toString('utf8'));
  const began=performance.now();
  try {
    const send=createR69HttpsObservationSender(input.config);
    if(input.disableTlsAfterConstruction) process.env.NODE_TLS_REJECT_UNAUTHORIZED='0';
    const response=await send(input.record);
    process.stdout.write(JSON.stringify({ok:true,nativeResponse:response instanceof Response,
      status:response.status,redirected:response.redirected,type:response.headers.get('content-type'),
      body:await response.text(),elapsedMs:performance.now()-began}));
  } catch(error) { process.stdout.write(JSON.stringify({ok:false,code:error.code,
      message:error.message,elapsedMs:performance.now()-began})); }
`;
function sendInChild(config, record, options = {}) {
  // Extra CA trust is present at process startup. No CA is passed to the sender.
  const env = { PATH: process.env.PATH || '/usr/bin:/bin',
    ...(options.trustCa === false ? {} : { NODE_EXTRA_CA_CERTS: caFile }), ...(options.env ?? {}) };
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--input-type=module', '-e', childCode], { cwd: root, env,
      stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    const timer = setTimeout(() => { child.kill('SIGKILL'); reject(Error('R69_TEST_CHILD_TIMEOUT')); }, 10000);
    child.stdout.on('data', chunk => { stdout += chunk; if (stdout.length > 20000) child.kill('SIGKILL'); });
    child.stderr.on('data', chunk => { stderr += chunk; if (stderr.length > 20000) child.kill('SIGKILL'); });
    child.once('error', cause => { clearTimeout(timer); reject(cause); });
    child.once('close', code => {
      clearTimeout(timer);
      if (code !== 0) { reject(Error('R69_TEST_CHILD_FAILED ' + stderr)); return; }
      try { resolve({ ...JSON.parse(stdout), stderr }); } catch (cause) { reject(cause); }
    });
    child.stdin.on('error', () => {});
    child.stdin.end(JSON.stringify({ config, record, disableTlsAfterConstruction: options.disableTlsAfterConstruction === true }));
  });
}
async function fixture() {
  const f = await createR67ProtocolFixture(); assert.equal(f.fixtureEvidence, R67_PROTOCOL_FIXTURE_KIND); return f;
}
function ack(record, trustedSource, status = 'STORED') {
  const verified = verifyR67PrivateObservationRecord(record, { trustedSource, nowMs: Date.now() });
  return createR67IntakeAcknowledgement({ receipt: verified.receipt, record: verified.record }, status);
}

test('R69 admits only canonical declared HTTPS origins and blocks known production aliases including root dots', async () => {
  const f = await fixture();
  for (const origin of ['http://127.0.0.1:4320', 'https://127.0.0.1:4320/', 'https://qa.example.invalid/path',
    'https://qa.example.invalid?token=x', 'https://qa.example.invalid#fragment', 'https://user:secret@qa.example.invalid',
    'https://qa.example.invalid:443', 'https://QA.example.invalid', ' https://qa.example.invalid', {}])
    denied(() => createR69HttpsObservationSender({ origin, trustedSource: f.trustedSource }), 'R69_HTTPS_ORIGIN_REQUIRED');
  for (const origin of ['https://jenios.com.br', 'https://www.jenios.com.br', 'https://jenios.com.br.',
    'https://www.jenios.com.br.', 'https://jenios.com.br.:8443', 'https://jenios.com.br..'])
    denied(() => createR69HttpsObservationSender({ origin, trustedSource: f.trustedSource }), 'R69_HTTPS_PRODUCTION_ORIGIN_FORBIDDEN');
  assert.equal(typeof createR69HttpsObservationSender({ origin: 'https://qa.example.invalid', trustedSource: f.trustedSource }), 'function');
  assert.equal(R69_HTTPS_TRANSPORT_BOUNDARIES.targetDeploymentQaVerified, false);
  assert.equal(R69_HTTPS_TRANSPORT_BOUNDARIES.operationalActivationAuthorized, false);
  assert.equal(R69_HTTPS_TRANSPORT_BOUNDARIES.productionAliasBlockIsExhaustive, false);
});

test('R69 rejects injected transports, credentials, CA and TLS overrides plus malformed deadlines without calling getters', async () => {
  const f = await fixture(), config = { origin: 'https://qa.example.invalid', trustedSource: f.trustedSource };
  for (const key of ['fetch', 'lookup', 'agent', 'headers', 'ca', 'rejectUnauthorized', 'checkServerIdentity', 'servername', 'path', 'env'])
    denied(() => createR69HttpsObservationSender({ ...config, [key]: 'forbidden' }), 'R69_HTTPS_CONFIG');
  for (const timeoutMs of [0, 49, 10001, NaN, 1.5, null])
    denied(() => createR69HttpsObservationSender({ ...config, timeoutMs }), 'R69_HTTPS_TIMEOUT_INVALID');
  let calls = 0;
  const getter = { trustedSource: f.trustedSource, get origin() { calls++; return config.origin; } };
  denied(() => createR69HttpsObservationSender(getter), 'R69_HTTPS_CONFIG'); assert.equal(calls, 0);
  denied(() => createR69HttpsObservationSender({ ...config, trustedSource: { ...f.trustedSource, enabled: false } }), 'R67_TRUST_ROOT');
  assert.equal(R69_HTTPS_LIMITS.requestBytes, 262144); assert.equal(R69_HTTPS_LIMITS.responseBytes, 8192);
});

test('R69 performs real trusted TLS and sends the exact signed fixture to the fixed R67 path without HTTP credentials', async t => {
  const f = await fixture(); let received = null;
  const origin = await server(t, async (req, res) => {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    received = { body: Buffer.concat(chunks).toString('utf8'), path: req.url, method: req.method,
      headers: req.headers, encrypted: req.socket.encrypted };
    res.writeHead(202, { 'content-type': 'application/json' }); res.end(JSON.stringify(ack(f.record, f.trustedSource)));
  });
  const result = await sendInChild({ origin, trustedSource: f.trustedSource }, f.record);
  assert.equal(result.ok, true); assert.equal(result.nativeResponse, true); assert.equal(result.redirected, false);
  assert.equal(received.encrypted, true); assert.equal(received.method, 'POST');
  assert.equal(received.path, '/api/platform/robot-private-observations'); assert.equal(received.body, canonicalR67Json(f.record));
  for (const key of ['authorization', 'apikey', 'cookie', 'x-vercel-protection-bypass']) assert.equal(received.headers[key], undefined);
  assert.equal(inspectR67IntakeAcknowledgement(JSON.parse(result.body), f.record, result.status).body.captureCount, 3);
});

test('R69 rejects an untrusted CA and a trusted certificate with the wrong hostname before any HTTP request', async t => {
  const f = await fixture(); let requests = 0;
  const handler = (req, res) => { requests++; req.resume(); res.writeHead(202, { 'content-type': 'application/json' }); res.end('{}'); };
  const good = await server(t, handler), wrong = await server(t, handler, wrongCertificate), untrusted = await server(t, handler, untrustedCertificate);
  for (const [origin, options] of [[good, { trustCa: false }], [wrong, {}], [untrusted, {}]]) {
    const result = await sendInChild({ origin, trustedSource: f.trustedSource }, f.record, options);
    assert.equal(result.ok, false); assert.equal(result.code, 'R69_HTTPS_REQUEST_UNCONFIRMED');
    assert.equal(result.message.includes('127.0.0.1'), false);
  }
  assert.equal(requests, 0);
});

test('R69 refuses disabled TLS verification at construction and again before a send', async t => {
  const f = await fixture(); let requests = 0;
  const origin = await server(t, (req, res) => { requests++; req.resume(); res.end(); });
  for (const options of [{ env: { NODE_TLS_REJECT_UNAUTHORIZED: '0' } }, { disableTlsAfterConstruction: true }]) {
    const result = await sendInChild({ origin, trustedSource: f.trustedSource }, f.record, options);
    assert.equal(result.ok, false); assert.equal(result.code, 'R69_HTTPS_TLS_VERIFICATION_REQUIRED');
  }
  assert.equal(requests, 0);
});

test('R69 refuses redirects without opening another path or peer', async t => {
  const f = await fixture(); let first = 0, target = 0;
  const redirected = await server(t, (req, res) => { target++; req.resume(); res.end(); });
  const origin = await server(t, (req, res) => { first++; req.resume(); res.writeHead(307, { location: redirected + '/other' }); res.end(); });
  const result = await sendInChild({ origin, trustedSource: f.trustedSource }, f.record);
  assert.equal(result.ok, false); assert.equal(result.code, 'R69_HTTPS_REDIRECT_FORBIDDEN');
  assert.equal(first, 1); assert.equal(target, 0);
});

test('R69 total deadline aborts silent TLS handshake, response headers and a continuously arriving unfinished body', async t => {
  const f = await fixture(), sockets = new Set();
  const tcp = createTcpServer(socket => { sockets.add(socket); socket.on('error', () => {}); socket.once('close', () => sockets.delete(socket)); });
  await new Promise(resolve => tcp.listen(0, '127.0.0.1', resolve));
  t.after(async () => { for (const socket of sockets) socket.destroy(); await new Promise(resolve => tcp.close(resolve)); });
  const silentTls = 'https://127.0.0.1:' + tcp.address().port;
  const silentHeaders = await server(t, req => { req.resume(); });
  const ongoingBody = await server(t, (req, res) => {
    req.resume(); res.writeHead(202, { 'content-type': 'application/json' }); res.write('{');
    const timer = setInterval(() => res.write(' '), 10); res.once('close', () => clearInterval(timer));
  });
  for (const origin of [silentTls, silentHeaders, ongoingBody]) {
    const result = await sendInChild({ origin, trustedSource: f.trustedSource, timeoutMs: 150 }, f.record);
    assert.equal(result.ok, false); assert.equal(result.code, 'R69_HTTPS_REQUEST_UNCONFIRMED');
    assert.ok(result.elapsedMs >= 100 && result.elapsedMs < 2500, String(result.elapsedMs));
  }
});

test('R69 bounds advertised and chunked response bytes and refuses a truncated HTTP message', async t => {
  const f = await fixture();
  const declared = await server(t, (req, res) => { req.resume(); res.writeHead(202, {
    'content-type': 'application/json', 'content-length': '8193' }); res.flushHeaders(); });
  const chunked = await server(t, (req, res) => { req.resume(); res.writeHead(202, { 'content-type': 'application/json' });
    res.write(' '.repeat(8192)); res.end(' '); });
  for (const origin of [declared, chunked]) {
    const result = await sendInChild({ origin, trustedSource: f.trustedSource }, f.record);
    assert.equal(result.ok, false); assert.equal(result.code, 'R69_HTTPS_RESPONSE_TOO_LARGE');
  }
  const truncated = await server(t, (req, res) => { req.resume(); res.writeHead(202, {
    'content-type': 'application/json', 'content-length': '100' }); res.write('{}'); setImmediate(() => res.destroy()); });
  const result = await sendInChild({ origin: truncated, trustedSource: f.trustedSource }, f.record);
  assert.equal(result.ok, false); assert.equal(result.code, 'R69_HTTPS_REQUEST_UNCONFIRMED');
});

test('R69 never opens HTTP for expired, future, oversized or invalidly signed records', async t => {
  const f = await fixture(); let requests = 0;
  const origin = await server(t, (req, res) => { requests++; req.resume(); res.end(); });
  const expired = await createR67ProtocolFixture({ nowMs: Date.now() - 120000, privateKeyPem: f.privateKeyPem });
  const future = await createR67ProtocolFixture({ nowMs: Date.now() + 60000, privateKeyPem: f.privateKeyPem });
  const forged = JSON.parse(JSON.stringify(f.record)); forged.envelope.signatureBase64 = 'A'.repeat(86) + '==';
  const oversized = { ...f.record, padding: Array.from({ length: 5 }, () => 'x'.repeat(60000)) };
  for (const [record, code] of [[expired.record, 'R67_RECORD_TIME'], [future.record, 'R67_RECORD_TIME'],
    [forged, 'R67_PAYLOAD_SIGNATURE'], [oversized, 'R67_RECORD_TOO_LARGE']]) {
    const result = await sendInChild({ origin, trustedSource: f.trustedSource }, record);
    assert.equal(result.ok, false); assert.equal(result.code, code);
  }
  assert.equal(requests, 0);
});

test('R69 ignores ambient proxy configuration and keeps ACK binding exclusively in the existing R67 validator', async t => {
  const f = await fixture(); let requests = 0, proxyConnections = 0;
  const proxy = createTcpServer(socket => { proxyConnections++; socket.destroy(); });
  await new Promise(resolve => proxy.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => proxy.close(resolve)));
  const origin = await server(t, (req, res) => { requests++; req.resume(); res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ...ack(f.record, f.trustedSource, 'ALREADY_STORED'), recordDigest: '0'.repeat(64) })); });
  const proxyOrigin = 'http://127.0.0.1:' + proxy.address().port;
  const result = await sendInChild({ origin, trustedSource: f.trustedSource }, f.record,
    { env: { NODE_USE_ENV_PROXY: '1', HTTPS_PROXY: proxyOrigin, https_proxy: proxyOrigin, NO_PROXY: '' } });
  assert.equal(result.ok, true); assert.equal(result.nativeResponse, true);
  denied(() => inspectR67IntakeAcknowledgement(JSON.parse(result.body), f.record, result.status), 'R67_OUTBOX_ACK_BINDING');
  assert.equal(requests, 1); assert.equal(proxyConnections, 0);
});
