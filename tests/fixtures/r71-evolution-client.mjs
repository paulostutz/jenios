/** Local process harness only. Generated QA keys and loopback TLS; no real user,
 * provider or customer. The private mode has no fixture execution fallback.
 */
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createInterface } from 'node:readline';
import { requireR71QaEnabled } from '../../lib/platform/research/robot-r71-access.mjs';
import { createR70PreflightClient } from '../../lib/platform/research/robot-r70-preflight-client.mjs';
import { createR71HttpsObservationSender, createR71SourceStateClient } from '../../lib/platform/research/robot-r71-https-transport.mjs';
import { createR71PrivateCaptureOutbox, r71DeliveryState } from '../../lib/platform/research/robot-r71-private-capture-outbox.mjs';
import { createR71DurableEmitter } from '../../lib/platform/research/robot-r71-durable-emitter.mjs';
import { r71CaptureInputDigest, r71RecordDigest, r71AnnotationDigest, inspectR71IntakeAcknowledgement } from '../../lib/platform/research/robot-r71-private-protocol.mjs';
import { createR71ProtocolFixture } from './r71-private-protocol-fixture.mjs';

const paths = ['/api/platform/admin/robot-private-evolution', '/api/platform/internal/robot-private-evolution',
  '/api/platform/robot-private-evolution-state', '/api/platform/robot-private-policy-observations',
  '/api/platform/robot-private-target-preflight', '/platform/homologacao/robos/privado'];
const errorCode = error => /^R(?:67|68|69|70|71)_[A-Z0-9_]+$/.test(error?.code || error?.message || '')
  ? error.code || error.message : 'R71_FIXTURE_REQUEST_FAILED';
function loopback(value) {
  const url = new URL(value); assert.equal(url.protocol, 'https:'); assert.equal(url.hostname, '127.0.0.1');
  assert.equal(url.origin, value); assert.equal(url.username, ''); assert.equal(url.password, ''); assert.ok(url.port); return url;
}
function describe(record) {
  const a = record.annotation;
  return { recordDigest: r71RecordDigest(record), annotationDigest: r71AnnotationDigest(a), eventId: a.eventId,
    purpose: a.purpose, wrapperVersion: a.wrapperVersion, entryCount: a.entries.length,
    changedEntries: a.entries.filter(e => e.nativeDecisionDigest !== e.effectiveDecisionDigest).length };
}
async function genericRequest(c) {
  loopback(c.origin);
  const url = new URL(c.path, c.origin); assert.equal(url.origin, c.origin); assert.ok(paths.includes(url.pathname));
  assert.ok(['GET', 'POST'].includes(c.method || 'GET'));
  const headers = {};
  if (c.token) headers.Authorization = 'Bearer ' + c.token;
  if (c.originHeader) headers.Origin = c.originHeader;
  if (c.body !== undefined) headers['Content-Type'] = c.contentType || 'application/json';
  const response = await fetch(url, { method: c.method || 'GET', headers,
    body: c.body === undefined ? undefined : JSON.stringify(c.body), redirect: 'manual', signal: AbortSignal.timeout(15000) });
  const text = await response.text(); assert.ok(Buffer.byteLength(text) <= 2 * 1024 * 1024);
  return { status: response.status, cacheControl: response.headers.get('cache-control'),
    body: text ? (response.headers.get('content-type')?.includes('application/json') ? JSON.parse(text) : text) : null };
}
async function sourceSession() {
  requireR71QaEnabled(process.env);
  const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
  let config, emitter, outbox, getActiveState, probe, send, sessionId, sequence = 1, modeledCaptures = 0;
  const state = () => {
    if (emitter) {
      const s = emitter.inspect(); return { sessionId: s.sessionId, nativeAnalysesCompleted: s.nativeAnalysesCompleted,
        modeledCaptures: 0, nextSequence: s.nextSequence, queue: s.queue, revision: s.lastRuntimeView?.revision ?? null };
    }
    const s = outbox.read(), queue = { total: s.entries.length, acknowledged: 0, pending: 0, unconfirmed: 0 };
    for (const e of s.entries) { const x = r71DeliveryState(e); if (x === 'ACKNOWLEDGED') queue.acknowledged++; else if (x === 'PENDING') queue.pending++; else queue.unconfirmed++; }
    return { sessionId, nativeAnalysesCompleted: 0, modeledCaptures, nextSequence: sequence, queue, revision: s.lastRuntimeView?.revision ?? null };
  };
  for await (const line of lines) {
    let c;
    try {
      assert.ok(Buffer.byteLength(line) <= 1048576); c = JSON.parse(line); assert.ok(Number.isSafeInteger(c.requestId));
      let result;
      if (c.action === 'initialize') {
        assert.equal(config, undefined); config = c.config; loopback(config.origin);
        assert.ok(['PUBLIC_PROTOCOL_FIXTURE', 'ORIGINAL_PRIVATE_CORE'].includes(config.mode));
        probe = createR70PreflightClient({ targetPins: config.targetPins, trustedSource: config.trustedSource, privateKeyPem: config.privateKeyPem });
        getActiveState = createR71SourceStateClient({ targetPins: config.targetPins, trustedSource: config.trustedSource, privateKeyPem: config.privateKeyPem });
        send = createR71HttpsObservationSender({ origin: config.origin, trustedSource: config.trustedSource });
        await probe();
        if (config.mode === 'ORIGINAL_PRIVATE_CORE') {
          assert.ok(config.coreDirectory);
          const { loadR67VerifiedPrivateCore } = await import('../../lib/platform/research/robot-r67-private-core-loader.mjs');
          const handle = await loadR67VerifiedPrivateCore({ directory: config.coreDirectory });
          emitter = createR71DurableEmitter({ enabled: true, handle, directory: config.directory, key: config.key,
            scopeId: config.trustedSource.scopeId, sourceId: config.trustedSource.sourceId,
            privateKeyPem: config.privateKeyPem, getActiveState });
        } else {
          outbox = createR71PrivateCaptureOutbox({ directory: config.directory, key: config.key, trustedSource: config.trustedSource });
          sessionId = 'session:' + randomBytes(8).toString('hex'); outbox.reserveSession({ sessionId, startedAtMs: Date.now() });
        }
        result = { initialized: true, ...state() };
      } else {
        assert.ok(config);
        if (c.action === 'view') result = { runtimeView: await getActiveState() };
        else if (c.action === 'capture' || c.action === 'validate') {
          await probe();
          const purpose = c.action === 'validate' ? 'VALIDATION' : 'OBSERVATION';
          const command = purpose === 'OBSERVATION' ? { operationId: c.operationId, scenarios: c.scenarios, positionContexts: c.positionContexts }
            : { operationId: c.operationId, planId: c.planId };
          let record;
          if (emitter) record = await (purpose === 'OBSERVATION' ? emitter.captureBatch(command) : emitter.captureValidation(command));
          else {
            const inputDigest = r71CaptureInputDigest(purpose === 'OBSERVATION' ? { purpose, scenarios: c.scenarios, positionContexts: c.positionContexts } : { purpose, planId: c.planId });
            const captured = await outbox.capture({ operationId: c.operationId, inputDigest, sessionId, produce: async () => {
              const view = await getActiveState();
              if (purpose === 'VALIDATION') assert.ok(Date.now() >= view.pendingEvaluation.startsAtMs && Date.now() < view.pendingEvaluation.endsAtMs);
              const f = await createR71ProtocolFixture({ scopeId: config.trustedSource.scopeId, sourceId: config.trustedSource.sourceId,
                sessionId, sequence, privateKeyPem: config.privateKeyPem, operationId: c.operationId, runtimeView: view,
                purpose, planId: purpose === 'VALIDATION' ? c.planId : null,
                ...(purpose === 'OBSERVATION' ? { scenarios: c.scenarios, positionContexts: c.positionContexts } : {}) });
              sequence++; modeledCaptures += f.receipt.entryCount; return { record: f.record, runtimeView: view };
            } }); record = captured.record;
          }
          result = { capture: describe(record), ...state() };
        } else if (c.action === 'flush') {
          await probe();
          if (emitter) result = { delivery: await emitter.flush({ send, limit: 1 }), ...state() };
          else {
            const delivery = await outbox.withDeliveryLease(async () => {
              outbox.expire({ nowMs: Date.now() });
              const entry = outbox.read().entries.find(e => ['PENDING', 'UNCONFIRMED'].includes(r71DeliveryState(e)));
              if (!entry) return { attempted: 0, acknowledged: 0, unconfirmed: 0 };
              const attempt = outbox.beginAttempt({ operationId: entry.operationId, nowMs: Date.now() }); let acknowledgement = null;
              try { const response = await send(attempt.record); acknowledgement = inspectR71IntakeAcknowledgement(await response.json(), attempt.record, response.status); }
              catch { /* Intentionally retained ambiguous delivery for the fixture. */ }
              outbox.resolveAttempt({ operationId: entry.operationId, attemptId: attempt.attemptId, nowMs: Date.now(), acknowledgement });
              return { attempted: 1, acknowledged: acknowledgement ? 1 : 0, unconfirmed: acknowledgement ? 0 : 1 };
            }); result = { delivery, ...state() };
          }
        } else if (c.action === 'inspect') result = state();
        else if (c.action === 'stop') {
          process.stdout.write(JSON.stringify({ requestId: c.requestId, ok: true, result: state() }) + '\n'); break;
        } else throw Error('R71_FIXTURE_COMMAND');
      }
      process.stdout.write(JSON.stringify({ requestId: c.requestId, ok: true, result }) + '\n');
    } catch (error) {
      process.stdout.write(JSON.stringify({ requestId: c?.requestId ?? null, ok: false, code: errorCode(error) }) + '\n');
    }
  }
}
if (process.argv.slice(2).join(' ') === '--source-session') await sourceSession();
else {
  assert.equal(process.argv.length, 2); let input = '', bytes = 0;
  for await (const chunk of process.stdin) { bytes += chunk.length; if (bytes > 1048576) throw Error('R71_FIXTURE_INPUT_LIMIT'); input += chunk; }
  try { process.stdout.write(JSON.stringify({ ok: true, ...(await genericRequest(JSON.parse(input))) }) + '\n'); }
  catch (error) { process.stdout.write(JSON.stringify({ ok: false, code: errorCode(error) }) + '\n'); process.exitCode = 2; }
}
