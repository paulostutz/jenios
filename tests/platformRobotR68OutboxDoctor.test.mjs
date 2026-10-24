import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, readdirSync, lstatSync,
  chmodSync, symlinkSync, linkSync, unlinkSync, truncateSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { diagnoseR68Outbox } from '../lib/platform/research/robot-r68-outbox-doctor.mjs';
import { createPrivateDurableFile } from '../lib/platform/research/robot-private-durable-file.mjs';
import { createR66ObservationOutbox, R66_OUTBOX_FILE } from '../lib/platform/research/robot-r66-observation-outbox.mjs';
import { createR67PrivateCaptureOutbox, R67_OUTBOX_FILE, R67_OUTBOX_LOCK,
  R67_DELIVERY_LOCK } from '../lib/platform/research/robot-r67-private-capture-outbox.mjs';
import { createR67ProtocolFixture, R67_PROTOCOL_FIXTURE_KIND } from './fixtures/r67-private-protocol-fixture.mjs';
import { verifyR67PrivateObservationRecord, createR67IntakeAcknowledgement } from '../lib/platform/research/robot-r67-private-protocol.mjs';

const NOW = Date.UTC(2026, 9, 24, 22), SESSION = 'session:6767676767676767';
const op = n => 'op:' + n.toString(16).padStart(32, '0');
const hash = value => createHash('sha256').update(value).digest('hex');
const denied = (fn, code) => assert.throws(fn, error => code ? error.code === code : error.name === 'ValidationError');
function directory(t) {
  const path = mkdtempSync('/tmp/jenios-r68-doctor-');
  t.after(() => { chmodSync(path, 0o700); rmSync(path, { recursive: true, force: true }); });
  return path;
}
function metadata(path) {
  const s = lstatSync(path, { bigint: true });
  return { inode: String(s.ino), mode: String(s.mode), modified: String(s.mtimeNs), changed: String(s.ctimeNs), size: String(s.size) };
}
function preservedFiles(path) {
  return Object.fromEntries(readdirSync(path).sort().map(name => [name,
    { metadata: metadata(`${path}/${name}`), bytes: readFileSync(`${path}/${name}`).toString('base64') }]));
}
function r66Fixture(t, present = true) {
  const golden = JSON.parse(readFileSync(new URL('./fixtures/r67-r66-certified-outbox.json', import.meta.url), 'utf8'));
  const dir = directory(t), config = { directory: dir, key: golden.testOnlyHmacKey, trustedSource: golden.trustedSource };
  if (present) writeFileSync(`${dir}/${R66_OUTBOX_FILE}`, golden.before, { mode: 0o600 });
  return { dir, golden, config, diagnose: nowMs => diagnoseR68Outbox({ profile: 'R66_OBSERVATION', ...config, nowMs }) };
}
async function r67Fixture(t, present = true) {
  const dir = directory(t), fixture = await createR67ProtocolFixture({ nowMs: NOW, operationId: op(1) });
  assert.equal(fixture.fixtureEvidence, R67_PROTOCOL_FIXTURE_KIND);
  const config = { directory: dir, key: '8'.repeat(64), trustedSource: fixture.trustedSource };
  const outbox = present ? createR67PrivateCaptureOutbox(config) : null;
  if (outbox) outbox.reserveSession({ sessionId: SESSION, startedAtMs: NOW });
  const capture = record => outbox.capture({ operationId: record.provenance.operationId,
    inputDigest: record.provenance.inputDigest, sessionId: record.envelope.payload.sessionId, produce: async () => ({ record }) });
  const next = (n, patch = {}) => createR67ProtocolFixture({ nowMs: NOW, sequence: n,
    operationId: op(n), privateKeyPem: fixture.privateKeyPem, ...patch });
  return { dir, config, fixture, outbox, capture, next,
    diagnose: nowMs => diagnoseR68Outbox({ profile: 'R67_PRIVATE_CAPTURE', ...config, nowMs }) };
}
function invariantReport(report) {
  assert.equal(report.readOnly, true);
  for (const field of ['processOwnershipVerified', 'exclusiveHostFenceVerified', 'monotonicWitnessVerified',
    'recoveryAuthorized', 'operationalReady', 'hostedReadinessVerified', 'privateRuntimeExecuted',
    'customerMonitoringActive', 'productionChanged']) assert.equal(report[field], false, field);
  for (const field of ['realOrdersSent', 'externalPaperOrdersSent', 'paidProviderCalls', 'hostedDatabaseChanges'])
    assert.equal(report[field], 0, field);
  for (const field of ['actualBrokerPnl', 'actualLossesAvoided', 'realTradeAccuracy']) assert.equal(report[field], null, field);
  assert.equal(report.recoveryPlan.executable, false); assert.equal(report.recoveryPlan.automaticUnlockAvailable, false);
}

test('R68 diagnoses an empty private directory without creating a file, runtime or session in either domain', async t => {
  const fixtures = [r66Fixture(t, false), await r67Fixture(t, false)];
  for (const f of fixtures) {
    const before = metadata(f.dir), report = f.diagnose(NOW);
    assert.equal(report.status, 'OBSERVED_EMPTY'); assert.equal(report.observationStable, true);
    assert.equal(report.inventoryComplete, true); assert.equal(report.snapshot.present, false);
    assert.equal(report.snapshot.validated, false); assert.equal(report.queue.entries, 0); assert.equal(report.queue.sessions, 0);
    assert.equal(report.capacity.remainingEntries, 5000); assert.deepEqual(readdirSync(f.dir), []);
    assert.deepEqual(metadata(f.dir), before); invariantReport(report);
  }
});

test('R68 inspects the certified R66 bytes and calculates expiry without changing its retained state', t => {
  const f = r66Fixture(t), before = preservedFiles(f.dir), outbox = createR66ObservationOutbox(f.config);
  const entry = outbox.read().entries[0], report = f.diagnose(entry.record.envelope.payload.expiresAtMs);
  assert.equal(report.snapshot.validated, true); assert.equal(report.snapshot.hmacVerified, true);
  assert.equal(report.snapshot.sha256, hash(Buffer.from(f.golden.before)));
  assert.equal(report.queue.entries, 1); assert.equal(report.queue.persistedStates.PENDING, 1);
  assert.equal(report.queue.statesAtObservation.EXPIRED_UNCONFIRMED, 1); assert.equal(report.queue.newlyObservedExpired, 1);
  assert.equal(report.queue.expiryCalculationOnly, true); assert.equal(outbox.read().entries[0].expiredAtMs, null);
  assert.deepEqual(preservedFiles(f.dir), before);
  assert.equal(outbox.diagnose().snapshot.validated, true);
  const text = JSON.stringify(report);
  for (const privateValue of [f.config.key, f.config.trustedSource.publicKeyPem, f.golden.operationId])
    assert.equal(text.includes(privateValue), false);
  for (const field of ['"payload"', '"record"', '"provenance"', '"token"', 'PRIVATE KEY']) assert.equal(text.includes(field), false);
  invariantReport(report);
});

test('R68 preserves unknown outcomes and diagnoses R67 expired predecessors without blocking other sessions', async t => {
  const f = await r67Fixture(t); await f.capture(f.fixture.record);
  f.outbox.beginAttempt({ operationId: op(1), nowMs: NOW });
  const second = await f.next(2, { nowMs: NOW + 1000 }); await f.capture(second.record);
  const nextSession = 'session:6767676767676768';
  f.outbox.reserveSession({ sessionId: nextSession, startedAtMs: NOW + 120000 });
  const fresh = await f.next(3, { sequence: 1, sessionId: nextSession, nowMs: NOW + 120000 }); await f.capture(fresh.record);
  const before = preservedFiles(f.dir), report = f.diagnose(NOW + 120000);
  assert.equal(report.queue.persistedStates.UNCONFIRMED, 1); assert.equal(report.queue.persistedStates.PENDING, 2);
  assert.equal(report.queue.statesAtObservation.EXPIRED_UNCONFIRMED, 1);
  assert.equal(report.queue.inFlightAttempts, 1); assert.equal(report.queue.unknownOutcomeEntries, 1);
  assert.equal(report.queue.sequenceBlockedEntries, 1); assert.equal(report.queue.expiredPredecessorBlockedEntries, 1);
  assert.equal(report.queue.eligibleByQueueMetadata, 1); assert.equal(report.queue.blockedSessions.length, 1);
  assert.equal(report.queue.blockedSessions[0].sessionId, SESSION);
  assert.deepEqual(preservedFiles(f.dir), before);
  const entry = f.outbox.read().entries[0]; assert.equal(entry.expiredAtMs, null);
  assert.equal(entry.attempts[0].outcome, 'IN_FLIGHT'); assert.equal(entry.attempts[0].ack, null);
  assert.equal(f.outbox.diagnose().snapshot.validated, true); invariantReport(report);
});

test('R68 counts only the already verified persisted ACK and never turns expiry or an in-flight attempt into delivery', async t => {
  const f = await r67Fixture(t); await f.capture(f.fixture.record);
  const { attemptId } = f.outbox.beginAttempt({ operationId: op(1), nowMs: NOW });
  const { receipt } = verifyR67PrivateObservationRecord(f.fixture.record, { trustedSource: f.config.trustedSource, nowMs: NOW });
  f.outbox.resolveAttempt({ operationId: op(1), attemptId, nowMs: NOW + 1,
    acknowledgement: { httpStatus: 202, body: createR67IntakeAcknowledgement({ receipt, record: f.fixture.record }, 'STORED') } });
  const second = await f.next(2, { nowMs: NOW + 2 }); await f.capture(second.record);
  f.outbox.beginAttempt({ operationId: op(2), nowMs: NOW + 2 });
  const before = preservedFiles(f.dir), report = f.diagnose(NOW + 120003);
  assert.equal(report.queue.statesAtObservation.ACKNOWLEDGED, 1);
  assert.equal(report.queue.statesAtObservation.EXPIRED_UNCONFIRMED, 1);
  assert.equal(report.queue.inFlightAttempts, 1); assert.equal(report.queue.unknownOutcomeEntries, 1);
  assert.deepEqual(preservedFiles(f.dir), before); invariantReport(report);
});

test('R68 observes live and SIGKILL-retained transaction/delivery locks without proving ownership or unlocking', async t => {
  const f = await r67Fixture(t); await f.capture(f.fixture.record);
  const code = `
    import { createPrivateDurableFile } from './lib/platform/research/robot-private-durable-file.mjs';
    const config=JSON.parse(process.env.JENIOS_R68_TEST_INPUT); delete process.env.JENIOS_R68_TEST_INPUT;
    const file=createPrivateDurableFile(config);
    await file.withDeliveryLease(()=>file.transactAsync(async()=>{
      process.stdout.write('LOCKED\\n'); process.stdin.resume();
      await new Promise(resolve=>process.stdin.once('end',resolve));
      return {changed:false,value:null};
    }));
  `;
  const child = spawn(process.execPath, ['--input-type=module', '-e', code], { cwd: process.cwd(),
    env: { ...process.env, JENIOS_R68_TEST_INPUT: JSON.stringify({ profile: 'R67_PRIVATE_CAPTURE', directory: f.dir, key: f.config.key }) },
    stdio: ['pipe', 'pipe', 'pipe'] });
  t.after(() => { if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL'); });
  const ready = await Promise.race([once(child.stdout, 'data').then(([bytes]) => bytes.toString()),
    once(child, 'error').then(([error]) => { throw error; }),
    new Promise((_, reject) => { const timer = setTimeout(() => reject(Error('child did not acquire locks')), 10000); timer.unref(); })]);
  assert.equal(ready, 'LOCKED\n');
  const before = preservedFiles(f.dir), live = f.diagnose(NOW + 1);
  assert.equal(live.status, 'BLOCKED_LOCK_PRESENT'); assert.equal(live.snapshot.validated, true);
  assert.deepEqual(live.locks.filter(lock => lock.present).map(lock => lock.kind), ['TRANSACTION', 'DELIVERY']);
  for (const lock of live.locks.filter(lock => lock.present)) {
    assert.equal(lock.formatValid, true); assert.equal(lock.declaredPid, child.pid);
    assert.equal(JSON.stringify(live).includes(JSON.parse(readFileSync(`${f.dir}/${lock.name}`, 'utf8')).token), false);
  }
  denied(() => f.outbox.read(), 'R67_OUTBOX_LOCKED');
  assert.deepEqual(preservedFiles(f.dir), before); invariantReport(live);
  const exited = once(child, 'exit'); child.kill('SIGKILL'); const [, signal] = await exited; assert.equal(signal, 'SIGKILL');
  const dead = f.diagnose(NOW + 2);
  assert.equal(dead.status, 'BLOCKED_LOCK_PRESENT'); assert.deepEqual(dead.locks, live.locks);
  assert.deepEqual(preservedFiles(f.dir), before);
  denied(() => createR67PrivateCaptureOutbox(f.config), 'R67_OUTBOX_LOCKED');
  invariantReport(dead);
});

test('R68 includes only the closed R67 host lock and retains malformed lock bytes without repair', async t => {
  const f = await r67Fixture(t), hostName = 'r68-private-host.lock', token = 'd'.repeat(32);
  writeFileSync(`${f.dir}/${hostName}`, JSON.stringify({ pid: process.pid, token }), { mode: 0o600 });
  writeFileSync(`${f.dir}/${R67_DELIVERY_LOCK}`, '', { mode: 0o600 });
  const before = preservedFiles(f.dir), report = f.diagnose(NOW);
  const host = report.locks.find(lock => lock.kind === 'HOST'); assert.equal(host.name, hostName);
  assert.equal(host.present, true); assert.equal(host.formatValid, true); assert.equal(host.declaredPid, process.pid);
  assert.equal(report.locks.find(lock => lock.kind === 'DELIVERY').formatValid, false);
  assert.equal(JSON.stringify(report).includes(token), false); assert.deepEqual(preservedFiles(f.dir), before);
  const r66 = r66Fixture(t); writeFileSync(`${r66.dir}/${hostName}`, JSON.stringify({ pid: process.pid, token }), { mode: 0o600 });
  const oldDomain = r66.diagnose(NOW); assert.equal(oldDomain.locks.length, 2);
  assert.equal(oldDomain.unrecognizedEntries, 1); assert.equal(oldDomain.status, 'REVIEW_UNRECOGNIZED_ENTRIES');
});

test('R68 inventories uncommitted temporary bytes without selecting, promoting or deleting them', async t => {
  const f = await r67Fixture(t); await f.capture(f.fixture.record);
  const name = '.r67-private-capture.' + 'a'.repeat(32) + '.tmp', partial = '{"payload":{"revision":999999';
  writeFileSync(`${f.dir}/${name}`, partial, { mode: 0o600 });
  const before = preservedFiles(f.dir), report = f.diagnose(NOW);
  assert.equal(report.status, 'REVIEW_TEMPORARY_FILES'); assert.equal(report.temporaryFiles.length, 1);
  assert.equal(report.temporaryFiles[0].sha256, hash(partial)); assert.equal(report.temporaryFiles[0].hmacVerified, false);
  assert.equal(report.temporaryFiles[0].classification, 'UNCOMMITTED_FILE_NOT_PROMOTED');
  assert.equal(report.snapshot.revision, 2); assert.equal(report.queue.entries, 1);
  assert.equal(report.recoveryPlan.snapshotSelectionAuthorized, false); assert.deepEqual(preservedFiles(f.dir), before);
});

test('R68 rejects incorrect HMAC, source binding and signed-record corruption even behind an existing lock', async t => {
  const f = await r67Fixture(t); await f.capture(f.fixture.record);
  const path = `${f.dir}/${R67_OUTBOX_FILE}`, original = readFileSync(path);
  writeFileSync(`${f.dir}/${R67_OUTBOX_LOCK}`, JSON.stringify({ pid: process.pid, token: 'f'.repeat(32) }), { mode: 0o600 });
  denied(() => diagnoseR68Outbox({ profile: 'R67_PRIVATE_CAPTURE', ...f.config, key: '9'.repeat(64), nowMs: NOW }), 'R67_OUTBOX_HMAC_MISMATCH');
  denied(() => diagnoseR68Outbox({ profile: 'R67_PRIVATE_CAPTURE', ...f.config,
    trustedSource: { ...f.config.trustedSource, sourceId: 'source:ffffffffffffffff' }, nowMs: NOW }), 'R67_OUTBOX_INVALID_SNAPSHOT');
  writeFileSync(path, original.subarray(0, original.length - 5)); denied(() => f.diagnose(NOW), 'R67_OUTBOX_INVALID_JSON');
  writeFileSync(path, original); unlinkSync(`${f.dir}/${R67_OUTBOX_LOCK}`);
  const file = createPrivateDurableFile({ profile: 'R67_PRIVATE_CAPTURE', directory: f.dir, key: f.config.key });
  file.transact(payload => {
    const changed = JSON.parse(JSON.stringify(payload)); changed.entries[0].record.envelope.signatureBase64 = 'A'.repeat(86) + '==';
    return { changed: true, payload: changed, value: null };
  });
  const corrupt = preservedFiles(f.dir); denied(() => f.diagnose(NOW)); assert.deepEqual(preservedFiles(f.dir), corrupt);
});

test('R68 rejects unsafe inspected files instead of following links or reading public permissions', async t => {
  const f = await r67Fixture(t), path = `${f.dir}/${R67_OUTBOX_FILE}`, bytes = readFileSync(path);
  chmodSync(path, 0o644); denied(() => f.diagnose(NOW), 'R67_OUTBOX_FILE_UNSAFE'); chmodSync(path, 0o600);
  const linked = `${f.dir}/linked`; linkSync(path, linked);
  denied(() => f.diagnose(NOW), 'R67_OUTBOX_FILE_UNSAFE'); unlinkSync(linked);
  unlinkSync(path); writeFileSync(linked, bytes, { mode: 0o600 }); symlinkSync(linked, path);
  denied(() => f.diagnose(NOW), 'R67_OUTBOX_FILE_UNSAFE'); unlinkSync(path); unlinkSync(linked);
  writeFileSync(path, bytes, { mode: 0o600 }); symlinkSync(path, `${f.dir}/r68-private-host.lock`);
  denied(() => f.diagnose(NOW), 'R67_OUTBOX_FILE_UNSAFE');
  unlinkSync(`${f.dir}/r68-private-host.lock`);
  const fifo = spawnSync('mkfifo', ['-m', '600', `${f.dir}/r68-private-host.lock`], { encoding: 'utf8', timeout: 10000 });
  assert.equal(fifo.status, 0, fifo.stderr || fifo.error?.message);
  denied(() => f.diagnose(NOW), 'R67_OUTBOX_FILE_UNSAFE');
});

test('R68 bounds directory, temporary-file and byte inspection and admits no arbitrary profile or callback', async t => {
  const f = await r67Fixture(t);
  denied(() => diagnoseR68Outbox({ profile: 'CUSTOM', ...f.config, nowMs: NOW }), 'R68_DOCTOR_PROFILE');
  denied(() => diagnoseR68Outbox({ profile: 'R67_PRIVATE_CAPTURE', ...f.config, nowMs: NaN }), 'R68_DOCTOR_CLOCK');
  denied(() => diagnoseR68Outbox({ profile: 'R67_PRIVATE_CAPTURE', ...f.config, nowMs: NOW, recover: () => {} }), 'R68_DOCTOR_CONFIG');
  for (let n = 0; n < 17; n++) writeFileSync(`${f.dir}/.r67-private-capture.${n.toString(16).padStart(32, '0')}.tmp`, '', { mode: 0o600 });
  denied(() => f.diagnose(NOW), 'R67_OUTBOX_INSPECTION_TEMPORARY_LIMIT');
  for (const name of readdirSync(f.dir).filter(name => name.endsWith('.tmp'))) unlinkSync(`${f.dir}/${name}`);
  for (let n = 0; n < 128; n++) writeFileSync(`${f.dir}/unknown-${n}`, '', { mode: 0o600 });
  denied(() => f.diagnose(NOW), 'R67_OUTBOX_INSPECTION_ENTRY_LIMIT');
  for (const name of readdirSync(f.dir).filter(name => name.startsWith('unknown-'))) unlinkSync(`${f.dir}/${name}`);
  truncateSync(`${f.dir}/${R67_OUTBOX_FILE}`, 32 * 1024 * 1024 + 1);
  denied(() => f.diagnose(NOW), 'R67_OUTBOX_INSPECTION_SIZE_LIMIT');
});

test('R68 reports a file changing during read as inconclusive and does not return queue authorization', async t => {
  const f = await r67Fixture(t); await f.capture(f.fixture.record);
  const code = `
    import fs from 'node:fs';
    import { syncBuiltinESMExports } from 'node:module';
    const config=JSON.parse(process.env.JENIOS_R68_TEST_INPUT); delete process.env.JENIOS_R68_TEST_INPUT;
    const path=config.directory+'/r67-private-capture-outbox.json', inode=fs.lstatSync(path).ino;
    const originalRead=fs.readSync; let changed=false;
    fs.readSync=function(fd,...args) {
      const length=originalRead(fd,...args);
      if(!changed && fs.fstatSync(fd).ino===inode) { changed=true; fs.appendFileSync(path,' '); }
      return length;
    };
    syncBuiltinESMExports();
    const { diagnoseR68Outbox }=await import('./lib/platform/research/robot-r68-outbox-doctor.mjs');
    const report=diagnoseR68Outbox(config);
    process.stdout.write(JSON.stringify({changed,report}));
  `;
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', code], { cwd: process.cwd(), encoding: 'utf8', timeout: 10000,
    env: { ...process.env, JENIOS_R68_TEST_INPUT: JSON.stringify({ profile: 'R67_PRIVATE_CAPTURE', ...f.config, nowMs: NOW }) } });
  assert.equal(child.status, 0, child.stderr || child.error?.message);
  const { changed, report } = JSON.parse(child.stdout); assert.equal(changed, true);
  assert.equal(report.status, 'INCONCLUSIVE_CHANGE'); assert.equal(report.observationStable, false);
  assert.equal(report.snapshot.validated, false); assert.equal(report.queue, null); assert.equal(report.capacity, null);
  invariantReport(report);
});
