import { isPrelaunchReport } from './prelaunch.mjs';
import { DEFAULT_PRODUCTS, normalizePurchase } from '../pay/catalog.mjs';
import { normalizeCryptoRequest } from '../crypto-validator.mjs';

// Call only after the route verifies the bearer token with requirePayUser/getUser.
// This policy never creates an order and never marks a payment as paid.
export async function requirePrelaunchReportAccess({ user, productCode, target }) {
  if (!isPrelaunchReport(productCode)) throw Object.assign(new Error('Serviço fora do pré-lançamento gratuito.'), { status: 403 });
  if (!user?.id || user.is_anonymous) throw Object.assign(new Error('Crie sua conta na Social e entre para acessar o relatório completo.'), { status: 401 });
  let normalized;
  try {
    const product = DEFAULT_PRODUCTS.find(item => item.code === productCode);
    normalized = normalizePurchase({ target }, product, 'social').target;
    if (productCode === 'social-crypto-validator') normalized = normalizeCryptoRequest(normalized);
  } catch (error) {
    throw Object.assign(new Error(error.message || 'Dados da consulta inválidos.'), { status: 400 });
  }
  return { authorized: true, status: 'prelaunch', orderId: null, productCode, target: normalized };
}
