/** Ephemeral local TLS and public protocol declarations only. No private core,
 * deployment, hosted database or independent runtime evidence is used here.
 */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFile, execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:https';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createR70PreflightFixture } from './fixtures/r70-preflight-fixture.mjs';
import { createR70PreflightClient } from '../lib/platform/research/robot-r70-preflight-client.mjs';
import { createR69HttpsPreflightPoster } from '../lib/platform/research/robot-r69-https-transport.mjs';
import { createR70PreflightResponse, verifyR70PreflightRequest, r70TargetPinsDigest,
  R70_PREFLIGHT_PATH } from '../lib/platform/research/robot-r70-preflight-protocol.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
let directory, caPath, certificate;
const denied = (fn, code) => assert.throws(fn, error => error.code === code);
before(() => {
  directory = mkdtempSync(join(tmpdir(), 'jenios-r70-preflight-tls-'));
  const caKey = join(directory, 'ca.key'), key = join(directory, 'server.key');
  const cert = join(directory, 'server.pem'), csr = join(directory, 'server.csr'), ext = join(directory, 'server.ext');
  caPath = join(directory, 'ca.pem');
  const run = args => execFileSync('openssl', args, { stdio: 'ignore' });
  run(['req', '-x509', '-newkey', 'rsa:2048', '-sha256', '-nodes', '-days', '1',
    '-subj', '/CN=R70 public local fixture CA', '-addext', 'basicConstraints=critical,CA:TRUE',
    '-keyout', caKey, '-out', caPath]);
  run(['req', '-new', '-newkey', 'rsa:2048', '-sha256', '-nodes', '-subj', '/CN=127.0.0.1', '-keyout', key, '-out', csr]);
  writeFileSync(ext, 'subjectAltName=IP:127.0.0.1\nbasicConstraints=critical,CA:FALSE\nextendedKeyUsage=serverAuth\n');
  run(['x509', '-req', '-in', csr, '-CA', caPath, '-CAkey', caKey, '-CAcreateserial',
    '-out', cert, '-days', '1', '-sha256', '-extfile', ext]);
  certificate = { key: readFileSync(key), cert: readFileSync(cert) };
});
after(() => { if (directory) rmSync(directory, { recursive: true, force: true }); });

async function server(t, handler) {
  const instance = createServer(certificate, handler);
  await new Promise(resolve => instance.listen(0, '127.0.0.1', resolve));
  t.after(async () => { instance.closeAllConnections(); await new Promise(resolve => instance.close(resolve)); });
  return 'https://127.0.0.1:' + instance.address().port;
}
async function child(config, { count = 1, helperBody } = {}) {
  const source = `
    import {createR70PreflightClient} from './lib/platform/research/robot-r70-preflight-client.mjs';
    import {createR69HttpsPreflightPoster} from './lib/platform/research/robot-r69-https-transport.mjs';
    let raw='';for await(const bytes of process.stdin)raw+=bytes;const input=JSON.parse(raw);
    try{
      if(input.helperBody!==undefined){const post=createR69HttpsPreflightPoster(input.config);await post(input.helperBody);}
      else {const probe=createR70PreflightClient(input.config);const results=[];
        for(let i=0;i<input.count;i++)results.push(await probe());
        process.stdout.write(JSON.stringify({ok:true,results}));}
    }catch(error){process.stdout.write(JSON.stringify({ok:false,code:error.code||'UNEXPECTED'}));}
  `;
  return await new Promise((resolve, reject) => {
    const processChild = execFile(process.execPath, ['--input-type=module', '-e', source],
      { cwd: root, env: { PATH: process.env.PATH || '/usr/bin:/bin', NODE_EXTRA_CA_CERTS: caPath },
        timeout: 10000, maxBuffer: 65536 }, (error, stdout) => {
        if (error) reject(error); else { try { resolve(JSON.parse(stdout)); } catch (error) { reject(error); } }
      });
    processChild.stdin.end(JSON.stringify({ config, count, ...(helperBody === undefined ? {} : { helperBody }) }));
  });
}
const clientConfig = f => ({ targetPins: f.targetPins, trustedSource: f.trustedSource, privateKeyPem: f.privateKeyPem });
async function incoming(req) {
  const parts = []; for await (const part of req) parts.push(part);
  return { text: Buffer.concat(parts).toString('utf8'), headers: req.headers, path: req.url };
}

test('R70 client has closed configuration and no clock nonce transport credentials or TLS overrides', () => {
  const f = createR70PreflightFixture(), config = clientConfig(f);
  assert.equal(typeof createR70PreflightClient(config), 'function');
  for (const key of ['nowMs', 'nonce', 'fetch', 'headers', 'ca', 'env', 'lookup', 'agent', 'path', 'rejectUnauthorized'])
    denied(() => createR70PreflightClient({ ...config, [key]: 'forbidden' }), 'R70_PREFLIGHT_CLIENT_CONFIG');
  let reads = 0;
  denied(() => createR70PreflightClient({ ...config, get targetPins() { reads++; return config.targetPins; } }), 'R70_PREFLIGHT_CLIENT_CONFIG');
  assert.equal(reads, 0);
  denied(() => createR69HttpsPreflightPoster({ origin: f.targetPins.origin, path: '/other' }), 'R69_HTTPS_CONFIG');
});

test('R70 real TLS probes sign fresh nonces and use only the fixed challenge path with sanitized match results', async t => {
  let f; const seen = [];
  const origin = await server(t, async (req, res) => {
    const row = await incoming(req), signed = JSON.parse(row.text); seen.push({ ...row, signed });
    verifyR70PreflightRequest(signed, { trustedSource: f.trustedSource });
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(createR70PreflightResponse(signed, { targetPins: f.targetPins, trustedSource: f.trustedSource })));
  });
  f = createR70PreflightFixture({ origin });
  const result = await child(clientConfig(f), { count: 2 });
  assert.equal(result.ok, true); assert.equal(seen.length, 2);
  assert.notEqual(seen[0].signed.payload.nonce, seen[1].signed.payload.nonce);
  for (const row of seen) {
    assert.equal(row.path, R70_PREFLIGHT_PATH); assert.ok(Buffer.byteLength(row.text) <= 4096);
    for (const name of ['authorization', 'apikey', 'cookie', 'x-vercel-protection-bypass']) assert.equal(row.headers[name], undefined);
    assert.deepEqual(Object.keys(row.signed.payload).sort(), ['expiresAtMs', 'issuedAtMs', 'nonce', 'schema', 'targetPins']);
  }
  for (const report of result.results) {
    assert.equal(report.status, 'CONFIGURATION_MATCH'); assert.equal(report.targetPinsSha256, r70TargetPinsDigest(f.targetPins));
    assert.equal(report.targetClassification, 'LOCAL_TLS_ACCEPTANCE_FIXTURE');
    assert.equal(report.remoteQaDeploymentVerified, false); assert.equal(report.operationalReady, false);
    assert.equal(report.configuredSourceChallengeSigned, true);
    for (const field of ['nonce', 'targetPins', 'signatureBase64', 'privateKeyPem', 'publicKeyPem', 'scopeId'])
      assert.equal(Object.hasOwn(report, field), false);
  }
});

test('R70 TLS responses cannot substitute nonce destination capabilities or server clock', async t => {
  let f, change; let requests = 0;
  const origin = await server(t, async (req, res) => {
    requests++; const row = await incoming(req), signed = JSON.parse(row.text);
    const result = structuredClone(createR70PreflightResponse(signed, { targetPins: f.targetPins, trustedSource: f.trustedSource }));
    change(result); res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(result));
  });
  f = createR70PreflightFixture({ origin });
  for (const [mutate, code] of [
    [value => { value.nonce = '0'.repeat(64); }, 'R70_PREFLIGHT_RESPONSE_BINDING'],
    [value => { value.targetPins.deploymentId = 'dpl_other'; }, 'R70_PREFLIGHT_RESPONSE_BINDING'],
    [value => { value.remoteQaDeploymentVerified = true; }, 'R70_PREFLIGHT_RESPONSE'],
    [value => { value.observedAtMs += 5000; }, 'R70_PREFLIGHT_RESPONSE_TIME'],
  ]) {
    change = mutate; const result = await child(clientConfig(f));
    assert.equal(result.ok, false); assert.equal(result.code, code);
  }
  assert.equal(requests, 4);
});

test('R70 shared TLS engine accepts only 200 for preflight and refuses malformed JSON and an unfinished response', async t => {
  let mode = 202;
  const origin = await server(t, async (req, res) => {
    await incoming(req);
    if (mode === 'silent') return;
    res.writeHead(mode === 'json' ? 200 : mode, { 'content-type': 'application/json' }); res.end('{');
  });
  const f = createR70PreflightFixture({ origin });
  for (const value of [202, 401, 409, 503, 'json', 'silent']) {
    mode = value; const result = await child({ ...clientConfig(f), timeoutMs: 100 });
    assert.equal(result.ok, false);
    assert.equal(result.code, value === 'json' ? 'R70_PREFLIGHT_RESPONSE_JSON' :
      value === 'silent' ? 'R69_HTTPS_REQUEST_UNCONFIRMED' : 'R69_HTTPS_RESPONSE_STATUS');
  }
});

test('R70 closed-path poster refuses a body above 4096 bytes before opening an HTTP request', async t => {
  let requests = 0;
  const origin = await server(t, (req, res) => { requests++; req.resume(); res.end(); });
  const result = await child({ origin }, { helperBody: 'x'.repeat(4097) });
  assert.equal(result.ok, false); assert.equal(result.code, 'R70_PREFLIGHT_REQUEST_TOO_LARGE');
  assert.equal(requests, 0);
});
