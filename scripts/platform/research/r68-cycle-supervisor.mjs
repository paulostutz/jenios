/** Explicit foreground entry only. This script installs no hosted service. */
import { createR65Runtime } from '../../../lib/platform/research/robot-r65-runtime.mjs';
import { requireR68WorkerEnabled, runR68R65Worker } from '../../../lib/platform/research/robot-r68-cycle-supervisor.mjs';

const args = process.argv.slice(2), controller = new AbortController();
const stop = () => controller.abort();
try {
  if (args.length !== 1 || !['--once', '--watch'].includes(args[0])) throw Error('INVALID_ARGUMENTS');
  requireR68WorkerEnabled(process.env);
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
  const runtime = createR65Runtime();
  const result = await runR68R65Worker({ runtime, env: process.env, signal: controller.signal,
    mode: args[0].slice(2), emitEvent: event => { process.stdout.write(JSON.stringify(event) + '\n'); } });
  if (result.status === 'FAILED') process.exitCode = 1;
} catch (error) {
  process.stderr.write(error?.code === 'R68_WORKER_DISABLED' ? 'R68_WORKER_DISABLED\n' : 'R68_WORKER_UNAVAILABLE\n');
  process.exitCode = 1;
} finally {
  process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop);
}
