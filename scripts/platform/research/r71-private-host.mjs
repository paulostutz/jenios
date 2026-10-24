#!/usr/bin/env node
/** Explicit R71 QA host only. Installs no service and never authorizes recovery. */
import { inspectR71PrivateHost, runR71PrivateHost } from '../../../lib/platform/research/robot-r71-private-host.mjs';

const write = value => process.stdout.write(JSON.stringify(value) + '\n');
try {
  const [mode, flag, configPath, ...extra] = process.argv.slice(2);
  if (!['--check', '--once', '--watch'].includes(mode) || flag !== '--config' || !configPath || extra.length)
    throw Object.assign(Error('R71_HOST_USAGE'), { code: 'R71_HOST_USAGE' });
  if (mode === '--check') {
    const result = inspectR71PrivateHost({ configPath }); write(result);
    if (!result.coreFiles.bytesMatchPinnedHashes) process.exitCode = 1;
  } else {
    const stop = new AbortController();
    const abort = () => stop.abort();
    process.once('SIGINT', abort); process.once('SIGTERM', abort);
    try {
      const result = await runR71PrivateHost({ configPath, mode: mode.slice(2), signal: stop.signal, onReport: write });
      write(result);
      if (['DELIVERY_UNCONFIRMED', 'OPERATOR_REVIEW_REQUIRED'].includes(result.status)) process.exitCode = 2;
    } finally { process.removeListener('SIGINT', abort); process.removeListener('SIGTERM', abort); }
  }
} catch (error) {
  const code = /^(?:R6[789]|R7[01]|B297)_[A-Z0-9_]+$/.test(error?.code || '') ? error.code : 'R71_HOST_UNAVAILABLE';
  write({ schema: 'JENIOS_R71_PRIVATE_HOST_FAILURE_V1', status: 'BLOCKED', code,
    secretsDisclosed: false, recoveryAuthorized: false, operationalReady: false,
    remoteQaDeploymentVerified: false, hostedAuthenticationCertified: false,
    customerMonitoringActive: false, privateOperationalSourceActive: false,
    realOrdersSent: 0, externalPaperOrdersSent: 0, paidProviderCalls: 0 });
  process.exitCode = 1;
}
