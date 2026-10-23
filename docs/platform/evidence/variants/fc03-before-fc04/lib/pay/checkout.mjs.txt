import {buyerKey,ownsOrder,GUEST_PRODUCTS} from './buyer.mjs';
import { purchaseQuote, purchaseFingerprint } from './purchase.mjs';
import { createGatewayCheckout, gatewayConfig } from './gateway.mjs';
import {interPixConfigured} from './inter-pix.mjs';
import {loadJeniosInterServerEnv} from './inter-vault.mjs';
import { publicSpecialist, validateSpecialist } from '../social/specialists.mjs';
import { prepareSpecialistOrder, specialistOrdersEnabled } from '../social/specialist-orders.mjs';
import { boostEnabled, validateBoostTarget, prepareBoostCampaign } from '../social/boost.mjs';
import { assertBoostSigningConfig } from '../social/boost-proof.mjs';
import { assertBankscoreDetailedReady } from '../bankscore/coverage.mjs';

export async function checkoutService({ body, user, db, scope, key, gateway = createGatewayCheckout, configured = gatewayConfig, retried = false, serviceOrdersEnabled = specialistOrdersEnabled(), campaignsEnabled = boostEnabled(), campaignsConfigured = assertBoostSigningConfig, bankscoreReady = assertBankscoreDetailedReady }) {
  if (!/^[a-zA-Z0-9-]{16,100}$/.test(key || '')) throw Object.assign(new Error('Identificador de pedido inválido.'), { status: 400 });
  if (!buyerKey(user)) throw Object.assign(Error('Comprador inválido.'),{status:401});
  if (!user.id && (scope!=='social'||!GUEST_PRODUCTS.has(body?.productCode))) throw Object.assign(Error('Este serviço exige conta.'),{status:403});
  let gatewayEnv=process.env;
  if(gatewayEnv.JENIOS_PAY_PROVIDER==='inter_pix'&&!interPixConfigured(gatewayEnv)&&
   gatewayEnv.JENIOS_INTER_CHARGES_ENABLED==='true'&&db)
   gatewayEnv=await loadJeniosInterServerEnv(db,gatewayEnv);
  const paymentConfig=configured(gatewayEnv);
  if (!paymentConfig) throw Object.assign(new Error('Pagamento temporariamente indisponível. Tente novamente mais tarde.'), { status: 503 });
  if(paymentConfig.provider==='inter_pix'&&scope!=='social')throw Object.assign(Error('Assinaturas ainda não estão disponíveis neste meio de pagamento.'),{status:503});
  const { data: product, error } = await db.from('jenios_pay_products').select('*').eq('code', body.productCode).maybeSingle();
  if (error) throw error;
  const idempotencyKey = buyerKey(user) + ':' + key;
  const { data: previous, error: previousError } = await db.from('jenios_pay_orders').select('*').eq('idempotency_key', idempotencyKey).maybeSingle();
  if (previousError) throw previousError;
  if (previous && !ownsOrder(previous,user)) throw Object.assign(Error('Pedido não encontrado.'),{status:404});
  // Existing orders retain their original price even when the admin changes the catalog.
  let pricedProduct = previous && previous.product_id === product?.id ? { ...product, price_cents: previous.amount_cents } : product;
  let specialistOffer, specialistName;
  if(product?.code==='social-specialist-offer'){
    const specialistId=body?.target?.specialistId;
    if(!/^[0-9a-f-]{36}$/i.test(specialistId||''))throw Object.assign(new Error('Especialista inválido.'),{status:400});
    if(specialistId===user.id)throw Object.assign(new Error('Você não pode contratar sua própria oferta.'),{status:400});
    const {data:profile,error:profileError}=await db.from('jenios_specialist_profiles').select('*').eq('user_id',specialistId).maybeSingle();
    if(profileError)throw profileError;
    const seller=profile&&publicSpecialist(profile);const offer=seller?.offers?.find(o=>o.id===body.target.offerId);
    if(!offer)throw Object.assign(new Error('Esta oferta não está disponível.'),{status:404});
    validateSpecialist({...seller,offers:[offer]});
    specialistOffer = offer; specialistName = seller.nome;
    pricedProduct={...product,price_cents:previous&&previous.product_id===product.id?previous.amount_cents:offer.price_cents};
  }
  const quote = purchaseQuote(body, pricedProduct, scope);
  if(paymentConfig.provider==='inter_pix'&&((quote.productCode==='social-specialist-offer'&&!serviceOrdersEnabled)||(quote.productCode==='social-boost'&&!campaignsEnabled)))throw Object.assign(Error('Este serviço ainda não está disponível para contratação.'),{status:503});
  if (quote.productCode === 'social-bankscore-report' && previous?.status !== 'paid') await bankscoreReady({db,target:quote.target});
  if (quote.productCode === 'social-crypto-validator' && quote.target.network === 'litecoin') throw Object.assign(new Error('A consulta detalhada de Litecoin ainda não está disponível para contratação.'), { status: 400 });
  if (quote.productCode === 'social-boost') {
    if (campaignsEnabled) { campaignsConfigured(); validateBoostTarget(quote.target); }
    const { data: post, error: postError } = await db.from('posts').select('id,author_id,archived_at').eq('id', quote.target.postId).maybeSingle();
    if (postError) throw postError;
    if (!post || post.archived_at || post.author_id !== user.id) throw Object.assign(new Error('Você só pode impulsionar publicações próprias.'), { status: 403 });
  }
  const fingerprint = purchaseFingerprint(quote);
  let order = previous;
  if (previous) {
    const stored = JSON.parse(previous.external_reference || '{}');
    if (stored.fingerprint !== fingerprint) throw Object.assign(new Error('Este pedido já foi usado com outros dados. Inicie uma nova contratação.'), { status: 409 });
    if (['cancelled', 'expired', 'refunded'].includes(previous.status)) throw Object.assign(new Error('Pedido encerrado. Inicie uma nova contratação.'), { status: 409 });
    if (previous.status === 'paid') return { orderId: previous.id, status: 'paid', checkoutUrl: null };
  } else {
    const { data: created, error: insertError } = await db.from('jenios_pay_orders').insert({ user_id: user.id, ...(!user.id ? {guest_buyer_hash:user.guestHash} : {}), product_id: product.id, amount_cents: quote.amount_cents, currency: 'BRL', status: 'pending', provider: 'jenios_pay', idempotency_key: idempotencyKey, external_reference: JSON.stringify({ fingerprint, productCode: quote.productCode, scope, checkoutKey: idempotencyKey }) }).select('*').single();
    if (insertError?.code === '23505' && !retried) return checkoutService({ body, user, db, scope, key, gateway, configured, retried: true, serviceOrdersEnabled, campaignsEnabled, campaignsConfigured, bankscoreReady });
    if (insertError) throw insertError;
    order = created;
  }
  if (quote.productCode === 'social-specialist-offer' && serviceOrdersEnabled) {
    try { await prepareSpecialistOrder({ db, order, quote, offer: specialistOffer, sellerName: specialistName }); }
    catch (error) { if (error.status) throw error; throw Object.assign(new Error('Não foi possível preparar o atendimento. O pedido foi preservado para tentar novamente, sem abrir novo checkout.'), { status: 503 }); }
  }
  if (quote.productCode === 'social-boost' && campaignsEnabled) {
    try { await prepareBoostCampaign({ db, order, quote }); }
    catch (error) { if (error.status) throw error; throw Object.assign(new Error('Não foi possível preparar a campanha. O pedido foi preservado para tentar novamente, sem abrir novo checkout.'), { status: 503 }); }
  }
  const result = await gateway({ orderId: order.id, userId: user.id, ...(!user.id ? {guest:true} : {}), ...quote },{db,env:gatewayEnv});
  const { error: updateError } = await db.from('jenios_pay_orders').update({ status: 'awaiting_payment', ...(paymentConfig.provider==='inter_pix'?{provider:'inter_pix'}:{}), updated_at: new Date().toISOString() }).eq('id', order.id).eq('status', 'pending');
  if (updateError) throw updateError;
  return { orderId: order.id, status: 'awaiting_payment', ...result };
}
