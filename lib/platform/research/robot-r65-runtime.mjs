/** Additive host integration over the dedicated Platform database and R64 worker. */
import { createR64Runtime } from './robot-r64-runtime.mjs';
import { createR65DatabaseStore } from './robot-r65-database-store.mjs';
import { requireR65CycleEnabled } from './robot-r65-cycle-access.mjs';
import { runR65EvolutionTick,rollbackR65Durable } from './robot-r65-cycle-worker.mjs';
import { projectR65AdminFeed } from './robot-r65-admin-view.mjs';

export function createR65Runtime(env=process.env){
  requireR65CycleEnabled(env);
  const prior=createR64Runtime(env),lifecycleStore=createR65DatabaseStore({db:prior.db});
  const scopeId=prior.source.scopeId;
  const runTick=()=>runR65EvolutionTick({observationStore:prior.store,lifecycleStore,scopeId,env,
    completeObservationCycle:prior.runCycle});
  const readFeed=async()=>{
    const [overview,evolution]=await Promise.all([lifecycleStore.readOverview({scopeId,limit:30}),lifecycleStore.readEvolution({scopeId})]);
    const plan=evolution?.state?.pendingEvaluation?.plan;
    const validationCases=plan?await lifecycleStore.readValidationCases({scopeId,planId:plan.planId}):[];
    return projectR65AdminFeed({scopeId,overview,evolution,validationCases,generatedAtMs:Date.now()});
  };
  return {db:prior.db,scopeId,lifecycleStore,runTick,readFeed,
    rollback:args=>rollbackR65Durable({...args,lifecycleStore,scopeId,env})};
}
