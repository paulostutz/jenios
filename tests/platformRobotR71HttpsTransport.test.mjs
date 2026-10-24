/** Real local TLS carrying PUBLIC_PROTOCOL_FIXTURE claims, never private execution. */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFile, execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:https';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createR71ProtocolFixture } from './fixtures/r71-private-protocol-fixture.mjs';
import { createR71SourceStateClient, createR71HttpsObservationSender } from '../lib/platform/research/robot-r71-https-transport.mjs';
import { createR71SourceStateResult, verifyR71SourceStateQuery, verifyR71PrivateObservationRecord,
  createR71IntakeAcknowledgement, R71_STATE_PATH, R71_OBSERVATION_PATH } from '../lib/platform/research/robot-r71-private-protocol.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
let directory, caPath, certificate;
before(() => {
  directory = mkdtempSync(join(tmpdir(), 'jenios-r71-tls-')); caPath = join(directory, 'ca.pem');
  const caKey = join(directory, 'ca.key'), key = join(directory, 'server.key'), cert = join(directory, 'server.pem');
  const csr = join(directory, 'server.csr'), ext = join(directory, 'server.ext');
  const run = args => execFileSync('openssl', args, { stdio: 'ignore' });
  run(['req', '-x509', '-newkey', 'rsa:2048', '-sha256', '-nodes', '-days', '1', '-subj', '/CN=R71 local fixture CA',
    '-addext', 'basicConstraints=critical,CA:TRUE', '-keyout', caKey, '-out', caPath]);
  run(['req', '-new', '-newkey', 'rsa:2048', '-sha256', '-nodes', '-subj', '/CN=127.0.0.1', '-keyout', key, '-out', csr]);
  writeFileSync(ext, 'subjectAltName=IP:127.0.0.1\nbasicConstraints=critical,CA:FALSE\nextendedKeyUsage=serverAuth\n');
  run(['x509', '-req', '-in', csr, '-CA', caPath, '-CAkey', caKey, '-CAcreateserial', '-out', cert,
    '-days', '1', '-sha256', '-extfile', ext]);
  certificate = { key: readFileSync(key), cert: readFileSync(cert) };
});
after(() => { if (directory) rmSync(directory, { recursive: true, force: true }); });
async function server(t, handler) {
  const instance = createServer(certificate, handler);
  await new Promise(resolve => instance.listen(0, '127.0.0.1', resolve));
  t.after(async () => { instance.closeAllConnections(); await new Promise(resolve => instance.close(resolve)); });
  return 'https://127.0.0.1:' + instance.address().port;
}
function pins(f, origin) { return { schema: 'JENIOS_R70_TARGET_PINS_V1', origin, projectId: 'prj_R71TLSFixture',
  deploymentId: 'dpl_R71TLSFixture', commitSha: '71'.repeat(20), scopeId: f.trustedSource.scopeId,
  sourceId: f.trustedSource.sourceId, sourceKeySha256: f.receipt.sourceKeySha256 }; }
function clientConfig(f, origin) { return { targetPins: pins(f, origin), trustedSource: f.trustedSource, privateKeyPem: f.privateKeyPem }; }
async function incoming(req) {
  const chunks = []; for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
async function child(config, record = null, count = 1) {
  const source = `
    import {createR71SourceStateClient,createR71HttpsObservationSender} from './lib/platform/research/robot-r71-https-transport.mjs';
    import {inspectR71IntakeAcknowledgement} from './lib/platform/research/robot-r71-private-protocol.mjs';
    let raw='';for await(const c of process.stdin)raw+=c;const input=JSON.parse(raw);
    try{const views=[];
      if(input.count){const get=createR71SourceStateClient(input.config);for(let i=0;i<input.count;i++)views.push(await get());}
      let acknowledgement=null;
      if(input.record){const send=createR71HttpsObservationSender({origin:input.config.targetPins.origin,trustedSource:input.config.trustedSource});
        const response=await send(input.record);acknowledgement=inspectR71IntakeAcknowledgement(await response.json(),input.record,response.status).body.status;}
      process.stdout.write(JSON.stringify({ok:true,views,acknowledgement}));
    }catch(e){process.stdout.write(JSON.stringify({ok:false,code:e.code||'UNEXPECTED'}));}
  `;
  return new Promise((resolve, reject) => {
    const processChild = execFile(process.execPath, ['--input-type=module', '-e', source], { cwd: root,
      env: { PATH: process.env.PATH || '/usr/bin:/bin', NODE_EXTRA_CA_CERTS: caPath }, timeout: 10000, maxBuffer: 65536 },
    (error, stdout) => { if (error) reject(error); else { try { resolve(JSON.parse(stdout)); } catch (e) { reject(e); } } });
    processChild.stdin.end(JSON.stringify({ config, record, count }));
  });
}

test('R71 clients have closed identities paths timing and TLS settings with no injected state or transport', async () => {
  const f = await createR71ProtocolFixture(), c = clientConfig(f, 'https://127.0.0.1:4443');
  assert.equal(typeof createR71SourceStateClient(c), 'function');
  for (const field of ['getActiveState', 'runtimeView', 'fetch', 'headers', 'path', 'now', 'nowMs', 'nonce', 'ca', 'agent', 'lookup']) {
    assert.throws(() => createR71SourceStateClient({ ...c, [field]: true }), e => e.code === 'R71_STATE_CLIENT_CONFIG');
    assert.throws(() => createR71HttpsObservationSender({ origin: c.targetPins.origin, trustedSource: f.trustedSource, [field]: true }),
      e => e.code === 'R71_HTTPS_CONFIG');
  }
  const previous = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  try { process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    assert.throws(() => createR71SourceStateClient(c), e => e.code === 'R69_HTTPS_TLS_VERIFICATION_REQUIRED');
  } finally { if (previous === undefined) delete process.env.NODE_TLS_REJECT_UNAUTHORIZED; else process.env.NODE_TLS_REJECT_UNAUTHORIZED = previous; }
});

test('R71 real TLS reads use fresh independently signed queries and deliver all three signatures on a fixed distinct intake path', async t => {
  const f = await createR71ProtocolFixture(), rows = [];
  const origin = await server(t, async (req, res) => {
    const body = await incoming(req); rows.push({ path: req.url, headers: req.headers, body });
    if (req.url === R71_STATE_PATH) {
      verifyR71SourceStateQuery(body, { trustedSource: f.trustedSource });
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(createR71SourceStateResult({ query: body, runtimeView: f.runtimeView, trustedSource: f.trustedSource })));
    } else {
      const checked = verifyR71PrivateObservationRecord(body, { trustedSource: f.trustedSource, nowMs: Date.now() });
      res.writeHead(202, { 'content-type': 'application/json' }); res.end(JSON.stringify(createR71IntakeAcknowledgement(checked, 'STORED')));
    }
  });
  const result = await child(clientConfig(f, origin), f.record, 2);
  assert.equal(result.ok, true); assert.deepEqual(result.views, [f.runtimeView, f.runtimeView]);
  assert.equal(result.acknowledgement, 'STORED'); assert.deepEqual(rows.map(r => r.path), [R71_STATE_PATH, R71_STATE_PATH, R71_OBSERVATION_PATH]);
  assert.notEqual(rows[0].body.challenge.payload.nonce, rows[1].body.challenge.payload.nonce);
  assert.deepEqual(rows[2].body, f.record);
  for (const row of rows) for (const name of ['authorization', 'apikey', 'cookie', 'x-vercel-protection-bypass'])
    assert.equal(row.headers[name], undefined);
});

test('R71 TLS rejects substituted state bindings and stale observations before observation HTTP', async t => {
  const f = await createR71ProtocolFixture(); let mutate = value => value, count = 0;
  const origin = await server(t, async (req, res) => {
    count++; const query = await incoming(req);
    const value = structuredClone(createR71SourceStateResult({ query, runtimeView: f.runtimeView, trustedSource: f.trustedSource }));
    mutate(value); res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(value));
  });
  for (const [change, code] of [[v => { v.nonce = '00'.repeat(32); }, 'R71_STATE_RESULT_BINDING'],
    [v => { v.runtimeView.sourceKeySha256 = '00'.repeat(32); }, 'R71_STATE_VIEW_SOURCE'],
    [v => { v.expiresAtMs++; }, 'R71_STATE_RESULT_BINDING']]) {
    mutate = change; const result = await child(clientConfig(f, origin)); assert.equal(result.ok, false); assert.equal(result.code, code);
  }
  const prior = count, expired = await createR71ProtocolFixture({ privateKeyPem: f.privateKeyPem, nowMs: Date.now() - 120001 });
  const result = await child(clientConfig(f, origin), expired.record, 0);
  assert.equal(result.ok, false); assert.equal(result.code, 'R67_RECORD_TIME'); assert.equal(count, prior);
});
