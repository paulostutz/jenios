/** R68 offline handoff checks. Format and configuration are not identity proof. */
import { inspectR66OperationalReadiness } from './robot-r66-operational-readiness.mjs';
import { isRobotR67QaEnabled, readR67SourceConfiguration } from './robot-r67-access.mjs';

const ENV_NAMES = Object.freeze([
  'VERCEL_ENV', 'JENIOS_QA_CANDIDATE_ENABLED', 'JENIOS_ROBOT_QA_ENABLED',
  'JENIOS_ROBOT_R64_ENABLED', 'JENIOS_ROBOT_R65_ENABLED', 'JENIOS_ROBOT_R67_ENABLED',
  'JENIOS_ROBOT_R68_HOST_ENABLED', 'JENIOS_ROBOT_R68_WORKER_ENABLED',
  'JENIOS_REAL_EXECUTION_ENABLED', 'JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED',
  'JENIOS_PRIVATE_PAPER_EXECUTOR', 'JENIOS_ROBOT_ANALYST_PAID_ENABLED',
  'PLATFORM_SUPABASE_URL', 'PLATFORM_SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_PLATFORM_SUPABASE_URL', 'NEXT_PUBLIC_PLATFORM_SUPABASE_PUBLISHABLE_KEY',
  'NEXT_PUBLIC_PLATFORM_SUPABASE_SERVICE_ROLE_KEY', 'NEXT_PUBLIC_PLATFORM_SUPABASE_SECRET_KEY',
  'JENIOS_ROBOT_R64_SCOPE_ID', 'JENIOS_ROBOT_R64_SOURCE_ID', 'JENIOS_ROBOT_R64_SOURCE_PUBLIC_KEY',
  'JENIOS_ROBOT_R67_SCOPE_ID', 'JENIOS_ROBOT_R67_SOURCE_ID', 'JENIOS_ROBOT_R67_SOURCE_PUBLIC_KEY',
  'JENIOS_ROBOT_R65_ADMIN_ORIGIN', 'JENIOS_ROBOT_R65_SCHEDULER_TOKEN',
]);
const fail = code => { throw Object.assign(new Error(code), { code }); };
function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze); Object.freeze(value);
  }
  return value;
}
function environment(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('R68_HANDOFF_ENV_INVALID');
  const output = {};
  for (const key of ENV_NAMES) {
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    if (!descriptor) continue;
    if (!Object.hasOwn(descriptor, 'value') || typeof descriptor.value !== 'string' ||
        descriptor.value.length > 32768) fail('R68_HANDOFF_ENV_INVALID');
    output[key] = descriptor.value;
  }
  return output;
}
function canonicalHttpsOrigin(value) {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.origin === value && !url.username && !url.password;
  } catch { return false; }
}
// This decoder does NOT verify a signature, validity, project or user. It only
// prevents obviously elevated declarations being accepted in the browser slot.
function declaredKeyKind(value) {
  if (typeof value !== 'string' || value.length > 8192) return 'INVALID';
  if (/^sb_publishable_[A-Za-z0-9_-]{16,512}$/.test(value)) return 'PUBLISHABLE';
  if (/^sb_secret_[A-Za-z0-9_-]{16,512}$/.test(value)) return 'SECRET';
  if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value)) return 'INVALID';
  try {
    const [header, payload] = value.split('.').slice(0, 2).map(part => {
      const decoded = Buffer.from(part, 'base64url');
      if (decoded.toString('base64url') !== part) throw new Error();
      return JSON.parse(decoded.toString('utf8'));
    });
    if (header?.alg !== 'HS256' || !payload || typeof payload !== 'object' || Array.isArray(payload)) return 'INVALID';
    return payload.role === 'anon' ? 'LEGACY_ANON_DECLARED' :
      payload.role === 'service_role' ? 'LEGACY_SERVICE_ROLE_DECLARED' : 'INVALID';
  } catch { return 'INVALID'; }
}

export const R68_ADMIN_ACCEPTANCE_MATRIX = freeze([
  { identity: 'REAL_PLATFORM_ADMIN', endpoint: 'R65_AND_R67_ADMIN_GET', expected: 'AUTHORIZED_SCOPED_REPORT' },
  { identity: 'REAL_PLATFORM_ORDINARY_USER', endpoint: 'R65_AND_R67_ADMIN_GET', expected: 'DENIED' },
  { identity: 'REAL_PLATFORM_REPORTS_ONLY_USER', endpoint: 'R65_AND_R67_ADMIN_GET', expected: 'DENIED' },
  { identity: 'ANONYMOUS', endpoint: 'R65_AND_R67_ADMIN_GET', expected: 'DENIED_NO_ADMIN_FEED' },
  { identity: 'INVALID_OR_EXPIRED_TOKEN', endpoint: 'R65_AND_R67_ADMIN_GET', expected: 'DENIED' },
  { identity: 'REAL_PLATFORM_ADMIN_WRONG_ORIGIN', endpoint: 'R65_ADMIN_MUTATION', expected: 'DENIED_WITHOUT_STATE_CHANGE' },
  { identity: 'REAL_PLATFORM_ADMIN_PINNED_ORIGIN', endpoint: 'R65_ADMIN_MUTATION', expected: 'AUTHORIZED_AUDITED_QA_ACTION' },
]);

/** No acceptance flags, evidence objects or callbacks are inputs. All checks
 * describe supplied configuration; no network or executable is reached here. */
export function inspectR68DeclaredHandoff(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(input))) fail('R68_HANDOFF_INPUT_INVALID');
  const descriptors = Object.getOwnPropertyDescriptors(input);
  if (Reflect.ownKeys(descriptors).some(key => typeof key !== 'string' || !['env', 'host'].includes(key) ||
      !Object.hasOwn(descriptors[key], 'value') || !descriptors[key].enumerable)) fail('R68_HANDOFF_INPUT_INVALID');
  const env = environment(descriptors.env?.value ?? {});
  const base = inspectR66OperationalReadiness({ env, host: descriptors.host?.value ?? {} });
  const configuration = base.configuration.map(check => ({ ...check }));
  const check = (id, valid, accepted, missing) => configuration.push({ id,
    declaredConfigurationValid: valid, status: valid ? accepted : missing, verifiedAgainstHost: false });
  check('BROWSER_SERVER_PROJECT_URL', canonicalHttpsOrigin(env.PLATFORM_SUPABASE_URL) &&
    canonicalHttpsOrigin(env.NEXT_PUBLIC_PLATFORM_SUPABASE_URL) &&
    env.PLATFORM_SUPABASE_URL === env.NEXT_PUBLIC_PLATFORM_SUPABASE_URL,
  'DECLARED_SAME_CANONICAL_HTTPS_ORIGIN', 'MATCHING_PLATFORM_BROWSER_SERVER_URL_REQUIRED');
  const publicKind = declaredKeyKind(env.NEXT_PUBLIC_PLATFORM_SUPABASE_PUBLISHABLE_KEY);
  const privateKind = declaredKeyKind(env.PLATFORM_SUPABASE_SERVICE_ROLE_KEY);
  check('BROWSER_KEY_DECLARATION', ['PUBLISHABLE', 'LEGACY_ANON_DECLARED'].includes(publicKind) &&
    env.NEXT_PUBLIC_PLATFORM_SUPABASE_PUBLISHABLE_KEY !== env.PLATFORM_SUPABASE_SERVICE_ROLE_KEY,
  'DECLARED_PUBLIC_KEY_FORMAT_ONLY', 'PUBLIC_PLATFORM_KEY_FORMAT_REQUIRED');
  check('SERVER_KEY_DECLARATION', ['SECRET', 'LEGACY_SERVICE_ROLE_DECLARED'].includes(privateKind),
    'DECLARED_SERVER_KEY_FORMAT_ONLY', 'SERVER_PLATFORM_KEY_FORMAT_REQUIRED');
  check('NO_DECLARED_PUBLIC_PLATFORM_SECRET',
    !env.NEXT_PUBLIC_PLATFORM_SUPABASE_SERVICE_ROLE_KEY && !env.NEXT_PUBLIC_PLATFORM_SUPABASE_SECRET_KEY,
  'NO_SECRET_IN_CHECKED_PUBLIC_SLOTS', 'REMOVE_DECLARED_PUBLIC_PLATFORM_SECRET');
  check('PRIVATE_QA_BOUNDARY', isRobotR67QaEnabled(env), 'DECLARED_PRIVATE_QA_BOUNDARY', 'PRIVATE_QA_BOUNDARY_REQUIRED');
  let sourceSeparated = false;
  try { readR67SourceConfiguration(env); sourceSeparated = true; } catch { /* fail closed */ }
  check('SEPARATE_PRIVATE_SOURCE', sourceSeparated, 'DECLARED_DISTINCT_SOURCE_AND_KEY', 'DISTINCT_PRIVATE_SOURCE_AND_KEY_REQUIRED');
  check('PRIVATE_HOST_OPT_IN', env.JENIOS_ROBOT_R68_HOST_ENABLED === 'true',
    'DECLARED_NOT_STARTED', 'R68_PRIVATE_HOST_OPT_IN_REQUIRED');
  check('CYCLE_SUPERVISOR_OPT_IN', env.JENIOS_ROBOT_R68_WORKER_ENABLED === 'true',
    'DECLARED_NOT_STARTED', 'R68_WORKER_OPT_IN_REQUIRED');
  check('CONTINUOUS_SUPERVISION_PLAN', base.hostPlan.workerKind === 'persistent_process' &&
    base.hostPlan.wakeStrategy === 'next_at_ms',
  'DECLARED_PERSISTENT_PROCESS', 'R68_PERSISTENT_SUPERVISOR_REQUIRED');
  const missingConfiguration = configuration.filter(check => !check.declaredConfigurationValid).map(check => check.status);
  return freeze({
    schema: 'JENIOS_R68_DECLARED_HANDOFF_V1', mode: 'OFFLINE_DECLARED_CONFIGURATION_ONLY',
    status: missingConfiguration.length ? 'BLOCKED_CONFIGURATION_AND_HOSTED_EVIDENCE' : 'BLOCKED_PENDING_HOSTED_EVIDENCE',
    configurationComplete: missingConfiguration.length === 0, operationalReady: false,
    configuration, missingConfiguration, hostPlan: base.hostPlan,
    realAdminIdentityVerified: false, credentialsProjectBindingVerified: false, credentialsVerified: false,
    hostedDatabaseVerified: false, actualHostStateObserved: false, pendingOwnerOperationalAcceptance: true,
    keyDeclaration: { publicKind, privateKind, proof: 'DECLARED_FORMAT_ONLY_NO_SIGNATURE_OR_PROJECT_VERIFICATION' },
    adminAcceptance: R68_ADMIN_ACCEPTANCE_MATRIX.map(item => ({ ...item, status: 'NOT_EXECUTED' })),
    needsEvidence: base.needsEvidence,
    hostRecovery: { privateCustodyVerified: false, processOwnershipVerified: false,
      exclusiveHostFenceVerified: false, monotonicWitnessVerified: false, recoveryAuthorized: false },
    preparedActivation: base.preparedActivation, actionsPerformed: base.actionsPerformed, metrics: base.metrics,
    existingIntegration: { ...base.existingIntegration,
      privateHost: 'scripts/platform/research/r68-private-host.mjs',
      worker: 'scripts/platform/research/r68-cycle-supervisor.mjs',
      privateObservationEndpoint: '/api/platform/robot-private-observations',
      privateAdminEndpoint: '/api/platform/admin/robot-private-observations',
    },
    limitations: ['MATCHING_URLS_DO_NOT_VERIFY_CREDENTIAL_PROJECT_BINDING',
      'DECLARED_KEY_FORMAT_DOES_NOT_AUTHENTICATE_A_USER',
      'LOCAL_HOST_CHECK_DOES_NOT_VERIFY_DEPLOYED_HOST',
      'READ_ONLY_DOCTOR_NEVER_AUTHORIZES_LOCK_REMOVAL',
      'SYNTHETIC_ACCEPTANCE_DOES_NOT_CERTIFY_FINANCIAL_PERFORMANCE'],
  });
}
