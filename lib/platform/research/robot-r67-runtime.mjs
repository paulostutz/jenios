/** R67 private-source QA storage only; no collector/worker is started here. */
import { getJeniosPlatformAdmin } from '../admin-db.mjs';
import { requireR67QaEnabled, readR67SourceConfiguration } from './robot-r67-access.mjs';
import { createR67DatabaseStore } from './robot-r67-database-store.mjs';

export function createR67Runtime(env = process.env) {
  requireR67QaEnabled(env);
  const source = readR67SourceConfiguration(env), db = getJeniosPlatformAdmin(env);
  const store = createR67DatabaseStore({ db, scopeId: source.scopeId, sourceId: source.sourceId });
  return Object.freeze({ source, db, store, scopeId: source.scopeId, sourceId: source.sourceId });
}
