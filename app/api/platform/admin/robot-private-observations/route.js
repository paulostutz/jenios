import { getJeniosPlatformAdmin } from '../../../../../lib/platform/admin-db.mjs';
import { createR67Runtime } from '../../../../../lib/platform/research/robot-r67-runtime.mjs';
import { createR67AdminHandler } from '../../../../../lib/platform/research/robot-r67-http.mjs';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const GET = createR67AdminHandler({ getDb: () => getJeniosPlatformAdmin(), getRuntime: () => createR67Runtime() });
