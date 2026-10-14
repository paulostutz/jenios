import { createHash } from 'node:crypto';
import { normalizePurchase } from './catalog.mjs';
import { normalizeCryptoRequest } from '../crypto-validator.mjs';
import { createGatewayCheckout, gatewayConfig } from './gateway.mjs';
import { publicSpecialist, validateSpecialist } from '../social/specialists.mjs';

export async function checkoutService({ body, user, db, scope, key, gateway = createGatewayCheckout, configured = gatewayConfig, retried = false }) {
  if (!/^[a-zA-Z0-9-]{16,100}$/.test(key || '')) throw Object.assign(new Error('Identificador de pedido inválido.'), { status: 400 });
  if (!configured()) throw Object.assign(new Error('Configure a conexão da JENIOS PAY no servidor para gerar cobranças.'), { status: 503 });
  const { data: product, error } = await db.from('jenios_pay_products').select('*').eq('code', body.productCode).maybeSingle();
  if (error) throw error;
  const idempotencyKey = user.id + ':' + key;
  const { data: previous, error: previousError } = await db.from('jenios_pay_orders').select('*').eq('idempotency_key', idempotencyKey).maybeSingle();
  if (previousError) throw previousError;
  // Existing orders retain their original price even when the admin changes the catalog.
  let pricedProduct = previous && previous.product_id === product?.id ? { ...product, price_cents: previous.amount_cents } : product;
  if(product?.code==='social-specialist-offer'){
    const specialistId=body?.target?.specialistId;
    if(!/^[0-9a-f-]{36}$/i.test(specialistId||''))throw Object.assign(new Error('Especialista inválido.'),{status:400});
    if(specialistId===user.id)throw Object.assign(new Error('Você não pode contratar sua própria oferta.'),{status:400});
    const {data:profile,error:profileError}=await db.from('jenios_specialist_profiles').select('*').eq('user_id',specialistId).maybeSingle();
    if(profileError)throw profileError;
    const seller=profile&&publicSpecialist(profile);const offer=seller?.offers?.find(o=>o.id===body.target.offerId);
    if(!offer)throw Object.assign(new Error('Esta oferta não está disponível.'),{status:404});
    validateSpecialist({...seller,offers:[offer]});
    pricedProduct={...product,price_cents:previous&&previous.product_id===product.id?previous.amount_cents:offer.price_cents};
  }
  const quote = normalizePurchase(body, pricedProduct, scope);
  if(quote.productCode==='social-specialist-offer')Object.assign(quote,{seller_id:quote.target.specialistId,commission_bps:1000,commission_cents:Math.round(quote.amount_cents*.1),seller_amount_cents:quote.amount_cents-Math.round(quote.amount_cents*.1)});
  if (quote.productCode === 'social-crypto-validator') quote.target = normalizeCryptoRequest(quote.target);
  if (quote.productCode === 'social-boost') {
    const { data: post, error: postError } = await db.from('posts').select('id,author_id').eq('id', quote.target.postId).maybeSingle();
    if (postError) throw postError;
    if (!post || post.author_id !== user.id) throw Object.assign(new Error('Você só pode impulsionar publicações próprias.'), { status: 403 });
  }
  const fingerprint = createHash('sha256').update(JSON.stringify(quote)).digest('hex');
  let order = previous;
  if (previous) {
    const stored = JSON.parse(previous.external_reference || '{}');
    if (stored.fingerprint !== fingerprint) throw Object.assign(new Error('Este pedido já foi usado com outros dados. Inicie uma nova contratação.'), { status: 409 });
    if (['cancelled', 'expired', 'refunded'].includes(previous.status)) throw Object.assign(new Error('Pedido encerrado. Inicie uma nova contratação.'), { status: 409 });
    if (previous.status === 'paid') return { orderId: previous.id, status: 'paid', checkoutUrl: null };
  } else {
    const { data: created, error: insertError } = await db.from('jenios_pay_orders').insert({ user_id: user.id, product_id: product.id, amount_cents: quote.amount_cents, currency: 'BRL', status: 'pending', provider: 'jenios_pay', idempotency_key: idempotencyKey, external_reference: JSON.stringify({ fingerprint, productCode: quote.productCode, scope, checkoutKey: idempotencyKey }) }).select('*').single();
    if (insertError?.code === '23505' && !retried) return checkoutService({ body, user, db, scope, key, gateway, configured, retried: true });
    if (insertError) throw insertError;
    order = created;
  }
  const result = await gateway({ orderId: order.id, userId: user.id, ...quote });
  const { error: updateError } = await db.from('jenios_pay_orders').update({ status: 'awaiting_payment', updated_at: new Date().toISOString() }).eq('id', order.id).eq('status', 'pending');
  if (updateError) throw updateError;
  return { orderId: order.id, status: 'awaiting_payment', ...result };
}
