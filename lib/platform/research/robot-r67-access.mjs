/** Independent opt-in boundary for original-private-core synthetic QA only. */
import { createPublicKey } from 'node:crypto';
import { isRobotR61QaEnabled } from './robot-r61-qa-access.mjs';
import { inspectR67TrustedSource, R67_EVIDENCE } from './robot-r67-private-protocol.mjs';

const qaKeys = ['VERCEL_ENV', 'JENIOS_QA_CANDIDATE_ENABLED', 'JENIOS_ROBOT_QA_ENABLED',
  'JENIOS_REAL_EXECUTION_ENABLED', 'JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED', 'JENIOS_PRIVATE_PAPER_EXECUTOR'];
const value = (env, key) => {
  if (!env || typeof env !== 'object') return undefined;
  const property = Object.getOwnPropertyDescriptor(env, key);
  return property && Object.hasOwn(property, 'value') && typeof property.value === 'string' ? property.value : undefined;
};
const fail = () => { throw Object.assign(new Error('R67_SOURCE_NOT_CONFIGURED'), { code: 'R67_SOURCE_NOT_CONFIGURED', status: 503 }); };
const keyBytes = pem => {
  const key = createPublicKey(pem);
  if (key.asymmetricKeyType !== 'ed25519') fail();
  return key.export({ type: 'spki', format: 'der' });
};

export function isRobotR67QaEnabled(env = {}) {
  const qa = Object.fromEntries(qaKeys.map(key => [key, value(env, key)]));
  return isRobotR61QaEnabled(qa) && value(env, 'JENIOS_ROBOT_R67_ENABLED') === 'true' &&
    value(env, 'JENIOS_ROBOT_ANALYST_PAID_ENABLED') === 'false';
}

export function requireR67QaEnabled(env = {}) {
  if (!isRobotR67QaEnabled(env)) throw Object.assign(new Error('R67_DISABLED'), { code: 'R67_DISABLED', status: 404 });
}

export function readR67SourceConfiguration(env = {}) {
  try {
    const source = inspectR67TrustedSource({ scopeId: value(env, 'JENIOS_ROBOT_R67_SCOPE_ID'),
      sourceId: value(env, 'JENIOS_ROBOT_R67_SOURCE_ID'), publicKeyPem: value(env, 'JENIOS_ROBOT_R67_SOURCE_PUBLIC_KEY'),
      enabled: true, evidenceKind: R67_EVIDENCE });
    const previousId = value(env, 'JENIOS_ROBOT_R64_SOURCE_ID');
    const previousKey = value(env, 'JENIOS_ROBOT_R64_SOURCE_PUBLIC_KEY');
    // Compare key bytes, not PEM spelling. A source from another evidence domain
    // must not also be admissible through the old R64/R65 configured identity.
    if (previousId === source.sourceId || (previousKey && keyBytes(previousKey).equals(keyBytes(source.publicKeyPem)))) fail();
    if ((value(env, 'JENIOS_ROBOT_R64_ENABLED') === 'true' || value(env, 'JENIOS_ROBOT_R65_ENABLED') === 'true') &&
        (!/^source:[a-f0-9]{16}$/.test(previousId || '') || !previousKey)) fail();
    return source;
  } catch { fail(); }
}
