/** Uses the existing dedicated Platform client; never falls back to Social. */
import { getJeniosPlatformAdmin } from '../admin-db.mjs';
import { createR64DatabaseStore } from './robot-r64-database-store.mjs';
import { readR64SourceConfiguration,requireR64QaEnabled } from './robot-r64-access.mjs';
import { runR64OperationalCycle } from './robot-r64-operational-worker.mjs';

export function createR64Runtime(env=process.env){
  requireR64QaEnabled(env);
  const source=readR64SourceConfiguration(env);
  const db=getJeniosPlatformAdmin(env),store=createR64DatabaseStore({db});
  return {source,db,store,runCycle:()=>runR64OperationalCycle({store,scopeId:source.scopeId,env})};
}
