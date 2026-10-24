/**
 * R67 — load the two EXISTING private modules from hash-pinned bytes.
 *
 * The checked bytes are compiled directly by SourceTextModule; no path import
 * occurs after hashing. A later pathname replacement cannot select new code.
 * Only ./engine.mjs may link, and only to the already compiled pinned module.
 * A branded handle, never a caller callback or a declared hash, authorizes the
 * original B297 synthetic capture. No proprietary source is included here.
 *
 * vm provides a separate context for this known, pinned source. It is not
 * claimed as a security sandbox for arbitrary untrusted code or a remote host
 * attestation. A private host still needs its own process/resource boundaries.
 */
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { constants, openSync, closeSync, fstatSync, lstatSync, readSync, realpathSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalR64Json } from './robot-r64-telemetry.mjs';
import { digestR71Value } from './robot-r71-policy.mjs';
import { B297_ENGINE_SHA256, B297_SERVICE_SHA256, captureB297OriginalDecisions,
  verifyB297CaptureChain } from './b297-private-readonly-audit.mjs';

const HANDLES = new WeakMap();
const REPOSITORY = realpathSync(fileURLToPath(new URL('../../../', import.meta.url)));
const MAX_MODULE_BYTES = 65536, MAX_OUTPUT_BYTES = 262144, VM_TIMEOUT_MS = 1000;
const VERSION = 'jenios-research-r29.1';
const MODES = Object.freeze(['manual', 'hybrid', 'reverse']);
const fail = code => { throw Object.assign(new Error(code), { name: 'ValidationError', code }); };
const sha = value => createHash('sha256').update(value).digest('hex');
const freeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze); Object.freeze(value);
  }
  return value;
};
function fields(value, allowed, required, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail(code);
  const descriptors = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(descriptors);
  if (keys.some(key => typeof key !== 'string' || !allowed.includes(key) ||
      !descriptors[key].enumerable || !Object.hasOwn(descriptors[key], 'value')) ||
      required.some(key => !Object.hasOwn(descriptors, key))) fail(code);
  return Object.fromEntries(keys.map(key => [key, descriptors[key].value]));
}
function privateDirectory(value) {
  if (typeof value !== 'string' || !isAbsolute(value) || value.includes('\0') ||
      value.length > 2048 || resolve(value) !== value) fail('R67_CORE_DIRECTORY');
  const inside = relative(REPOSITORY, value);
  if (inside === '' || !(inside === '..' || inside.startsWith('..' + sep)))
    fail('R67_CORE_DIRECTORY_IN_REPOSITORY');
  let stat;
  try { stat = lstatSync(value); }
  catch { fail('R67_CORE_DIRECTORY'); }
  if (!stat.isDirectory() || stat.isSymbolicLink() || (stat.mode & 0o077) !== 0 ||
      (typeof process.getuid === 'function' && stat.uid !== process.getuid())) fail('R67_CORE_DIRECTORY');
  try { if (realpathSync(value) !== value) fail('R67_CORE_DIRECTORY'); }
  catch { fail('R67_CORE_DIRECTORY'); }
  return { path: value, stat };
}
const sameFile = (a, b) => a.dev === b.dev && a.ino === b.ino;
function privateRegularFile(stat) {
  return stat.isFile() && stat.nlink === 1 && (stat.mode & 0o077) === 0 &&
    (typeof process.getuid !== 'function' || stat.uid === process.getuid()) &&
    Number.isSafeInteger(stat.size) && stat.size > 0 && stat.size <= MAX_MODULE_BYTES;
}
function readPinnedFile(directory, name, expectedHash) {
  let fd;
  try {
    fd = openSync(join(directory, name), constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const before = fstatSync(fd);
    if (!privateRegularFile(before)) fail('R67_CORE_FILE');
    // A bounded descriptor read avoids allocating an attacker-controlled grown
    // file. Hash and compilation use this one immutable byte snapshot.
    const buffer = Buffer.alloc(MAX_MODULE_BYTES + 1); let length = 0;
    while (length < buffer.length) {
      const count = readSync(fd, buffer, length, buffer.length - length, length);
      if (count === 0) break; length += count;
    }
    const after = fstatSync(fd);
    if (!privateRegularFile(after) || !sameFile(before, after) || before.size !== after.size ||
        length !== before.size || length > MAX_MODULE_BYTES) fail('R67_CORE_FILE');
    const bytes = Buffer.from(buffer.subarray(0, length));
    if (sha(bytes) !== expectedHash) fail('R67_CORE_HASH_MISMATCH');
    let text;
    try { text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes); }
    catch { fail('R67_CORE_UTF8'); }
    if (!Buffer.from(text, 'utf8').equals(bytes)) fail('R67_CORE_UTF8');
    return text;
  } catch (error) {
    if (/^R67_CORE_/.test(error?.code || '')) throw error;
    fail('R67_CORE_FILE');
  } finally { if (fd !== undefined) closeSync(fd); }
}
function handleState(handle) {
  if (!handle || typeof handle !== 'object' || !HANDLES.has(handle)) fail('R67_CORE_HANDLE');
  return HANDLES.get(handle);
}
function batchInput(value) {
  const input = fields(value, ['scenarios', 'nowMs'], ['scenarios', 'nowMs'], 'R67_CORE_BATCH_CONFIG');
  if (!Number.isSafeInteger(input.nowMs) || input.nowMs < 0 || input.nowMs > 8640000000000000)
    fail('R67_CORE_BATCH_CLOCK');
  let scenarios;
  try { scenarios = JSON.parse(canonicalR64Json(input.scenarios)); }
  catch { fail('R67_CORE_BATCH_SCENARIOS'); }
  if (!Array.isArray(scenarios) || scenarios.length < 3 || scenarios.length > 60) fail('R67_CORE_BATCH_SCENARIOS');
  const ids = new Set(), modes = new Set();
  for (const value of scenarios) {
    const scenario = fields(value, ['id', 'mode', 'intent', 'horizon', 'paused'],
      ['id', 'mode', 'intent', 'horizon'], 'R67_CORE_BATCH_SCENARIOS');
    if (typeof scenario.id !== 'string' || !/^[A-Za-z0-9._-]{1,80}$/.test(scenario.id) || ids.has(scenario.id) ||
        !MODES.includes(scenario.mode) || !['buy', 'sell'].includes(scenario.intent) ||
        !['day', 'swing'].includes(scenario.horizon) ||
        (Object.hasOwn(scenario, 'paused') && typeof scenario.paused !== 'boolean')) fail('R67_CORE_BATCH_SCENARIOS');
    ids.add(scenario.id); modes.add(scenario.mode);
  }
  if (modes.size !== MODES.length) fail('R67_CORE_BATCH_THREE_MODES_REQUIRED');
  return { scenarios, nowMs: input.nowMs };
}
const guardScript = new vm.Script(`
  globalThis.__r67Guard = null;
  try { __r67Engine.assertNoLiveExecution(); }
  catch (error) { globalThis.__r67Guard = typeof error.code === 'string' ? error.code : null; }
`, { filename: 'r67-private-core-guard' });
const invocationScript = new vm.Script(`
  globalThis.__r67Output = null;
  globalThis.__r67Error = null;
  __r67Service.analyzeRequest(JSON.parse(__r67Input), {
    now: __r67Now,
    fetcher: async () => { throw Object.assign(new Error('R67_CORE_NETWORK_FORBIDDEN'), { code: 'R67_CORE_NETWORK_FORBIDDEN' }); }
  }).then(value => { globalThis.__r67Output = JSON.stringify(value); },
    () => { globalThis.__r67Error = 'R67_CORE_EXECUTION'; });
  void 0;
`, { filename: 'r67-private-core-synthetic-invocation' });
// R71 uses this existing original hook without altering either pinned module.
// The original service answer below is produced inside this loader, never
// supplied by a caller. Only the position-context boolean is added; no scan,
// calibration, strategy code, risk setting or decision can be injected.
const positionContextScript = new vm.Script(`
  globalThis.__r71Decision = null;
  globalThis.__r71Error = null;
  try {
    const request = JSON.parse(__r71Request);
    const original = JSON.parse(__r71Original);
    const decision = __r67Engine.chooseMode({
      mode: request.mode, intent: request.intent,
      scan: original.scan, calibration: original.calibration,
      paused: request.paused === true || original.load.pauseSuggested === true,
      positionOpen: request.mode !== 'manual' && __r71ForwardedPositionOpen
    });
    globalThis.__r71Decision = JSON.stringify(decision);
  } catch { globalThis.__r71Error = 'R71_CORE_POLICY_EXECUTION'; }
`, { filename: 'r71-original-position-context-hook' });

/** A directory is the only input. Hashes and original callbacks are not injectable. */
export async function loadR67VerifiedPrivateCore(options) {
  const config = fields(options, ['directory'], ['directory'], 'R67_CORE_CONFIG');
  const directory = privateDirectory(config.directory);
  let directoryFd, engineText, serviceText;
  try {
    directoryFd = openSync(directory.path, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
    if (!sameFile(directory.stat, fstatSync(directoryFd))) fail('R67_CORE_DIRECTORY');
    engineText = readPinnedFile(directory.path, 'engine.mjs', B297_ENGINE_SHA256);
    serviceText = readPinnedFile(directory.path, 'service.mjs', B297_SERVICE_SHA256);
    if (!sameFile(directory.stat, lstatSync(directory.path)) || realpathSync(directory.path) !== directory.path)
      fail('R67_CORE_DIRECTORY');
  } catch (error) {
    if (/^R67_CORE_/.test(error?.code || '')) throw error;
    fail('R67_CORE_DIRECTORY');
  } finally { if (directoryFd !== undefined) closeSync(directoryFd); }
  if (typeof vm.SourceTextModule !== 'function') fail('R67_CORE_VM_MODULES_REQUIRED');

  const sandbox = Object.create(null);
  const context = vm.createContext(sandbox, { name: 'JENIOS_R67_PINNED_PRIVATE_CORE',
    codeGeneration: { strings: false, wasm: false }, microtaskMode: 'afterEvaluate' });
  // Only primitives are installed from the host. Export namespaces below are
  // created by this same VM; no host callback, filesystem or process is exposed.
  for (const name of ['process', 'require', 'fetch', 'Buffer', 'console', 'setTimeout', 'setInterval',
    'setImmediate', 'queueMicrotask', 'WebSocket', 'EventSource'])
    Object.defineProperty(sandbox, name, { value: undefined, writable: false, configurable: false });
  let engine, service;
  try {
    engine = new vm.SourceTextModule(engineText, { context, identifier: 'r67-private-engine:' + B297_ENGINE_SHA256 });
    service = new vm.SourceTextModule(serviceText, { context, identifier: 'r67-private-service:' + B297_SERVICE_SHA256 });
    if (engine.dependencySpecifiers.length !== 0 || service.dependencySpecifiers.length !== 1 ||
        service.dependencySpecifiers[0] !== './engine.mjs') fail('R67_CORE_DEPENDENCY');
    await service.link((specifier, requester) => {
      if (requester !== service || specifier !== './engine.mjs') fail('R67_CORE_DEPENDENCY');
      return engine;
    });
    await service.evaluate({ timeout: VM_TIMEOUT_MS });
  } catch (error) {
    if (/^R67_CORE_/.test(error?.code || '')) throw error;
    fail(error?.code === 'ERR_SCRIPT_EXECUTION_TIMEOUT' ? 'R67_CORE_TIMEOUT' : 'R67_CORE_EVALUATION');
  }
  if (typeof service.namespace.analyzeRequest !== 'function' ||
      typeof engine.namespace.chooseMode !== 'function' || typeof engine.namespace.assertNoLiveExecution !== 'function')
    fail('R67_CORE_EXPORTS');
  if (engine.namespace.VERSION !== VERSION) fail('R67_CORE_VERSION');
  Object.defineProperty(sandbox, '__r67Service', { value: service.namespace, writable: false, configurable: false });
  Object.defineProperty(sandbox, '__r67Engine', { value: engine.namespace, writable: false, configurable: false });
  try { guardScript.runInContext(context, { timeout: VM_TIMEOUT_MS }); }
  catch { fail('R67_CORE_LIVE_GUARD'); }
  if (sandbox.__r67Guard !== 'LIVE_DISABLED') fail('R67_CORE_LIVE_GUARD');
  const metadata = freeze({ schema: 'JENIOS_R67_VERIFIED_PRIVATE_CORE_V1',
    engineSha256: B297_ENGINE_SHA256, serviceSha256: B297_SERVICE_SHA256, originalVersion: VERSION,
    localExecutableBytesVerified: true, independentRuntimeAttestation: false,
    runtimeOrigin: 'ORIGINAL_PRIVATE_CORE_SYNTHETIC_RUNTIME', loaderEvidence: 'VM_SOURCE_TEXT_MODULE_PINNED_BYTES',
    commercialModes: [...MODES], ultrafastProvided: false, liveExecutionGuardVerified: true,
    executionAllowed: false, customerMonitoringActive: false, realOrdersSent: 0, externalPaperOrdersSent: 0,
    paidProviderCalls: 0 });
  const invoke = (request, nowMs) => {
    if (request?.sourceMode !== 'synthetic') fail('R67_CORE_SYNTHETIC_REQUIRED');
    sandbox.__r67Input = JSON.stringify(request); sandbox.__r67Now = nowMs;
    try {
      invocationScript.runInContext(context, { timeout: VM_TIMEOUT_MS });
      // afterEvaluate resolves the original async result inside the context.
      // Never await a cross-context promise or pass a host callback to then().
      if (sandbox.__r67Error !== null) fail('R67_CORE_EXECUTION');
      if (typeof sandbox.__r67Output !== 'string' || Buffer.byteLength(sandbox.__r67Output, 'utf8') > MAX_OUTPUT_BYTES)
        fail('R67_CORE_OUTPUT');
      let result;
      try { result = JSON.parse(sandbox.__r67Output); }
      catch { fail('R67_CORE_OUTPUT'); }
      if (result?.version !== VERSION) fail('R67_CORE_VERSION');
      return result;
    } catch (error) {
      if (/^R67_CORE_/.test(error?.code || '')) throw error;
      fail(error?.code === 'ERR_SCRIPT_EXECUTION_TIMEOUT' ? 'R67_CORE_TIMEOUT' : 'R67_CORE_EXECUTION');
    } finally {
      sandbox.__r67Input = null; sandbox.__r67Now = null; sandbox.__r67Output = null; sandbox.__r67Error = null;
    }
  };
  const invokePositionContext = (request, nowMs, forwardedPositionOpen) => {
    if (typeof forwardedPositionOpen !== 'boolean') fail('R71_CORE_POSITION_CONTEXT');
    const original = invoke(request, nowMs);
    sandbox.__r71Request = JSON.stringify(request);
    sandbox.__r71Original = JSON.stringify(original);
    sandbox.__r71ForwardedPositionOpen = forwardedPositionOpen;
    try {
      positionContextScript.runInContext(context, { timeout: VM_TIMEOUT_MS });
      if (sandbox.__r71Error !== null || typeof sandbox.__r71Decision !== 'string' ||
          Buffer.byteLength(sandbox.__r71Decision, 'utf8') > 4096) fail('R71_CORE_POLICY_EXECUTION');
      let decision;
      try { decision = JSON.parse(sandbox.__r71Decision); }
      catch { fail('R71_CORE_POLICY_EXECUTION'); }
      // The external policy may only route an unpaused assisted decision to
      // the original existing-position branch. Every other native result is
      // preserved exactly, including Manual and the original pause priority.
      const routed = forwardedPositionOpen && request.mode !== 'manual' &&
        request.paused !== true && original.load.pauseSuggested !== true;
      const expected = routed ? { side: null, action: 'manage_existing_position', mayClose: true } : original.decision;
      if (JSON.stringify(decision) !== JSON.stringify(expected)) fail('R71_CORE_POLICY_OUTPUT');
      return { original, decision };
    } catch (error) {
      if (/^R(?:67|71)_CORE_/.test(error?.code || '')) throw error;
      fail(error?.code === 'ERR_SCRIPT_EXECUTION_TIMEOUT' ? 'R71_CORE_TIMEOUT' : 'R71_CORE_POLICY_EXECUTION');
    } finally {
      sandbox.__r71Request = null; sandbox.__r71Original = null;
      sandbox.__r71ForwardedPositionOpen = null; sandbox.__r71Decision = null; sandbox.__r71Error = null;
    }
  };
  const handle = Object.freeze(Object.assign(Object.create(null), { schema: 'JENIOS_R67_PRIVATE_CORE_HANDLE_V1' }));
  HANDLES.set(handle, { metadata, invoke, invokePositionContext, busy: false });
  return handle;
}

/** Metadata is immutable and contains no private source, path or executable callback. */
export function inspectR67VerifiedPrivateCore(handle) { return handleState(handle).metadata; }

/** Returns the original B297 capture unchanged, with its original conservative
 * attestation flags. The separate loader metadata supplies LOCAL byte identity.
 */
export async function captureR67VerifiedPrivateBatch(handle, options) {
  const state = handleState(handle), { scenarios, nowMs } = batchInput(options);
  if (state.busy) fail('R67_CORE_CAPTURE_BUSY');
  state.busy = true;
  try {
    const batch = await captureB297OriginalDecisions({ scenarios, nowMs,
      analyzeRequest: request => state.invoke(request, nowMs) });
    verifyB297CaptureChain(batch);
    return batch;
  } finally { state.busy = false; }
}

/** R71 preserves B297's native capture and adds separately classified original
 * chooseMode results. Position context is synthetic; this is an external runtime
 * policy, not an internal core retuning or a broker-position attestation.
 */
export async function captureR71VerifiedPrivateBatch(handle, options) {
  const state = handleState(handle);
  const input = fields(options, ['scenarios', 'positionContexts', 'forwardPositionOpen', 'nowMs'],
    ['scenarios', 'positionContexts', 'forwardPositionOpen', 'nowMs'], 'R71_CORE_BATCH_CONFIG');
  const { scenarios, nowMs } = batchInput({ scenarios: input.scenarios, nowMs: input.nowMs });
  if (typeof input.forwardPositionOpen !== 'boolean') fail('R71_CORE_POSITION_CONTEXT');
  let positions;
  try { positions = JSON.parse(canonicalR64Json(input.positionContexts)); }
  catch { fail('R71_CORE_POSITION_CONTEXT'); }
  if (!Array.isArray(positions) || positions.length !== scenarios.length) fail('R71_CORE_POSITION_CONTEXT');
  positions = positions.map((value, index) => {
    const position = fields(value, ['scenarioId', 'positionOpen'], ['scenarioId', 'positionOpen'], 'R71_CORE_POSITION_CONTEXT');
    if (position.scenarioId !== scenarios[index].id || typeof position.positionOpen !== 'boolean')
      fail('R71_CORE_POSITION_CONTEXT');
    return position;
  });
  if (state.busy) fail('R67_CORE_CAPTURE_BUSY');
  state.busy = true;
  const policyDecisions = []; let index = 0;
  try {
    const nativeCapture = await captureB297OriginalDecisions({ scenarios, nowMs,
      analyzeRequest: request => {
        const position = positions[index++];
        const result = state.invokePositionContext(request, nowMs,
          input.forwardPositionOpen && position.positionOpen);
        const summary = value => ({ action: value.action, side: value.side, mayClose: value.mayClose });
        const nativeDecision = summary(result.original.decision), effectiveDecision = summary(result.decision);
        policyDecisions.push({ ...position, nativeDecision, effectiveDecision,
          nativeDecisionDigest: digestR71Value(nativeDecision), effectiveDecisionDigest: digestR71Value(effectiveDecision),
          nativeRawOutputSha256: sha(JSON.stringify(result.original)) });
        return result.original;
      } });
    verifyB297CaptureChain(nativeCapture);
    if (index !== scenarios.length || policyDecisions.some((decision, i) =>
      decision.nativeRawOutputSha256 !== nativeCapture.entries[i].rawOutputSha256)) fail('R71_CORE_NATIVE_BINDING');
    return freeze({ nativeCapture, policyDecisions });
  } finally { state.busy = false; }
}
