import { DEFAULT_PRODUCTS } from './catalog.mjs';

export function publicOrder(order) {
  let reference;
  try { reference = JSON.parse(order.external_reference || '{}'); } catch { reference = {}; }
  const product = DEFAULT_PRODUCTS.find(item => item.code === reference?.productCode);
  return { id: order.id, ...(order.provider==='inter_pix'?{paymentMethod:'pix'}:{}), product_id: order.product_id, productCode: product?.code || null, productName: product?.name || 'Cobrança JENIOS PAY', amount_cents: order.amount_cents, currency: order.currency, status: order.status, created_at: order.created_at };
}
