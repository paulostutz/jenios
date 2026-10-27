/** Definitive-site administration. Reads only; the certified QA gates stay unchanged. */
import { timingSafeEqual } from 'node:crypto';
import { getJeniosPlatformAdmin } from '../admin-db.mjs';
import { requirePlatformAdmin } from '../admin-permissions.mjs';
import { readR67SourceConfiguration } from './robot-r67-access.mjs';

export const R73_PROJECT_ID = 'prj_44ipBY3R9sHlQDAXY7NUn1zDguw4';
export const R73_DATABASE_ID = 'xaicvhagftzjkqphnbgx';
export const R73_BRANCH = 'release/jenios-genios-g44-20261024';
const DATABASE_URL = `https://${R73_DATABASE_ID}.supabase.co`;
const closedFlags = ['JENIOS_REAL_EXECUTION_ENABLED', 'JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED',
  'JENIOS_PRIVATE_PAPER_EXECUTOR', 'JENIOS_ROBOT_ANALYST_PAID_ENABLED'];
export const R73_TABLES = Object.freeze([
  ['jenios_robot_events_r64', 'Observações assinadas de QA'],
  ['jenios_robot_config_r64', 'Configuração de custos'],
  ['jenios_robot_budgets_r64', 'Reservas de orçamento'],
  ['jenios_robot_cycles_r64', 'Ciclos de estudo de QA'],
  ['jenios_robot_observation_provenance_r65', 'Proveniência das observações'],
  ['jenios_robot_reconciliations_r65', 'Reconciliações'],
  ['jenios_robot_archives_r65', 'Arquivos lógicos'],
  ['jenios_robot_archive_items_r65', 'Registros arquivados'],
  ['jenios_robot_evolution_r65', 'Histórico de evolução dos adaptadores'],
  ['jenios_robot_validation_cases_r65', 'Casos de avaliação dos adaptadores'],
  ['jenios_robot_private_captures_r67', 'Capturas assinadas do motor privado'],
  ['jenios_robot_private_evolution_r71', 'Histórico de evolução privada'],
  ['jenios_robot_private_observations_r71', 'Observações privadas contextualizadas'],
  ['jenios_robot_private_studies_r71', 'Estudos privados'],
  ['jenios_robot_private_study_members_r71', 'Registros dos estudos privados'],
  ['jenios_robot_private_validation_cases_r71', 'Casos de avaliação privada'],
].map(([name, label]) => Object.freeze({ name, label })));

export function isR73AdministrationEnabled(env = {}) {
  return env.VERCEL_ENV === 'production' && env.VERCEL_PROJECT_ID === R73_PROJECT_ID &&
    env.VERCEL_GIT_COMMIT_REF === R73_BRANCH && env.JENIOS_ROBOT_R73_ADMIN_ENABLED === 'true' &&
    env.PLATFORM_SUPABASE_URL === DATABASE_URL && env.NEXT_PUBLIC_PLATFORM_SUPABASE_URL === DATABASE_URL &&
    closedFlags.every(key => env[key] === 'false');
}
const disabled = () => Object.assign(Error('R73_DISABLED'), { status: 404 });
function requireEnabled(env) { if (!isR73AdministrationEnabled(env)) throw disabled(); }
const response = (body, status = 200) => Response.json(body, { status, headers: {
  'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Vary': 'Authorization',
} });
const errorResponse = error => response({ error: error?.status === 401 ? 'Entre com sua conta administrativa da Platform.' :
  error?.status === 403 ? 'Conta sem autorização administrativa da Platform.' :
  error?.status === 404 ? 'Recurso indisponível.' : 'Não foi possível consultar o banco dos robôs.' },
  [401, 403, 404].includes(error?.status) ? error.status : 503);
const validCount = value => Number.isSafeInteger(value) && value >= 0;

export async function readR73DefinitiveStatus({ db, env = process.env, now = Date.now } = {}) {
  requireEnabled(env);
  // HEAD counts transfer no observation payload, customer record or private source code.
  const results = await Promise.allSettled(R73_TABLES.map(async table => {
    const result = await db.from(table.name).select('*', { count: 'exact', head: true })
      .abortSignal(AbortSignal.timeout(6000));
    if (result.error || !validCount(result.count)) throw Error('R73_TABLE_UNAVAILABLE');
    return result.count;
  }));
  const tables = R73_TABLES.map((table, i) => ({ ...table,
    available: results[i].status === 'fulfilled',
    rowCount: results[i].status === 'fulfilled' ? results[i].value : null,
  }));
  let config = null;
  try {
    const result = await db.from('jenios_robot_config_r64').select('generation_enabled,pricing_approved')
      .eq('singleton', true).maybeSingle().abortSignal(AbortSignal.timeout(6000));
    if (!result.error && typeof result.data?.generation_enabled === 'boolean' &&
        typeof result.data?.pricing_approved === 'boolean') config = result.data;
  } catch { /* Availability is explicit; a failed read never means zero or disabled. */ }
  requireEnabled(env);
  let sourceConfigured = false;
  try { readR67SourceConfiguration(env); sourceConfigured = true; } catch { /* No invented source. */ }
  const availableTables = tables.filter(table => table.available).length;
  const rowCount = name => tables.find(table => table.name === name).rowCount;
  return {
    schema: 'JENIOS_R73_ROBOT_ADMIN_STATUS_V1', checkedAt: new Date(now()).toISOString(),
    release: { version: 'R73', environment: env.VERCEL_ENV,
      commitSha: /^[a-f0-9]{40}$/.test(env.VERCEL_GIT_COMMIT_SHA || '') ? env.VERCEL_GIT_COMMIT_SHA : null },
    database: { status: availableTables === R73_TABLES.length && config &&
        config.generation_enabled === false && config.pricing_approved === false ? 'READY' :
        availableTables === 0 ? 'UNAVAILABLE' : 'INCOMPLETE',
      projectId: R73_DATABASE_ID, expectedTables: R73_TABLES.length, availableTables, tables,
      generationEnabled: config?.generation_enabled ?? null, pricingApproved: config?.pricing_approved ?? null },
    source: { configuration: sourceConfigured ? 'CONFIGURED' : 'NOT_CONFIGURED', connection: 'NOT_VERIFIED' },
    worker: { status: 'WAITING_FOR_SOURCE', scheduled: false },
    activity: { qaReceipts: rowCount('jenios_robot_events_r64'), qaCycles: rowCount('jenios_robot_cycles_r64'),
      privateCaptures: rowCount('jenios_robot_private_captures_r67'),
      privateObservations: rowCount('jenios_robot_private_observations_r71'),
      privateRevisions: rowCount('jenios_robot_private_evolution_r71') },
    certification: { code: 'R71', database: 'R72', financialPerformanceCertified: false },
    boundaries: { realOrdersEnabled: false, externalPaperEnabled: false, paidRobotProviderEnabled: false,
      customerMonitoringActive: false, actualBrokerPnl: null, actualLossesAvoided: null, realTradeAccuracy: null },
  };
}

function validateReadRequest(request, env) {
  requireEnabled(env);
  if (request.method !== 'GET') return response({ error: 'Método não permitido.' }, 405);
  if (new URL(request.url).search) return response({ error: 'Esta consulta não aceita parâmetros.' }, 400);
  return null;
}

export function createR73AdminStatusHandler({ env = process.env,
  getDb = () => getJeniosPlatformAdmin(env), now = Date.now } = {}) {
  return async request => {
    try {
      const invalid = validateReadRequest(request, env); if (invalid) return invalid;
      if (!/^Bearer [^\s]+$/i.test(request.headers.get('authorization') || ''))
        throw Object.assign(Error('R73_ADMIN_REQUIRED'), { status: 401 });
      const db = getDb();
      // Server-validated dedicated Platform identity; no Social fallback or user_metadata grant.
      await requirePlatformAdmin(request, db, 'platform.admin');
      requireEnabled(env);
      return response(await readR73DefinitiveStatus({ db, env, now }));
    } catch (error) { return errorResponse(error); }
  };
}

/** A one-hour, server-only deployment probe. It cannot read feeds or mutate any state. */
export function isR73VerificationAuthorized(request, env = {}, nowMs = Date.now()) {
  const expected = env.JENIOS_ROBOT_R73_VERIFY_TOKEN;
  const issuedAt = Number(env.JENIOS_ROBOT_R73_VERIFY_ISSUED_AT);
  const received = request.headers.get('authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
  if (!/^[a-f0-9]{64}$/.test(expected || '') || !received || !Number.isSafeInteger(issuedAt) ||
      issuedAt <= 0 || nowMs < issuedAt || nowMs >= issuedAt + 3600000) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}

export function createR73DeploymentProbeHandler({ env = process.env,
  getDb = () => getJeniosPlatformAdmin(env), now = Date.now } = {}) {
  return async request => {
    try {
      const invalid = validateReadRequest(request, env); if (invalid) return invalid;
      if (!isR73VerificationAuthorized(request, env, now()))
        throw Object.assign(Error('R73_PROBE_UNAUTHORIZED'), { status: 401 });
      const status = await readR73DefinitiveStatus({ db: getDb(), env, now });
      if (!isR73VerificationAuthorized(request, env, now()))
        throw Object.assign(Error('R73_PROBE_EXPIRED'), { status: 401 });
      return response({ schema: 'JENIOS_R73_DEPLOYMENT_PROBE_V1', checkedAt: status.checkedAt,
        release: status.release, database: { status: status.database.status,
          projectId: status.database.projectId, expectedTables: status.database.expectedTables,
          availableTables: status.database.availableTables, generationEnabled: status.database.generationEnabled,
          pricingApproved: status.database.pricingApproved },
        source: status.source, worker: status.worker, boundaries: status.boundaries,
        hostedAdministratorLoginVerified: false, verificationOnly: true }, status.database.status === 'READY' ? 200 : 503);
    } catch (error) { return errorResponse(error); }
  };
}
