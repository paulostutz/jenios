// Query targets stay in this browser session, never in public URLs or order listings.
const key = userId => 'jenios-pay-receipts-v1:' + userId;
export function saveReceipt(storage, userId, orderId, purchase) {
  try {
    const records = JSON.parse(storage.getItem(key(userId)) || '{}');
    records[orderId] = { productCode: purchase.productCode, target: purchase.target };
    storage.setItem(key(userId), JSON.stringify(Object.fromEntries(Object.entries(records).slice(-50))));
    return true;
  } catch { return false; }
}
export function readReceipt(storage, userId, orderId) {
  try { return JSON.parse(storage.getItem(key(userId)) || '{}')[orderId] || null; } catch { return null; }
}
