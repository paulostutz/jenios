/**
 * R66 offline preflight. This module inspects DECLARED configuration only.
 * It does not open a database, import a private executable, contact a provider,
 * start a worker, inspect a live account or grant operational authorization.
 * A complete configuration never certifies hosted or customer readiness.
 */
import { createPublicKey } from 'node:crypto';
import { isRobotR65CycleEnabled } from './robot-r65-cycle-access.mjs';
import { readR64SourceConfiguration } from './robot-r64-access.mjs';

const ENV_NAMES = Object.freeze([
  'VERCEL_ENV', 'JENIOS_QA_CANDIDATE_ENABLED', 'JENIOS_ROBOT_QA_ENABLED',
  'JENIOS_ROBOT_R64_ENABLED', 'JENIOS_ROBOT_R65_ENABLED',
  'JENIOS_REAL_EXECUTION_ENABLED', 'JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED',
  'JENIOS_PRIVATE_PAPER_EXECUTOR', 'JENIOS_ROBOT_ANALYST_PAID_ENABLED',
  'PLATFORM_SUPABASE_URL', 'PLATFORM_SUPABASE_SERVICE_ROLE_KEY',
  'JENIOS_ROBOT_R64_SCOPE_ID', 'JENIOS_ROBOT_R64_SOURCE_ID',
  'JENIOS_ROBOT_R64_SOURCE_PUBLIC_KEY', 'JENIOS_ROBOT_R65_ADMIN_ORIGIN',
  'JENIOS_ROBOT_R65_SCHEDULER_TOKEN',
]);
const fail = code => { throw Object.assign(new Error(code), { code }); };
const freeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze); Object.freeze(value);
  }
  return value;
};

// Never evaluate accessors or stringify untrusted values, including secrets.
function environment(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('R66_PREFLIGHT_ENV_INVALID');
  const output = {};
  for (const key of ENV_NAMES) {
    const property = Object.getOwnPropertyDescriptor(input, key);
    if (!property) continue;
    if (!Object.hasOwn(property, 'value') || typeof property.value !== 'string')
      fail('R66_PREFLIGHT_ENV_INVALID');
    output[key] = property.value;
  }
  return output;
}

function hostPlan(input) {
  const fields = ['storageKind', 'workerKind', 'wakeStrategy'];
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(input))) fail('R66_PREFLIGHT_HOST_INVALID');
  const descriptors = Object.getOwnPropertyDescriptors(input);
  const keys = Reflect.ownKeys(descriptors);
  if (keys.some(key => typeof key !== 'string' || !fields.includes(key) ||
      !Object.hasOwn(descriptors[key], 'value') || !descriptors[key].enumerable)) fail('R66_PREFLIGHT_HOST_INVALID');
  const value = Object.fromEntries(fields.map(key => [key, descriptors[key]?.value ?? 'unspecified']));
  if (!['persistent_private_volume', 'ephemeral_filesystem', 'unspecified'].includes(value.storageKind) ||
      !['persistent_process', 'external_scheduler', 'unspecified'].includes(value.workerKind) ||
      !['next_at_ms', 'fixed_minute', 'unspecified'].includes(value.wakeStrategy)) fail('R66_PREFLIGHT_HOST_INVALID');
  return value;
}

function canonicalHttpsOrigin(value) {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.origin === value && !url.username && !url.password;
  } catch { return false; }
}

function sourceDeclared(env) {
  try {
    const source = readR64SourceConfiguration(env);
    return createPublicKey(source.publicKeyPem).asymmetricKeyType === 'ed25519';
  } catch { return false; }
}

export const R66_OPERATIONAL_EVIDENCE_REQUIREMENTS = freeze([
  { id: 'PRIVATE_EXECUTABLE_TO_EMITTER', appliesTo: 'private_source',
    required: 'Verify pinned private bytes, supported hooks and separate source provenance; exercise the authorized connection without relabelling private output as R61.' },
  { id: 'PERSISTENT_HOST_RESTART', appliesTo: 'hosted_qa',
    required: 'Run crash/restart and exact retry on the selected persistent host; verify private storage, keys, locks and bounded expiry handling.' },
  { id: 'HOSTED_PLATFORM_DATABASE', appliesTo: 'hosted_qa',
    required: 'Confirm the isolated Platform QA project, schema installation, atomic intake, permissions and scope isolation on that actual project.' },
  { id: 'REAL_PLATFORM_ADMIN_IDENTITY', appliesTo: 'hosted_qa',
    required: 'Use actual Platform Auth and test admin, ordinary user, reports-only user, anonymous and invalid/expired tokens; verify server-pinned Origin.' },
  { id: 'HOSTED_WORKER_TIMING', appliesTo: 'hosted_qa',
    required: 'Verify one scheduled worker follows nextAtMs through the registered database-clock window; missed cases must stay missing.' },
  { id: 'OPERATIONAL_DATA_PROVENANCE', appliesTo: 'customer_observation',
    required: 'Define authorized data, source identity, disclosure, minimization, retention and access; use an explicit evidence domain distinct from synthetic QA.' },
  { id: 'PAID_PROVIDER_AUTHORIZATION', appliesTo: 'paid_generation_only',
    required: 'Obtain JENIOS-specific budget authorization, approved model/current rates, internal funded limits and actual provider validation before enabling paid generation.' },
  { id: 'OWNER_OPERATIONAL_ACCEPTANCE', appliesTo: 'customer_observation',
    required: 'Record owner acceptance of the hosted observation flow and recovery plan before any customer activation.' },
]);

/** Only env and host declarations are accepted. There is intentionally no
 * caller-provided verified/ready/accepted boolean or evidence override. */
export function inspectR66OperationalReadiness(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(input))) fail('R66_PREFLIGHT_INPUT_INVALID');
  const descriptors = Object.getOwnPropertyDescriptors(input), keys = Reflect.ownKeys(descriptors);
  if (keys.some(key => typeof key !== 'string' || !['env', 'host'].includes(key) ||
      !Object.hasOwn(descriptors[key], 'value') || !descriptors[key].enumerable)) fail('R66_PREFLIGHT_INPUT_INVALID');
  const env = environment(descriptors.env?.value ?? {}), host = hostPlan(descriptors.host?.value ?? {});
  const checks = [];
  const check = (id, satisfied, status, missing) => checks.push({ id, declaredConfigurationValid: satisfied,
    status: satisfied ? status : missing, verifiedAgainstHost: false });

  check('QA_BOUNDARY', isRobotR65CycleEnabled(env), 'DECLARED_QA_BOUNDARY', 'QA_BOUNDARY_NOT_CONFIGURED');
  check('PREVIEW_TARGET', env.VERCEL_ENV === 'preview', 'DECLARED_PREVIEW', 'PREVIEW_REQUIRED');
  check('EXECUTION_DISABLED', ['JENIOS_REAL_EXECUTION_ENABLED', 'JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED',
    'JENIOS_PRIVATE_PAPER_EXECUTOR'].every(key => env[key] === 'false'),
  'DECLARED_EXECUTION_DISABLED', 'EXPLICIT_EXECUTION_DISABLE_REQUIRED');
  check('PAID_GENERATION_DISABLED', env.JENIOS_ROBOT_ANALYST_PAID_ENABLED === 'false',
    'DECLARED_PAID_GENERATION_DISABLED', 'EXPLICIT_PAID_GENERATION_DISABLE_REQUIRED');
  check('PLATFORM_DATABASE', canonicalHttpsOrigin(env.PLATFORM_SUPABASE_URL) &&
    typeof env.PLATFORM_SUPABASE_SERVICE_ROLE_KEY === 'string' && env.PLATFORM_SUPABASE_SERVICE_ROLE_KEY.length > 0,
  'DECLARED_NOT_CONNECTED', 'DEDICATED_PLATFORM_DATABASE_REQUIRED');
  check('SIGNED_QA_SOURCE', sourceDeclared(env), 'DECLARED_NOT_ATTESTED', 'VALID_ED25519_QA_SOURCE_REQUIRED');
  check('ADMIN_ORIGIN', canonicalHttpsOrigin(env.JENIOS_ROBOT_R65_ADMIN_ORIGIN),
    'DECLARED_NOT_TESTED', 'CANONICAL_HTTPS_ADMIN_ORIGIN_REQUIRED');
  const schedulerToken = env.JENIOS_ROBOT_R65_SCHEDULER_TOKEN;
  check('SCHEDULER_CREDENTIAL', typeof schedulerToken === 'string' && schedulerToken.length >= 32 &&
    schedulerToken.length <= 256 && !/\s/.test(schedulerToken),
  'DECLARED_NOT_DISPATCHED', 'R65_SCHEDULER_TOKEN_REQUIRED');
  check('DURABLE_STORAGE', host.storageKind === 'persistent_private_volume',
    'DECLARED_NOT_VALIDATED', 'PERSISTENT_PRIVATE_HOST_REQUIRED');
  check('WORKER_PLAN', host.workerKind !== 'unspecified' && host.wakeStrategy === 'next_at_ms',
    'DECLARED_NOT_STARTED', 'WORKER_WITH_NEXT_AT_MS_REQUIRED');

  const missingConfiguration = checks.filter(item => !item.declaredConfigurationValid).map(item => item.status);
  return freeze({
    schema: 'JENIOS_R66_OPERATIONAL_PREFLIGHT_V1', mode: 'OFFLINE_DECLARED_CONFIGURATION_ONLY',
    status: missingConfiguration.length ? 'BLOCKED_CONFIGURATION_AND_EVIDENCE' : 'BLOCKED_PENDING_OPERATIONAL_EVIDENCE',
    configurationComplete: missingConfiguration.length === 0, operationalReady: false,
    actualHostStateObserved: false, pendingOwnerOperationalAcceptance: true,
    configuration: checks, missingConfiguration, hostPlan: host,
    needsEvidence: R66_OPERATIONAL_EVIDENCE_REQUIREMENTS.map(item => ({ ...item, status: 'NOT_VERIFIED_BY_THIS_PREFLIGHT' })),
    existingIntegration: {
      databaseSchemas: ['db/schema/robot-r64-operational-store.sql', 'db/schema/robot-r65-lifecycle-store.sql'],
      sourceConfiguration: 'lib/platform/research/robot-r64-access.mjs',
      runtime: 'lib/platform/research/robot-r65-runtime.mjs',
      worker: 'scripts/platform/research/r65-cycle-worker.mjs',
      schedulerEndpoint: '/api/platform/internal/robot-evolution-cycle',
      observationEndpoint: '/api/platform/robot-evolution-observations',
      adminEndpoint: '/api/platform/admin/robot-evolution-cycle',
      externalHook: 'captureB297OriginalDecisions -> analyzeRequest',
      privateCoreRobots: ['manual', 'hybrid', 'reverse'],
      ultrafastOrigin: 'R61_SYNTHETIC_RUNTIME',
    },
    preservedPolicy: { robot: 'ultrafast', parameter: 'maxAgeMs', from: 750, to: 500,
      maximumApplicationsPerHistory: 1, freshConfirmationsAfterGenerationChange: 2,
      candidateFalseAllows: 0, strictFalseAllowReduction: true, falseBlockRegressionAllowed: false,
      arbitraryGeneratedCodeExecution: false },
    preparedActivation: { customerMonitoringActive: false, privateOperationalSourceActive: false,
      workerStarted: false, hostedSchemaApplied: false, paidGenerationEnabled: false },
    actionsPerformed: { networkCalls: 0, providerCalls: 0, realOrdersSent: 0, externalPaperOrdersSent: 0,
      hostedDatabaseChanges: 0, mergePerformed: false, deploymentPerformed: false, productionChanged: false },
    metrics: { actualBrokerPnl: null, actualLossesAvoided: null, realTradeAccuracy: null,
      commercialPerformanceCertified: false },
  });
}
