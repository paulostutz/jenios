/** Read-only identity inspection. Never imports or copies proprietary executable bytes. */
import { open, constants } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import { createHash } from 'node:crypto';
import { B297_ENGINE_SHA256, B297_SERVICE_SHA256 } from './b297-private-readonly-audit.mjs';
const expected = Object.freeze({ 'engine.mjs': B297_ENGINE_SHA256, 'service.mjs': B297_SERVICE_SHA256 });
const maximumBytes = 16 * 1024 * 1024;
export async function inspectFC03OriginalCore(directory) {
  const configured = typeof directory === 'string' && isAbsolute(directory);
  const files = [];
  for (const [name, expectedSha256] of Object.entries(expected)) {
    let handle, status = 'DIRECTORY_NOT_CONFIGURED', observedSha256 = null;
    if (configured) {
      try {
        handle = await open(join(directory, name), constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
        const stat = await handle.stat();
        if (!stat.isFile()) status = 'NOT_REGULAR_FILE';
        else if (stat.size > maximumBytes) status = 'FILE_TOO_LARGE';
        else {
          const bytes = await handle.readFile();
          if (bytes.length > maximumBytes) status = 'FILE_TOO_LARGE';
          else {
            observedSha256 = createHash('sha256').update(bytes).digest('hex');
            status = observedSha256 === expectedSha256 ? 'HASH_MATCH' : 'HASH_MISMATCH';
          }
        }
      } catch (error) {
        status = error.code === 'ENOENT' ? 'MISSING' : 'UNREADABLE_OR_SYMLINK';
      } finally {
        await handle?.close();
      }
    }
    files.push({ name, expectedSha256, observedSha256, status });
  }
  const originalBytesMatch = files.every(file => file.status === 'HASH_MATCH');
  return {
    schema: 'JENIOS_FC03_ORIGINAL_CORE_INSPECTION_V1',
    status: originalBytesMatch ? 'ORIGINAL_BYTES_MATCH_RUNTIME_NOT_TESTED' : 'ORIGINAL_CORE_UNAVAILABLE_OR_UNVERIFIED',
    files, originalBytesMatch, privateEngineLoaded: false, runtimeImported: false,
    runtimeDependenciesVerified: false, originalDecisionObserved: false,
    externalIntegrationCertified: false, ordersSent: 0, paperOrdersSent: 0,
    actualBrokerPnl: null, actualLossesAvoided: null, realTradeAccuracy: null
  };
}
