export const BOOST_FIELDS = 'order_id,owner_id,post_id,target,amount_cents,state,starts_at,ends_at,revision,created_at,updated_at';
export const boostEnabled = (env = process.env) => env.JENIOS_BOOST_CAMPAIGNS_ENABLED === 'true';
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
export const boostUuid = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value || '');

export function boostDestination(value, objective) {
  if (!value) return null;
  let url;
  try { url = new URL(value); } catch { fail('Informe o destino HTTPS da campanha.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.toString().length > 1500) fail('Use um destino HTTPS sem credenciais.');
  if (objective === 'whatsapp' && (url.hostname !== 'wa.me' || !/^\/[1-9]\d{7,14}$/.test(url.pathname) || url.hash)) fail('Para WhatsApp, use https://wa.me/ com o número completo e DDI.');
  return url.toString();
}
export function validateBoostTarget(target) {
  if (!boostUuid(target?.postId) || !Number.isSafeInteger(target.dailyCents) || target.dailyCents < 1000 || target.dailyCents > 1000000 || !Number.isInteger(target.days) || target.days < 1 || target.days > 365 || !['profile', 'website', 'whatsapp', 'copy'].includes(target.objective)) fail('Dados de campanha inválidos.');
  audienceInput(target);
  const destination = boostDestination(target.destination, target.objective);
  if (target.objective !== 'profile' && !destination) fail('Informe o destino para este objetivo antes de pagar.');
  return { ...target, ...(destination ? { destination } : {}) };
}
export function audienceInput(body) {
  const result = {};
  for (const key of ['country', 'region', 'city']) {
    if (body?.[key] != null && typeof body[key] !== 'string') fail('Localização declarada inválida.');
    const value = String(body?.[key] || '').trim();
    if (value.length > 80) fail('Localização declarada muito longa.');
    result[key] = value;
  }
  if (!result.country) fail('Informe voluntariamente seu país para consultar os anúncios dessa região.');
  return result;
}
export async function prepareBoostCampaign({ db, order, quote }) {
  validateBoostTarget(quote.target);
  const expected = { order_id: order.id, owner_id: order.user_id, post_id: quote.target.postId, amount_cents: quote.amount_cents };
  const verify = row => {
    const canonical = obj => JSON.stringify(Object.fromEntries(Object.entries(obj || {}).sort(([a], [b]) => a.localeCompare(b))));
    if (!row || Object.entries(expected).some(([key, value]) => String(row[key]) !== String(value)) || canonical(row.target) !== canonical(quote.target)) fail('A campanha não corresponde à contratação.', 409);
    return row;
  };
  const existing = await db.from('jenios_boost_campaigns').select(BOOST_FIELDS).eq('order_id', order.id).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return verify(existing.data);
  const result = await db.from('jenios_boost_campaigns').insert({ ...expected, target: quote.target, state: 'pending', revision: 0 }).select(BOOST_FIELDS).single();
  if (result.error?.code === '23505') {
    const retry = await db.from('jenios_boost_campaigns').select(BOOST_FIELDS).eq('order_id', order.id).maybeSingle();
    if (retry.error) throw retry.error;
    return verify(retry.data);
  }
  if (result.error) throw result.error;
  return verify(result.data);
}
export function visibleBoostCampaign(row, ownerId, paymentStatus, metrics = {}, now = Date.now()) {
  if (row.owner_id !== ownerId) fail('Campanha não encontrada.', 404);
  const expired = Boolean(row.ends_at && Date.parse(row.ends_at) <= now);
  const state = expired && row.state !== 'cancelled' ? 'ended' : row.state;
  const actions = paymentStatus !== 'paid' ? [] : state === 'pending' ? ['start', 'cancel'] : state === 'active' ? ['pause', 'cancel'] : state === 'paused' ? ['resume', 'cancel'] : [];
  return { orderId: row.order_id, postId: row.post_id, target: row.target, amount_cents: Number(row.amount_cents), state, paymentStatus, startsAt: row.starts_at, endsAt: row.ends_at, revision: row.revision, actions, impressions: Number(metrics.impressions || 0), clicks: Number(metrics.clicks || 0), createdAt: row.created_at };
}
export async function listBoostCampaigns({ db, user, page = 1 }) {
  if (!Number.isInteger(page) || page < 1 || page > 10000) fail('Página inválida.');
  const result = await db.from('jenios_boost_campaigns').select(BOOST_FIELDS).eq('owner_id', user.id).order('created_at', { ascending: false }).order('order_id').range((page - 1) * 30, page * 30);
  if (result.error) throw result.error;
  const rows = (result.data || []).slice(0, 30);
  let payments = [], metrics = [];
  if (rows.length) {
    const orders = await db.from('jenios_pay_orders').select('id,status').in('id', rows.map(row => row.order_id));
    if (orders.error) throw orders.error; payments = orders.data || [];
    const counts = await db.rpc('jenios_boost_metrics', { p_owner_id: user.id, p_order_ids: rows.map(row => row.order_id) });
    if (counts.error) throw counts.error; metrics = counts.data || [];
  }
  return { campaigns: rows.map(row => visibleBoostCampaign(row, user.id, payments.find(o => o.id === row.order_id)?.status || 'unknown', metrics.find(m => m.order_id === row.order_id))), nextPage: result.data?.length > 30 ? page + 1 : null };
}
export async function boostAction({ db, user, body }) {
  if (!boostUuid(body?.orderId) || !Number.isSafeInteger(body.revision) || body.revision < 0 || !['start', 'pause', 'resume', 'cancel'].includes(body.action)) fail('Ação inválida.');
  const result = await db.rpc('jenios_boost_action', { p_order_id: body.orderId, p_actor_id: user.id, p_expected_revision: body.revision, p_action: body.action });
  if (result.error) {
    const status = { P0002: 404, '40001': 409, '42501': 403, '22023': 400 }[result.error.code];
    if (status) fail(status === 409 ? 'Campanha atualizada em outra sessão. Atualize a lista.' : 'A campanha ou pagamento não permite esta ação.', status);
    throw result.error;
  }
  return { updated: true };
}
