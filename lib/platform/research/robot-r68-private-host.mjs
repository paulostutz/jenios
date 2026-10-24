/** R68 explicit LOCAL private-source host. Existing R67 loader, source, outbox
 * and loopback transport remain the sole capture/delivery implementation.
 * No service is installed, no hosted credential is needed and no order runs.
 */
import { createHash, createPrivateKey, createPublicKey } from 'node:crypto';
import { join } from 'node:path';
import { inspectR68PrivateDirectory, readR68PrivateFile, acquireR68HostLease } from './robot-r68-private-files.mjs';
import { diagnoseR68Outbox } from './robot-r68-outbox-doctor.mjs';
import { loadR67VerifiedPrivateCore, inspectR67VerifiedPrivateCore } from './robot-r67-private-core-loader.mjs';
import { createR67DurableEmitter } from './robot-r67-durable-emitter.mjs';
import { createR67LoopbackObservationSender } from './robot-r67-loopback-transport.mjs';
import { isRobotR67QaEnabled } from './robot-r67-access.mjs';
import { B297_ENGINE_SHA256, B297_SERVICE_SHA256 } from './b297-private-readonly-audit.mjs';
import { R67_ORIGIN, R67_EVIDENCE, R67_INVARIANTS, inspectR67Scenarios,
  inspectR67TrustedSource, r67InputDigest, r67RecordDigest, fieldsR67, freezeR67 } from './robot-r67-private-protocol.mjs';

export const R68_HOST_LIMITS = Object.freeze({ commands: 20, intervalMs: 1000,
  maximumBackoffMs: 8000, flushLimit: 20, requestTimeoutMs: 3000 });
const CONFIG_KEYS = ['schema', 'coreDirectory', 'outboxDirectory', 'privateKeyFile', 'hmacKeyFile',
  'commandsFile', 'scopeId', 'sourceId', 'sourceKeySha256', 'origin'];
const fail = code => { throw Object.assign(new Error(code), { name: 'ValidationError', code }); };
const sha = value => createHash('sha256').update(value).digest('hex');
const invariant = Object.freeze({ ...R67_INVARIANTS, persistentHostCertified: false,
  hostedEnvironmentCertified: false, realAdministrativeIdentityCertified: false,
  processOwnershipIndependentlyVerified: false, monotonicWitnessVerified: false,
  recoveryAuthorized: false, operationalReady: false, serviceInstalled: false,
  hostedDatabaseMigrationsApplied: 0, productionConfigurationChanged: false });
const safeCode = error => /^(?:R6[78]|B297)_[A-Z0-9_]+$/.test(error?.code || '')
  ? error.code : 'R68_HOST_UNAVAILABLE';
const qaAllowed = env => isRobotR67QaEnabled(env) &&
  Object.getOwnPropertyDescriptor(env ?? {}, 'JENIOS_ROBOT_R68_HOST_ENABLED')?.value === 'true';
function json(text) {
  try { return JSON.parse(text); } catch { fail('R68_HOST_JSON'); }
}
function commands(path) {
  const raw = json(readR68PrivateFile(path, 262144).text);
  const c = fieldsR67(raw, ['schema', 'commands'], ['schema', 'commands'], 'R68_HOST_COMMANDS');
  if (c.schema !== 'JENIOS_R68_PRIVATE_HOST_COMMANDS_V1' || !Array.isArray(c.commands) ||
      c.commands.length > R68_HOST_LIMITS.commands) fail('R68_HOST_COMMANDS');
  const seen = new Set();
  return freezeR67(c.commands.map(value => {
    const command = fieldsR67(value, ['operationId', 'scenarios'], ['operationId', 'scenarios'], 'R68_HOST_COMMAND');
    if (typeof command.operationId !== 'string' || !/^op:[a-f0-9]{32}$/.test(command.operationId) ||
        seen.has(command.operationId)) fail('R68_HOST_COMMAND');
    seen.add(command.operationId);
    return { operationId: command.operationId, scenarios: inspectR67Scenarios(command.scenarios) };
  }));
}
function bundle(configPath) {
  const config = fieldsR67(json(readR68PrivateFile(configPath, 16384).text), CONFIG_KEYS, CONFIG_KEYS, 'R68_HOST_CONFIG');
  if (config.schema !== 'JENIOS_R68_PRIVATE_HOST_CONFIG_V1' ||
      typeof config.sourceKeySha256 !== 'string' || !/^[a-f0-9]{64}$/.test(config.sourceKeySha256)) fail('R68_HOST_CONFIG');
  inspectR68PrivateDirectory(config.coreDirectory); inspectR68PrivateDirectory(config.outboxDirectory);
  const privateKeyPem = readR68PrivateFile(config.privateKeyFile, 4096).text;
  const hmac = readR68PrivateFile(config.hmacKeyFile, 65).text;
  if (!/^[a-f0-9]{64}\n?$/.test(hmac)) fail('R68_HOST_HMAC_KEY');
  const key = hmac.replace(/\n$/, '');
  let signingKey, publicKey;
  try { signingKey = createPrivateKey(privateKeyPem); publicKey = createPublicKey(signingKey); }
  catch { fail('R68_HOST_SIGNING_KEY'); }
  if (signingKey.asymmetricKeyType !== 'ed25519' || publicKey.asymmetricKeyType !== 'ed25519') fail('R68_HOST_SIGNING_KEY');
  const sourceKeySha256 = sha(publicKey.export({ type: 'spki', format: 'der' }));
  if (sourceKeySha256 !== config.sourceKeySha256) fail('R68_HOST_SOURCE_KEY_MISMATCH');
  const trustedSource = inspectR67TrustedSource({ scopeId: config.scopeId, sourceId: config.sourceId,
    publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }), enabled: true, evidenceKind: R67_EVIDENCE });
  // Construction validates the fixed loopback target without making a request.
  const send = createR67LoopbackObservationSender({ origin: config.origin, trustedSource,
    timeoutMs: R68_HOST_LIMITS.requestTimeoutMs });
  const initialCommands = commands(config.commandsFile);
  return { config, privateKeyPem, key, trustedSource, sourceKeySha256, send, initialCommands };
}
function diagnosis(c, nowMs) {
  return diagnoseR68Outbox({ profile: 'R67_PRIVATE_CAPTURE', directory: c.config.outboxDirectory,
    key: c.key, trustedSource: c.trustedSource, nowMs });
}
function canStart(doctor) {
  return doctor.observationStable === true && doctor.inventoryComplete === true &&
    (doctor.snapshot?.validated === true || doctor.snapshot?.present === false) &&
    Array.isArray(doctor.locks) && !doctor.locks.some(lock => lock.present) &&
    Array.isArray(doctor.temporaryFiles) && doctor.temporaryFiles.length === 0 && doctor.unrecognizedEntries === 0;
}
function identity(c) {
  return { scopeId: c.config.scopeId, sourceId: c.config.sourceId, sourceKeySha256: c.sourceKeySha256 };
}
function offlineCore(c) {
  const result = { engineSha256Expected: B297_ENGINE_SHA256, serviceSha256Expected: B297_SERVICE_SHA256,
    bytesMatchPinnedHashes: false, executableCompiled: false, privateCoreExecuted: false, error: null };
  try {
    for (const [name, expected] of [['engine.mjs', B297_ENGINE_SHA256], ['service.mjs', B297_SERVICE_SHA256]]) {
      const text = readR68PrivateFile(join(c.config.coreDirectory, name), 65536).text;
      if (sha(Buffer.from(text, 'utf8')) !== expected) fail('R68_HOST_CORE_HASH_MISMATCH');
    }
    result.bytesMatchPinnedHashes = true;
  } catch (error) { result.error = safeCode(error); }
  return freezeR67(result);
}

/** No loader/emitter is constructed. Diagnostics cannot consume a session,
 * mutate expiration, acquire a lease or silently authorize recovery.
 */
export function inspectR68PrivateHost(input) {
  const c = fieldsR67(input, ['configPath', 'nowMs', 'env'], ['configPath'], 'R68_HOST_INSPECT_CONFIG');
  const loaded = bundle(c.configPath), nowMs = c.nowMs ?? Date.now();
  const doctor = diagnosis(loaded, nowMs), coreFiles = offlineCore(loaded);
  return freezeR67({ schema: 'JENIOS_R68_PRIVATE_HOST_INSPECTION_V1', observedAtMs: nowMs,
    status: coreFiles.bytesMatchPinnedHashes ? 'LOCAL_FILES_VERIFIED_QA_ONLY' : 'BLOCKED_PRIVATE_CORE',
    mode: 'READ_ONLY_LOCAL_FILES', configurationObserved: true, credentialsFilePermissionsVerified: true,
    signingKeyMatchesConfiguredFingerprint: true, qaConfigurationValid: qaAllowed(c.env ?? process.env),
    source: identity(loaded), commandsObserved: loaded.initialCommands.length, coreFiles,
    privateCoreExecutedByInspection: false, loaderConstructed: false, emitterConstructed: false,
    sessionsCreated: 0, capturesExecuted: 0, networkCalls: 0, doctor, ...invariant });
}
function wait(ms, signal) {
  if (signal?.aborted) return Promise.resolve();
  return new Promise(resolve => {
    const stop = () => { clearTimeout(timer); signal?.removeEventListener('abort', stop); resolve(); };
    const timer = setTimeout(stop, ms); signal?.addEventListener('abort', stop, { once: true });
  });
}

/** onReport is a trusted host logger for sanitized metadata. It is never passed
 * to the VM or accepted as executable-source evidence. CLI uses process.env.
 */
export async function runR68PrivateHost(input) {
  const c = fieldsR67(input, ['configPath', 'mode', 'signal', 'onReport', 'env'],
    ['configPath', 'mode'], 'R68_HOST_RUN_CONFIG');
  if (!['once', 'watch'].includes(c.mode) || (c.signal !== undefined && !(c.signal instanceof AbortSignal)) ||
      (c.onReport !== undefined && typeof c.onReport !== 'function')) fail('R68_HOST_RUN_CONFIG');
  if (!qaAllowed(c.env ?? process.env)) fail('R68_HOST_DISABLED');
  const loaded = bundle(c.configPath), report = c.onReport ?? (() => {});
  const before = diagnosis(loaded, Date.now());
  if (!canStart(before)) fail('R68_HOST_RECOVERY_REQUIRED');
  const coreFiles = offlineCore(loaded);
  if (!coreFiles.bytesMatchPinnedHashes) fail(coreFiles.error ?? 'R68_HOST_CORE_UNVERIFIED');
  if (c.signal?.aborted) return freezeR67({ schema: 'JENIOS_R68_PRIVATE_HOST_RESULT_V1',
    status: 'STOPPED_BEFORE_START', sessionsCreated: 0, ...invariant });
  const lease = acquireR68HostLease(loaded.config.outboxDirectory);
  let emitter, terminalStatus = 'ONCE_COMPLETE', failure = null, captures = 0, ticks = 0, unconfirmedRuns = 0;
  const handled = new Map();
  try {
    const handle = await loadR67VerifiedPrivateCore({ directory: loaded.config.coreDirectory });
    lease.assertOwned();
    emitter = createR67DurableEmitter({ enabled: true, domain: R67_ORIGIN, handle,
      directory: loaded.config.outboxDirectory, key: loaded.key, scopeId: loaded.config.scopeId,
      sourceId: loaded.config.sourceId, privateKeyPem: loaded.privateKeyPem });
    await report(freezeR67({ schema: 'JENIOS_R68_PRIVATE_HOST_EVENT_V1', event: 'HOST_STARTED',
      source: identity(loaded), sessionId: emitter.sessionId, mode: c.mode,
      core: inspectR67VerifiedPrivateCore(handle), ...invariant }));
    do {
      if (c.signal?.aborted) { terminalStatus = 'STOPPED'; break; }
      if (!qaAllowed(c.env ?? process.env)) fail('R68_HOST_DISABLED');
      lease.assertOwned();
      const inputCommands = commands(loaded.config.commandsFile), captured = [];
      for (const command of inputCommands) {
        if (c.signal?.aborted) break;
        const digest = r67InputDigest(command.scenarios), previous = handled.get(command.operationId);
        if (previous !== undefined) {
          if (previous !== digest) fail('R68_HOST_COMMAND_CONFLICT');
          continue;
        }
        lease.assertOwned();
        const nextBefore = emitter.inspect().nextSequence;
        const record = await emitter.captureBatch(command);
        const fresh = emitter.inspect().nextSequence > nextBefore;
        if (fresh) captures += record.envelope.payload.capture.entries.length;
        handled.set(command.operationId, digest);
        captured.push({ operationId: command.operationId, eventId: record.envelope.payload.eventId,
          sessionId: record.envelope.payload.sessionId, sequence: record.envelope.payload.sequence,
          recordDigest: r67RecordDigest(record), replayed: !fresh });
      }
      // A stop during capture drains that capture; it does not start a new send.
      let flushed = null;
      for (let n = 0; n < R68_HOST_LIMITS.flushLimit && !c.signal?.aborted; n++) {
        if (!qaAllowed(c.env ?? process.env)) fail('R68_HOST_DISABLED');
        lease.assertOwned();
        // R67 drains one delivery fully. The host checks stop/gates before
        // beginning the next one, never racing a timer against held locks.
        const part = await emitter.flush({ send: loaded.send, limit: 1 });
        flushed ??= { schema: 'JENIOS_R68_HOST_FLUSH_RESULT_V1', attempted: 0, acknowledged: 0,
          expired: 0, unconfirmed: 0, stoppedReason: null, runtimeOrigin: R67_ORIGIN, evidenceKind: R67_EVIDENCE,
          ...invariant };
        for (const field of ['attempted', 'acknowledged', 'expired', 'unconfirmed']) flushed[field] += part[field];
        flushed.stoppedReason = part.stoppedReason;
        if (!part.attempted || part.stoppedReason) break;
      }
      ticks++;
      const inspect = emitter.inspect();
      await report(freezeR67({ schema: 'JENIOS_R68_PRIVATE_HOST_EVENT_V1', event: 'HOST_TICK',
        sessionId: emitter.sessionId, captured, flushed, inspect, ...invariant }));
      if (c.signal?.aborted) { terminalStatus = 'STOPPED'; break; }
      if (flushed?.stoppedReason === 'ATTEMPT_LIMIT' || flushed?.stoppedReason === 'EXPIRED_SESSION_REQUIRES_NEW_SESSION') {
        terminalStatus = 'OPERATOR_REVIEW_REQUIRED'; break;
      }
      if (c.mode === 'once') {
        terminalStatus = flushed?.unconfirmed ? 'DELIVERY_UNCONFIRMED' :
          inspect.queue.expiredUnconfirmed ? 'OPERATOR_REVIEW_REQUIRED' : 'ONCE_COMPLETE';
        break;
      }
      unconfirmedRuns = flushed?.unconfirmed ? unconfirmedRuns + 1 : 0;
      const delay = Math.min(R68_HOST_LIMITS.maximumBackoffMs,
        R68_HOST_LIMITS.intervalMs * 2 ** Math.min(unconfirmedRuns, 3));
      await wait(delay, c.signal);
    } while (true);
  } catch (error) { failure = safeCode(error); }
  finally {
    try { lease.release(); }
    catch (error) { failure = safeCode(error); }
  }
  if (failure) fail(failure);
  return freezeR67({ schema: 'JENIOS_R68_PRIVATE_HOST_RESULT_V1', status: terminalStatus,
    source: identity(loaded), sessionId: emitter?.sessionId ?? null, sessionsCreated: emitter ? 1 : 0,
    capturesExecuted: captures, ticks, runtimeOrigin: R67_ORIGIN, evidenceKind: R67_EVIDENCE,
    lifetimeLeaseReleased: true, ...invariant });
}
