import test from 'node:test';
import assert from 'node:assert/strict';
import { isR71AdminFeed, requireR71AdminFeed, projectR71AdminFeed } from '../lib/platform/research/robot-r71-admin-view.mjs';
import { createR71EvolutionState } from '../lib/platform/research/robot-r71-evolution-engine.mjs';

const T = Date.UTC(2026, 9, 24, 21), scopeId = 'scope:' + '71'.repeat(8), sourceId = 'source:' + '71'.repeat(8);
const sourceKeySha256 = '71'.repeat(32);
function fixture() {
  const state = createR71EvolutionState({ scopeId, sourceId, sourceKeySha256, nowMs: T });
  const overview = { scopeId, sourceId, sourceKeySha256, snapshots: [], operations: [],
    state: { scopeId, sourceId, revision: 0, stateDigest: 'ab'.repeat(32), state } };
  return { overview, feed: projectR71AdminFeed({ scopeId, sourceId, sourceKeySha256, overview, generatedAtMs: T }) };
}

test('R71 browser feed rejects private extras, getters, impossible wrapper and operational claims', () => {
  for (const change of [f => { f.rawRecord = {}; }, f => { f.operationalReady = true; }, f => { f.internalCoreRetuning = true; },
    f => { f.actualBrokerPnl = 10; }, f => { f.state.activeVersion.versionId = 'private:r67-v1'; },
    f => { f.state.activeVersion.forwardPositionOpen = true; }, f => { f.state.privateJournal = []; }]) {
    const feed = structuredClone(fixture().feed); change(feed); assert.equal(isR71AdminFeed(feed), false);
  }
  const feed = structuredClone(fixture().feed); let calls = 0;
  Object.defineProperty(feed.state.activeVersion, 'forwardPositionOpen', { enumerable: true, get() { calls++; return false; } });
  assert.throws(() => requireR71AdminFeed(feed), /R71_ADMIN_FEED_INVALID/); assert.equal(calls, 0);
  assert.equal(JSON.stringify(fixture().feed).includes('journal'), false);
});

test('R71 projection rejects cross-source overview and presents incomplete comparisons without fabricated zero scores', () => {
  const f = fixture();
  assert.throws(() => projectR71AdminFeed({ scopeId, sourceId, sourceKeySha256,
    overview: { ...f.overview, sourceId: 'source:' + 'ff'.repeat(8) }, generatedAtMs: T }), /R71_ADMIN_SCOPE/);
  const overview = structuredClone(f.overview);
  overview.state.state.evaluations = [{ planId: 'plan:' + '71'.repeat(8), snapshotId: '00000000-0000-4000-8000-000000000071',
    studyDigest: '71'.repeat(32), completedAtMs: T, status: 'REJECTED_INCOMPLETE',
    summary: { expectedCases: 8, observedCases: 0, baselineMissedExistingPositionRouting: 0,
      candidateMissedExistingPositionRouting: 0, protectedCaseChanges: 0, unsupportedCandidateOutcomes: 0 },
    caseResults: [], missingCaseIds: ['case:' + '71'.repeat(8)] }];
  const feed = projectR71AdminFeed({ scopeId, sourceId, sourceKeySha256, overview, generatedAtMs: T });
  assert.equal(feed.state.lastEvaluation.summary.observedCases, 0);
  for (const k of ['baselineMissedExistingPositionRouting', 'candidateMissedExistingPositionRouting', 'protectedCaseChanges', 'unsupportedCandidateOutcomes'])
    assert.equal(feed.state.lastEvaluation.summary[k], null);
  for (const field of ['caseResults', 'missingCaseIds', 'journal']) assert.equal(JSON.stringify(feed).includes(field), false);
});
