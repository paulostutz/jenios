/** Scoped R67-only RPC adapter. No R64/R65 study or policy table is touched.
 * The application verifier owns signature authentication. This adapter verifies
 * historical structure/digests and pins scope/source; service_role bypasses RLS.
 */
import { canonicalR67Json, inspectR67StoredObservation, freezeR67, R67_LIMITS } from './robot-r67-private-protocol.mjs';

export const R67_DATABASE_RPCS = Object.freeze({
  ingest: 'jenios_robot_r67_ingest_private_capture', read: 'jenios_robot_r67_read_private_captures',
});
export const R67_DATABASE_LIMITS = Object.freeze({ recordBytes: R67_LIMITS.maxBytes, readLimit: 30 });
const fail = code => { throw Object.assign(new Error(code), { code }); };
const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).length === keys.length && Object.keys(value).every(key => keys.includes(key));
const snapshot = (value, maxBytes = R67_LIMITS.maxBytes + 8192) => {
  const encoded = canonicalR67Json(value);
  if (Buffer.byteLength(encoded) > maxBytes) fail('R67_DATABASE_INPUT_LIMIT');
  return JSON.parse(encoded);
};

export function createR67DatabaseStore({ db, scopeId, sourceId } = {}) {
  if (!db || typeof db.rpc !== 'function') fail('R67_DATABASE_CLIENT_REQUIRED');
  if (!/^scope:[a-f0-9]{16}$/.test(scopeId || '') || !/^source:[a-f0-9]{16}$/.test(sourceId || ''))
    fail('R67_DATABASE_SCOPE_REQUIRED');
  function checkedObservation(value) {
    const checked = inspectR67StoredObservation(value);
    if (checked.receipt.scopeId !== scopeId || checked.receipt.sourceId !== sourceId) fail('R67_DATABASE_SCOPE');
    return checked;
  }
  async function rpc(method, input) {
    let response;
    try { response = await db.rpc(R67_DATABASE_RPCS[method], { p_input: snapshot(input) }); }
    catch { fail('R67_DATABASE_UNAVAILABLE'); }
    if (response?.error) {
      const code = typeof response.error.message === 'string' && response.error.message.match(/^(R67_DATABASE_[A-Z0-9_]{1,64})$/)?.[1];
      fail(code || 'R67_DATABASE_UNAVAILABLE');
    }
    if (!response || !Object.hasOwn(response, 'data') || response.data === null) fail('R67_DATABASE_RESPONSE');
    return response.data;
  }
  return Object.freeze({
    async ingest(input) {
      const safe = checkedObservation(snapshot(input));
      const raw = await rpc('ingest', { scopeId, sourceId, ...safe });
      const data = snapshot(raw);
      if (!exact(data, ['status', 'receipt', 'record']) || !['STORED', 'ALREADY_STORED'].includes(data.status))
        fail('R67_DATABASE_RESPONSE');
      const saved = checkedObservation({ receipt: data.receipt, record: data.record });
      const withoutTime = receipt => { const { admittedAtMs, ...rest } = receipt; return rest; };
      if (canonicalR67Json(saved.record) !== canonicalR67Json(safe.record) ||
          canonicalR67Json(withoutTime(saved.receipt)) !== canonicalR67Json(withoutTime(safe.receipt)))
        fail('R67_DATABASE_RESPONSE_BINDING');
      // Concurrent verification times need not follow commit order. The first
      // committed receipt remains authoritative on an identical retry.
      return freezeR67({ status: data.status, ...saved });
    },
    async read(input = {}) {
      const safe = snapshot(input);
      if (!exact(safe, Object.hasOwn(safe, 'limit') ? ['limit'] : [])) fail('R67_DATABASE_READ_REQUEST');
      const limit = safe.limit ?? R67_DATABASE_LIMITS.readLimit;
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > R67_DATABASE_LIMITS.readLimit) fail('R67_DATABASE_READ_REQUEST');
      const rows = await rpc('read', { scopeId, sourceId, limit });
      if (!Array.isArray(rows) || rows.length > limit) fail('R67_DATABASE_RESPONSE');
      const checked = rows.map(row => checkedObservation(snapshot(row)));
      const seen = new Set();
      for (const row of checked) {
        if (seen.has(row.receipt.eventId)) fail('R67_DATABASE_RESPONSE_BINDING');
        seen.add(row.receipt.eventId);
      }
      return freezeR67(checked);
    },
  });
}
