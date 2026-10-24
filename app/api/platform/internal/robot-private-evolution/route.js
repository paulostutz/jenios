import { createR71Runtime } from '../../../../../lib/platform/research/robot-r71-runtime.mjs';
import { createR71SchedulerHandler } from '../../../../../lib/platform/research/robot-r71-http.mjs';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const POST = createR71SchedulerHandler({ getRuntime: () => createR71Runtime() });
