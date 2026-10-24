/** Explicit invocation only; importing the runtime does not schedule work. */
import { createR71Runtime } from '../../../lib/platform/research/robot-r71-runtime.mjs';
if (process.argv.length !== 2) throw Error('R71_WORKER_NO_ARGUMENTS');
const result = await createR71Runtime(process.env).runTick();
console.log(JSON.stringify({ schema: 'JENIOS_R71_WORKER_RESULT_V1', ...result }));
