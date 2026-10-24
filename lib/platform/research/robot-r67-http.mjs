/** Separate private-batch intake and authenticated read-only admin visibility. */
import { readBoundedJson } from '../bounded-response.mjs';
import { requirePlatformAdmin } from '../admin-permissions.mjs';
import { isRobotR67QaEnabled } from './robot-r67-access.mjs';
import { verifyR67PrivateObservationRecord, inspectR67StoredObservation, createR67IntakeAcknowledgement,
  R67_LIMITS, R67_INVARIANTS, R67_EVIDENCE, R67_ORIGIN, R67_BINDING } from './robot-r67-private-protocol.mjs';

const respond = (body, status = 200) => Response.json(body, { status,
  headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
const unavailable = () => respond({ error: 'Observações privadas indisponíveis; nenhum resultado foi presumido.' }, 503);
const disabled = () => respond({ error: 'Recurso indisponível.' }, 404);

export function createR67ObservationHandler({ getStore, getSource, env = process.env, now = Date.now } = {}) {
  return async request => {
    if (!isRobotR67QaEnabled(env)) return disabled();
    if (request.method !== 'POST') return respond({ error: 'Método não permitido.' }, 405);
    if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') || ''))
      return respond({ error: 'Envie JSON.' }, 415);
    let source;
    try { source = getSource(); } catch { return unavailable(); }
    let verified;
    try { verified = verifyR67PrivateObservationRecord(await readBoundedJson(request, R67_LIMITS.maxBytes),
      { trustedSource: source, nowMs: now() }); }
    catch { return respond({ error: 'Captura privada ou assinatura recusada.' }, 400); }
    try {
      const result = await getStore().ingest({ receipt: verified.receipt, record: verified.record });
      if (!['STORED', 'ALREADY_STORED'].includes(result.status)) throw Error('R67_INTAKE_UNCONFIRMED');
      const ack = createR67IntakeAcknowledgement({ receipt: result.receipt, record: result.record }, result.status);
      // The backing store is a trusted dependency but cannot acknowledge another
      // record if a host miswires its response adapter.
      if (ack.recordDigest !== verified.receipt.recordDigest || ack.scopeId !== source.scopeId ||
          ack.sourceId !== source.sourceId || ack.eventId !== verified.receipt.eventId) throw Error('R67_INTAKE_UNCONFIRMED');
      return respond(ack, result.status === 'STORED' ? 202 : 200);
    } catch (error) {
      return /CONFLICT|SEQUENCE|REPLAY|MISMATCH/.test(error?.code || '')
        ? respond({ error: 'Captura em conflito com o registro existente.' }, 409) : unavailable();
    }
  };
}

export function createR67AdminHandler({ getDb, getRuntime, env = process.env, now = Date.now } = {}) {
  return async request => {
    if (!isRobotR67QaEnabled(env)) return disabled();
    if (request.method !== 'GET') return respond({ error: 'Método não permitido.' }, 405);
    if (!/^Bearer [^\s]+$/i.test(request.headers.get('authorization') || ''))
      return respond({ error: 'Entre com sua conta administrativa da Platform.' }, 401);
    // The caller never selects source, scope, actor, limit or runtime identity.
    if (new URL(request.url).search) return respond({ error: 'Esta consulta não aceita parâmetros.' }, 400);
    try {
      await requirePlatformAdmin(request, getDb(), 'platform.admin');
      const runtime = getRuntime(), observations = await runtime.store.read({ limit: 30 });
      if (!Array.isArray(observations) || observations.length > 30) throw Error('R67_ADMIN_INVALID');
      const rows = observations.map(raw => {
        const { receipt, record } = inspectR67StoredObservation(raw);
        if (receipt.scopeId !== runtime.scopeId || receipt.sourceId !== runtime.sourceId) throw Error('R67_ADMIN_SCOPE');
        return { eventId: receipt.eventId, sessionId: receipt.sessionId, sequence: receipt.sequence,
          capturedAtMs: receipt.capturedAtMs, admittedAtMs: receipt.admittedAtMs,
          recordDigest: receipt.recordDigest, captureCount: receipt.captureCount, counts: receipt.counts,
          originalActions: record.envelope.payload.capture.entries.map(entry => ({ robot: entry.commercialMode,
            action: entry.action, suggestedSide: entry.suggestedSide, originalVersion: entry.originalVersion })) };
      });
      const generatedAtMs = now();
      if (!Number.isSafeInteger(generatedAtMs) || generatedAtMs < 0) throw Error('R67_ADMIN_CLOCK');
      return respond({ schema: 'JENIOS_R67_PRIVATE_ADMIN_FEED_V1', adminOnly: true,
        scopeId: runtime.scopeId, sourceId: runtime.sourceId, generatedAtMs, sampleLimit: 30,
        returnedBatches: rows.length, returnedCaptures: rows.reduce((sum, row) => sum + row.captureCount, 0),
        observations: rows, evidenceKind: R67_EVIDENCE, runtimeOrigin: R67_ORIGIN, ...R67_BINDING,
        configuredSourceSignaturesCheckedAtIntake: true, currentPrivateHostIndependentlyObserved: false,
        ...R67_INVARIANTS });
    } catch (error) {
      return [401, 403].includes(error?.status)
        ? respond({ error: error.status === 401 ? 'Sessão inválida da Platform.' : 'Conta sem autorização administrativa.' }, error.status)
        : unavailable();
    }
  };
}
