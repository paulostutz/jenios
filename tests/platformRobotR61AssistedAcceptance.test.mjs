import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateR61AssistedAcceptance } from '../lib/platform/research/robot-r61-assisted-acceptance.mjs';
import { evaluateR56ManualAdvisory } from '../lib/platform/research/robot-r56-manual-final-advisory.mjs';
import { operatorAlignmentGuard } from '../lib/platform/research/robot-r19-assisted-refinement.mjs';
import { R57_FROZEN_THRESHOLD } from '../lib/platform/research/robot-r57-hybrid-final-alignment.mjs';
import { evaluateR58Reverse } from '../lib/platform/research/robot-r58-reverse-final-stress.mjs';

const fixture = (mode, changes = {}) => ({
  source: 'synthetic_fixture', mode, operatorSide: 'buy', technicalSide: 'sell',
  confidence: 0.82, consecutiveLosses: 0, sessionDrawdownR: 0,
  operatorRequestedHelp: false, megaTrend: false, syntheticLossIfFollowedR: 0,
  ...changes,
});
const assertNoExecution = (result) => {
  assert.equal(result.executed, false);
  assert.equal(result.operatorRetainsControl, true);
  for (const flag of ['automaticModeSwitch', 'automaticEntry', 'automaticExit']) assert.equal(result[flag], false);
  for (const count of ['ordersSent', 'paperOrdersSent', 'realOrdersSent', 'externalPaperOrdersSent']) assert.equal(result[count], 0);
  for (const metric of ['actualBrokerPnl', 'actualLossesAvoided', 'realTradeAccuracy']) assert.equal(result[metric], null);
};

test('R61 Manual presents the exact R56 stressed advisory without taking control', () => {
  const input = fixture('manual', { consecutiveLosses: 4, sessionDrawdownR: 6, confidence: 0.5, operatorRequestedHelp: true });
  const result = evaluateR61AssistedAcceptance(input);
  const expected = evaluateR56ManualAdvisory(input);
  assert.deepEqual(result.policyResult, expected);
  assert.deepEqual(result.advisories, expected.advisories);
  assert.equal(result.action, 'MANUAL_CONTROL');
  assert.equal(result.suggestedSide, input.operatorSide);
  assertNoExecution(result);
});

test('R61 Manual supports an explicit synthetic calm context with no invented side or warning', () => {
  const result = evaluateR61AssistedAcceptance({ source: 'synthetic_fixture', mode: 'manual', confidence: 0.8 });
  assert.deepEqual(result.advisories, []);
  assert.equal(result.operatorSide, null);
  assert.equal(result.suggestedSide, null);
  assert.equal(result.losseshometro.hypotheticalLossAvoidedR, null);
  assertNoExecution(result);
});

test('R61 Hybrid agrees with the certified guard at and around the frozen 0.65 boundary', () => {
  assert.equal(R57_FROZEN_THRESHOLD, 0.65);
  for (const operatorSide of ['buy', 'sell']) for (const technicalSide of ['buy', 'sell']) {
    for (const confidence of [0, 0.60, 0.649999, 0.65, 0.650001, 0.91, 1]) {
      const input = fixture('hybrid', { operatorSide, technicalSide, confidence });
      const expected = operatorAlignmentGuard(input);
      const result = evaluateR61AssistedAcceptance(input);
      assert.deepEqual(result.policyResult, expected);
      assert.equal(result.alignmentGuardThreshold, R57_FROZEN_THRESHOLD);
      assert.equal(result.action, expected.intervene ? 'ADVISE_REVIEW' : 'KEEP_OPERATOR_DECISION');
      assert.equal(result.suggestedSide, expected.intervene ? technicalSide : operatorSide);
      assertNoExecution(result);
    }
  }
});

test('R61 Hybrid advises review on disagreement but does not transform the mode into Reverse', () => {
  const result = evaluateR61AssistedAcceptance(fixture('hybrid'));
  assert.equal(result.mode, 'hybrid');
  assert.equal(result.action, 'ADVISE_REVIEW');
  assert.deepEqual(result.reasons, ['MATERIAL_DISAGREEMENT']);
  assert.equal(result.losseshometro.hypotheticalLossAvoidedR, null);
  assertNoExecution(result);
});

test('R61 Reverse delegates all selective, megatrend and confidence decisions to R58', () => {
  for (const operatorSide of ['buy', 'sell']) for (const technicalSide of ['buy', 'sell']) {
    for (const confidence of [0.55, 0.649999, 0.65, 0.85, 1]) for (const megaTrend of [false, true]) {
      const input = fixture('reverse', { operatorSide, technicalSide, confidence, megaTrend, consecutiveLosses: 4, syntheticLossIfFollowedR: 1.23456789 });
      const expected = evaluateR58Reverse({ ...input, lossStreak: input.consecutiveLosses });
      const result = evaluateR61AssistedAcceptance(input);
      assert.deepEqual(result.policyResult, expected);
      assert.equal(result.suggestedSide, expected.suggestedSide);
      assert.deepEqual(result.reasons, expected.reasons);
      assert.equal(result.action, expected.reverseReference ? 'REVERSE_REFERENCE' : 'KEEP_OPERATOR_DECISION');
      assert.equal(result.losseshometro.hypotheticalLossAvoidedR, expected.hypotheticalLossAvoidedR);
      assertNoExecution(result);
    }
  }
});

test('R61 losseshometro keeps R58 hypothetical R units and cannot create actual avoided losses', () => {
  const result = evaluateR61AssistedAcceptance(fixture('reverse', { consecutiveLosses: 4, syntheticLossIfFollowedR: 2.4 }));
  assert.equal(result.losseshometro.hypotheticalLossAvoidedR, 2.4);
  assert.equal(result.losseshometro.classification, 'SYNTHETIC_ONLY');
  assert.equal(result.losseshometro.unit, 'R');
  assert.equal(result.provenance.kind, 'SYNTHETIC_FIXTURE');
  assert.equal(result.provenance.marketObservation, false);
  assertNoExecution(result);
});

test('R61 rejects live provenance, unsupported modes, unknown fields and malformed policy inputs', () => {
  const invalid = [
    undefined, null, [], 'manual',
    fixture('unknown'), fixture('hybrid', { source: 'live_market' }),
    fixture('hybrid', { source: undefined }), fixture('hybrid', { confidence: NaN }),
    fixture('hybrid', { confidence: Infinity }), fixture('hybrid', { confidence: -0.01 }),
    fixture('hybrid', { confidence: 1.01 }), fixture('hybrid', { confidence: '0.82' }),
    fixture('hybrid', { operatorSide: null }), fixture('reverse', { technicalSide: null }),
    fixture('manual', { operatorSide: 'BUY' }), fixture('manual', { consecutiveLosses: 1.5 }),
    fixture('manual', { consecutiveLosses: -1 }), fixture('manual', { sessionDrawdownR: NaN }),
    fixture('manual', { sessionDrawdownR: -1 }), fixture('manual', { operatorRequestedHelp: 'true' }),
    fixture('reverse', { megaTrend: 1 }), fixture('reverse', { syntheticLossIfFollowedR: -1 }),
    fixture('reverse', { syntheticLossIfFollowedR: '2' }), fixture('reverse', { alignmentGuardThreshold: 0.50 }),
    fixture('manual', { actualBrokerPnl: 1 }), fixture('manual', { execute: true }),
  ];
  for (const input of invalid) assert.throws(() => evaluateR61AssistedAcceptance(input), (error) =>
    error.name === 'ValidationError' && /^R61_ASSISTED_(INVALID_INPUT|UNKNOWN_FIELD)$/.test(error.code));
});

test('R61 requires provenance on every invocation and cannot retain a previous successful decision', () => {
  const input = fixture('reverse', { confidence: 0.9 });
  assert.equal(evaluateR61AssistedAcceptance(input).action, 'REVERSE_REFERENCE');
  const changed = { ...input, confidence: 0.1 };
  assert.equal(evaluateR61AssistedAcceptance(changed).action, 'KEEP_OPERATOR_DECISION');
  delete changed.source;
  assert.throws(() => evaluateR61AssistedAcceptance(changed), { code: 'R61_ASSISTED_INVALID_INPUT' });
});

test('R61 input is not mutated and returned evidence is immutable and JSON serializable', () => {
  for (const mode of ['manual', 'hybrid', 'reverse']) {
    const input = Object.freeze(fixture(mode, { consecutiveLosses: 4 }));
    const before = JSON.stringify(input);
    const result = evaluateR61AssistedAcceptance(input);
    assert.equal(JSON.stringify(input), before);
    assert.deepEqual(JSON.parse(JSON.stringify(result)), result);
    assert.throws(() => { result.executed = true; }, TypeError);
    assert.throws(() => { result.provenance.kind = 'LIVE'; }, TypeError);
    assert.throws(() => { result.losseshometro.classification = 'REAL'; }, TypeError);
    assert.throws(() => result.reasonCodes.push('OVERRIDE'), TypeError);
    assertNoExecution(result);
  }
});
