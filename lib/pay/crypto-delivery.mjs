import { requirePaidPurchase } from './access.mjs';
import { validateCrypto } from '../crypto-validator.mjs';
import { detailedCryptoReport } from '../crypto/detailed.mjs';

export async function deliverCryptoReport({ db, user, orderId, target, validate = validateCrypto }) {
  const access = await requirePaidPurchase({ db, user, orderId, productCode: 'social-crypto-validator', target });
  // Never query a provider, generate a paid PDF or accept client-supplied evidence before authorization.
  const report = await validate(access.target);
  if (report.network !== access.target.network || report.type !== access.target.type || report.identifier !== access.target.identifier) throw Object.assign(new Error('A fonte retornou dados incompatíveis com a consulta.'), { status: 502 });
  return detailedCryptoReport(report, access.orderId);
}
