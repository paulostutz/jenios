/** R69 public host boundaries. These tests never replace original private
 * executable bytes with a positive callback or claim hosted TLS/Auth proof.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash, generateKeyPairSync, randomBytes } from 'node:crypto';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync,
  symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectR69PrivateHost, runR69PrivateHost, R69_HOST_LIMITS } from '../lib/platform/research/robot-r69-private-host.mjs';
import { inspectR68PrivateHost, runR68PrivateHost, R68_HOST_LIMITS } from '../lib/platform/research/robot-r68-private-host.mjs';
import { R68_HOST_LOCK } from '../lib/platform/research/robot-r68-private-files.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const cli = join(root, 'scripts/platform/research/r69-private-host.mjs');
const qa = { VERCEL_ENV: 'preview', JENIOS_QA_CANDIDATE_ENABLED: 'true', JENIOS_ROBOT_QA_ENABLED: 'true',
  JENIOS_ROBOT_R67_ENABLED: 'true', JENIOS_ROBOT_R68_HOST_ENABLED: 'true', JENIOS_ROBOT_R69_HTTPS_ENABLED: 'true',
  JENIOS_ROBOT_ANALYST_PAID_ENABLED: 'false', JENIOS_REAL_EXECUTION_ENABLED: 'false',
  JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED: 'false', JENIOS_PRIVATE_PAPER_EXECUTOR: 'false' };
const denied = (fn, code) => assert.throws(fn, error => error?.code === code);
const asyncDenied = (fn, code) => assert.rejects(fn, error => error?.code === code);
const put = (path, value) => writeFileSync(path, typeof value === 'string' ? value : JSON.stringify(value), { mode: 0o600 });
const command = n => ({ operationId: 'op:' + n.toString(16).padStart(32, '0'),
  scenarios: ['manual', 'hybrid', 'reverse'].map(mode => ({ id: 'public-' + mode, mode, intent: 'buy', horizon: 'day' })) });
function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'jenios-r69-public-host-')); chmodSync(directory, 0o700);
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const coreDirectory = join(directory, 'core'), outboxDirectory = join(directory, 'outbox');
  mkdirSync(coreDirectory, { mode: 0o700 }); mkdirSync(outboxDirectory, { mode: 0o700 });
  const pair = generateKeyPairSync('ed25519'), privateKeyPem = pair.privateKey.export({ type: 'pkcs8', format: 'pem' });
  const key = randomBytes(32).toString('hex');
  const config = { schema: 'JENIOS_R69_PRIVATE_HOST_CONFIG_V1', coreDirectory, outboxDirectory,
    privateKeyFile: join(directory, 'signing.pem'), hmacKeyFile: join(directory, 'integrity.txt'),
    commandsFile: join(directory, 'commands.json'), scopeId: 'scope:6969696969696969',
    sourceId: 'source:6969696969696969', sourceKeySha256: createHash('sha256')
      .update(pair.publicKey.export({ type: 'spki', format: 'der' })).digest('hex'), origin: 'https://qa.invalid:4343' };
  const configPath = join(directory, 'host.json');
  put(config.privateKeyFile, privateKeyPem); put(config.hmacKeyFile, key);
  put(config.commandsFile, { schema: 'JENIOS_R68_PRIVATE_HOST_COMMANDS_V1', commands: [] }); put(configPath, config);
  return { directory, config, configPath, privateKeyPem, key };
}
const runCli = (args, env = qa) => new Promise(resolve => {
  execFile(process.execPath, [cli, ...args], { cwd: root, timeout: 10000,
    env: { PATH: process.env.PATH || '/usr/bin:/bin', ...env } }, (error, stdout, stderr) => resolve({
    code: error?.code ?? 0, stdout, stderr, json: stdout.trim() ? JSON.parse(stdout.trim()) : null }));
});

test('R69 offline inspection declares a fixed HTTPS target without TLS Auth network or session proof', t => {
  const f = fixture(t), input = { configPath: f.configPath, nowMs: Date.now(), env: qa };
  const result = inspectR69PrivateHost(input), again = inspectR69PrivateHost(input);
  assert.deepEqual(again, result);
  assert.equal(result.schema, 'JENIOS_R69_PRIVATE_HOST_INSPECTION_V1');
  assert.equal(result.qaConfigurationValid, true); assert.equal(result.networkCalls, 0);
  assert.equal(result.loaderConstructed, false); assert.equal(result.emitterConstructed, false);
  assert.equal(result.sessionsCreated, 0); assert.equal(result.privateCoreExecutedByInspection, false);
  assert.equal(result.status, 'BLOCKED_PRIVATE_CORE'); assert.equal(result.coreFiles.bytesMatchPinnedHashes, false);
  assert.equal(result.transport.target, 'DECLARED_CONFIG_ORIGIN');
  assert.equal(result.transport.targetOriginSha256, createHash('sha256').update(f.config.origin).digest('hex'));
  assert.equal(result.transport.endpoint, '/api/platform/robot-private-observations');
  for (const name of ['tlsRequired', 'certificateAndHostnameVerificationRequired']) assert.equal(result.transport[name], true);
  for (const name of ['tlsCheckedByOfflineInspection', 'remoteQaDeploymentVerified', 'hostedAuthenticationCertified'])
    assert.equal(result.transport[name], false);
  assert.equal(result.operationalReady, false); assert.equal(result.recoveryAuthorized, false);
  assert.equal(result.persistentHostCertified, false); assert.equal(result.serviceInstalled, false);
  assert.ok(Object.isFrozen(result.transport)); assert.ok(!JSON.stringify(result).includes(f.config.origin));
  assert.deepEqual(readdirSync(f.config.outboxDirectory), []);
});

test('R69 requires its own opt-in and every inherited QA cost and execution gate before reading files', async t => {
  const f = fixture(t);
  for (const [flag, value] of Object.entries(qa)) {
    const env = { ...qa, [flag]: value === 'true' ? 'false' : value === 'false' ? 'true' : 'production' };
    await asyncDenied(() => runR69PrivateHost({ configPath: '/not/read/by/disabled-host.json', mode: 'once', env }),
      'R69_HOST_DISABLED');
    assert.equal(inspectR69PrivateHost({ configPath: f.configPath, env }).qaConfigurationValid, false);
  }
  const missing = { ...qa }; delete missing.JENIOS_ROBOT_R69_HTTPS_ENABLED;
  await asyncDenied(() => runR69PrivateHost({ configPath: f.configPath, mode: 'once', env: missing }), 'R69_HOST_DISABLED');
  assert.deepEqual(readdirSync(f.config.outboxDirectory), []);
});

test('R68 and R69 reject each other manifests and R68 retains loopback-only reports without R69 opt-in', async t => {
  const f = fixture(t);
  denied(() => inspectR68PrivateHost({ configPath: f.configPath, env: qa }), 'R68_HOST_CONFIG');
  const legacy = { ...f.config, schema: 'JENIOS_R68_PRIVATE_HOST_CONFIG_V1', origin: 'http://127.0.0.1:54321' };
  put(f.configPath, legacy);
  denied(() => inspectR69PrivateHost({ configPath: f.configPath, env: qa }), 'R69_HOST_CONFIG');
  const env = { ...qa, JENIOS_ROBOT_R69_HTTPS_ENABLED: 'false' };
  const old = inspectR68PrivateHost({ configPath: f.configPath, env });
  assert.equal(old.schema, 'JENIOS_R68_PRIVATE_HOST_INSPECTION_V1'); assert.equal(old.qaConfigurationValid, true);
  assert.equal(Object.hasOwn(old, 'transport'), false); assert.equal(old.networkCalls, 0);
  await asyncDenied(() => runR68PrivateHost({ configPath: f.configPath, mode: 'once', env }), 'R68_HOST_PRIVATE_FILE');
  put(f.configPath, { ...legacy, origin: f.config.origin });
  denied(() => inspectR68PrivateHost({ configPath: f.configPath, env }), 'R67_LOOPBACK_ORIGIN_REQUIRED');
  assert.equal(R69_HOST_LIMITS, R68_HOST_LIMITS); assert.ok(Object.isFrozen(R69_HOST_LIMITS));
  assert.deepEqual(readdirSync(f.config.outboxDirectory), []);
});

test('R69 config cannot inject sender headers TLS options code paths or profile changes', t => {
  const f = fixture(t);
  for (const key of ['sender', 'send', 'fetch', 'headers', 'ca', 'agent', 'lookup', 'transport', 'profile',
    'privateKeyPem', 'sessionId', 'timeoutMs', 'commandModule']) {
    put(f.configPath, { ...f.config, [key]: 'rejected-input' });
    denied(() => inspectR69PrivateHost({ configPath: f.configPath, env: qa }), 'R69_HOST_CONFIG');
  }
  put(f.configPath, { ...f.config, schema: 'JENIOS_R69_PRIVATE_HOST_CONFIG_V2' });
  denied(() => inspectR69PrivateHost({ configPath: f.configPath, env: qa }), 'R69_HOST_CONFIG');
  put(f.configPath, 'globalThis.__R69_PUBLIC_CODE_EXECUTED__=true;');
  denied(() => inspectR69PrivateHost({ configPath: f.configPath, env: qa }), 'R69_HOST_JSON');
  assert.equal(globalThis.__R69_PUBLIC_CODE_EXECUTED__, undefined);
  assert.deepEqual(readdirSync(f.config.outboxDirectory), []);
});

test('R69 host function arguments cannot bypass the fixed transport or evaluate getters', async t => {
  const f = fixture(t); let called = 0;
  const injected = () => { called++; throw Error('must not run'); };
  denied(() => inspectR69PrivateHost({ configPath: f.configPath, env: qa, send: injected }), 'R69_HOST_INSPECT_CONFIG');
  await asyncDenied(() => runR69PrivateHost({ configPath: f.configPath, mode: 'once', env: qa, send: injected }),
    'R69_HOST_RUN_CONFIG');
  await asyncDenied(() => runR69PrivateHost({ configPath: f.configPath, mode: 'once', env: qa, profile: 'R68' }),
    'R69_HOST_RUN_CONFIG');
  denied(() => inspectR69PrivateHost({ get configPath() { called++; return f.configPath; } }), 'R69_HOST_INSPECT_CONFIG');
  assert.equal(called, 0); assert.deepEqual(readdirSync(f.config.outboxDirectory), []);
});

test('R69 keeps protected file custody and binds signing key bytes to the declared fingerprint', t => {
  const f = fixture(t), alias = join(f.directory, 'key-link.pem');
  chmodSync(f.config.privateKeyFile, 0o644);
  denied(() => inspectR69PrivateHost({ configPath: f.configPath }), 'R68_HOST_PRIVATE_FILE');
  chmodSync(f.config.privateKeyFile, 0o600); symlinkSync(f.config.privateKeyFile, alias);
  put(f.configPath, { ...f.config, privateKeyFile: alias });
  denied(() => inspectR69PrivateHost({ configPath: f.configPath }), 'R68_HOST_PRIVATE_FILE');
  put(f.configPath, { ...f.config, sourceKeySha256: '0'.repeat(64) });
  denied(() => inspectR69PrivateHost({ configPath: f.configPath }), 'R69_HOST_SOURCE_KEY_MISMATCH');
  put(f.configPath, f.config); put(f.config.hmacKeyFile, 'not-a-key');
  denied(() => inspectR69PrivateHost({ configPath: f.configPath }), 'R69_HOST_HMAC_KEY');
  assert.deepEqual(readdirSync(f.config.outboxDirectory), []);
});

test('R69 rejects HTTP credentials paths and known production origins without falling back to loopback', t => {
  const f = fixture(t);
  for (const origin of ['http://127.0.0.1:54321', 'https://user:secret@qa.invalid',
    'https://qa.invalid/path', 'https://qa.invalid?target=other', 'https://qa.invalid#fragment',
    'https://jenios.com.br', 'https://www.jenios.com.br', 'https://jenios.com.br.']) {
    put(f.configPath, { ...f.config, origin });
    assert.throws(() => inspectR69PrivateHost({ configPath: f.configPath }), error => /^R69_HTTPS_/.test(error?.code || ''));
  }
  assert.deepEqual(readdirSync(f.config.outboxDirectory), []);
});

test('R69 reuses closed R68 command batches and cannot receive a market source or command program', t => {
  const f = fixture(t), good = command(1);
  put(f.config.commandsFile, { schema: 'JENIOS_R68_PRIVATE_HOST_COMMANDS_V1', commands: [good] });
  assert.equal(inspectR69PrivateHost({ configPath: f.configPath }).commandsObserved, 1);
  for (const commands of [[good, good], Array.from({ length: 21 }, (_, n) => command(n + 1)),
    [{ ...good, sender: 'run-code.mjs' }]]) {
    put(f.config.commandsFile, { schema: 'JENIOS_R68_PRIVATE_HOST_COMMANDS_V1', commands });
    assert.throws(() => inspectR69PrivateHost({ configPath: f.configPath }), error =>
      ['R68_HOST_COMMAND', 'R68_HOST_COMMANDS'].includes(error?.code));
  }
  put(f.config.commandsFile, { schema: 'JENIOS_R68_PRIVATE_HOST_COMMANDS_V1', commands: [{
    ...good, scenarios: good.scenarios.map(value => ({ ...value, sourceMode: 'market' })) }] });
  denied(() => inspectR69PrivateHost({ configPath: f.configPath }), 'R67_SCENARIO');
  assert.deepEqual(readdirSync(f.config.outboxDirectory), []);
});

test('R69 incorrect original bytes remain blocked before VM session lease or HTTPS transmission', async t => {
  const f = fixture(t);
  put(join(f.config.coreDirectory, 'engine.mjs'), 'globalThis.__R69_PUBLIC_CORE_EXECUTED__=true;\n');
  put(join(f.config.coreDirectory, 'service.mjs'), 'throw Error("not original source");\n');
  const result = inspectR69PrivateHost({ configPath: f.configPath, env: qa });
  assert.equal(result.coreFiles.error, 'R69_HOST_CORE_HASH_MISMATCH');
  assert.equal(result.coreFiles.bytesMatchPinnedHashes, false); assert.equal(result.coreFiles.executableCompiled, false);
  assert.equal(result.networkCalls, 0); assert.equal(result.sessionsCreated, 0);
  await asyncDenied(() => runR69PrivateHost({ configPath: f.configPath, mode: 'once', env: qa }), 'R69_HOST_CORE_HASH_MISMATCH');
  assert.equal(globalThis.__R69_PUBLIC_CORE_EXECUTED__, undefined);
  assert.deepEqual(readdirSync(f.config.outboxDirectory), []);
});

test('R69 shares the existing lifetime lock and diagnoses an orphan without cleanup or new state', async t => {
  const f = fixture(t), path = join(f.config.outboxDirectory, R68_HOST_LOCK);
  put(path, { pid: 999999999, token: 'e'.repeat(32) });
  const before = readFileSync(path), result = inspectR69PrivateHost({ configPath: f.configPath, env: qa });
  assert.equal(result.doctor.locks.find(value => value.kind === 'HOST').name, R68_HOST_LOCK);
  assert.equal(result.doctor.locks.find(value => value.kind === 'HOST').present, true);
  assert.equal(result.recoveryAuthorized, false); assert.equal(result.sessionsCreated, 0);
  await asyncDenied(() => runR69PrivateHost({ configPath: f.configPath, mode: 'once', env: qa }), 'R69_HOST_RECOVERY_REQUIRED');
  assert.deepEqual(readFileSync(path), before); assert.deepEqual(readdirSync(f.config.outboxDirectory), [R68_HOST_LOCK]);
});

test('R69 actual CLI has closed arguments sanitized output and its own live environment opt-in', async t => {
  const f = fixture(t), checked = await runCli(['--check', '--config', f.configPath]);
  assert.equal(checked.code, 1); assert.equal(checked.json.schema, 'JENIOS_R69_PRIVATE_HOST_INSPECTION_V1');
  assert.equal(checked.json.networkCalls, 0); assert.equal(checked.json.transport.remoteQaDeploymentVerified, false);
  const usage = await runCli(['--check', '--config', f.configPath, '--key', f.key]);
  assert.equal(usage.code, 1); assert.equal(usage.json.code, 'R69_HOST_USAGE');
  const disabled = await runCli(['--once', '--config', f.configPath], { ...qa, JENIOS_ROBOT_R69_HTTPS_ENABLED: 'false' });
  assert.equal(disabled.code, 1); assert.equal(disabled.json.code, 'R69_HOST_DISABLED');
  const output = [checked, usage, disabled].map(value => value.stdout + value.stderr).join('');
  for (const privateValue of [f.privateKeyPem, f.key, f.directory, f.config.origin]) assert.ok(!output.includes(privateValue));
  assert.deepEqual(readdirSync(f.config.outboxDirectory), []);
});
