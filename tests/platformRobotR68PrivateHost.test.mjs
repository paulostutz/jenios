/** Public host boundaries only. The private original executable is never
 * substituted with a callback, and positive execution remains a separate run.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash, generateKeyPairSync, randomBytes } from 'node:crypto';
import { chmodSync, linkSync, mkdirSync, mkdtempSync, readFileSync, readdirSync,
  renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectR68PrivateHost, runR68PrivateHost, R68_HOST_LIMITS } from '../lib/platform/research/robot-r68-private-host.mjs';
import { acquireR68HostLease, readR68PrivateFile, R68_HOST_LOCK } from '../lib/platform/research/robot-r68-private-files.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const cli = join(root, 'scripts/platform/research/r68-private-host.mjs');
const qa = { VERCEL_ENV: 'preview', JENIOS_QA_CANDIDATE_ENABLED: 'true', JENIOS_ROBOT_QA_ENABLED: 'true',
  JENIOS_ROBOT_R67_ENABLED: 'true', JENIOS_ROBOT_R68_HOST_ENABLED: 'true',
  JENIOS_ROBOT_ANALYST_PAID_ENABLED: 'false', JENIOS_REAL_EXECUTION_ENABLED: 'false',
  JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED: 'false', JENIOS_PRIVATE_PAPER_EXECUTOR: 'false' };
const denied = (fn, code) => assert.throws(fn, error => error?.code === code);
const asyncDenied = (fn, code) => assert.rejects(fn, error => error?.code === code);
const put = (path, value) => writeFileSync(path, typeof value === 'string' ? value : JSON.stringify(value), { mode: 0o600 });
function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'jenios-r68-public-host-')); chmodSync(directory, 0o700);
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const coreDirectory = join(directory, 'core'), outboxDirectory = join(directory, 'outbox');
  mkdirSync(coreDirectory, { mode: 0o700 }); mkdirSync(outboxDirectory, { mode: 0o700 });
  const pair = generateKeyPairSync('ed25519'), privateKeyPem = pair.privateKey.export({ type: 'pkcs8', format: 'pem' });
  const key = randomBytes(32).toString('hex');
  const config = { schema: 'JENIOS_R68_PRIVATE_HOST_CONFIG_V1', coreDirectory, outboxDirectory,
    privateKeyFile: join(directory, 'signing.pem'), hmacKeyFile: join(directory, 'integrity.txt'),
    commandsFile: join(directory, 'commands.json'), scopeId: 'scope:6868686868686868',
    sourceId: 'source:6868686868686868', sourceKeySha256: createHash('sha256')
      .update(pair.publicKey.export({ type: 'spki', format: 'der' })).digest('hex'), origin: 'http://127.0.0.1:54321' };
  const configPath = join(directory, 'host.json');
  put(config.privateKeyFile, privateKeyPem); put(config.hmacKeyFile, key + '\n');
  put(config.commandsFile, { schema: 'JENIOS_R68_PRIVATE_HOST_COMMANDS_V1', commands: [] }); put(configPath, config);
  return { directory, config, configPath, privateKeyPem, key };
}
const command = n => ({ operationId: 'op:' + n.toString(16).padStart(32, '0'),
  scenarios: ['manual', 'hybrid', 'reverse'].map(mode => ({ id: 'public-' + mode, mode, intent: 'buy', horizon: 'day' })) });
const runCli = args => new Promise(resolve => {
  execFile(process.execPath, [cli, ...args], { cwd: root, timeout: 10000,
    env: { PATH: process.env.PATH || '/usr/bin:/bin', ...qa } }, (error, stdout, stderr) => resolve({
    code: error?.code ?? 0, stdout, stderr, json: stdout.trim() ? JSON.parse(stdout.trim()) : null }));
});

test('R68 inspection is read-only without private executable execution or a new session', t => {
  const f = fixture(t), before = readdirSync(f.config.outboxDirectory);
  for (let n = 0; n < 2; n++) {
    const result = inspectR68PrivateHost({ configPath: f.configPath, env: qa });
    assert.equal(result.qaConfigurationValid, true); assert.equal(result.sessionsCreated, 0);
    assert.equal(result.emitterConstructed, false); assert.equal(result.loaderConstructed, false);
    assert.equal(result.privateCoreExecutedByInspection, false); assert.equal(result.networkCalls, 0);
    assert.equal(result.coreFiles.bytesMatchPinnedHashes, false); assert.equal(result.status, 'BLOCKED_PRIVATE_CORE');
    assert.equal(result.doctor.snapshot.present, false); assert.equal(result.operationalReady, false);
    assert.deepEqual(readdirSync(f.config.outboxDirectory), before);
  }
});

test('R68 run requires both the inherited QA gate and the explicit host gate before any write', async t => {
  const f = fixture(t);
  for (const env of [{}, { ...qa, VERCEL_ENV: 'production' }, { ...qa, JENIOS_ROBOT_R68_HOST_ENABLED: 'false' },
    { ...qa, JENIOS_ROBOT_ANALYST_PAID_ENABLED: 'true' }, { ...qa, JENIOS_REAL_EXECUTION_ENABLED: 'true' },
    { ...qa, JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED: 'true' }]) {
    await asyncDenied(() => runR68PrivateHost({ configPath: f.configPath, mode: 'once', env }), 'R68_HOST_DISABLED');
    assert.deepEqual(readdirSync(f.config.outboxDirectory), []);
  }
  assert.equal(inspectR68PrivateHost({ configPath: f.configPath, env: {} }).qaConfigurationValid, false);
});

test('R68 protected input reads reject checkout paths, symlinks, hardlinks and readable secrets', t => {
  const f = fixture(t);
  denied(() => readR68PrivateFile(join(root, 'package.json'), 16384), 'R68_HOST_IN_REPOSITORY');
  const alias = join(f.directory, 'alias.pem'); symlinkSync(f.config.privateKeyFile, alias);
  denied(() => readR68PrivateFile(alias, 4096), 'R68_HOST_PRIVATE_FILE');
  rmSync(alias); linkSync(f.config.privateKeyFile, alias);
  denied(() => readR68PrivateFile(f.config.privateKeyFile, 4096), 'R68_HOST_PRIVATE_FILE'); rmSync(alias);
  chmodSync(f.config.privateKeyFile, 0o644);
  denied(() => inspectR68PrivateHost({ configPath: f.configPath }), 'R68_HOST_PRIVATE_FILE');
});

test('R68 input parent directories, canonical paths and size bounds are enforced', t => {
  const f = fixture(t);
  denied(() => readR68PrivateFile(f.configPath + '/..', 16384), 'R68_HOST_PRIVATE_PATH');
  denied(() => readR68PrivateFile(f.configPath, 1), 'R68_HOST_PRIVATE_FILE');
  chmodSync(f.directory, 0o755);
  denied(() => inspectR68PrivateHost({ configPath: f.configPath }), 'R68_HOST_PRIVATE_DIRECTORY');
});

test('R68 manifest rejects extra fields and caller-selected runtime controls', t => {
  const f = fixture(t);
  for (const patch of [{ privateKeyPem: f.privateKeyPem }, { intervalMs: 1 }, { domain: 'OPERATIONAL' },
    { analyzeRequest: 'caller callback' }, { schema: 'UNKNOWN' }]) {
    put(f.configPath, { ...f.config, ...patch });
    denied(() => inspectR68PrivateHost({ configPath: f.configPath }), 'R68_HOST_CONFIG');
  }
  assert.deepEqual(R68_HOST_LIMITS, { commands: 20, intervalMs: 1000, maximumBackoffMs: 8000,
    flushLimit: 20, requestTimeoutMs: 3000 });
});

test('R68 signing identity and HMAC file must match their exact formats', t => {
  const f = fixture(t);
  put(f.configPath, { ...f.config, sourceKeySha256: '0'.repeat(64) });
  denied(() => inspectR68PrivateHost({ configPath: f.configPath }), 'R68_HOST_SOURCE_KEY_MISMATCH');
  put(f.configPath, f.config); put(f.config.hmacKeyFile, 'not-a-key');
  denied(() => inspectR68PrivateHost({ configPath: f.configPath }), 'R68_HOST_HMAC_KEY');
  put(f.config.hmacKeyFile, f.key); put(f.config.privateKeyFile, 'not-a-private-key');
  denied(() => inspectR68PrivateHost({ configPath: f.configPath }), 'R68_HOST_SIGNING_KEY');
});

test('R68 configuration cannot select hosted DNS credentialed or redirect-capable targets', t => {
  const f = fixture(t);
  for (const origin of ['https://127.0.0.1:443', 'http://localhost:54321', 'https://example.test',
    'http://user:password@127.0.0.1:54321', 'http://127.0.0.1:54321/path']) {
    put(f.configPath, { ...f.config, origin });
    denied(() => inspectR68PrivateHost({ configPath: f.configPath }), 'R67_LOOPBACK_ORIGIN_REQUIRED');
  }
});

test('R68 command file accepts only bounded synthetic batches with stable unique operations', t => {
  const f = fixture(t), good = command(1);
  for (const commands of [[good, good], Array.from({ length: 21 }, (_, i) => command(i + 1)),
    [{ ...good, decision: 'ALLOW' }]]) {
    put(f.config.commandsFile, { schema: 'JENIOS_R68_PRIVATE_HOST_COMMANDS_V1', commands });
    assert.throws(() => inspectR68PrivateHost({ configPath: f.configPath }), error =>
      ['R68_HOST_COMMAND', 'R68_HOST_COMMANDS'].includes(error.code));
  }
  put(f.config.commandsFile, 'globalThis.runPrivateCore = true;');
  denied(() => inspectR68PrivateHost({ configPath: f.configPath }), 'R68_HOST_JSON');
  put(f.config.commandsFile, { schema: 'JENIOS_R68_PRIVATE_HOST_COMMANDS_V1', commands: [{
    ...good, scenarios: good.scenarios.map(x => ({ ...x, sourceMode: 'market' })) }] });
  denied(() => inspectR68PrivateHost({ configPath: f.configPath }), 'R67_SCENARIO');
});

test('R68 atomically replaced command files are read as complete protected snapshots', t => {
  const f = fixture(t), replacement = join(f.directory, 'commands.next');
  put(replacement, { schema: 'JENIOS_R68_PRIVATE_HOST_COMMANDS_V1', commands: [command(1), command(2)] });
  renameSync(replacement, f.config.commandsFile);
  const result = inspectR68PrivateHost({ configPath: f.configPath });
  assert.equal(result.commandsObserved, 2); assert.deepEqual(readdirSync(f.config.outboxDirectory), []);
});

test('R68 lifetime lease rejects another owner and releases only its own unchanged file', t => {
  const f = fixture(t), lease = acquireR68HostLease(f.config.outboxDirectory);
  denied(() => acquireR68HostLease(f.config.outboxDirectory), 'R68_HOST_LOCKED');
  const raw = JSON.parse(readFileSync(join(f.config.outboxDirectory, R68_HOST_LOCK), 'utf8'));
  assert.equal(raw.pid, process.pid); assert.match(raw.token, /^[a-f0-9]{32}$/);
  lease.release(); assert.deepEqual(readdirSync(f.config.outboxDirectory), []);
});

test('R68 altered lease ownership is retained for explicit review and never removed', t => {
  const f = fixture(t), lease = acquireR68HostLease(f.config.outboxDirectory);
  const path = join(f.config.outboxDirectory, R68_HOST_LOCK);
  put(path, { pid: process.pid, token: 'f'.repeat(32) });
  denied(() => lease.assertOwned(), 'R68_HOST_LEASE_OWNERSHIP_CHANGED');
  denied(() => lease.release(), 'R68_HOST_LEASE_OWNERSHIP_CHANGED');
  assert.equal(JSON.parse(readFileSync(path, 'utf8')).token, 'f'.repeat(32));
});

test('R68 orphan lease is diagnosed without creating a session or authorizing recovery', async t => {
  const f = fixture(t), path = join(f.config.outboxDirectory, R68_HOST_LOCK);
  put(path, { pid: 999999999, token: 'e'.repeat(32) });
  const before = readFileSync(path);
  const result = inspectR68PrivateHost({ configPath: f.configPath });
  assert.equal(result.doctor.locks.find(x => x.kind === 'HOST').present, true);
  assert.equal(result.recoveryAuthorized, false);
  await asyncDenied(() => runR68PrivateHost({ configPath: f.configPath, mode: 'once', env: qa }), 'R68_HOST_RECOVERY_REQUIRED');
  assert.deepEqual(readFileSync(path), before); assert.deepEqual(readdirSync(f.config.outboxDirectory), [R68_HOST_LOCK]);
});

test('R68 unavailable original bytes fail before acquiring a lease or creating a session', async t => {
  const f = fixture(t);
  await asyncDenied(() => runR68PrivateHost({ configPath: f.configPath, mode: 'once', env: qa }), 'R68_HOST_PRIVATE_FILE');
  assert.deepEqual(readdirSync(f.config.outboxDirectory), []);
});

test('R68 offline check rejects wrong core bytes without compiling executing or transmitting them', async t => {
  const f = fixture(t);
  put(join(f.config.coreDirectory, 'engine.mjs'), 'globalThis.__R68_WRONG_CORE_EXECUTED__ = true;\n');
  put(join(f.config.coreDirectory, 'service.mjs'), 'throw new Error("not private source");\n');
  const result = inspectR68PrivateHost({ configPath: f.configPath, env: qa });
  assert.equal(result.coreFiles.bytesMatchPinnedHashes, false);
  assert.equal(result.coreFiles.error, 'R68_HOST_CORE_HASH_MISMATCH');
  assert.equal(result.coreFiles.executableCompiled, false); assert.equal(result.sessionsCreated, 0);
  assert.equal(result.networkCalls, 0); assert.equal(globalThis.__R68_WRONG_CORE_EXECUTED__, undefined);
  const cliResult = await runCli(['--check', '--config', f.configPath]);
  assert.equal(cliResult.code, 1); assert.equal(cliResult.json.coreFiles.error, 'R68_HOST_CORE_HASH_MISMATCH');
  assert.deepEqual(readdirSync(f.config.outboxDirectory), []);
});

test('R68 actual CLI accepts check only arguments and never exposes paths or keys in output', async t => {
  const f = fixture(t), okay = await runCli(['--check', '--config', f.configPath]);
  assert.equal(okay.code, 1); assert.equal(okay.json.coreFiles.bytesMatchPinnedHashes, false);
  assert.equal(okay.json.emitterConstructed, false);
  assert.equal(okay.json.sessionsCreated, 0); assert.equal(okay.json.networkCalls, 0);
  const bad = await runCli(['--check', '--config', f.configPath, '--private-key', f.key]);
  assert.equal(bad.code, 1); assert.equal(bad.json.code, 'R68_HOST_USAGE');
  const output = okay.stdout + okay.stderr + bad.stdout + bad.stderr;
  for (const secret of [f.privateKeyPem, f.key, f.directory]) assert.ok(!output.includes(secret));
  assert.deepEqual(readdirSync(f.config.outboxDirectory), []);
});
