#!/usr/bin/env node
/** Explicit local host invocation only; no daemon/service is installed. */
import { inspectR68PrivateHost, runR68PrivateHost } from '../../../lib/platform/research/robot-r68-private-host.mjs';

const write = value => process.stdout.write(JSON.stringify(value) + '\n');
try {
  const [mode, flag, configPath, ...extra] = process.argv.slice(2);
  if (!['--check', '--once', '--watch'].includes(mode) || flag !== '--config' || !configPath || extra.length)
    throw Object.assign(Error('R68_HOST_USAGE'), { code: 'R68_HOST_USAGE' });
  if (mode === '--check') {
    const result = inspectR68PrivateHost({ configPath }); write(result);
    if (!result.coreFiles.bytesMatchPinnedHashes) process.exitCode = 1;
  }
  else {
    const stop = new AbortController();
    const abort = () => stop.abort();
    process.once('SIGINT', abort); process.once('SIGTERM', abort);
    try {
      const result = await runR68PrivateHost({ configPath, mode: mode.slice(2), signal: stop.signal, onReport: write });
      write(result);
      if (['DELIVERY_UNCONFIRMED', 'OPERATOR_REVIEW_REQUIRED'].includes(result.status)) process.exitCode = 2;
    } finally { process.removeListener('SIGINT', abort); process.removeListener('SIGTERM', abort); }
  }
} catch (error) {
  const code = /^(?:R6[78]|B297)_[A-Z0-9_]+$/.test(error?.code || '') ? error.code : 'R68_HOST_UNAVAILABLE';
  write({ schema: 'JENIOS_R68_PRIVATE_HOST_FAILURE_V1', status: 'BLOCKED', code,
    secretsDisclosed: false, recoveryAuthorized: false, operationalReady: false,
    customerMonitoringActive: false, privateOperationalSourceActive: false,
    realOrdersSent: 0, externalPaperOrdersSent: 0, paidProviderCalls: 0 });
  process.exitCode = 1;
}
