import { getJeniosPlatformAdmin } from '../../../../../lib/platform/admin-db.mjs';
import { createR64DatabaseStore } from '../../../../../lib/platform/research/robot-r64-database-store.mjs';
import { readR64SourceConfiguration } from '../../../../../lib/platform/research/robot-r64-access.mjs';
import { createR64AdminHandler } from '../../../../../lib/platform/research/robot-r64-http.mjs';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export const GET=createR64AdminHandler({getDb:getJeniosPlatformAdmin,
  getStore:db=>createR64DatabaseStore({db}),getScopeId:()=>readR64SourceConfiguration(process.env).scopeId});
