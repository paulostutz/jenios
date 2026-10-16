import { createHmac, timingSafeEqual } from 'node:crypto';
import { boostUuid } from './boost.mjs';
function secret(env) {
  const value = env.JENIOS_BOOST_SIGNING_SECRET || '';
  if (Buffer.byteLength(value) < 32) throw Object.assign(new Error('Configure uma chave própria de pelo menos 32 bytes para os comprovantes de exibição.'), { status: 503 });
  return value;
}
export function assertBoostSigningConfig(env = process.env) { secret(env); }
export function signBoostDelivery(campaign, viewerId, { env = process.env, now = Date.now() } = {}) {
  const payload = Buffer.from(JSON.stringify({ v: 1, orderId: campaign.order_id, viewerId, revision: campaign.revision, expiresAt: now + 600000 })).toString('base64url');
  return payload + '.' + createHmac('sha256', secret(env)).update(payload).digest('base64url');
}
export function verifyBoostDelivery(token, viewerId, { env = process.env, now = Date.now() } = {}) {
  const key = secret(env);
  const invalid = () => { throw Object.assign(new Error('Comprovante de exibição inválido ou expirado.'), { status: 403 }); };
  if (typeof token !== 'string' || token.length > 2048 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(token)) invalid();
  const [payload, signature] = token.split('.');
  const expected = createHmac('sha256', key).update(payload).digest();
  const received = Buffer.from(signature, 'base64url');
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) invalid();
  let data;
  try { data = JSON.parse(Buffer.from(payload, 'base64url').toString()); } catch { invalid(); }
  if (!data || data.v !== 1 || data.viewerId !== viewerId || !boostUuid(data.orderId) || !Number.isSafeInteger(data.revision) || data.revision < 0 || !Number.isSafeInteger(data.expiresAt) || data.expiresAt <= now || data.expiresAt > now + 600000) invalid();
  return data;
}
