export const SPECIALIST_ORDER_FIELDS = 'order_id,buyer_id,seller_id,offer_id,snapshot,amount_cents,commission_cents,seller_amount_cents,state,scheduled_at,meeting_url,delivery_note,revision,history,created_at,updated_at';
export const specialistOrdersEnabled = (env = process.env) => env.JENIOS_SPECIALIST_ORDERS_ENABLED === 'true';
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const uuid = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value || '');

export async function prepareSpecialistOrder({ db, order, quote, offer, sellerName }) {
  const expected = { order_id: order.id, buyer_id: order.user_id, seller_id: quote.target.specialistId, offer_id: quote.target.offerId, amount_cents: quote.amount_cents, commission_cents: quote.commission_cents, seller_amount_cents: quote.seller_amount_cents };
  const verify = row => {
    if (!row || Object.entries(expected).some(([key, value]) => String(row[key]) !== String(value))) fail('O atendimento não corresponde à contratação.', 409);
    return row;
  };
  const { data: existing, error } = await db.from('jenios_specialist_orders').select(SPECIALIST_ORDER_FIELDS).eq('order_id', order.id).maybeSingle();
  if (error) throw error;
  if (existing) return verify(existing);
  const { data, error: insertError } = await db.from('jenios_specialist_orders').insert({ ...expected, snapshot: { title: offer.title, description: offer.description, kind: offer.kind, sellerName }, state: 'pending', revision: 0, history: [] }).select(SPECIALIST_ORDER_FIELDS).single();
  if (insertError?.code === '23505') {
    const result = await db.from('jenios_specialist_orders').select(SPECIALIST_ORDER_FIELDS).eq('order_id', order.id).maybeSingle();
    if (result.error) throw result.error;
    return verify(result.data);
  }
  if (insertError) throw insertError;
  return verify(data);
}

export function allowedSpecialistActions(row, actorId, paymentStatus) {
  if (paymentStatus !== 'paid') return [];
  if (actorId === row.seller_id) {
    if (row.state === 'pending') return ['accept', 'decline'];
    if (row.state === 'accepted') return ['schedule', 'deliver', 'decline'];
    if (row.state === 'scheduled') return ['schedule', 'deliver'];
  }
  if (actorId === row.buyer_id && row.state === 'delivered') return ['complete'];
  return [];
}

export function specialistActionInput(body, now = Date.now()) {
  if (!body || !uuid(body.orderId) || !Number.isSafeInteger(body.revision) || body.revision < 0 || !['accept', 'decline', 'schedule', 'deliver', 'complete'].includes(body.action)) fail('Ação ou pedido inválido.');
  const result = { orderId: body.orderId, revision: body.revision, action: body.action, scheduledAt: null, meetingUrl: null, deliveryNote: '' };
  if (body.action === 'schedule') {
    if (typeof body.scheduledAt !== 'string' || !/(Z|[+-]\d{2}:\d{2})$/i.test(body.scheduledAt)) fail('Informe um horário com fuso explícito.');
    const timestamp = Date.parse(body.scheduledAt);
    if (!Number.isFinite(timestamp) || timestamp <= now || timestamp > now + 366 * 86400000) fail('Escolha um horário futuro, em até um ano.');
    result.scheduledAt = new Date(timestamp).toISOString();
    if (body.meetingUrl) {
      let url;
      try { url = new URL(body.meetingUrl); } catch { fail('Link da sessão inválido.'); }
      if (url.protocol !== 'https:' || url.username || url.password || url.toString().length > 1500) fail('Use um link HTTPS sem credenciais.');
      result.meetingUrl = url.toString();
    }
  }
  if (body.action === 'deliver' || body.action === 'decline') {
    const note = String(body.deliveryNote || '').trim();
    if (note.length < 10 || note.length > 2000) fail('Descreva a entrega ou o motivo em 10 a 2.000 caracteres.');
    result.deliveryNote = note;
  }
  return result;
}

export function visibleSpecialistOrder(row, actorId, paymentStatus) {
  const seller = actorId === row.seller_id, buyer = actorId === row.buyer_id;
  if (!seller && !buyer) fail('Atendimento não encontrado.', 404);
  return { orderId: row.order_id, role: seller ? 'seller' : 'buyer', offerId: row.offer_id, snapshot: { title: row.snapshot?.title, description: row.snapshot?.description, kind: row.snapshot?.kind, sellerName: row.snapshot?.sellerName }, amount_cents: Number(row.amount_cents), ...(seller ? { commission_cents: Number(row.commission_cents), seller_amount_cents: Number(row.seller_amount_cents) } : {}), state: row.state, paymentStatus, scheduledAt: row.scheduled_at, meetingUrl: row.meeting_url, deliveryNote: row.delivery_note, revision: row.revision, history: (row.history || []).map(({ action, role, at }) => ({ action, role, at })), createdAt: row.created_at, updatedAt: row.updated_at, actions: allowedSpecialistActions(row, actorId, paymentStatus) };
}

export async function listSpecialistOrders({ db, user, role = 'buyer', page = 1 }) {
  if (!['buyer', 'seller'].includes(role) || !Number.isInteger(page) || page < 1 || page > 10000) fail('Filtro inválido.');
  const { data: rows, error } = await db.from('jenios_specialist_orders').select(SPECIALIST_ORDER_FIELDS).eq(role === 'seller' ? 'seller_id' : 'buyer_id', user.id).order('created_at', { ascending: false }).order('order_id').range((page - 1) * 30, page * 30);
  if (error) throw error;
  const visible = (rows || []).slice(0, 30);
  let payments = [];
  if (visible.length) {
    const result = await db.from('jenios_pay_orders').select('id,status').in('id', visible.map(row => row.order_id));
    if (result.error) throw result.error;
    payments = result.data || [];
  }
  return { orders: visible.map(row => visibleSpecialistOrder(row, user.id, payments.find(payment => payment.id === row.order_id)?.status || 'unknown')), nextPage: rows?.length > 30 ? page + 1 : null };
}

export async function updateSpecialistOrder({ db, user, body }) {
  const input = specialistActionInput(body);
  const { data, error } = await db.rpc('jenios_specialist_order_action', { p_order_id: input.orderId, p_actor_id: user.id, p_expected_revision: input.revision, p_action: input.action, p_scheduled_at: input.scheduledAt, p_meeting_url: input.meetingUrl, p_delivery_note: input.deliveryNote });
  if (error) {
    if (error.code === 'P0002') fail('Atendimento não encontrado.', 404);
    if (error.code === '40001') fail('O atendimento foi atualizado em outra sessão. Atualize a lista.', 409);
    if (error.code === '42501') fail('Ação não permitida neste estado de atendimento ou pagamento.', 403);
    if (error.code === '22023') fail('Dados do atendimento inválidos.', 400);
    throw error;
  }
  return visibleSpecialistOrder(Array.isArray(data) ? data[0] : data, user.id, 'paid');
}
