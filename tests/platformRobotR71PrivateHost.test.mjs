/** Public host boundary tests. No private executable is supplied or replaced. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash, generateKeyPairSync } from 'node:crypto';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectR71PrivateHost, runR71PrivateHost } from '../lib/platform/research/robot-r71-private-host.mjs';
import { inspectR70PrivateHost } from '../lib/platform/research/robot-r70-private-host.mjs';
import { R71_FIXTURE_SCENARIOS, R71_FIXTURE_POSITION_CONTEXTS } from './fixtures/r71-private-protocol-fixture.mjs';
import { createR71PrivateCoreSource } from '../lib/platform/research/robot-r71-private-source.mjs';
import { createR71DurableEmitter } from '../lib/platform/research/robot-r71-durable-emitter.mjs';
import { captureR71VerifiedPrivateBatch } from '../lib/platform/research/robot-r67-private-core-loader.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const qa = { VERCEL_ENV: 'preview', JENIOS_QA_CANDIDATE_ENABLED: 'true', JENIOS_ROBOT_QA_ENABLED: 'true',
  JENIOS_ROBOT_R67_ENABLED: 'true', JENIOS_ROBOT_R68_HOST_ENABLED: 'true', JENIOS_ROBOT_R69_HTTPS_ENABLED: 'true',
  JENIOS_ROBOT_R70_PREFLIGHT_ENABLED: 'true', JENIOS_ROBOT_R71_ENABLED: 'true',
  JENIOS_ROBOT_ANALYST_PAID_ENABLED: 'false', JENIOS_REAL_EXECUTION_ENABLED: 'false',
  JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED: 'false', JENIOS_PRIVATE_PAPER_EXECUTOR: 'false' };
const put = (p, value) => writeFileSync(p, typeof value === 'string' ? value : JSON.stringify(value), { mode: 0o600 });
function setup(t) {
  const directory = mkdtempSync(join(tmpdir(), 'jenios-r71-public-host-')); chmodSync(directory, 0o700);
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const coreDirectory = join(directory, 'core'), outboxDirectory = join(directory, 'outbox');
  mkdirSync(coreDirectory, { mode: 0o700 }); mkdirSync(outboxDirectory, { mode: 0o700 });
  const keys = generateKeyPairSync('ed25519'), privateKeyPem = keys.privateKey.export({ type: 'pkcs8', format: 'pem' });
  const config = { schema: 'JENIOS_R71_PRIVATE_HOST_CONFIG_V1', coreDirectory, outboxDirectory,
    privateKeyFile: join(directory, 'signing.pem'), hmacKeyFile: join(directory, 'integrity.txt'),
    commandsFile: join(directory, 'commands.json'), scopeId: 'scope:' + '71'.repeat(8), sourceId: 'source:' + '71'.repeat(8),
    sourceKeySha256: createHash('sha256').update(keys.publicKey.export({ type: 'spki', format: 'der' })).digest('hex'),
    origin: 'https://r71-public-fixture.vercel.app', targetPinsFile: join(directory, 'target-pins.json') };
  const pins = { schema: 'JENIOS_R70_TARGET_PINS_V1', origin: config.origin, projectId: 'prj_R71PublicFixture',
    deploymentId: 'dpl_R71PublicFixture', commitSha: '71'.repeat(20), scopeId: config.scopeId,
    sourceId: config.sourceId, sourceKeySha256: config.sourceKeySha256 };
  const command = { operationId: 'op:' + '71'.repeat(16), scenarios: R71_FIXTURE_SCENARIOS, positionContexts: R71_FIXTURE_POSITION_CONTEXTS };
  const commands = { schema: 'JENIOS_R71_PRIVATE_HOST_COMMANDS_V1', commands: [command] }, configPath = join(directory, 'host.json');
  put(config.privateKeyFile, privateKeyPem); put(config.hmacKeyFile, '71'.repeat(32)); put(config.targetPinsFile, pins);
  put(config.commandsFile, commands); put(configPath, config);
  return { directory, configPath, config, commands, command, pins, privateKeyPem };
}
const denied = (fn, code) => assert.throws(fn, e => e.code === code);

test('R71 offline host check observes the distinct queue and policy contract without state query session or loader', t => {
  const f = setup(t), result = inspectR71PrivateHost({ configPath: f.configPath, env: qa });
  assert.equal(result.schema, 'JENIOS_R71_PRIVATE_HOST_INSPECTION_V1'); assert.equal(result.qaConfigurationValid, true);
  assert.equal(result.doctor.profile, 'R71_PRIVATE_EVOLUTION'); assert.equal(result.commandsObserved, 1);
  assert.equal(result.transport.endpoint, '/api/platform/robot-private-policy-observations');
  assert.equal(result.privateRuntimePolicy.stateEndpoint, '/api/platform/robot-private-evolution-state');
  assert.equal(result.privateRuntimePolicy.policySelectionFromCommandAllowed, false);
  assert.equal(result.privateRuntimePolicy.internalCoreRetuning, false);
  assert.equal(result.preflight.executed, false); assert.equal(result.networkCalls, 0); assert.equal(result.sessionsCreated, 0);
  assert.equal(result.loaderConstructed, false); assert.equal(result.status, 'BLOCKED_PRIVATE_CORE');
  assert.deepEqual(readdirSync(f.config.outboxDirectory), []);
  for (const secret of [f.directory, f.privateKeyPem, f.pins.origin, f.pins.deploymentId])
    assert.ok(!JSON.stringify(result).includes(secret));
});

test('R71 host requires all inherited gates and its own opt-in before config access', async t => {
  const f = setup(t);
  for (const [flag, value] of Object.entries(qa)) {
    const env = { ...qa, [flag]: value === 'true' ? 'false' : value === 'false' ? 'true' : 'production' };
    await assert.rejects(() => runR71PrivateHost({ configPath: '/never/opened', mode: 'once', env }), e => e.code === 'R71_HOST_DISABLED');
    assert.equal(inspectR71PrivateHost({ configPath: f.configPath, env }).qaConfigurationValid, false);
  }
  const env = { ...qa }; delete env.JENIOS_ROBOT_R71_ENABLED;
  await assert.rejects(() => runR71PrivateHost({ configPath: f.configPath, mode: 'once', env }), e => e.code === 'R71_HOST_DISABLED');
  assert.deepEqual(readdirSync(f.config.outboxDirectory), []);
});

test('R71 fixed manifest and commands refuse policy booleans code callbacks and native-profile substitution', async t => {
  const f = setup(t); denied(() => inspectR70PrivateHost({ configPath: f.configPath }), 'R70_HOST_CONFIG');
  for (const field of ['forwardPositionOpen', 'wrapperVersion', 'getActiveState', 'send', 'fetch', 'profile', 'now']) {
    put(f.configPath, { ...f.config, [field]: true });
    denied(() => inspectR71PrivateHost({ configPath: f.configPath }), 'R71_HOST_CONFIG');
    await assert.rejects(() => runR71PrivateHost({ configPath: f.configPath, mode: 'once', env: qa, [field]: () => {} }),
      e => e.code === 'R71_HOST_RUN_CONFIG');
    put(f.configPath, f.config); put(f.config.commandsFile, { ...f.commands, commands: [{ ...f.command, [field]: true }] });
    denied(() => inspectR71PrivateHost({ configPath: f.configPath }), 'R71_HOST_COMMAND');
  }
  put(f.config.commandsFile, { schema: 'JENIOS_R68_PRIVATE_HOST_COMMANDS_V1', commands: [] });
  denied(() => inspectR71PrivateHost({ configPath: f.configPath }), 'R71_HOST_COMMANDS');
  const bad = structuredClone(f.commands); bad.commands[0].positionContexts[0].scenarioId = 'other';
  put(f.config.commandsFile, bad); denied(() => inspectR71PrivateHost({ configPath: f.configPath }), 'R71_POSITION_CONTEXTS');
  assert.deepEqual(readdirSync(f.config.outboxDirectory), []);
});

test('R71 retains custody fingerprint and orphan-lock refusal without executing substituted core bytes', async t => {
  const f = setup(t);
  put(join(f.config.coreDirectory, 'engine.mjs'), 'globalThis.__R71_BAD_EXECUTED__=true;');
  put(join(f.config.coreDirectory, 'service.mjs'), 'throw Error("must not execute");');
  const checked = inspectR71PrivateHost({ configPath: f.configPath, env: qa });
  assert.equal(checked.coreFiles.error, 'R71_HOST_CORE_HASH_MISMATCH');
  await assert.rejects(() => runR71PrivateHost({ configPath: f.configPath, mode: 'once', env: qa }), e => e.code === 'R71_HOST_CORE_HASH_MISMATCH');
  assert.equal(globalThis.__R71_BAD_EXECUTED__, undefined);
  chmodSync(f.config.privateKeyFile, 0o644);
  denied(() => inspectR71PrivateHost({ configPath: f.configPath }), 'R68_HOST_PRIVATE_FILE');
  chmodSync(f.config.privateKeyFile, 0o600);
  put(f.config.targetPinsFile, { ...f.pins, sourceKeySha256: '00'.repeat(32) });
  denied(() => inspectR71PrivateHost({ configPath: f.configPath }), 'R71_HOST_TARGET_PINS_MISMATCH');
  put(f.config.targetPinsFile, f.pins);
  const lock = join(f.config.outboxDirectory, 'r68-private-host.lock'); put(lock, { pid: 999999999, token: '71'.repeat(16) });
  const before = readFileSync(lock), blocked = inspectR71PrivateHost({ configPath: f.configPath });
  assert.equal(blocked.doctor.locks.find(l => l.kind === 'HOST').present, true);
  await assert.rejects(() => runR71PrivateHost({ configPath: f.configPath, mode: 'once', env: qa }), e => e.code === 'R71_HOST_RECOVERY_REQUIRED');
  assert.deepEqual(readFileSync(lock), before);
});

test('R71 actual CLI check remains offline and sanitizes failures and private paths', async t => {
  const f = setup(t), env = { PATH: process.env.PATH || '/usr/bin:/bin', ...qa, JENIOS_ROBOT_R71_ENABLED: 'false' };
  const run = args => new Promise(resolve => execFile(process.execPath,
    [join(root, 'scripts/platform/research/r71-private-host.mjs'), ...args], { cwd: root, env, timeout: 10000 },
    (error, stdout, stderr) => resolve({ code: error?.code ?? 0, stdout, stderr, json: JSON.parse(stdout) })));
  const result = await run(['--check', '--config', f.configPath]);
  assert.equal(result.code, 1); assert.equal(result.json.qaConfigurationValid, false); assert.equal(result.json.networkCalls, 0);
  const blocked = await run(['--once', '--config', f.configPath]); assert.equal(blocked.json.code, 'R71_HOST_DISABLED');
  for (const secret of [f.directory, f.privateKeyPem, f.pins.origin]) assert.ok(!(result.stdout + result.stderr + blocked.stdout).includes(secret));
  assert.deepEqual(readdirSync(f.config.outboxDirectory), []);
});

test('R71 original-runtime APIs reject forged handles or executable callbacks before file mutation', async t => {
  const f = setup(t), fake = Object.freeze(Object.assign(Object.create(null), { schema: 'JENIOS_R67_PRIVATE_CORE_HANDLE_V1' }));
  let calls = 0;
  const config = { enabled: true, handle: fake, scopeId: f.config.scopeId, sourceId: f.config.sourceId,
    sessionId: 'session:' + '71'.repeat(8), privateKeyPem: f.privateKeyPem, getActiveState: () => { calls++; } };
  denied(() => createR71PrivateCoreSource(config), 'R67_CORE_HANDLE');
  await assert.rejects(() => captureR71VerifiedPrivateBatch(fake, { scenarios: f.command.scenarios,
    positionContexts: f.command.positionContexts, forwardPositionOpen: true, nowMs: Date.now() }), e => e.code === 'R67_CORE_HANDLE');
  const { sessionId, ...emitter } = config;
  denied(() => createR71DurableEmitter({ ...emitter, directory: f.config.outboxDirectory, key: '71'.repeat(32) }), 'R67_CORE_HANDLE');
  denied(() => createR71PrivateCoreSource({ ...config, analyzeRequest: () => { calls++; } }), 'R71_SOURCE_CONFIG');
  assert.equal(calls, 0); assert.deepEqual(readdirSync(f.config.outboxDirectory), []);
});
