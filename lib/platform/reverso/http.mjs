import { emptyReversoState, validateReversoState } from './state-contract.mjs';
const headers = { 'Cache-Control': 'private, no-store', 'Vary': 'Authorization, Cookie', 'X-Content-Type-Options': 'nosniff' };
const reply = (body, status = 200) => Response.json(body, { status, headers });
const fail = (status, message) => { throw Object.assign(Error(message), { status }); };
const validSubject = s => typeof s === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(s);

/** Same dedicated Platform identity and admin permission as the existing robot
 * administration. Only reads; never resolves a customer by email. */
export function createReversoStateHandler({ getUser, requireAdmin, readState, now = Date.now, admin = false } = {}) {
  if (typeof getUser !== 'function' || admin && typeof requireAdmin !== 'function') throw Error('REVERSO_IDENTITY_REQUIRED');
  return async request => {
    try {
      const url = new URL(request.url);
      if (request.method !== 'GET') fail(405, 'Método não permitido.');
      const origin = request.headers.get('origin'), site = request.headers.get('sec-fetch-site');
      if (origin && origin !== url.origin || site && !['same-origin', 'none'].includes(site)) fail(403, 'Origem não autorizada.');
      const user = await getUser(request);
      if (!validSubject(user?.id) || user.is_anonymous) fail(401, 'Entre com sua conta da Platform.');
      let subject = user.id;
      if (admin) {
        if ([...url.searchParams.keys()].some(k => k !== 'subject') || url.searchParams.getAll('subject').length !== 1 || !validSubject(url.searchParams.get('subject'))) fail(400, 'Informe um titular válido.');
        const authorization = await requireAdmin(request);
        if (authorization?.user?.id !== user.id || !authorization.permissions?.includes('platform.admin')) fail(403, 'Conta sem autorização administrativa na Platform.');
        subject = url.searchParams.get('subject');
      } else if (url.search) fail(400, 'A conta é determinada pela sessão.');
      let state = emptyReversoState({ subject, now: now() });
      try { if (readState) state = validateReversoState(await readState({ subject, robotId: 'reverso', platform: 'jenios' }), { subject, now: now() }); }
      catch { /* Missing evidence is unavailable, never a zero balance. */ }
      const current = await getUser(request);
      if (current?.id !== user.id || current.is_anonymous) fail(409, 'Sua sessão mudou. Atualize a página.');
      if (admin) {
        const currentAdmin = await requireAdmin(request);
        if (currentAdmin?.user?.id !== user.id || !currentAdmin.permissions?.includes('platform.admin')) fail(403, 'Permissão administrativa indisponível.');
      }
      try { state = validateReversoState(state, { subject, now: now() }); }
      catch { state = emptyReversoState({ subject, now: now() }); }
      return reply(state);
    } catch (e) { return reply({ error: e.status ? e.message : 'Os dados do Reverso estão indisponíveis.' }, [400, 401, 403, 405, 409].includes(e.status) ? e.status : 503); }
  };
}
