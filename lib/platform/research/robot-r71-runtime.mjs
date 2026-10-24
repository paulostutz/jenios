/** Server composition only; construction does not initialize a study or start a worker. */
import { getJeniosPlatformAdmin } from '../admin-db.mjs';
import { requireR71QaEnabled, readR71SourceConfiguration } from './robot-r71-access.mjs';
import { r67SourceKeyDigest } from './robot-r67-private-protocol.mjs';
import { createR71DatabaseStore } from './robot-r71-database-store.mjs';
import { inspectR71EvolutionState, projectR71RuntimeView } from './robot-r71-evolution-engine.mjs';
import { runR71EvolutionTick, rollbackR71Durable } from './robot-r71-cycle-worker.mjs';
import { projectR71AdminFeed } from './robot-r71-admin-view.mjs';

export function createR71Runtime(env = process.env) {
  requireR71QaEnabled(env);
  const source = readR71SourceConfiguration(env), db = getJeniosPlatformAdmin(env);
  const { scopeId, sourceId } = source, sourceKeySha256 = r67SourceKeyDigest(source);
  const store = createR71DatabaseStore({ db, scopeId, sourceId, sourceKeySha256 });
  const readRuntimeView = async () => {
    requireR71QaEnabled(env);
    const row = await store.readState();
    requireR71QaEnabled(env);
    if (!row) throw Object.assign(Error('R71_STATE_NOT_INITIALIZED'), { code: 'R71_STATE_NOT_INITIALIZED' });
    // A source read cannot initialize state. Only the explicit worker/admin
    // operation creates the initial durable revision.
    return projectR71RuntimeView(row);
  };
  const readFeed = async () => {
    requireR71QaEnabled(env);
    const overview = await store.readOverview({ limit: 30 });
    requireR71QaEnabled(env);
    if (overview.state) inspectR71EvolutionState(overview.state.state);
    const pending = overview.state?.state.pendingEvaluation;
    const validationCases = pending ? await store.readValidationCases({ planId: pending.planId }) : [];
    requireR71QaEnabled(env);
    return projectR71AdminFeed({ scopeId, sourceId, sourceKeySha256, overview, validationCases, generatedAtMs: Date.now() });
  };
  return Object.freeze({ db, source, scopeId, sourceId, sourceKeySha256, store, readFeed, readRuntimeView,
    runTick: () => runR71EvolutionTick({ store, trustedSource: source, env }),
    rollback: args => rollbackR71Durable({ ...args, store, env }),
  });
}
