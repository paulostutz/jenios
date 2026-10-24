import { createR64SchedulerHandler } from '../../../../../lib/platform/research/robot-r64-http.mjs';
import { createR64Runtime } from '../../../../../lib/platform/research/robot-r64-runtime.mjs';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export const POST=createR64SchedulerHandler({runCycle:()=>createR64Runtime().runCycle()});
