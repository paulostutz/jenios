import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync, chmodSync, rmSync, readFileSync, writeFileSync, existsSync,
  readdirSync, statSync, symlinkSync, mkdirSync, linkSync, unlinkSync,
} from 'node:fs';
import { createHmac } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { studyR63Observations } from '../lib/platform/research/robot-r63-observation-study.mjs';
import { createR63EvolutionState, registerR63Evaluation } from '../lib/platform/research/robot-r63-continuous-evolution.mjs';
import { buildR63AdminReport } from '../lib/platform/research/robot-r63-admin-report.mjs';
import {
  readR63Journal, appendR63Journal, withR63WorkerLease,
  R63_JOURNAL_FILE, R63_JOURNAL_LOCK, R63_WORKER_LOCK, R63_JOURNAL_LIMITS,
} from '../lib/platform/research/robot-r63-durable-journal.mjs';

const T = Date.UTC(2026, 9, 24, 12), SCOPE = 'fixture:00000001', KEY = 'ab'.repeat(32);
const clone = value => JSON.parse(JSON.stringify(value));
const rejects = (fn, code) => assert.throws(fn, error => error?.code === code);
function withDirectory(run) {
  const directory = mkdtempSync(join(tmpdir(), 'jenios-r63-journal-'));
  chmodSync(directory, 0o700);
  try { return run(directory); } finally { rmSync(directory, { recursive: true, force: true }); }
}
async function withAsyncDirectory(run) {
  const directory = mkdtempSync(join(tmpdir(), 'jenios-r63-worker-'));
  chmodSync(directory, 0o700);
  try { return await run(directory); } finally { rmSync(directory, { recursive: true, force: true }); }
}
function fixture({ scopeId = SCOPE, events = false, asOfMs = T - 10, createdAtMs = T - 100,
  evolution, generatedAtMs = T + 1000, cycle = 1 } = {}) {
  const rows = events ? [1, 2, 3].map(number => ({
    evidenceKind: 'SYNTHETIC_FIXTURE', scopeId, eventId: `evt:${number.toString(16).padStart(8, '0')}`,
    policyVersion: 'research:r63-v1', robot: 'ultrafast', kind: 'incident', decision: 'ALLOW',
    issue: 'STALE_CONTEXT', marketAgeMs: 600 + number * 10,
    occurredAtMs: T - 90 + number, observedAtMs: T - 80 + number,
  })) : [];
  const study = studyR63Observations(rows, { scopeId, nowMs: asOfMs, windowStartMs: T - 1000 });
  const state = evolution ?? createR63EvolutionState({ scopeId, nowMs: createdAtMs });
  const report = buildR63AdminReport({ study, evolution: state,
    period: { startMs: T - 1000, endMs: T + 200 }, generatedAtMs });
  return { cycleId: `cycle:${cycle.toString(16).padStart(16, '0')}`, study, evolution: state, report };
}
function registered(planId = 'plan:00000001') {
  const record = fixture({ events: true });
  const caseDefinitions = [[100, true], [200, true], [600, false], [700, false], [900, false], [1000, false]]
    .map(([age, expectedAllow], index) => ({ caseId: `case:${(index + 1).toString(16).padStart(8, '0')}`,
      snapshotAgesMs: [age, age], expectedAllow }));
  const evolution = registerR63Evaluation({ state: record.evolution, study: record.study, nowMs: T,
    plan: { planId, scopeId: SCOPE, evidenceKind: 'SYNTHETIC_FIXTURE',
      startsAtMs: T + 10, endsAtMs: T + 100, caseDefinitions } });
  return fixture({ events: true, evolution });
}
function put(directory, record = fixture(), expectedRevision = 0) {
  return appendR63Journal({ directory, key: KEY, record, expectedRevision });
}
const stable = value => value === null || typeof value !== 'object' ? JSON.stringify(value) :
  Array.isArray(value) ? `[${value.map(stable).join(',')}]` :
    `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
function rewriteSigned(directory, change) {
  const path = join(directory, R63_JOURNAL_FILE), envelope = JSON.parse(readFileSync(path, 'utf8'));
  change(envelope.payload);
  envelope.hmac = createHmac('sha256', Buffer.from(KEY, 'hex'))
    .update('JENIOS_R63_DURABLE_JOURNAL_V1\0').update(stable(envelope.payload)).digest('hex');
  writeFileSync(path, JSON.stringify(envelope));
}

test('R63 journal starts empty, persists a reconstructed report and returns an immutable private snapshot', () => withDirectory(directory => {
  const empty = readR63Journal({ directory, key: KEY });
  assert.equal(empty.revision, 0); assert.deepEqual(empty.entries, []);
  const record = registered(), stored = put(directory, record);
  assert.equal(stored.revision, 1); assert.deepEqual(stored.entries, [record]);
  assert.deepEqual(readR63Journal({ directory, key: KEY }), stored);
  assert.equal(statSync(join(directory, R63_JOURNAL_FILE)).mode & 0o777, 0o600);
  assert.equal(statSync(directory).mode & 0o777, 0o700);
  assert.deepEqual(readdirSync(directory), [R63_JOURNAL_FILE]);
  assert.equal(Object.isFrozen(stored.entries[0].report), true);
  assert.equal(Object.isFrozen(stored.entries), true);
  assert.equal(stored.entries[0].report.delivery, 'NOT_DISPATCHED');
  assert.equal(stored.entries[0].report.scheduledDeliveryActive, false);
  assert.equal(readFileSync(join(directory, R63_JOURNAL_FILE), 'utf8').includes(KEY), false);
}));

test('R63 journal retry of an identical cycle is idempotent even with the prior CAS revision', () => withDirectory(directory => {
  const record = fixture(), first = put(directory, record);
  const reordered = Object.fromEntries(Object.entries(record).reverse());
  assert.deepEqual(put(directory, reordered, 0), first);
  assert.equal(readR63Journal({ directory, key: KEY }).entries.length, 1);
  rejects(() => put(directory, record, 2), 'R63_JOURNAL_REVISION_MISMATCH');
}));

test('R63 journal refuses changed content under an existing cycle identifier', () => withDirectory(directory => {
  put(directory, fixture());
  rejects(() => put(directory, fixture({ generatedAtMs: T + 1001 }), 1), 'R63_JOURNAL_CYCLE_REPLAY_CONFLICT');
  assert.equal(readR63Journal({ directory, key: KEY }).revision, 1);
}));

test('R63 journal CAS rejects stale writers and cleans only its transient lock', () => withDirectory(directory => {
  put(directory, fixture());
  rejects(() => put(directory, fixture({ cycle: 2 }), 0), 'R63_JOURNAL_REVISION_MISMATCH');
  assert.deepEqual(readdirSync(directory), [R63_JOURNAL_FILE]);
  assert.equal(put(directory, fixture({ cycle: 2 }), 1).revision, 2);
}));

test('R63 journal requires a configured key and an explicit nonnegative expected revision', () => withDirectory(directory => {
  for (const key of [undefined, '', 'x'.repeat(64), 'ab'.repeat(31), 123])
    rejects(() => readR63Journal({ directory, key }), 'R63_JOURNAL_KEY_REQUIRED');
  for (const expectedRevision of [undefined, -1, NaN, '0', 0.5])
    rejects(() => appendR63Journal({ directory, key: KEY, record: fixture(), expectedRevision }), 'R63_JOURNAL_REVISION_REQUIRED');
  assert.deepEqual(readdirSync(directory), []);
}));

test('R63 journal refuses in-repository, relative, missing and non-private directories', () => withDirectory(directory => {
  rejects(() => readR63Journal({ directory: process.cwd(), key: KEY }), 'R63_JOURNAL_IN_REPOSITORY_FORBIDDEN');
  rejects(() => readR63Journal({ directory: 'relative/path', key: KEY }), 'R63_JOURNAL_DIRECTORY_UNSAFE');
  rejects(() => readR63Journal({ directory: join(directory, 'missing'), key: KEY }), 'R63_JOURNAL_DIRECTORY_UNSAFE');
  assert.equal(existsSync(join(directory, 'missing')), false);
  chmodSync(directory, 0o755);
  rejects(() => readR63Journal({ directory, key: KEY }), 'R63_JOURNAL_DIRECTORY_UNSAFE');
  chmodSync(directory, 0o700);
}));

test('R63 journal rejects a symlink directory and an ancestor symlink', () => withDirectory(directory => {
  const real = join(directory, 'real'), nested = join(real, 'nested'), link = join(directory, 'link');
  mkdirSync(real, { mode: 0o700 }); mkdirSync(nested, { mode: 0o700 }); symlinkSync(real, link, 'dir');
  rejects(() => readR63Journal({ directory: link, key: KEY }), 'R63_JOURNAL_DIRECTORY_UNSAFE');
  rejects(() => readR63Journal({ directory: join(link, 'nested'), key: KEY }), 'R63_JOURNAL_DIRECTORY_UNSAFE');
}));

test('R63 journal never follows a symlink file or modifies its target', () => withDirectory(directory => {
  const target = join(directory, 'target.txt'); writeFileSync(target, 'private target', { mode: 0o600 });
  symlinkSync(target, join(directory, R63_JOURNAL_FILE));
  rejects(() => readR63Journal({ directory, key: KEY }), 'R63_JOURNAL_FILE_UNSAFE');
  rejects(() => put(directory), 'R63_JOURNAL_FILE_UNSAFE');
  assert.equal(readFileSync(target, 'utf8'), 'private target');
  assert.equal(existsSync(join(directory, R63_JOURNAL_LOCK)), false);
}));

test('R63 journal refuses permissive file modes and hard-linked snapshots', () => withDirectory(directory => {
  put(directory); const file = join(directory, R63_JOURNAL_FILE);
  chmodSync(file, 0o644);
  rejects(() => readR63Journal({ directory, key: KEY }), 'R63_JOURNAL_FILE_UNSAFE');
  chmodSync(file, 0o600);
  const second = join(directory, 'hardlink.json'); linkSync(file, second);
  rejects(() => readR63Journal({ directory, key: KEY }), 'R63_JOURNAL_FILE_UNSAFE');
  unlinkSync(second);
  assert.equal(readR63Journal({ directory, key: KEY }).revision, 1);
}));

test('R63 journal keeps an interrupted or competing lock intact and fails closed', () => withDirectory(directory => {
  const lock = join(directory, R63_JOURNAL_LOCK), contents = '{"pid":99999999,"token":"another-owner"}';
  writeFileSync(lock, contents, { mode: 0o600 });
  rejects(() => readR63Journal({ directory, key: KEY }), 'R63_JOURNAL_LOCKED');
  rejects(() => put(directory), 'R63_JOURNAL_LOCKED');
  assert.equal(readFileSync(lock, 'utf8'), contents);
  assert.equal(existsSync(join(directory, R63_JOURNAL_FILE)), false);
}));

test('R63 journal never removes a pre-existing symlink lock or its target', () => withDirectory(directory => {
  const target = join(directory, 'other-lock'); writeFileSync(target, 'do not alter', { mode: 0o600 });
  symlinkSync(target, join(directory, R63_JOURNAL_LOCK));
  rejects(() => put(directory), 'R63_JOURNAL_LOCKED');
  assert.equal(readFileSync(target, 'utf8'), 'do not alter');
  assert.equal(existsSync(join(directory, R63_JOURNAL_LOCK)), true);
}));

test('R63 journal detects corruption and a wrong integrity key before trusting the payload', () => withDirectory(directory => {
  put(directory);
  rejects(() => readR63Journal({ directory, key: 'cd'.repeat(32) }), 'R63_JOURNAL_HMAC_MISMATCH');
  const file = join(directory, R63_JOURNAL_FILE), envelope = JSON.parse(readFileSync(file, 'utf8'));
  envelope.payload.entries[0].report.actualBrokerPnl = 100;
  writeFileSync(file, JSON.stringify(envelope));
  rejects(() => readR63Journal({ directory, key: KEY }), 'R63_JOURNAL_HMAC_MISMATCH');
  writeFileSync(file, '{"truncated":');
  rejects(() => readR63Journal({ directory, key: KEY }), 'R63_JOURNAL_INVALID_JSON');
}));

test('R63 journal bounds file reading before parsing', () => withDirectory(directory => {
  const file = join(directory, R63_JOURNAL_FILE);
  writeFileSync(file, Buffer.alloc(R63_JOURNAL_LIMITS.maxBytes + 1, 32), { mode: 0o600 });
  rejects(() => readR63Journal({ directory, key: KEY }), 'R63_JOURNAL_SIZE_LIMIT');
}));

test('R63 journal reconstructs every signed study, state and report instead of trusting a valid local HMAC alone', () => {
  const mutations = [
    entry => { entry.study.metrics.eventCount = 999; },
    entry => { entry.evolution.activeVersion.maxAgeMs = 250; },
    entry => { entry.report.actualBrokerPnl = 100; },
    entry => { entry.report.delivery = 'DISPATCHED'; },
  ];
  for (const change of mutations) withDirectory(directory => {
    put(directory);
    rewriteSigned(directory, payload => change(payload.entries[0]));
    assert.throws(() => readR63Journal({ directory, key: KEY }), error => /^R63_JOURNAL_/.test(error?.code || ''));
  });
});

test('R63 journal rejects invalid signed revision counts and duplicate cycle entries', () => {
  withDirectory(directory => {
    put(directory); rewriteSigned(directory, payload => { payload.revision = 9; });
    rejects(() => readR63Journal({ directory, key: KEY }), 'R63_JOURNAL_INVALID_SNAPSHOT');
  });
  withDirectory(directory => {
    put(directory); rewriteSigned(directory, payload => { payload.entries.push(clone(payload.entries[0])); payload.revision = 2; });
    rejects(() => readR63Journal({ directory, key: KEY }), 'R63_JOURNAL_DUPLICATE_CYCLE');
  });
});

test('R63 journal rejects unknown record fields, operational claims and accessor-based inputs before persisting', () => withDirectory(directory => {
  const bad = [
    { ...fixture(), ownerEmail: 'person@example.invalid' },
    { ...fixture(), cycleId: 'live-account-123' },
    { ...fixture(), study: { ...fixture().study, evidenceKind: 'VERIFIED_OPERATIONAL_EVENT' } },
    { ...fixture(), report: { ...fixture().report, secret: 'do-not-store' } },
  ];
  let touched = 0; const accessor = fixture();
  Object.defineProperty(accessor, 'study', { enumerable: true, get() { touched++; return fixture().study; } });
  bad.push(accessor);
  for (const record of bad) assert.throws(() => put(directory, record), error => /^R63_JOURNAL_/.test(error?.code || ''));
  assert.equal(touched, 0); assert.deepEqual(readdirSync(directory), []);
}));

test('R63 journal permits forward state continuation but rejects a different valid branch', () => withDirectory(directory => {
  const initial = fixture({ events: true }); put(directory, initial);
  const next = registered(); next.cycleId = 'cycle:0000000000000002';
  assert.equal(put(directory, next, 1).revision, 2);
  const divergent = registered('plan:00000002'); divergent.cycleId = 'cycle:0000000000000003';
  rejects(() => put(directory, divergent, 2), 'R63_JOURNAL_SCOPE_STATE_REGRESSION');
  assert.equal(readR63Journal({ directory, key: KEY }).revision, 2);
}));

test('R63 journal rejects revision, creation and observation/report clock regressions per scope', () => withDirectory(directory => {
  put(directory, registered());
  for (const record of [
    fixture({ events: true, cycle: 2 }),
    fixture({ events: true, createdAtMs: T - 99, cycle: 2 }),
    fixture({ events: true, asOfMs: T - 11, evolution: registered().evolution, cycle: 2 }),
    fixture({ events: true, generatedAtMs: T + 999, evolution: registered().evolution, cycle: 2 }),
  ]) rejects(() => put(directory, record, 1), 'R63_JOURNAL_SCOPE_STATE_REGRESSION');
}));

test('R63 journal detects event ID conflicts across nonadjacent retained batches', () => withDirectory(directory => {
  put(directory, fixture({ events: true }));
  put(directory, fixture({ cycle: 2 }), 1);
  const changed = fixture({ events: true, cycle: 3 });
  const rows = clone(changed.study.events); rows[0].marketAgeMs = 640;
  changed.study = studyR63Observations(rows, { scopeId: SCOPE, nowMs: changed.study.asOfMs, windowStartMs: changed.study.windowStartMs });
  changed.report = buildR63AdminReport({ study: changed.study, evolution: changed.evolution,
    period: changed.report.period, generatedAtMs: changed.report.generatedAtMs });
  rejects(() => put(directory, changed, 2), 'R63_JOURNAL_EVENT_REPLAY_CONFLICT');
}));

test('R63 journal separates fixture scopes without correlating their event identities', () => withDirectory(directory => {
  put(directory, fixture({ events: true }));
  const next = fixture({ scopeId: 'fixture:00000002', events: true, cycle: 2 });
  assert.equal(put(directory, next, 1).revision, 2);
  assert.deepEqual(readR63Journal({ directory, key: KEY }).entries.map(entry => entry.study.scopeId), [SCOPE, 'fixture:00000002']);
}));

test('R63 journal stops at the retention cap without deleting earlier evidence', () => withDirectory(directory => {
  for (let index = 0; index < R63_JOURNAL_LIMITS.maxEntries; index++) put(directory, fixture({ cycle: index + 1 }), index);
  rejects(() => put(directory, fixture({ cycle: 101 }), 100), 'R63_JOURNAL_ENTRY_LIMIT');
  const snapshot = readR63Journal({ directory, key: KEY });
  assert.equal(snapshot.revision, 100);
  assert.equal(snapshot.entries[0].cycleId, 'cycle:0000000000000001');
  assert.equal(snapshot.entries.at(-1).cycleId, 'cycle:0000000000000064');
  assert.deepEqual(readdirSync(directory), [R63_JOURNAL_FILE]);
}));

test('R63 worker lease excludes concurrent provider work while allowing journal append and admin reads', async () => withAsyncDirectory(async directory => {
  let release, entered, calls = 0;
  const blocked = new Promise(resolve => { release = resolve; });
  const started = new Promise(resolve => { entered = resolve; });
  const first = withR63WorkerLease({ directory, operation: async () => {
    calls++;
    const snapshot = put(directory);
    entered();
    await blocked;
    return snapshot.revision;
  } });
  await Promise.race([started, first]);
  try {
    assert.equal(readR63Journal({ directory, key: KEY }).revision, 1);
    assert.equal(statSync(join(directory, R63_WORKER_LOCK)).mode & 0o777, 0o600);
    await assert.rejects(withR63WorkerLease({ directory, operation: () => { calls++; } }),
      error => error?.code === 'R63_WORKER_LOCKED');
    assert.equal(calls, 1);
  } finally { release(); await first; }
  assert.equal(await first, 1);
  assert.equal(existsSync(join(directory, R63_WORKER_LOCK)), false);
  assert.deepEqual(readdirSync(directory), [R63_JOURNAL_FILE]);
}));

test('R63 worker lease releases after exceptions but never steals an abandoned lock', async () => withAsyncDirectory(async directory => {
  const failure = new Error('fixture failure');
  await assert.rejects(withR63WorkerLease({ directory, operation: async () => { throw failure; } }), error => error === failure);
  assert.equal(existsSync(join(directory, R63_WORKER_LOCK)), false);
  await assert.rejects(withR63WorkerLease({ directory, operation: null }),
    error => error?.code === 'R63_WORKER_LEASE_OPERATION_REQUIRED');
  const abandoned = '{"pid":99999999,"token":"abandoned-fixture"}';
  writeFileSync(join(directory, R63_WORKER_LOCK), abandoned, { mode: 0o600 });
  let calls = 0;
  await assert.rejects(withR63WorkerLease({ directory, operation: () => { calls++; } }),
    error => error?.code === 'R63_WORKER_LOCKED');
  assert.equal(calls, 0);
  assert.equal(readFileSync(join(directory, R63_WORKER_LOCK), 'utf8'), abandoned);
  assert.equal(readR63Journal({ directory, key: KEY }).revision, 0);
}));
