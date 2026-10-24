/**
 * R61 — browser-safe adapter for synthetic, interactive acceptance.
 * The certified policy modules remain authoritative; this adapter only validates
 * the input envelope and presents their outputs without any order transport.
 */
import { evaluateR56ManualAdvisory } from './robot-r56-manual-final-advisory.mjs';
import { operatorAlignmentGuard } from './robot-r19-assisted-refinement.mjs';
import { R57_FROZEN_THRESHOLD } from './robot-r57-hybrid-final-alignment.mjs';
import { evaluateR58Reverse } from './robot-r58-reverse-final-stress.mjs';

const allowedKeys = new Set([
  'source', 'mode', 'operatorSide', 'technicalSide', 'confidence',
  'consecutiveLosses', 'sessionDrawdownR', 'operatorRequestedHelp',
  'megaTrend', 'syntheticLossIfFollowedR',
]);
const finite = (value) => typeof value === 'number' && Number.isFinite(value);
const fail = (code) => {
  const error = new Error(code);
  error.name = 'ValidationError';
  error.code = code;
  throw error;
};
const optional = (input, key, fallback) => Object.hasOwn(input, key) ? input[key] : fallback;

function parseInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(input))) {
    fail('R61_ASSISTED_INVALID_INPUT');
  }
  if (Reflect.ownKeys(input).some((key) => typeof key !== 'string' || !allowedKeys.has(key))) {
    fail('R61_ASSISTED_UNKNOWN_FIELD');
  }
  const values = {
    source: input.source,
    mode: input.mode,
    operatorSide: optional(input, 'operatorSide', null),
    technicalSide: optional(input, 'technicalSide', null),
    confidence: input.confidence,
    consecutiveLosses: optional(input, 'consecutiveLosses', 0),
    sessionDrawdownR: optional(input, 'sessionDrawdownR', 0),
    operatorRequestedHelp: optional(input, 'operatorRequestedHelp', false),
    megaTrend: optional(input, 'megaTrend', false),
    syntheticLossIfFollowedR: optional(input, 'syntheticLossIfFollowedR', 0),
  };
  if (values.source !== 'synthetic_fixture' ||
      !['manual', 'hybrid', 'reverse'].includes(values.mode) ||
      !finite(values.confidence) || values.confidence < 0 || values.confidence > 1 ||
      ![null, 'buy', 'sell'].includes(values.operatorSide) ||
      ![null, 'buy', 'sell'].includes(values.technicalSide) ||
      (values.mode !== 'manual' && (!values.operatorSide || !values.technicalSide)) ||
      !Number.isSafeInteger(values.consecutiveLosses) || values.consecutiveLosses < 0 ||
      !finite(values.sessionDrawdownR) || values.sessionDrawdownR < 0 ||
      typeof values.operatorRequestedHelp !== 'boolean' ||
      typeof values.megaTrend !== 'boolean' ||
      !finite(values.syntheticLossIfFollowedR) || values.syntheticLossIfFollowedR < 0) {
    fail('R61_ASSISTED_INVALID_INPUT');
  }
  return values;
}

export function evaluateR61AssistedAcceptance(input) {
  const values = parseInput(input);
  let policyResult;
  let action;
  let suggestedSide = values.operatorSide;
  let advisories = Object.freeze([]);
  let reasons = Object.freeze([]);
  let policyModules;
  let hypotheticalLossAvoidedR = null;

  if (values.mode === 'manual') {
    policyResult = evaluateR56ManualAdvisory({
      consecutiveLosses: values.consecutiveLosses,
      sessionDrawdownR: values.sessionDrawdownR,
      confidence: values.confidence,
      operatorRequestedHelp: values.operatorRequestedHelp,
    });
    action = 'MANUAL_CONTROL';
    advisories = policyResult.advisories;
    policyModules = ['R56_MANUAL_ADVISORY'];
  } else if (values.mode === 'hybrid') {
    // The exact guard reused by the R57 frozen-policy battery.
    policyResult = operatorAlignmentGuard({
      operatorSide: values.operatorSide,
      technicalSide: values.technicalSide,
      confidence: values.confidence,
    });
    action = policyResult.intervene ? 'ADVISE_REVIEW' : 'KEEP_OPERATOR_DECISION';
    suggestedSide = policyResult.intervene ? values.technicalSide : values.operatorSide;
    reasons = Object.freeze([policyResult.reason]);
    policyModules = ['R19_OPERATOR_ALIGNMENT_GUARD', 'R57_FROZEN_POLICY'];
  } else {
    policyResult = evaluateR58Reverse({
      operatorSide: values.operatorSide,
      technicalSide: values.technicalSide,
      confidence: values.confidence,
      megaTrend: values.megaTrend,
      lossStreak: values.consecutiveLosses,
      syntheticLossIfFollowedR: values.syntheticLossIfFollowedR,
    });
    action = policyResult.reverseReference ? 'REVERSE_REFERENCE' : 'KEEP_OPERATOR_DECISION';
    suggestedSide = policyResult.suggestedSide;
    reasons = policyResult.reasons;
    hypotheticalLossAvoidedR = policyResult.hypotheticalLossAvoidedR;
    policyModules = ['R58_SELECTIVE_REVERSE'];
  }

  return Object.freeze({
    schema: 'JENIOS_R61_ASSISTED_ACCEPTANCE_V1',
    source: 'synthetic_fixture',
    mode: values.mode,
    action,
    operatorSide: values.operatorSide,
    suggestedSide,
    advisories,
    reasons,
    reasonCodes: Object.freeze([...new Set([...reasons, ...advisories])]),
    policyResult,
    alignmentGuardThreshold: R57_FROZEN_THRESHOLD,
    provenance: Object.freeze({
      kind: 'SYNTHETIC_FIXTURE',
      policyModules: Object.freeze(policyModules),
      marketObservation: false,
    }),
    losseshometro: Object.freeze({
      classification: 'SYNTHETIC_ONLY',
      unit: 'R',
      hypotheticalLossAvoidedR,
    }),
    operatorRetainsControl: true,
    automaticModeSwitch: false,
    automaticEntry: false,
    automaticExit: false,
    executed: false,
    ordersSent: 0,
    paperOrdersSent: 0,
    realOrdersSent: 0,
    externalPaperOrdersSent: 0,
    actualBrokerPnl: null,
    actualLossesAvoided: null,
    realTradeAccuracy: null,
  });
}
