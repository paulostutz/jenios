import { requirePaidPurchase } from './access.mjs';
import { validateCrypto } from '../crypto-validator.mjs';
import { detailedCryptoReport } from '../crypto/detailed.mjs';
import { walletInventory } from '../crypto/wallet-inventory.mjs';

export async function deliverCryptoReport({ db, user, orderId, target, validate = validateCrypto, inventory = walletInventory }) {
  const access = await requirePaidPurchase({ db, user, orderId, productCode: 'social-crypto-validator', target });
  // Never query a provider, generate a paid PDF or accept client-supplied evidence before authorization.
  const report = await validate(access.target);
  if (report.network !== access.target.network || report.type !== access.target.type || report.identifier !== access.target.identifier) throw Object.assign(new Error('A fonte retornou dados incompatíveis com a consulta.'), { status: 502 });
  if (report.providerError || report.supported === false) return detailedCryptoReport(report, access.orderId);
  const wallet = access.target.type === 'wallet' ? await inventory(access.target) : null;
  return detailedCryptoReport({ ...report, ...(wallet ? { inventory: wallet } : {}) }, access.orderId);
}
