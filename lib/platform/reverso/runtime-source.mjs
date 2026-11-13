import { randomUUID, timingSafeEqual } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { validateReversoState } from './state-contract.mjs';
const keyValid = v => typeof v === 'string' && /^[A-Za-z0-9_-]{32,256}$/.test(v);
const subjectValid = v => typeof v === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v);
async function bounded(response, limit) {
  if (!response.ok || !response.headers.get('content-type')?.includes('application/json') || !response.body) throw Error('REVERSO_SOURCE_UNAVAILABLE');
  const reader = response.body.getReader(), chunks = []; let size = 0;
  try { for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > limit) { await reader.cancel(); throw Error('REVERSO_SOURCE_TOO_LARGE'); } chunks.push(value); }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
  } finally { reader.releaseLock(); }
}

// Same runtime host/credential; a separate scoped READ route. This setting
// does not grant access, activate charges or create another financial ledger.
export function createReversoRuntimeSource({ env = {}, fetchImpl = fetch, now = Date.now, timeoutMs = 8000 } = {}) {
  return async ({ subject }) => {
    if (env.REVERSO_RUNTIME_READ_ENABLED !== 'true') return null;
    if (!subjectValid(subject) || !keyValid(env.ULTRA_RUNTIME_SERVICE_KEY)) throw Error('REVERSO_SOURCE_CONFIGURATION');
    const u = new URL(env.ULTRA_RUNTIME_ORIGIN);
    if (u.protocol !== 'https:' || u.username || u.password || u.port || u.pathname !== '/' || u.search || u.hash) throw Error('REVERSO_SOURCE_CONFIGURATION');
    const nonce = randomUUID(), issuedAt = now();
    const task = (async () => {
      const response = await fetchImpl(u.origin + '/v1/reverso/state', { method: 'POST', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(timeoutMs),
        headers: { Authorization: 'Bearer ' + env.ULTRA_RUNTIME_SERVICE_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ schema: 'REVERSO_STATE_REQUEST_V1', platform: 'jenios', robotId: 'reverso', subject, nonce, issuedAt }) });
      const raw = await bounded(response, 500000);
      if (raw.nonce !== nonce) throw Error('REVERSO_SOURCE_CONTEXT_MISMATCH');
      return validateReversoState(raw.state, { subject, now: now() });
    })();
    let timer;
    try { return await Promise.race([task, new Promise((_, reject) => { timer = setTimeout(() => reject(Error('REVERSO_SOURCE_TIMEOUT')), timeoutMs); })]); }
    finally { clearTimeout(timer); }
  };
}

export function createReversoRuntimeStateService({ serviceKey, resolve, now = Date.now } = {}) {
  if (!keyValid(serviceKey) || typeof resolve !== 'function') throw Error('REVERSO_SOURCE_CONFIGURATION');
  return async request => {
    const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
    const reply = (value, status = 200) => Response.json(value, { status, headers });
    try {
      if (request.method !== 'POST' || new URL(request.url).pathname !== '/v1/reverso/state' || new URL(request.url).search) return reply({ error: 'not_found' }, 404);
      const given = Buffer.from((request.headers.get('authorization') ?? '').replace(/^Bearer /, '')), expected = Buffer.from(serviceKey);
      if (given.length !== expected.length || !timingSafeEqual(given, expected)) return reply({ error: 'unauthorized' }, 401);
      if (!request.headers.get('content-type')?.startsWith('application/json')) return reply({ error: 'invalid_request' }, 400);
      const b = await bounded(new Response(request.body, { headers: { 'Content-Type': 'application/json' } }), 4096);
      if (Object.keys(b).sort().join() !== 'issuedAt,nonce,platform,robotId,schema,subject' || b.schema !== 'REVERSO_STATE_REQUEST_V1' || b.platform !== 'jenios' || b.robotId !== 'reverso' || !subjectValid(b.subject) ||
          typeof b.nonce !== 'string' || !/^[a-f0-9-]{36}$/.test(b.nonce) || !Number.isSafeInteger(b.issuedAt) || Math.abs(now() - b.issuedAt) > 30000) return reply({ error: 'invalid_request' }, 400);
      const context = { platform: 'jenios', subject: b.subject, robotId: 'reverso' };
      const source = await resolve(context);
      if (!source || typeof source.readState !== 'function') return reply({ error: 'source_unavailable' }, 503);
      const state = validateReversoState(await source.readState(), { subject: b.subject, now: now() });
      if (await resolve(context) !== source) return reply({ error: 'identity_changed' }, 409);
      return reply({ nonce: b.nonce, state: validateReversoState(state, { subject: b.subject, now: now() }) });
    } catch { return reply({ error: 'source_unavailable' }, 503); }
  };
}
