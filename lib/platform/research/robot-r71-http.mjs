/** Independent R71 HTTP surface. All identities and source scope are server-bound. */
import { readBoundedJson } from '../bounded-response.mjs';
import { requirePlatformAdmin } from '../admin-permissions.mjs';
import { isRobotR71QaEnabled, isR71AdminOriginAllowed, isR71SchedulerAuthorized } from './robot-r71-access.mjs';
import { r67SourceKeyDigest } from './robot-r67-private-protocol.mjs';
import { handleR70PreflightRequest } from './robot-r70-preflight-http.mjs';
import { R71_BOUNDARIES, inspectR71Version, inspectR71RuntimeView } from './robot-r71-policy.mjs';
import { verifyR71PrivateObservationRecord, createR71IntakeAcknowledgement,
  verifyR71SourceStateQuery, createR71SourceStateResult } from './robot-r71-private-protocol.mjs';
import { requireR71AdminFeed } from './robot-r71-admin-view.mjs';

const respond = (body, status = 200) => Response.json(body, { status,
  headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
const disabled = () => respond({ error: 'Recurso indisponível.' }, 404);
const unavailable = () => respond({ error: 'Evolução privada indisponível; nenhum resultado foi presumido.' }, 503);
const uuid = v => typeof v === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v);
const hasQuery = request => Boolean(new URL(request.url).search);
const jsonType = request => /^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') || '');
const bearer = request => /^Bearer [^\s]+$/i.test(request.headers.get('authorization') || '');
const sameSource = (a, b) => a.scopeId === b.scopeId && a.sourceId === b.sourceId && r67SourceKeyDigest(a) === r67SourceKeyDigest(b);
function errorResponse(error) {
  if ([401, 403].includes(error?.status)) return respond({ error: error.status === 401
    ? 'Sessão inválida da Platform.' : 'Conta sem permissão administrativa.' }, error.status);
  if (error?.code === 'R71_DISABLED') return disabled();
  if (/CONFLICT|MISMATCH|EXPIRED|WINDOW|PENDING|CHANGED|STALE|NOT_OPEN|NO_PREVIOUS|REPLAY|SEQUENCE/.test(error?.code || ''))
    return respond({ error: 'O estado mudou ou a ação não está disponível. Atualize o relatório.' }, 409);
  return unavailable();
}
function actionInput(body) {
  const shape = body?.action === 'TICK' ? ['action'] : body?.action === 'ROLLBACK'
    ? ['action', 'operationId', 'expectedRevision', 'previousDigest', 'reason'] : null;
  if (!body || typeof body !== 'object' || Array.isArray(body) || !shape ||
      Object.keys(body).length !== shape.length || Object.keys(body).some(k => !shape.includes(k))) throw Error('R71_ACTION_INVALID');
  if (body.action === 'ROLLBACK' && (typeof body.operationId !== 'string' || !/^op:[a-f0-9]{32}$/.test(body.operationId) ||
      !Number.isSafeInteger(body.expectedRevision) || body.expectedRevision < 0 || body.expectedRevision > 31 ||
      typeof body.previousDigest !== 'string' || !/^[a-f0-9]{64}$/.test(body.previousDigest) ||
      !['OWNER_REQUEST', 'TECHNICAL_FAILURE', 'REGRESSION_DETECTED'].includes(body.reason))) throw Error('R71_ACTION_INVALID');
  return body;
}
function projectResult(raw) {
  if (!raw || typeof raw.status !== 'string' || !/^[A-Z_]{1,90}$/.test(raw.status) ||
      !Number.isSafeInteger(raw.revision) || raw.revision < 0 || raw.revision > 31) throw Error('R71_RESULT_INVALID');
  const activeVersion = inspectR71Version(raw.activeVersion);
  const nextAtMs = raw.nextAtMs ?? null;
  if (nextAtMs !== null && (!Number.isSafeInteger(nextAtMs) || nextAtMs < 0)) throw Error('R71_RESULT_INVALID');
  return { status: raw.status, revision: raw.revision, activeVersion, nextAtMs };
}
async function emptyBody(request) {
  if (!request.body) return true;
  const reader = request.body.getReader(); let timer;
  try {
    const value = await Promise.race([reader.read(), new Promise(resolve => {
      timer = setTimeout(() => { resolve({ done: false }); void reader.cancel().catch(() => {}); }, 1000);
    })]);
    if (!value.done) { void reader.cancel().catch(() => {}); return false; }
    return true;
  } finally { clearTimeout(timer); reader.releaseLock(); }
}

export function createR71ObservationHandler({ getStore, getSource, env = process.env, now = Date.now } = {}) {
  return async request => {
    if (!isRobotR71QaEnabled(env)) return disabled();
    if (request.method !== 'POST') return respond({ error: 'Método não permitido.' }, 405);
    if (hasQuery(request)) return respond({ error: 'Esta admissão não aceita parâmetros.' }, 400);
    if (!jsonType(request)) return respond({ error: 'Envie JSON.' }, 415);
    let body;
    try { body = await readBoundedJson(request, 524288); } catch { return respond({ error: 'Observação recusada.' }, 400); }
    if (!isRobotR71QaEnabled(env)) return disabled();
    let source;
    try { source = getSource(); } catch { return unavailable(); }
    let verified;
    try { verified = verifyR71PrivateObservationRecord(body, { trustedSource: source, nowMs: now() }); }
    catch { return respond({ error: 'Observação privada ou assinatura recusada.' }, 400); }
    try {
      const result = await getStore().ingest({ receipt: verified.receipt, record: verified.record });
      if (!isRobotR71QaEnabled(env)) return disabled();
      if (!sameSource(source, getSource())) return unavailable();
      if (!['STORED', 'ALREADY_STORED'].includes(result?.status)) throw Error('R71_INTAKE_UNCONFIRMED');
      const ack = createR71IntakeAcknowledgement({ receipt: result.receipt, record: result.record }, result.status);
      if (ack.recordDigest !== verified.receipt.recordDigest || ack.annotationDigest !== verified.receipt.annotationDigest ||
          ack.scopeId !== source.scopeId || ack.sourceId !== source.sourceId ||
          ack.eventId !== verified.receipt.nativeReceipt.eventId) throw Error('R71_INTAKE_UNCONFIRMED');
      return respond(ack, result.status === 'STORED' ? 202 : 200);
    } catch (error) { return errorResponse(error); }
  };
}

export function createR71SourceStateHandler({ getSource, getRuntime, env = process.env, now = Date.now } = {}) {
  return async request => {
    if (!isRobotR71QaEnabled(env)) return disabled();
    if (request.method !== 'POST') return respond({ error: 'Método não permitido.' }, 405);
    if (hasQuery(request)) return respond({ error: 'Esta consulta não aceita parâmetros.' }, 400);
    if (!jsonType(request)) return respond({ error: 'Envie JSON.' }, 415);
    let body;
    try { body = await readBoundedJson(request, 8192); } catch { return respond({ error: 'Consulta de fonte recusada.' }, 400); }
    if (!isRobotR71QaEnabled(env)) return disabled();
    let source;
    try { source = getSource(); } catch { return unavailable(); }
    let checked;
    try { checked = verifyR71SourceStateQuery(body, { trustedSource: source, nowMs: now() }); }
    catch { return respond({ error: 'Fonte ou assinatura de consulta recusada.' }, 401); }
    // Authenticate the source's separate query domain, then reuse R70's
    // server-metadata comparison. No DB read is possible before both succeed.
    const preflight = await handleR70PreflightRequest(new Request(request.url, { method: 'POST',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(checked.challenge) }), { env, nowMs: now() });
    if (!preflight.ok) return preflight;
    if (!isRobotR71QaEnabled(env)) return disabled();
    try {
      if (!sameSource(source, getSource())) return unavailable();
      const runtimeView = inspectR71RuntimeView(await getRuntime().readRuntimeView());
      if (!isRobotR71QaEnabled(env)) return disabled();
      if (!sameSource(source, getSource())) return unavailable();
      const stillBound = await handleR70PreflightRequest(new Request(request.url, { method: 'POST',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(checked.challenge) }), { env, nowMs: now() });
      if (!stillBound.ok) return stillBound;
      if (!isRobotR71QaEnabled(env)) return disabled();
      return respond(createR71SourceStateResult({ query: checked.query, runtimeView, trustedSource: source, nowMs: now() }));
    } catch (error) { return errorResponse(error); }
  };
}

export function createR71AdminHandler({ getDb, getRuntime, env = process.env } = {}) {
  return async request => {
    if (!isRobotR71QaEnabled(env)) return disabled();
    if (!['GET', 'POST'].includes(request.method)) return respond({ error: 'Método não permitido.' }, 405);
    if (hasQuery(request)) return respond({ error: 'Esta consulta não aceita parâmetros.' }, 400);
    if (!bearer(request)) return respond({ error: 'Entre com sua conta administrativa da Platform.' }, 401);
    try {
      const { user } = await requirePlatformAdmin(request, getDb(), 'platform.admin');
      if (!isRobotR71QaEnabled(env)) return disabled();
      if (!uuid(user.id)) throw Object.assign(Error('R71_ADMIN_IDENTITY'), { status: 403 });
      if (request.method === 'GET') {
        const feed = requireR71AdminFeed(await getRuntime().readFeed());
        return isRobotR71QaEnabled(env) ? respond(feed) : disabled();
      }
      if (!isR71AdminOriginAllowed(request, env)) return respond({ error: 'Origem inválida.' }, 403);
      if (!jsonType(request)) return respond({ error: 'Envie JSON.' }, 415);
      let action;
      try { action = actionInput(await readBoundedJson(request, 16384)); }
      catch { return respond({ error: 'Solicitação inválida.' }, 400); }
      if (!isRobotR71QaEnabled(env)) return disabled();
      if (!isR71AdminOriginAllowed(request, env)) return respond({ error: 'Origem inválida.' }, 403);
      const runtime = getRuntime();
      const raw = action.action === 'TICK' ? await runtime.runTick() : await runtime.rollback({
        operationId: action.operationId, expectedRevision: action.expectedRevision, previousDigest: action.previousDigest,
        reason: action.reason, actorId: 'user:' + user.id });
      if (!isRobotR71QaEnabled(env)) return disabled();
      return respond({ schema: 'JENIOS_R71_ADMIN_ACTION_V1', action: action.action, result: projectResult(raw), ...R71_BOUNDARIES });
    } catch (error) { return errorResponse(error); }
  };
}

export function createR71SchedulerHandler({ getRuntime, env = process.env } = {}) {
  return async request => {
    if (!isRobotR71QaEnabled(env)) return disabled();
    if (request.method !== 'POST') return respond({ error: 'Método não permitido.' }, 405);
    if (hasQuery(request)) return respond({ error: 'Esta rotina não aceita parâmetros.' }, 400);
    if (!isR71SchedulerAuthorized(request, env)) return respond({ error: 'Agendador não autorizado.' }, 401);
    try {
      if (!await emptyBody(request)) return respond({ error: 'Esta rotina não aceita corpo.' }, 400);
      if (!isRobotR71QaEnabled(env)) return disabled();
      if (!isR71SchedulerAuthorized(request, env)) return respond({ error: 'Agendador não autorizado.' }, 401);
      const result = projectResult(await getRuntime().runTick());
      if (!isRobotR71QaEnabled(env)) return disabled();
      return respond({ schema: 'JENIOS_R71_SCHEDULE_RESULT_V1', ...result, productionSchedulerStarted: false, ...R71_BOUNDARIES });
    } catch (error) { return errorResponse(error); }
  };
}
