/** Pure declaration check. No runtime factory, network or database is loaded. */
import { inspectR66OperationalReadiness } from '../../../lib/platform/research/robot-r66-operational-readiness.mjs';

const args = process.argv.slice(2);
const host = {};
const flags = { '--storage': 'storageKind', '--worker': 'workerKind', '--wake': 'wakeStrategy' };
try {
  for (let index = 0; index < args.length; index++) {
    const flag = args[index];
    if (flag === '--json') continue;
    if (!Object.hasOwn(flags, flag)) throw Error('R66_PREFLIGHT_ARGUMENTS_INVALID');
    const field = flags[flag];
    if (Object.hasOwn(host, field) || index + 1 >= args.length) throw Error('R66_PREFLIGHT_ARGUMENTS_INVALID');
    host[field] = args[++index];
  }
  const report = inspectR66OperationalReadiness({ env: process.env, host });
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  // A complete declaration remains an incomplete operational certification.
  process.exitCode = 2;
} catch {
  process.stderr.write('R66_PREFLIGHT_INVALID_INPUT\n');
  process.exitCode = 1;
}
