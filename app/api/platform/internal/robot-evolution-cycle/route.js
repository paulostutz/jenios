import {createR65Runtime} from '../../../../../lib/platform/research/robot-r65-runtime.mjs';
import {createR65SchedulerHandler} from '../../../../../lib/platform/research/robot-r65-http.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const POST=createR65SchedulerHandler({getRuntime:()=>createR65Runtime()});
