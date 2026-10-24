/** Shared private-source host lifecycle. R68 keeps its closed LOCAL profile;
 * R69 selects HTTPS and R70 adds a signed configuration-match preflight. Existing
 * R67 loader/source/outbox and R68 lease/drain remain the sole implementation.
 * Neither profile installs a service or authorizes operational observation.
 */
import { createHash, createPrivateKey, createPublicKey } from 'node:crypto';
import { join } from 'node:path';
import { inspectR68PrivateDirectory, readR68PrivateFile, acquireR68HostLease } from './robot-r68-private-files.mjs';
import { diagnoseR68Outbox } from './robot-r68-outbox-doctor.mjs';
import { loadR67VerifiedPrivateCore, inspectR67VerifiedPrivateCore } from './robot-r67-private-core-loader.mjs';
import { createR67DurableEmitter } from './robot-r67-durable-emitter.mjs';
import { createR71DurableEmitter } from './robot-r71-durable-emitter.mjs';
import { createR71HttpsObservationSender, createR71SourceStateClient } from './robot-r71-https-transport.mjs';
import { R71_BOUNDARIES, r71OperationId } from './robot-r71-policy.mjs';
import { R71_RUNTIME_ORIGIN, inspectR71PositionContexts, r71CaptureInputDigest, r71RecordDigest } from './robot-r71-private-protocol.mjs';
import { createR67LoopbackObservationSender } from './robot-r67-loopback-transport.mjs';
import { createR69HttpsObservationSender } from './robot-r69-https-transport.mjs';
import { createR70PreflightClient } from './robot-r70-preflight-client.mjs';
import { inspectR70TargetPins, r70TargetPinsDigest } from './robot-r70-preflight-protocol.mjs';
import { isRobotR67QaEnabled } from './robot-r67-access.mjs';
import { B297_ENGINE_SHA256, B297_SERVICE_SHA256 } from './b297-private-readonly-audit.mjs';
import { R67_ORIGIN, R67_EVIDENCE, R67_INVARIANTS, inspectR67Scenarios,
  inspectR67TrustedSource, r67InputDigest, r67RecordDigest, fieldsR67, freezeR67 } from './robot-r67-private-protocol.mjs';

export const R68_HOST_LIMITS = Object.freeze({ commands: 20, intervalMs: 1000,
  maximumBackoffMs: 8000, flushLimit: 20, requestTimeoutMs: 3000 });
const CONFIG_KEYS = ['schema', 'coreDirectory', 'outboxDirectory', 'privateKeyFile', 'hmacKeyFile',
  'commandsFile', 'scopeId', 'sourceId', 'sourceKeySha256', 'origin'];
// These are internal constants, never supplied by a caller or JSON manifest.
const R68_PROFILE = Object.freeze({ revision: 'R68', schema: 'JENIOS_R68_PRIVATE_HOST_CONFIG_V1' });
const R69_PROFILE = Object.freeze({ revision: 'R69', schema: 'JENIOS_R69_PRIVATE_HOST_CONFIG_V1' });
const R70_PROFILE = Object.freeze({ revision: 'R70', schema: 'JENIOS_R70_PRIVATE_HOST_CONFIG_V1' });
const R71_PROFILE = Object.freeze({ revision: 'R71', schema: 'JENIOS_R71_PRIVATE_HOST_CONFIG_V1' });
const hasPreflight = profile => profile === R70_PROFILE || profile === R71_PROFILE;
const hostCode = (profile, suffix) => `${profile.revision}_HOST_${suffix}`;
const reportSchema = (profile, kind) => `JENIOS_${profile.revision}_${kind}_V1`;
const fail = code => { throw Object.assign(new Error(code), { name: 'ValidationError', code }); };
const sha = value => createHash('sha256').update(value).digest('hex');
const invariant = Object.freeze({ ...R67_INVARIANTS, persistentHostCertified: false,
  hostedEnvironmentCertified: false, realAdministrativeIdentityCertified: false,
  processOwnershipIndependentlyVerified: false, monotonicWitnessVerified: false,
  recoveryAuthorized: false, operationalReady: false, serviceInstalled: false,
  hostedDatabaseMigrationsApplied: 0, productionConfigurationChanged: false });
const safeCode = (error, profile) => (profile === R68_PROFILE ? /^(?:R6[78]|B297)_[A-Z0-9_]+$/ :
  profile === R69_PROFILE ? /^(?:R6[789]|B297)_[A-Z0-9_]+$/ :
    (profile === R70_PROFILE ? /^(?:R6[789]|R70|B297)_[A-Z0-9_]+$/ :
      /^(?:R6[789]|R7[01]|B297)_[A-Z0-9_]+$/)).test(error?.code || '') ? error.code : hostCode(profile, 'UNAVAILABLE');
const qaAllowed = (env, profile) => isRobotR67QaEnabled(env) &&
  Object.getOwnPropertyDescriptor(env ?? {}, 'JENIOS_ROBOT_R68_HOST_ENABLED')?.value === 'true' &&
  (profile === R68_PROFILE ||
    Object.getOwnPropertyDescriptor(env ?? {}, 'JENIOS_ROBOT_R69_HTTPS_ENABLED')?.value === 'true') &&
  (!hasPreflight(profile) ||
    Object.getOwnPropertyDescriptor(env ?? {}, 'JENIOS_ROBOT_R70_PREFLIGHT_ENABLED')?.value === 'true') &&
  (profile !== R71_PROFILE ||
    Object.getOwnPropertyDescriptor(env ?? {}, 'JENIOS_ROBOT_R71_ENABLED')?.value === 'true');
function json(text, profile = R68_PROFILE) {
  try { return JSON.parse(text); } catch { fail(hostCode(profile, 'JSON')); }
}
function commands(path, profile = R68_PROFILE) {
  if (profile === R71_PROFILE) {
    const raw = json(readR68PrivateFile(path, 262144).text, profile);
    const c = fieldsR67(raw, ['schema', 'commands'], ['schema', 'commands'], 'R71_HOST_COMMANDS');
    if (c.schema !== 'JENIOS_R71_PRIVATE_HOST_COMMANDS_V1' || !Array.isArray(c.commands) ||
        c.commands.length > R68_HOST_LIMITS.commands) fail('R71_HOST_COMMANDS');
    const seen = new Set();
    return freezeR67(c.commands.map(value => {
      const command = fieldsR67(value, ['operationId', 'scenarios', 'positionContexts'],
        ['operationId', 'scenarios', 'positionContexts'], 'R71_HOST_COMMAND');
      if (typeof command.operationId !== 'string' || !/^op:[a-f0-9]{32}$/.test(command.operationId) ||
          seen.has(command.operationId)) fail('R71_HOST_COMMAND');
      seen.add(command.operationId);
      const scenarios = inspectR67Scenarios(command.scenarios);
      return { operationId: command.operationId, scenarios,
        positionContexts: inspectR71PositionContexts(command.positionContexts, scenarios) };
    }));
  }
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
function bundle(configPath, profile) {
  const configKeys = hasPreflight(profile) ? [...CONFIG_KEYS, 'targetPinsFile'] : CONFIG_KEYS;
  const config = fieldsR67(json(readR68PrivateFile(configPath, 16384).text, profile),
    configKeys, configKeys, hostCode(profile, 'CONFIG'));
  if (config.schema !== profile.schema || typeof config.sourceKeySha256 !== 'string' ||
      !/^[a-f0-9]{64}$/.test(config.sourceKeySha256)) fail(hostCode(profile, 'CONFIG'));
  inspectR68PrivateDirectory(config.coreDirectory); inspectR68PrivateDirectory(config.outboxDirectory);
  const privateKeyPem = readR68PrivateFile(config.privateKeyFile, 4096).text;
  const hmac = readR68PrivateFile(config.hmacKeyFile, 65).text;
  if (!/^[a-f0-9]{64}\n?$/.test(hmac)) fail(hostCode(profile, 'HMAC_KEY'));
  const key = hmac.replace(/\n$/, '');
  let signingKey, publicKey;
  try { signingKey = createPrivateKey(privateKeyPem); publicKey = createPublicKey(signingKey); }
  catch { fail(hostCode(profile, 'SIGNING_KEY')); }
  if (signingKey.asymmetricKeyType !== 'ed25519' || publicKey.asymmetricKeyType !== 'ed25519')
    fail(hostCode(profile, 'SIGNING_KEY'));
  const sourceKeySha256 = sha(publicKey.export({ type: 'spki', format: 'der' }));
  if (sourceKeySha256 !== config.sourceKeySha256) fail(hostCode(profile, 'SOURCE_KEY_MISMATCH'));
  const trustedSource = inspectR67TrustedSource({ scopeId: config.scopeId, sourceId: config.sourceId,
    publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }), enabled: true, evidenceKind: R67_EVIDENCE });
  let probe = null, getActiveState = null, targetPinsSha256 = null;
  if (hasPreflight(profile)) {
    const targetPins = inspectR70TargetPins(json(readR68PrivateFile(config.targetPinsFile, 16384).text, profile));
    if (targetPins.origin !== config.origin || targetPins.scopeId !== config.scopeId ||
        targetPins.sourceId !== config.sourceId || targetPins.sourceKeySha256 !== sourceKeySha256)
      fail(hostCode(profile, 'TARGET_PINS_MISMATCH'));
    targetPinsSha256 = r70TargetPinsDigest(targetPins);
    // Construction validates signing identity without contacting its target.
    // Only the fixed runtime profile can probe; JSON cannot provide a callback.
    probe = createR70PreflightClient({ targetPins, trustedSource, privateKeyPem,
      timeoutMs: R68_HOST_LIMITS.requestTimeoutMs });
    if (profile === R71_PROFILE) getActiveState = createR71SourceStateClient({ targetPins, trustedSource, privateKeyPem,
      timeoutMs: R68_HOST_LIMITS.requestTimeoutMs });
  }
  // Both constructors validate a fixed target without making a request. No
  // caller-controlled sender, headers, TLS options or executable is accepted.
  const senderConfig = { origin: config.origin, trustedSource, timeoutMs: R68_HOST_LIMITS.requestTimeoutMs };
  const send = profile === R68_PROFILE ? createR67LoopbackObservationSender(senderConfig) :
    profile === R71_PROFILE ? createR71HttpsObservationSender(senderConfig) : createR69HttpsObservationSender(senderConfig);
  const initialCommands = commands(config.commandsFile, profile);
  return { config, privateKeyPem, key, trustedSource, sourceKeySha256, send, initialCommands,
    probe, getActiveState, targetPinsSha256, profile };
}
function diagnosis(c, nowMs) {
  return diagnoseR68Outbox({ profile: c.profile === R71_PROFILE ? 'R71_PRIVATE_EVOLUTION' : 'R67_PRIVATE_CAPTURE', directory: c.config.outboxDirectory,
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
function transportDescription(c, profile) {
  if (profile === R68_PROFILE) return {};
  return { transport: {
    profile: profile === R71_PROFILE ? 'R71_FIXED_HTTPS_POLICY' : 'R69_FIXED_HTTPS', target: 'DECLARED_CONFIG_ORIGIN',
    targetOriginSha256: sha(c.config.origin), endpoint: profile === R71_PROFILE ?
      '/api/platform/robot-private-policy-observations' : '/api/platform/robot-private-observations',
    tlsRequired: true, certificateAndHostnameVerificationRequired: true,
    tlsCheckedByOfflineInspection: false, remoteQaDeploymentVerified: false,
    hostedAuthenticationCertified: false,
  } };
}
function preflightDescription(c, profile, state = null) {
  if (!hasPreflight(profile)) return {};
  return { preflight: {
    schema: 'JENIOS_R70_HOST_PREFLIGHT_SUMMARY_V1', required: true,
    mechanism: 'SIGNED_SOURCE_CHALLENGE_OVER_TLS', targetPinsSha256: c.targetPinsSha256,
    pinsMeaning: 'DECLARED_CONFIGURATION_NOT_INDEPENDENT_TARGET_ATTESTATION',
    executed: (state?.attempted ?? 0) > 0, attempted: state?.attempted ?? 0,
    succeeded: state?.succeeded ?? 0, lastResult: state?.lastResult ?? null,
    remoteQaDeploymentVerified: false, independentRuntimeAttestation: false,
    hostedAuthenticationCertified: false, operationalReady: false,
  } };
}
function policyDescription(profile) {
  return profile === R71_PROFILE ? { privateRuntimePolicy: {
    runtimeOrigin: R71_RUNTIME_ORIGIN, policySource: 'SOURCE_SIGNED_QUERY_OVER_VERIFIED_TLS',
    stateEndpoint: '/api/platform/robot-private-evolution-state',
    stateReadByOfflineInspection: false, positionContextEvidence: 'SYNTHETIC_FIXTURE_ONLY',
    pendingPlanCapture: 'FIXED_REGISTERED_CASES_WITHIN_WINDOW_ONLY',
    policySelectionFromCommandAllowed: false, internalCoreRetuning: false,
    ...R71_BOUNDARIES } } : {};
}
function offlineCore(c, profile) {
  const result = { engineSha256Expected: B297_ENGINE_SHA256, serviceSha256Expected: B297_SERVICE_SHA256,
    bytesMatchPinnedHashes: false, executableCompiled: false, privateCoreExecuted: false, error: null };
  try {
    for (const [name, expected] of [['engine.mjs', B297_ENGINE_SHA256], ['service.mjs', B297_SERVICE_SHA256]]) {
      const text = readR68PrivateFile(join(c.config.coreDirectory, name), 65536).text;
      if (sha(Buffer.from(text, 'utf8')) !== expected) fail(hostCode(profile, 'CORE_HASH_MISMATCH'));
    }
    result.bytesMatchPinnedHashes = true;
  } catch (error) { result.error = safeCode(error, profile); }
  return freezeR67(result);
}

/** No loader/emitter is constructed. Diagnostics cannot consume a session,
 * mutate expiration, acquire a lease or silently authorize recovery.
 */
function inspectPrivateHost(input, profile) {
  const c = fieldsR67(input, ['configPath', 'nowMs', 'env'], ['configPath'], hostCode(profile, 'INSPECT_CONFIG'));
  const loaded = bundle(c.configPath, profile), nowMs = c.nowMs ?? Date.now();
  const doctor = diagnosis(loaded, nowMs), coreFiles = offlineCore(loaded, profile);
  return freezeR67({ schema: reportSchema(profile, 'PRIVATE_HOST_INSPECTION'), observedAtMs: nowMs,
    status: coreFiles.bytesMatchPinnedHashes ? 'LOCAL_FILES_VERIFIED_QA_ONLY' : 'BLOCKED_PRIVATE_CORE',
    mode: 'READ_ONLY_LOCAL_FILES', configurationObserved: true, credentialsFilePermissionsVerified: true,
    signingKeyMatchesConfiguredFingerprint: true, qaConfigurationValid: qaAllowed(c.env ?? process.env, profile),
    source: identity(loaded), commandsObserved: loaded.initialCommands.length, coreFiles,
    privateCoreExecutedByInspection: false, loaderConstructed: false, emitterConstructed: false,
    sessionsCreated: 0, capturesExecuted: 0, networkCalls: 0, doctor,
    ...transportDescription(loaded, profile), ...preflightDescription(loaded, profile), ...policyDescription(profile), ...invariant });
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
async function runPrivateHost(input, profile) {
  const c = fieldsR67(input, ['configPath', 'mode', 'signal', 'onReport', 'env'],
    ['configPath', 'mode'], hostCode(profile, 'RUN_CONFIG'));
  if (!['once', 'watch'].includes(c.mode) || (c.signal !== undefined && !(c.signal instanceof AbortSignal)) ||
      (c.onReport !== undefined && typeof c.onReport !== 'function')) fail(hostCode(profile, 'RUN_CONFIG'));
  if (!qaAllowed(c.env ?? process.env, profile)) fail(hostCode(profile, 'DISABLED'));
  const loaded = bundle(c.configPath, profile), report = c.onReport ?? (() => {});
  const before = diagnosis(loaded, Date.now());
  if (!canStart(before)) fail(hostCode(profile, 'RECOVERY_REQUIRED'));
  const coreFiles = offlineCore(loaded, profile);
  if (!coreFiles.bytesMatchPinnedHashes) fail(coreFiles.error ?? hostCode(profile, 'CORE_UNVERIFIED'));
  if (c.signal?.aborted) return freezeR67({ schema: reportSchema(profile, 'PRIVATE_HOST_RESULT'),
    status: 'STOPPED_BEFORE_START', sessionsCreated: 0, ...transportDescription(loaded, profile),
    ...preflightDescription(loaded, profile), ...invariant });
  const lease = acquireR68HostLease(loaded.config.outboxDirectory);
  let emitter, terminalStatus = 'ONCE_COMPLETE', failure = null, captures = 0, ticks = 0, unconfirmedRuns = 0;
  const preflight = { attempted: 0, succeeded: 0, lastResult: null };
  let initialProbeReusable = false;
  const handled = new Map();
  function targetExecutionAllowed() {
    if (!qaAllowed(c.env ?? process.env, profile)) fail(hostCode(profile, 'DISABLED'));
    lease.assertOwned();
    return !c.signal?.aborted;
  }
  async function checkTarget() {
    if (!targetExecutionAllowed()) return false;
    preflight.attempted++;
    const result = await loaded.probe();
    preflight.succeeded++;
    preflight.lastResult = freezeR67({ schema: result.schema, status: result.status,
      observedAtMs: result.observedAtMs, expiresAtMs: result.expiresAtMs,
      targetPinsSha256: result.targetPinsSha256, requestDigest: result.requestDigest,
      targetClassification: result.targetClassification, configuredSourceChallengeSigned: true,
      remoteQaDeploymentVerified: false, independentRuntimeAttestation: false,
      hostedAuthenticationCertified: false, operationalReady: false });
    return true;
  }
  try {
    hostLifecycle: {
    if (hasPreflight(profile)) {
      if (!await checkTarget() || !targetExecutionAllowed()) {
        terminalStatus = 'STOPPED_BEFORE_START'; break hostLifecycle;
      }
      initialProbeReusable = true;
    }
    const handle = await loadR67VerifiedPrivateCore({ directory: loaded.config.coreDirectory });
    lease.assertOwned();
    if (hasPreflight(profile)) {
      if (!targetExecutionAllowed()) { terminalStatus = 'STOPPED_BEFORE_START'; break hostLifecycle; }
    }
    const getRuntimeState = async () => {
      if (!targetExecutionAllowed()) fail('R71_HOST_STOPPED');
      const view = await loaded.getActiveState();
      // Never begin a native capture after a stop/gate/ownership change while
      // the signed state query was awaiting its TLS response.
      if (!targetExecutionAllowed()) fail('R71_HOST_STOPPED');
      return view;
    };
    const emitterConfig = { enabled: true, handle, directory: loaded.config.outboxDirectory,
      key: loaded.key, scopeId: loaded.config.scopeId, sourceId: loaded.config.sourceId,
      privateKeyPem: loaded.privateKeyPem };
    emitter = profile === R71_PROFILE ? createR71DurableEmitter({ ...emitterConfig, getActiveState: getRuntimeState }) :
      createR67DurableEmitter({ ...emitterConfig, domain: R67_ORIGIN });
    await report(freezeR67({ schema: reportSchema(profile, 'PRIVATE_HOST_EVENT'), event: 'HOST_STARTED',
      source: identity(loaded), sessionId: emitter.sessionId, mode: c.mode,
      core: inspectR67VerifiedPrivateCore(handle), ...transportDescription(loaded, profile),
      ...preflightDescription(loaded, profile, preflight), ...policyDescription(profile), ...invariant }));
    do {
      if (c.signal?.aborted) { terminalStatus = 'STOPPED'; break; }
      if (!qaAllowed(c.env ?? process.env, profile)) fail(hostCode(profile, 'DISABLED'));
      lease.assertOwned();
      if (hasPreflight(profile)) {
        const at = Date.now(), reusable = initialProbeReusable && preflight.lastResult &&
          at >= preflight.lastResult.observedAtMs && at < preflight.lastResult.expiresAtMs;
        initialProbeReusable = false;
        if (!reusable && (!await checkTarget() || !targetExecutionAllowed())) {
          terminalStatus = 'STOPPED'; break;
        }
      }
      const inputCommands = commands(loaded.config.commandsFile, profile), captured = [];
      for (const command of inputCommands) {
        if (c.signal?.aborted) break;
        if (hasPreflight(profile) && !qaAllowed(c.env ?? process.env, profile)) fail(hostCode(profile, 'DISABLED'));
        const digest = profile === R71_PROFILE ? r71CaptureInputDigest({ purpose: 'OBSERVATION',
          scenarios: command.scenarios, positionContexts: command.positionContexts }) : r67InputDigest(command.scenarios);
        const previous = handled.get(command.operationId);
        if (previous !== undefined) {
          if (previous !== digest) fail(hostCode(profile, 'COMMAND_CONFLICT'));
          continue;
        }
        lease.assertOwned();
        const nextBefore = emitter.inspect().nextSequence;
        const record = await emitter.captureBatch(command);
        const fresh = emitter.inspect().nextSequence > nextBefore;
        const native = profile === R71_PROFILE ? record.originalRecord : record;
        if (fresh) captures += native.envelope.payload.capture.entries.length;
        handled.set(command.operationId, digest);
        captured.push({ operationId: command.operationId, eventId: native.envelope.payload.eventId,
          sessionId: native.envelope.payload.sessionId, sequence: native.envelope.payload.sequence,
          recordDigest: profile === R71_PROFILE ? r71RecordDigest(record) : r67RecordDigest(record), replayed: !fresh });
      }
      if (profile === R71_PROFILE && !c.signal?.aborted) {
        const view = await getRuntimeState(), plan = view.pendingEvaluation, at = Date.now();
        if (plan && at >= plan.startsAtMs && at < plan.endsAtMs) {
          const operationId = r71OperationId('HOST_FIXED_VALIDATION', loaded.config.scopeId, loaded.config.sourceId, plan.planId);
          const digest = r71CaptureInputDigest({ purpose: 'VALIDATION', planId: plan.planId });
          if (!handled.has(operationId)) {
            const nextBefore = emitter.inspect().nextSequence;
            const record = await emitter.captureValidation({ operationId, planId: plan.planId });
            const fresh = emitter.inspect().nextSequence > nextBefore;
            if (fresh) captures += record.annotation.entries.length;
            handled.set(operationId, digest);
            captured.push({ operationId, eventId: record.annotation.eventId, sessionId: record.annotation.sessionId,
              sequence: record.annotation.sequence, recordDigest: r71RecordDigest(record), replayed: !fresh });
          } else if (handled.get(operationId) !== digest) fail('R71_HOST_COMMAND_CONFLICT');
        }
      }
      // A stop during capture drains that capture; it does not start a new send.
      let flushed = null;
      for (let n = 0; n < R68_HOST_LIMITS.flushLimit && !c.signal?.aborted; n++) {
        if (!qaAllowed(c.env ?? process.env, profile)) fail(hostCode(profile, 'DISABLED'));
        lease.assertOwned();
        // Refusal happens outside the outbox transaction: no observation send,
        // attempt consumption, fabricated UNCERTAIN state or re-signing occurs.
        if (hasPreflight(profile) && (!await checkTarget() || !targetExecutionAllowed())) {
          terminalStatus = 'STOPPED'; break;
        }
        // R67 drains one delivery fully. The host checks stop/gates before
        // beginning the next one, never racing a timer against held locks.
        const part = await emitter.flush({ send: loaded.send, limit: 1 });
        flushed ??= { schema: reportSchema(profile, 'HOST_FLUSH_RESULT'), attempted: 0, acknowledged: 0,
          expired: 0, unconfirmed: 0, stoppedReason: null, runtimeOrigin: profile === R71_PROFILE ? R71_RUNTIME_ORIGIN : R67_ORIGIN, evidenceKind: R67_EVIDENCE,
          ...invariant };
        for (const field of ['attempted', 'acknowledged', 'expired', 'unconfirmed']) flushed[field] += part[field];
        flushed.stoppedReason = part.stoppedReason;
        if (!part.attempted || part.stoppedReason) break;
      }
      ticks++;
      const inspect = emitter.inspect();
      await report(freezeR67({ schema: reportSchema(profile, 'PRIVATE_HOST_EVENT'), event: 'HOST_TICK',
        sessionId: emitter.sessionId, captured, flushed, inspect, ...transportDescription(loaded, profile),
        ...preflightDescription(loaded, profile, preflight), ...policyDescription(profile), ...invariant }));
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
    }
  } catch (error) {
    if (profile === R71_PROFILE && error?.code === 'R71_HOST_STOPPED' && c.signal?.aborted) terminalStatus = 'STOPPED';
    else failure = safeCode(error, profile);
  }
  finally {
    try { lease.release(); }
    catch (error) { failure = safeCode(error, profile); }
  }
  if (failure) fail(failure);
  return freezeR67({ schema: reportSchema(profile, 'PRIVATE_HOST_RESULT'), status: terminalStatus,
    source: identity(loaded), sessionId: emitter?.sessionId ?? null, sessionsCreated: emitter ? 1 : 0,
    capturesExecuted: captures, ticks, runtimeOrigin: profile === R71_PROFILE ? R71_RUNTIME_ORIGIN : R67_ORIGIN, evidenceKind: R67_EVIDENCE,
    lifetimeLeaseReleased: true, ...transportDescription(loaded, profile),
    ...preflightDescription(loaded, profile, preflight), ...policyDescription(profile), ...invariant });
}

export const inspectR68PrivateHost = input => inspectPrivateHost(input, R68_PROFILE);
export const runR68PrivateHost = input => runPrivateHost(input, R68_PROFILE);

// The R69 facade has a fixed profile, not a general transport injection hook.
export const inspectR69PrivateHostProfile = input => inspectPrivateHost(input, R69_PROFILE);
export const runR69PrivateHostProfile = input => runPrivateHost(input, R69_PROFILE);

export const inspectR70PrivateHostProfile = input => inspectPrivateHost(input, R70_PROFILE);
export const runR70PrivateHostProfile = input => runPrivateHost(input, R70_PROFILE);

export const inspectR71PrivateHostProfile = input => inspectPrivateHost(input, R71_PROFILE);
export const runR71PrivateHostProfile = input => runPrivateHost(input, R71_PROFILE);
