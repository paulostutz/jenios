/** Bounded comparison of PROVIDED Vercel snapshots only. No network, tokens,
 * approval flags or deployment operations. A caller-supplied JSON document is
 * never evidence that this module made an authenticated control-plane query.
 */
import { createHash } from 'node:crypto';
import { canonicalR67Json } from './robot-r67-private-protocol.mjs';

const SCHEMA = 'JENIOS_R70_PROVIDED_TARGET_SNAPSHOT_V1';
const SHA = /^[a-f0-9]{40}$/, TEAM = /^team_[A-Za-z0-9]{1,80}$/;
const PROJECT = /^prj_[A-Za-z0-9]{1,80}$/, DEPLOYMENT = /^dpl_[A-Za-z0-9]{1,80}$/;
const fail = () => { throw Object.assign(Error('R70_TARGET_SNAPSHOT_INVALID'), { code: 'R70_TARGET_SNAPSHOT_INVALID' }); };
const exact = (value, names) => value && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).length === names.length && names.every(name => Object.hasOwn(value, name));
const sha = value => createHash('sha256').update(value).digest('hex');
function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
function safeCopy(input) {
  const seen = new Set(); let nodes = 0;
  function visit(value, depth) {
    if (++nodes > 30000 || depth > 32) fail();
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (!value || typeof value !== 'object' || seen.has(value)) fail();
    if (!Array.isArray(value) && ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail();
    seen.add(value); const descriptors = Object.getOwnPropertyDescriptors(value), result = Array.isArray(value) ? [] : {};
    for (const key of Reflect.ownKeys(descriptors)) {
      if (Array.isArray(value) && key === 'length') continue;
      const descriptor = descriptors[key];
      if (typeof key !== 'string' || !Object.hasOwn(descriptor, 'value') || !descriptor.enumerable || key === '__proto__') fail();
      if (Array.isArray(value) && !/^(?:0|[1-9][0-9]*)$/.test(key)) fail();
      result[key] = visit(descriptor.value, depth + 1);
    }
    if (Array.isArray(value) && (result.length !== value.length || Object.keys(result).length !== value.length)) fail();
    seen.delete(value); return result;
  }
  const result = visit(input, 0);
  try { if (Buffer.byteLength(canonicalR67Json(result)) > 1048576) fail(); }
  catch { fail(); }
  return result;
}
function deploymentOrigin(value) {
  if (typeof value !== 'string' || value.length > 253) return null;
  try {
    const url = new URL('https://' + value);
    return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.vercel\.app$/.test(url.hostname) &&
      url.host === value && url.origin === 'https://' + value && url.pathname === '/' &&
      !url.username && !url.password && !url.port && !url.search && !url.hash ? url.origin : null;
  } catch { return null; }
}

export function compareR70ProvidedTargetSnapshot(input) {
  const snapshot = safeCopy(input);
  if (!exact(snapshot, ['schema', 'observedAtMs', 'expected', 'request', 'listResponse', 'deployment']) ||
      snapshot.schema !== SCHEMA || !Number.isSafeInteger(snapshot.observedAtMs) || snapshot.observedAtMs < 1) fail();
  const { expected, request, listResponse, deployment } = snapshot;
  if (!exact(expected, ['teamId', 'projectId', 'repositoryId', 'commitSha', 'deploymentId', 'origin']) ||
      !TEAM.test(expected.teamId || '') || !PROJECT.test(expected.projectId || '') ||
      expected.repositoryId !== '1408041119' || !SHA.test(expected.commitSha || '') ||
      !((expected.deploymentId === null && expected.origin === null) ||
        (DEPLOYMENT.test(expected.deploymentId || '') && typeof expected.origin === 'string' &&
          expected.origin.startsWith('https://') && deploymentOrigin(expected.origin.slice(8)) === expected.origin))) fail();
  if (!exact(request, ['teamId', 'projectId', 'sha', 'limit']) || !Number.isInteger(request.limit) ||
      request.limit < 1 || request.limit > 100) fail();
  const reasons = [];
  const result = (status, details = {}) => freeze({ schema: 'JENIOS_R70_TARGET_SNAPSHOT_COMPARISON_V1',
    classification: 'PROVIDED_SNAPSHOT_COMPARISON_ONLY', status, reasons: [...reasons],
    providedSnapshotSha256: sha(canonicalR67Json(snapshot)), reportedObservationAtMs: snapshot.observedAtMs,
    expected: { ...expected }, listQueryMatched: request.teamId === expected.teamId &&
      request.projectId === expected.projectId && request.sha === expected.commitSha,
    liveControlPlaneQueryPerformed: false, snapshotAcquisitionAuthenticatedByThisModule: false,
    remoteQaDeploymentVerified: false, independentRuntimeAttestation: false,
    hostedAuthenticationCertified: false, operationalReady: false, pendingOwnerOperationalAcceptance: true,
    targetPreflightExecuted: false, privateCaptureStarted: false, privatePayloadSent: false,
    customerMonitoringActive: false, privateOperationalSourceActive: false,
    deploymentsCreated: 0, hostedMigrationsApplied: 0, realOrdersSent: 0, externalPaperOrdersSent: 0, paidProviderCalls: 0,
    ...details });
  if (request.teamId !== expected.teamId || request.projectId !== expected.projectId || request.sha !== expected.commitSha) {
    reasons.push('LIST_QUERY_DOES_NOT_MATCH_EXPECTED_TEAM_PROJECT_SHA');
    return result('BLOCKED_CONTROL_PLANE_QUERY_MISMATCH');
  }
  const pagination = listResponse?.pagination, items = listResponse?.deployments;
  if (!exact(listResponse, ['pagination', 'deployments']) || !Array.isArray(items) || !pagination || Array.isArray(pagination) ||
      Object.keys(pagination).some(key => !['count', 'next', 'prev'].includes(key)) ||
      !Number.isInteger(pagination.count) || pagination.count !== items.length ||
      items.length > request.limit ||
      (Object.hasOwn(pagination, 'next') && pagination.next !== null)) {
    reasons.push('COMPLETE_UNTRUNCATED_LIST_RESPONSE_REQUIRED');
    return result('BLOCKED_CONTROL_PLANE_EVIDENCE_INCOMPLETE');
  }
  if (items.length === 0) {
    if (deployment !== null || expected.deploymentId !== null) {
      reasons.push('SELECTED_DEPLOYMENT_CONTRADICTS_EMPTY_LIST');
      return result('BLOCKED_CONTROL_PLANE_EVIDENCE_INCONSISTENT');
    }
    reasons.push('COMPLETE_PROVIDED_LIST_HAS_NO_DEPLOYMENT_FOR_CERTIFIED_SHA');
    return result('BLOCKED_CERTIFIED_SHA_NOT_DEPLOYED', { listedDeploymentCount: 0, selectedDeployment: null });
  }
  if (!expected.deploymentId || !expected.origin) {
    reasons.push('EXPLICIT_DEPLOYMENT_AND_UNIQUE_ORIGIN_SELECTION_REQUIRED');
    return result('BLOCKED_TARGET_SELECTION_REQUIRED', { listedDeploymentCount: items.length });
  }
  if (!deployment || typeof deployment !== 'object' || Array.isArray(deployment) ||
      ['id', 'projectId', 'ownerId', 'readyState', 'target', 'gitSource', 'url'].some(key => !Object.hasOwn(deployment, key)) ||
      !deployment.gitSource || typeof deployment.gitSource !== 'object' ||
      ['type', 'sha', 'repoId'].some(key => !Object.hasOwn(deployment.gitSource, key)) ||
      Object.hasOwn(deployment, 'truncated') || Object.hasOwn(deployment, 'truncation')) {
    reasons.push('OWNER_DETAIL_WITH_EXPLICIT_TARGET_AND_GIT_SOURCE_REQUIRED');
    return result('BLOCKED_CONTROL_PLANE_EVIDENCE_INCOMPLETE');
  }
  const selected = items.filter(item => item && (item.uid === expected.deploymentId || item.id === expected.deploymentId));
  if (selected.length !== 1 || selected[0].url !== deployment.url ||
      (selected[0].id && selected[0].uid && selected[0].id !== selected[0].uid)) reasons.push('SELECTED_DEPLOYMENT_NOT_UNIQUELY_BOUND_TO_LIST');
  for (const [valid, code] of [
    [deployment.id === expected.deploymentId, 'DEPLOYMENT_ID_MISMATCH'],
    [deployment.projectId === expected.projectId, 'PROJECT_ID_MISMATCH'],
    [deployment.ownerId === expected.teamId, 'TEAM_ID_MISMATCH'],
    [deployment.readyState === 'READY', 'DEPLOYMENT_NOT_READY'],
    [deployment.target === null, 'DEPLOYMENT_NOT_EXPLICIT_PREVIEW'],
    [deployment.gitSource.type === 'github', 'GIT_PROVIDER_MISMATCH'],
    [deployment.gitSource.sha === expected.commitSha, 'GIT_SOURCE_SHA_MISMATCH'],
    [(typeof deployment.gitSource.repoId === 'string' || Number.isSafeInteger(deployment.gitSource.repoId)) &&
      String(deployment.gitSource.repoId) === expected.repositoryId, 'GIT_REPOSITORY_ID_MISMATCH'],
    [deploymentOrigin(deployment.url) === expected.origin, 'UNIQUE_DEPLOYMENT_ORIGIN_MISMATCH'],
  ]) if (!valid) reasons.push(code);
  if (reasons.length) return result('BLOCKED_TARGET_PIN_MISMATCH', { listedDeploymentCount: items.length });
  return result('MATCHING_PROVIDED_SNAPSHOT_NOT_OPERATIONAL_ACCEPTANCE', { listedDeploymentCount: items.length,
    selectedDeployment: { id: deployment.id, projectId: deployment.projectId, ownerId: deployment.ownerId,
      readyState: deployment.readyState, target: null, origin: expected.origin,
      gitSource: { type: 'github', sha: deployment.gitSource.sha, repositoryId: expected.repositoryId } } });
}
