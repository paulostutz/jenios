import { isPrelaunchReport } from './prelaunch.mjs';
import { DEFAULT_PRODUCTS, normalizePurchase } from '../pay/catalog.mjs';
import { normalizeCryptoRequest } from '../crypto-validator.mjs';

// Call only after the route verifies the bearer token with requirePayUser/getUser.
// This policy never creates an order and never marks a payment as paid.
export async function requirePrelaunchReportAccess({ db, user, productCode, target }) {
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
  // A valid Supabase identity alone does not establish a JENIOS Social registration.
  // The user must have an existing database profile; client metadata is not proof.
  if (!db || typeof db.from !== 'function') throw Object.assign(new Error('Verificação da Social indisponível.'), { status: 503 });
  let profile;
  try {
    const { data, error } = await db.from('profiles').select('id').eq('id', user.id).maybeSingle();
    if (error) throw error;
    profile = data;
  } catch {
    throw Object.assign(new Error('Não foi possível confirmar o cadastro na JENIOS Social.'), { status: 503 });
  }
  if (profile?.id !== user.id) throw Object.assign(new Error('Cadastre-se na JENIOS Social para acessar o relatório completo.'), { status: 403 });
  return { authorized: true, status: 'prelaunch', orderId: null, productCode, target: normalized };
}
