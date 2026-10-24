/** Public R70 host boundaries only. No private executable or substitute
 * callback is executed; positive preflight/core runs have separate evidence.
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
import { inspectR70PrivateHost, runR70PrivateHost, R70_HOST_LIMITS } from '../lib/platform/research/robot-r70-private-host.mjs';
import { inspectR68PrivateHost, R68_HOST_LIMITS } from '../lib/platform/research/robot-r68-private-host.mjs';
import { inspectR69PrivateHost } from '../lib/platform/research/robot-r69-private-host.mjs';
import { R68_HOST_LOCK } from '../lib/platform/research/robot-r68-private-files.mjs';
import { r70TargetPinsDigest } from '../lib/platform/research/robot-r70-preflight-protocol.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const cli = join(root, 'scripts/platform/research/r70-private-host.mjs');
const qa = { VERCEL_ENV: 'preview', JENIOS_QA_CANDIDATE_ENABLED: 'true', JENIOS_ROBOT_QA_ENABLED: 'true',
  JENIOS_ROBOT_R67_ENABLED: 'true', JENIOS_ROBOT_R68_HOST_ENABLED: 'true', JENIOS_ROBOT_R69_HTTPS_ENABLED: 'true',
  JENIOS_ROBOT_R70_PREFLIGHT_ENABLED: 'true', JENIOS_ROBOT_ANALYST_PAID_ENABLED: 'false',
  JENIOS_REAL_EXECUTION_ENABLED: 'false', JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED: 'false',
  JENIOS_PRIVATE_PAPER_EXECUTOR: 'false' };
const denied = (fn, code) => assert.throws(fn, error => error?.code === code);
const asyncDenied = (fn, code) => assert.rejects(fn, error => error?.code === code);
const put = (path, value) => writeFileSync(path, typeof value === 'string' ? value : JSON.stringify(value), { mode: 0o600 });
function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'jenios-r70-public-host-')); chmodSync(directory, 0o700);
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const coreDirectory = join(directory, 'core'), outboxDirectory = join(directory, 'outbox');
  mkdirSync(coreDirectory, { mode: 0o700 }); mkdirSync(outboxDirectory, { mode: 0o700 });
  const keys = generateKeyPairSync('ed25519'), privateKeyPem = keys.privateKey.export({ type: 'pkcs8', format: 'pem' });
  const key = randomBytes(32).toString('hex');
  const config = { schema: 'JENIOS_R70_PRIVATE_HOST_CONFIG_V1', coreDirectory, outboxDirectory,
    privateKeyFile: join(directory, 'signing.pem'), hmacKeyFile: join(directory, 'integrity.txt'),
    commandsFile: join(directory, 'commands.json'), scopeId: 'scope:7070707070707070',
    sourceId: 'source:7070707070707070', sourceKeySha256: createHash('sha256')
      .update(keys.publicKey.export({ type: 'spki', format: 'der' })).digest('hex'),
    origin: 'https://r70-public-fixture.vercel.app', targetPinsFile: join(directory, 'target-pins.json') };
  const pins = { schema: 'JENIOS_R70_TARGET_PINS_V1', origin: config.origin, projectId: 'prj_R70PublicFixture',
    deploymentId: 'dpl_R70PublicFixture', commitSha: '7'.repeat(40), scopeId: config.scopeId,
    sourceId: config.sourceId, sourceKeySha256: config.sourceKeySha256 };
  const configPath = join(directory, 'host.json');
  put(config.privateKeyFile, privateKeyPem); put(config.hmacKeyFile, key); put(config.targetPinsFile, pins);
  put(config.commandsFile, { schema: 'JENIOS_R68_PRIVATE_HOST_COMMANDS_V1', commands: [] }); put(configPath, config);
  return { directory, config, configPath, pins, privateKeyPem, key };
}
const runCli = (args, env = qa) => new Promise(resolve => {
  execFile(process.execPath, [cli, ...args], { cwd: root, timeout: 10000,
    env: { PATH: process.env.PATH || '/usr/bin:/bin', ...env } }, (error, stdout, stderr) => resolve({
    code: error?.code ?? 0, stdout, stderr, json: stdout.trim() ? JSON.parse(stdout.trim()) : null }));
});

test('R70 offline inspection observes protected pin declarations without a probe session or remote proof', t => {
  const f = fixture(t), input = { configPath: f.configPath, nowMs: Date.now(), env: qa };
  const result = inspectR70PrivateHost(input);
  assert.deepEqual(inspectR70PrivateHost(input), result);
  assert.equal(result.schema, 'JENIOS_R70_PRIVATE_HOST_INSPECTION_V1'); assert.equal(result.qaConfigurationValid, true);
  assert.equal(result.preflight.targetPinsSha256, r70TargetPinsDigest(f.pins));
  assert.equal(result.preflight.required, true); assert.equal(result.preflight.executed, false);
  assert.equal(result.preflight.attempted, 0); assert.equal(result.preflight.succeeded, 0); assert.equal(result.preflight.lastResult, null);
  assert.equal(result.networkCalls, 0); assert.equal(result.sessionsCreated, 0);
  assert.equal(result.loaderConstructed, false); assert.equal(result.emitterConstructed, false);
  assert.equal(result.privateCoreExecutedByInspection, false); assert.equal(result.status, 'BLOCKED_PRIVATE_CORE');
  for (const field of ['remoteQaDeploymentVerified', 'independentRuntimeAttestation', 'hostedAuthenticationCertified', 'operationalReady'])
    assert.equal(result.preflight[field], false);
  assert.equal(result.transport.profile, 'R69_FIXED_HTTPS'); assert.ok(Object.isFrozen(result.preflight));
  const text = JSON.stringify(result);
  for (const raw of [f.pins.origin, f.pins.projectId, f.pins.deploymentId, f.pins.commitSha, f.directory]) assert.ok(!text.includes(raw));
  assert.deepEqual(readdirSync(f.config.outboxDirectory), []);
});

test('R70 run requires every inherited gate and its own opt-in before opening a config or probing', async t => {
  const f = fixture(t);
  for (const [flag, value] of Object.entries(qa)) {
    const env = { ...qa, [flag]: value === 'true' ? 'false' : value === 'false' ? 'true' : 'production' };
    await asyncDenied(() => runR70PrivateHost({ configPath: '/never/opened/host.json', mode: 'once', env }), 'R70_HOST_DISABLED');
    assert.equal(inspectR70PrivateHost({ configPath: f.configPath, env }).qaConfigurationValid, false);
  }
  const env = { ...qa }; delete env.JENIOS_ROBOT_R70_PREFLIGHT_ENABLED;
  await asyncDenied(() => runR70PrivateHost({ configPath: f.configPath, mode: 'once', env }), 'R70_HOST_DISABLED');
  assert.deepEqual(readdirSync(f.config.outboxDirectory), []);
});

test('R70 has exactly eleven manifest fields and cannot be selected through an R68 or R69 manifest', t => {
  const f = fixture(t); assert.equal(Object.keys(f.config).length, 11);
  denied(() => inspectR68PrivateHost({ configPath: f.configPath }), 'R68_HOST_CONFIG');
  denied(() => inspectR69PrivateHost({ configPath: f.configPath }), 'R69_HOST_CONFIG');
  const { targetPinsFile, ...ten } = f.config;
  put(f.configPath, ten); denied(() => inspectR70PrivateHost({ configPath: f.configPath }), 'R70_HOST_CONFIG');
  const disabledR70 = { ...qa, JENIOS_ROBOT_R70_PREFLIGHT_ENABLED: 'false' };
  put(f.configPath, { ...ten, schema: 'JENIOS_R69_PRIVATE_HOST_CONFIG_V1' });
  const r69 = inspectR69PrivateHost({ configPath: f.configPath, env: disabledR70 });
  assert.equal(r69.qaConfigurationValid, true); assert.equal(Object.hasOwn(r69, 'preflight'), false);
  assert.equal(r69.transport.profile, 'R69_FIXED_HTTPS');
  denied(() => inspectR70PrivateHost({ configPath: f.configPath, env: qa }), 'R70_HOST_CONFIG');
  put(f.configPath, { ...ten, schema: 'JENIOS_R68_PRIVATE_HOST_CONFIG_V1', origin: 'http://127.0.0.1:54321' });
  const r68 = inspectR68PrivateHost({ configPath: f.configPath, env: disabledR70 });
  assert.equal(r68.qaConfigurationValid, true); assert.equal(Object.hasOwn(r68, 'preflight'), false);
  assert.equal(Object.hasOwn(r68, 'transport'), false); assert.equal(R70_HOST_LIMITS, R68_HOST_LIMITS);
});

test('R70 pin file inherits protected path ownership mode link and size boundaries', t => {
  const f = fixture(t), alias = join(f.directory, 'pins-link.json');
  chmodSync(f.config.targetPinsFile, 0o644);
  denied(() => inspectR70PrivateHost({ configPath: f.configPath }), 'R68_HOST_PRIVATE_FILE');
  chmodSync(f.config.targetPinsFile, 0o600); symlinkSync(f.config.targetPinsFile, alias);
  put(f.configPath, { ...f.config, targetPinsFile: alias });
  denied(() => inspectR70PrivateHost({ configPath: f.configPath }), 'R68_HOST_PRIVATE_FILE');
  put(f.configPath, f.config); put(f.config.targetPinsFile, 'x'.repeat(16385));
  denied(() => inspectR70PrivateHost({ configPath: f.configPath }), 'R68_HOST_PRIVATE_FILE');
  put(f.config.targetPinsFile, f.pins); chmodSync(f.directory, 0o755);
  denied(() => inspectR70PrivateHost({ configPath: f.configPath }), 'R68_HOST_PRIVATE_DIRECTORY');
  chmodSync(f.directory, 0o700); assert.deepEqual(readdirSync(f.config.outboxDirectory), []);
});

test('R70 pins must bind origin scope source and actual signing-key fingerprint exactly', t => {
  const f = fixture(t);
  for (const mutation of [{ origin: 'https://different-r70-fixture.vercel.app' },
    { scopeId: 'scope:0000000000000070' }, { sourceId: 'source:0000000000000070' },
    { sourceKeySha256: '0'.repeat(64) }]) {
    put(f.config.targetPinsFile, { ...f.pins, ...mutation });
    denied(() => inspectR70PrivateHost({ configPath: f.configPath }), 'R70_HOST_TARGET_PINS_MISMATCH');
  }
  put(f.config.targetPinsFile, f.pins); put(f.configPath, { ...f.config, sourceKeySha256: '0'.repeat(64) });
  denied(() => inspectR70PrivateHost({ configPath: f.configPath }), 'R70_HOST_SOURCE_KEY_MISMATCH');
  assert.deepEqual(readdirSync(f.config.outboxDirectory), []);
});

test('R70 pins stay closed and malformed declarations cannot become an approval or executable input', t => {
  const f = fixture(t);
  for (const [key, value] of [['approved', true], ['privateKeyPem', f.privateKeyPem], ['databaseKey', 'forbidden'],
    ['nonce', 'a'.repeat(64)], ['nowMs', 1], ['probe', 'code.mjs']]) {
    put(f.config.targetPinsFile, { ...f.pins, [key]: value });
    denied(() => inspectR70PrivateHost({ configPath: f.configPath }), 'R70_TARGET_PINS');
  }
  put(f.config.targetPinsFile, f.pins);
  for (const origin of ['https://qa.invalid', 'https://localhost:4343', 'http://127.0.0.1:4343']) {
    put(f.configPath, { ...f.config, origin }); put(f.config.targetPinsFile, { ...f.pins, origin });
    denied(() => inspectR70PrivateHost({ configPath: f.configPath }), 'R70_TARGET_ORIGIN');
  }
  put(f.configPath, f.config); put(f.config.targetPinsFile, 'globalThis.__R70_PINS_EXECUTED__=true;');
  denied(() => inspectR70PrivateHost({ configPath: f.configPath }), 'R70_HOST_JSON');
  assert.equal(globalThis.__R70_PINS_EXECUTED__, undefined); assert.deepEqual(readdirSync(f.config.outboxDirectory), []);
});

test('R70 exposes no profile probe sender or clock callback for bypassing the target challenge', async t => {
  const f = fixture(t); let calls = 0;
  const callback = () => { calls++; throw Error('must never run'); };
  for (const field of ['probe', 'sender', 'send', 'fetch', 'now', 'profile', 'targetPins']) {
    await asyncDenied(() => runR70PrivateHost({ configPath: f.configPath, mode: 'once', env: qa, [field]: callback }),
      'R70_HOST_RUN_CONFIG');
    put(f.configPath, { ...f.config, [field]: 'forbidden' });
    denied(() => inspectR70PrivateHost({ configPath: f.configPath }), 'R70_HOST_CONFIG');
  }
  denied(() => inspectR70PrivateHost({ get configPath() { calls++; return f.configPath; } }), 'R70_HOST_INSPECT_CONFIG');
  assert.equal(calls, 0); assert.deepEqual(readdirSync(f.config.outboxDirectory), []);
});

test('R70 wrong original bytes and retained orphan locks fail before the initial preflight or new state', async t => {
  const f = fixture(t);
  put(join(f.config.coreDirectory, 'engine.mjs'), 'globalThis.__R70_WRONG_CORE_EXECUTED__=true;\n');
  put(join(f.config.coreDirectory, 'service.mjs'), 'throw Error("not original bytes");\n');
  const checked = inspectR70PrivateHost({ configPath: f.configPath, env: qa });
  assert.equal(checked.coreFiles.error, 'R70_HOST_CORE_HASH_MISMATCH'); assert.equal(checked.preflight.executed, false);
  await asyncDenied(() => runR70PrivateHost({ configPath: f.configPath, mode: 'once', env: qa }), 'R70_HOST_CORE_HASH_MISMATCH');
  assert.deepEqual(readdirSync(f.config.outboxDirectory), []); assert.equal(globalThis.__R70_WRONG_CORE_EXECUTED__, undefined);
  const path = join(f.config.outboxDirectory, R68_HOST_LOCK); put(path, { pid: 999999999, token: '7'.repeat(32) });
  const before = readFileSync(path), orphan = inspectR70PrivateHost({ configPath: f.configPath, env: qa });
  assert.equal(orphan.recoveryAuthorized, false); assert.equal(orphan.preflight.executed, false);
  await asyncDenied(() => runR70PrivateHost({ configPath: f.configPath, mode: 'once', env: qa }), 'R70_HOST_RECOVERY_REQUIRED');
  assert.deepEqual(readFileSync(path), before); assert.deepEqual(readdirSync(f.config.outboxDirectory), [R68_HOST_LOCK]);
});

test('R70 actual CLI keeps check offline with disabled gates and excludes pins secrets paths and extra arguments', async t => {
  const f = fixture(t), disabledEnv = { ...qa, JENIOS_ROBOT_R70_PREFLIGHT_ENABLED: 'false' };
  const checked = await runCli(['--check', '--config', f.configPath], disabledEnv);
  assert.equal(checked.code, 1); assert.equal(checked.json.qaConfigurationValid, false);
  assert.equal(checked.json.preflight.executed, false); assert.equal(checked.json.networkCalls, 0);
  assert.equal(checked.json.sessionsCreated, 0); assert.equal(checked.json.preflight.lastResult, null);
  const disabled = await runCli(['--once', '--config', f.configPath], disabledEnv);
  assert.equal(disabled.code, 1); assert.equal(disabled.json.code, 'R70_HOST_DISABLED');
  const invalid = await runCli(['--check', '--config', f.configPath, '--probe', f.key]);
  assert.equal(invalid.code, 1); assert.equal(invalid.json.code, 'R70_HOST_USAGE');
  const output = [checked, disabled, invalid].map(result => result.stdout + result.stderr).join('');
  for (const privateValue of [f.privateKeyPem, f.key, f.directory, f.pins.origin, f.pins.projectId, f.pins.deploymentId])
    assert.ok(!output.includes(privateValue));
  assert.deepEqual(readdirSync(f.config.outboxDirectory), []);
});
