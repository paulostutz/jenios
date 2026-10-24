#!/usr/bin/env node
/** Explicit R70 QA host only. Installs no service and never authorizes recovery. */
import { inspectR70PrivateHost, runR70PrivateHost } from '../../../lib/platform/research/robot-r70-private-host.mjs';

const write = value => process.stdout.write(JSON.stringify(value) + '\n');
try {
  const [mode, flag, configPath, ...extra] = process.argv.slice(2);
  if (!['--check', '--once', '--watch'].includes(mode) || flag !== '--config' || !configPath || extra.length)
    throw Object.assign(Error('R70_HOST_USAGE'), { code: 'R70_HOST_USAGE' });
  if (mode === '--check') {
    const result = inspectR70PrivateHost({ configPath }); write(result);
    if (!result.coreFiles.bytesMatchPinnedHashes) process.exitCode = 1;
  } else {
    const stop = new AbortController();
    const abort = () => stop.abort();
    process.once('SIGINT', abort); process.once('SIGTERM', abort);
    try {
      const result = await runR70PrivateHost({ configPath, mode: mode.slice(2), signal: stop.signal, onReport: write });
      write(result);
      if (['DELIVERY_UNCONFIRMED', 'OPERATOR_REVIEW_REQUIRED'].includes(result.status)) process.exitCode = 2;
    } finally { process.removeListener('SIGINT', abort); process.removeListener('SIGTERM', abort); }
  }
} catch (error) {
  const code = /^(?:R6[789]|R70|B297)_[A-Z0-9_]+$/.test(error?.code || '') ? error.code : 'R70_HOST_UNAVAILABLE';
  write({ schema: 'JENIOS_R70_PRIVATE_HOST_FAILURE_V1', status: 'BLOCKED', code,
    secretsDisclosed: false, recoveryAuthorized: false, operationalReady: false,
    remoteQaDeploymentVerified: false, hostedAuthenticationCertified: false,
    customerMonitoringActive: false, privateOperationalSourceActive: false,
    realOrdersSent: 0, externalPaperOrdersSent: 0, paidProviderCalls: 0 });
  process.exitCode = 1;
}
