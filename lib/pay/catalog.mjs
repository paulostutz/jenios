import { boostDestination } from '../social/boost.mjs';
export const DEFAULT_PRODUCTS = Object.freeze([
  { code: 'social-bankscore-report', name: 'BankScore — consulta detalhada', category: 'bankscore', price_cents: 990, billing_type: 'one_time', description: 'Laudo detalhado BankScore em PDF.' },
  { code: 'social-crypto-validator', name: 'Validador de Criptos — consulta detalhada', category: 'crypto_validator', price_cents: 990, billing_type: 'one_time', description: 'Consulta detalhada e relatório em PDF.' },
  { code: 'social-boost', name: 'Impulsionamento', category: 'ads', price_cents: 0, billing_type: 'one_time', description: 'Orçamento definido pelo cliente; zero no catálogo não significa serviço gratuito.' },
  { code: 'platform-nacional', name: 'Nacional — B3', category: 'platform', price_cents: 9990, billing_type: 'monthly', description: 'Assinatura mensal JENIOS Platform.' },
  { code: 'platform-global-crypto', name: 'Global Crypto — B3 + Cripto', category: 'platform', price_cents: 14990, billing_type: 'monthly', description: 'Assinatura mensal JENIOS Platform.' },
  { code: 'platform-internacional-pro', name: 'Internacional Pro', category: 'platform', price_cents: 19990, billing_type: 'monthly', description: 'Assinatura mensal JENIOS Platform.' },
  { code: 'social-specialist-offer', name: 'Serviço de Especialista', category: 'other', price_cents: 0, billing_type: 'one_time', description: 'Preço definido na oferta do especialista. Comissão JENIOS de 10%.' },
].map(product => Object.freeze({ ...product, currency: 'BRL', active: true })));

export const SPECIALIST_COMMISSION_BPS = 1000;
export const productScope = product => product.category === 'platform' ? 'platform' : 'social';
export function mergeCatalog(rows = []) {
  return DEFAULT_PRODUCTS.map(base => ({ ...base, ...(rows.find(row => row.code === base.code) || {}), variable_amount: ['social-boost','social-specialist-offer'].includes(base.code) }));
}
export function priceUpdate(body) {
  const base = DEFAULT_PRODUCTS.find(product => product.code === body?.code);
  if (!base) throw new Error('Produto desconhecido.');
  if (typeof body.active !== 'boolean') throw new Error('Estado de ativação inválido.');
  if (!Number.isSafeInteger(body.price_cents) || body.price_cents < 1 || body.price_cents > 100000000) {
    if (!(['social-boost','social-specialist-offer'].includes(base.code) && body.price_cents === 0)) throw new Error('Informe um preço válido em centavos.');
  }
  if (base.code === 'social-boost' && body.price_cents !== 0) throw new Error('O orçamento do impulsionamento é escolhido pelo cliente.');
  if (base.code === 'social-specialist-offer' && body.price_cents !== 0) throw new Error('O preço é definido na oferta do especialista.');
  return { ...base, price_cents: body.price_cents, active: body.active };
}
export function moneyToCents(value) {
  const input = String(value ?? '').trim().replace(',', '.');
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(input)) throw new Error('Valor monetário inválido.');
  const [whole, decimal = ''] = input.split('.');
  return Number(whole) * 100 + Number(decimal.padEnd(2, '0'));
}
export function normalizePurchase(body, product, scope) {
  if (!product?.active || productScope(product) !== scope) throw new Error('Produto indisponível neste checkout.');
  let target;
  let amount = product.price_cents;
  if (product.code === 'social-bankscore-report') {
    const codigo = String(body?.target?.codigo || '');
    const periodo = String(body?.target?.periodo || '');
    if (!/^(\d{1,12}|C\d{1,12})$/.test(codigo)) throw new Error('Escolha uma instituição válida.');
    if (periodo && !/^\d{4}(0[1-9]|1[0-2])$/.test(periodo)) throw new Error('Período inválido.');
    target = { codigo, periodo };
  } else if (product.code === 'social-crypto-validator') {
    target = body.target;
    if (!target || typeof target.network !== 'string' || typeof target.type !== 'string' || typeof target.identifier !== 'string') throw new Error('Informe os dados da consulta.');
  } else if (product.code === 'social-specialist-offer') {
    const {specialistId,offerId}=body.target||{};
    if(!/^[0-9a-f-]{36}$/i.test(specialistId||'')||!/^[0-9a-f-]{36}$/i.test(offerId||''))throw new Error('Selecione uma oferta válida.');
    target={specialistId,offerId};
  } else if (product.code === 'social-boost') {
    const { postId, dailyBudget, days, objective, country, region, city } = body.target || {};
    if (!/^[0-9a-f-]{36}$/i.test(String(postId || ''))) throw new Error('Selecione uma publicação real.');
    const dailyCents = moneyToCents(dailyBudget);
    if (dailyCents < 1000 || dailyCents > 1000000) throw new Error('Orçamento diário deve estar entre R$ 10 e R$ 10.000.');
    if (!Number.isInteger(days) || days < 1 || days > 365) throw new Error('Duração deve estar entre 1 e 365 dias.');
    if (!['profile', 'website', 'whatsapp', 'copy'].includes(objective)) throw new Error('Objetivo inválido.');
    target = { postId, dailyCents, days, objective, country: String(country || 'Brasil').slice(0, 80), region: String(region || '').slice(0, 80), city: String(city || '').slice(0, 80) };
    if (body.target.destination) target.destination = boostDestination(body.target.destination, objective);
    amount = dailyCents * days;
  } else {
    target = {};
  }
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 100000000) throw new Error('Valor da cobrança inválido.');
  return { productCode: product.code, amount_cents: amount, currency: 'BRL', billing_type: product.billing_type, scope, target };
}
