import { timingSafeEqual } from 'node:crypto';
import { purchaseQuote, purchaseFingerprint } from './purchase.mjs';

const fail = (message, status) => { throw Object.assign(new Error(message), { status }); };

export async function requirePaidPurchase({ db, user, orderId, productCode, target }) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId || '')) fail('Pedido inválido.', 400);
  const { data: order, error } = await db.from('jenios_pay_orders').select('*').eq('id', orderId).eq('user_id', user.id).maybeSingle();
  if (error) throw error;
  if (!order || order.user_id !== user.id) fail('Pedido não encontrado.', 404);
  if (order.status !== 'paid') fail('Este pedido não possui pagamento confirmado.', 403);
  if (order.currency !== 'BRL' || !Number.isSafeInteger(Number(order.amount_cents)) || Number(order.amount_cents) <= 0) fail('Dados do pedido inconsistentes.', 409);
  let reference;
  try { reference = JSON.parse(order.external_reference); } catch { fail('Pedido sem vínculo verificável com o serviço.', 409); }
  if (!reference || reference.productCode !== productCode || !/^[a-f0-9]{64}$/.test(reference.fingerprint || '')) fail('Pedido sem vínculo verificável com o serviço.', 409);
  // Platform access depends on an active subscription, not just an individual order.
  if (reference.scope !== 'social') fail('Consulte sua assinatura no checkout da Platform.', 409);
  const { data: product, error: productError } = await db.from('jenios_pay_products').select('*').eq('id', order.product_id).maybeSingle();
  if (productError) throw productError;
  if (!product || product.code !== productCode) fail('Produto incompatível com o pedido.', 409);
  let quote;
  try {
    // A later price change or catalog deactivation must not revoke a paid purchase.
    quote = purchaseQuote({ productCode, target }, { ...product, active: true, price_cents: Number(order.amount_cents) }, 'social');
  } catch { fail('Dados do serviço inválidos.', 400); }
  if (quote.amount_cents !== Number(order.amount_cents) || !timingSafeEqual(Buffer.from(reference.fingerprint, 'hex'), Buffer.from(purchaseFingerprint(quote), 'hex'))) fail('Este pedido pertence a outra consulta ou serviço.', 403);
  return { orderId: order.id, productCode, target: quote.target, status: 'paid', authorized: true };
}
