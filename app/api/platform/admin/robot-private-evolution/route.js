import { getJeniosPlatformAdmin } from '../../../../../lib/platform/admin-db.mjs';
import { createR71Runtime } from '../../../../../lib/platform/research/robot-r71-runtime.mjs';
import { createR71AdminHandler } from '../../../../../lib/platform/research/robot-r71-http.mjs';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const handler = createR71AdminHandler({ getDb: () => getJeniosPlatformAdmin(), getRuntime: () => createR71Runtime() });
export const GET = handler;
export const POST = handler;
