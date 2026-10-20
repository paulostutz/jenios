import { createHash } from 'node:crypto';
import { normalizePurchase } from './catalog.mjs';
import { normalizeCryptoRequest } from '../crypto-validator.mjs';
import { boostDemographicTarget } from '../social/boost-audience.mjs';

// The same canonical quote binds checkout and later delivery to one resource.
export function purchaseQuote(body, product, scope) {
  const quote = normalizePurchase(body, product, scope);
  if (quote.productCode === 'social-boost') Object.assign(quote.target, boostDemographicTarget(body?.target));
  if (quote.productCode === 'social-specialist-offer') {
    const commission = Math.round(quote.amount_cents * .1);
    Object.assign(quote, { seller_id: quote.target.specialistId, commission_bps: 1000, commission_cents: commission, seller_amount_cents: quote.amount_cents - commission });
  }
  if (quote.productCode === 'social-crypto-validator') quote.target = normalizeCryptoRequest(quote.target);
  return quote;
}

export const purchaseFingerprint = quote => createHash('sha256').update(JSON.stringify(quote)).digest('hex');
