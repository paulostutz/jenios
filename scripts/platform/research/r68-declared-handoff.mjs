#!/usr/bin/env node
/** Offline only. Exit 2 always means hosted evidence is still required. */
import { inspectR68DeclaredHandoff } from '../../../lib/platform/research/robot-r68-declared-handoff.mjs';
try {
  const args = process.argv.slice(2);
  const flags = { '--storage': 'storageKind', '--worker': 'workerKind', '--wake': 'wakeStrategy' };
  const host = {}, seen = new Set();
  for (let index = 0; index < args.length; index++) {
    const flag = args[index];
    if (seen.has(flag)) throw new Error('R68_HANDOFF_ARGUMENTS_INVALID');
    seen.add(flag);
    if (flag === '--json') continue;
    if (!Object.hasOwn(flags, flag) || !args[index + 1] || args[index + 1].startsWith('--'))
      throw new Error('R68_HANDOFF_ARGUMENTS_INVALID');
    host[flags[flag]] = args[++index];
  }
  const report = inspectR68DeclaredHandoff({ env: process.env, host });
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  process.exitCode = report.configurationComplete ? 2 : 1;
} catch {
  process.stderr.write('R68_HANDOFF_INVALID\n');
  process.exitCode = 1;
}
