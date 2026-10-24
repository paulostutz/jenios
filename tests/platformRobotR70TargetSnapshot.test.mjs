import test from 'node:test';
import assert from 'node:assert/strict';
import { compareR70ProvidedTargetSnapshot } from '../lib/platform/research/robot-r70-target-snapshot.mjs';

const empty = () => ({ schema: 'JENIOS_R70_PROVIDED_TARGET_SNAPSHOT_V1', observedAtMs: 1792872000000,
  expected: { teamId: 'team_fixture70', projectId: 'prj_fixture70', repositoryId: '1408041119',
    commitSha: '70'.repeat(20), deploymentId: null, origin: null },
  request: { teamId: 'team_fixture70', projectId: 'prj_fixture70', sha: '70'.repeat(20), limit: 100 },
  listResponse: { pagination: { count: 0 }, deployments: [] }, deployment: null });
const selected = () => {
  const value = empty(), id = 'dpl_fixture70', url = 'fixture-unique70-example.vercel.app';
  value.expected.deploymentId = id; value.expected.origin = 'https://' + url;
  value.listResponse = { pagination: { count: 1, next: null }, deployments: [{ uid: id, url }] };
  value.deployment = { id, url, projectId: value.expected.projectId, ownerId: value.expected.teamId,
    readyState: 'READY', target: null, gitSource: { type: 'github', sha: value.expected.commitSha, repoId: 1408041119 } };
  return value;
};
test('complete provided empty list blocks the certified SHA without treating imported data as a live query', () => {
  const result = compareR70ProvidedTargetSnapshot(empty());
  assert.equal(result.status, 'BLOCKED_CERTIFIED_SHA_NOT_DEPLOYED');
  assert.equal(result.classification, 'PROVIDED_SNAPSHOT_COMPARISON_ONLY');
  for (const key of ['liveControlPlaneQueryPerformed', 'snapshotAcquisitionAuthenticatedByThisModule',
    'remoteQaDeploymentVerified', 'operationalReady', 'targetPreflightExecuted', 'privatePayloadSent']) assert.equal(result[key], false);
  assert.equal(result.pendingOwnerOperationalAcceptance, true); assert.ok(Object.isFrozen(result));
});
test('matching supplied owner details compare pins but never grant operational acceptance', () => {
  const result = compareR70ProvidedTargetSnapshot(selected());
  assert.equal(result.status, 'MATCHING_PROVIDED_SNAPSHOT_NOT_OPERATIONAL_ACCEPTANCE');
  assert.equal(result.selectedDeployment.gitSource.repositoryId, '1408041119');
  assert.equal(result.operationalReady, false); assert.equal(result.remoteQaDeploymentVerified, false);
});
test('absent target and owner/Git fields are incomplete rather than normalized into preview', () => {
  for (const field of ['target', 'ownerId', 'projectId', 'gitSource']) {
    const value = selected(); delete value.deployment[field];
    assert.equal(compareR70ProvidedTargetSnapshot(value).status, 'BLOCKED_CONTROL_PLANE_EVIDENCE_INCOMPLETE');
  }
  const value = selected(); delete value.deployment.gitSource.sha;
  value.deployment.meta = { githubCommitSha: value.expected.commitSha };
  assert.equal(compareR70ProvidedTargetSnapshot(value).status, 'BLOCKED_CONTROL_PLANE_EVIDENCE_INCOMPLETE');
});
test('wrong team project target state Git source or unique URL cannot be replaced by matching metadata', () => {
  for (const mutate of [v => { v.deployment.ownerId = 'team_other'; }, v => { v.deployment.projectId = 'prj_other'; },
    v => { v.deployment.target = 'production'; }, v => { v.deployment.target = 'null'; },
    v => { v.deployment.readyState = 'BUILDING'; }, v => { v.deployment.gitSource.type = 'gitlab'; },
    v => { v.deployment.gitSource.sha = '00'.repeat(20); }, v => { v.deployment.gitSource.repoId = 1; },
    v => { v.deployment.url = 'another-branch-example.vercel.app'; }]) {
    const value = selected(); mutate(value);
    value.deployment.meta = { githubCommitSha: value.expected.commitSha, verified: true, authorized: true };
    assert.equal(compareR70ProvidedTargetSnapshot(value).status, 'BLOCKED_TARGET_PIN_MISMATCH');
  }
});
test('incomplete or truncated zero results never prove absence', () => {
  for (const mutate of [v => { delete v.listResponse.pagination; }, v => { v.listResponse.pagination.next = 1792872000000; },
    v => { v.listResponse.pagination.count = 1; }, v => { v.listResponse.truncated = true; },
    v => { v.listResponse.truncation = { omittedArrayItems: 1 }; },
    v => { v.listResponse._meta = { truncated: true }; }]) {
    const value = empty(); mutate(value);
    assert.equal(compareR70ProvidedTargetSnapshot(value).status, 'BLOCKED_CONTROL_PLANE_EVIDENCE_INCOMPLETE');
  }
});
test('query must match expected team project and SHA, with no state/target filter accepted', () => {
  for (const key of ['teamId', 'projectId', 'sha']) {
    const value = empty(); value.request[key] += 'other';
    assert.equal(compareR70ProvidedTargetSnapshot(value).status, 'BLOCKED_CONTROL_PLANE_QUERY_MISMATCH');
  }
  for (const key of ['state', 'target']) {
    const value = empty(); value.request[key] = 'READY';
    assert.throws(() => compareR70ProvidedTargetSnapshot(value), { code: 'R70_TARGET_SNAPSHOT_INVALID' });
  }
});
test('positive selection must be explicit and present once in the list with the same unique URL', () => {
  const noSelection = selected(); noSelection.expected.deploymentId = null; noSelection.expected.origin = null;
  assert.equal(compareR70ProvidedTargetSnapshot(noSelection).status, 'BLOCKED_TARGET_SELECTION_REQUIRED');
  const duplicate = selected(); duplicate.listResponse.deployments.push({ ...duplicate.listResponse.deployments[0] }); duplicate.listResponse.pagination.count++;
  assert.equal(compareR70ProvidedTargetSnapshot(duplicate).status, 'BLOCKED_TARGET_PIN_MISMATCH');
  const other = selected(); other.listResponse.deployments[0].uid = 'dpl_other';
  assert.equal(compareR70ProvidedTargetSnapshot(other).status, 'BLOCKED_TARGET_PIN_MISMATCH');
  const nested = selected(); nested.expected.origin = 'https://foo.bar.vercel.app';
  nested.deployment.url = 'foo.bar.vercel.app'; nested.listResponse.deployments[0].url = nested.deployment.url;
  assert.throws(() => compareR70ProvidedTargetSnapshot(nested), { code: 'R70_TARGET_SNAPSHOT_INVALID' });
});
test('caller approval flags accessors oversized input and arbitrary repository declarations fail closed', () => {
  for (const key of ['live', 'verified', 'authorized']) {
    const value = empty(); value[key] = true;
    assert.throws(() => compareR70ProvidedTargetSnapshot(value), { code: 'R70_TARGET_SNAPSHOT_INVALID' });
  }
  const getter = empty(); let invoked = false;
  Object.defineProperty(getter, 'observedAtMs', { enumerable: true, get() { invoked = true; return 1; } });
  assert.throws(() => compareR70ProvidedTargetSnapshot(getter), { code: 'R70_TARGET_SNAPSHOT_INVALID' }); assert.equal(invoked, false);
  const large = empty(); large.listResponse.unrelated = 'x'.repeat(1048576);
  assert.throws(() => compareR70ProvidedTargetSnapshot(large), { code: 'R70_TARGET_SNAPSHOT_INVALID' });
  const repo = selected(); repo.expected.repositoryId = '1';
  assert.throws(() => compareR70ProvidedTargetSnapshot(repo), { code: 'R70_TARGET_SNAPSHOT_INVALID' });
});
