/** Offline provider boundary for the single allowed R71 proposal. No provider
 * SDK, credentials, network, execution callback or paid generation is present.
 * A structurally valid external answer is still only a proposal; the worker
 * currently uses its measured deterministic policy and registered comparison.
 */
import { inspectR71PrivateStudy } from './robot-r71-private-study.mjs';
import { R71_POLICY, copyR71, sameR71, digestR71Value, fieldsR71, freezeR71 } from './robot-r71-policy.mjs';
const fail = code => { throw Object.assign(Error(code), { code }); };
const exact = (v, keys, code) => fieldsR71(v, keys, keys, code);
export function createR71HypothesisRequest(input) {
  const study = inspectR71PrivateStudy(input);
  const request = { schema: 'JENIOS_R71_PRIVATE_HYPOTHESIS_REQUEST_V1', studyDigest: study.studyDigest,
    snapshotId: study.snapshot.snapshotId, membershipDigest: study.snapshot.membershipDigest,
    evidenceKind: 'SIGNED_PRIVATE_QA_CAPTURE', positionContext: 'EXPLICIT_SYNTHETIC_POSITION_CONTEXT',
    findings: study.findings, metrics: study.metrics.byVersion, allowedProposal: R71_POLICY.kind,
    providerEnabled: false, paidProviderCalls: 0 };
  return freezeR71({ ...request, requestDigest: digestR71Value(request) });
}
export function inspectR71HypothesisResponse(input, { request: rawRequest }) {
  const request = exact(copyR71(rawRequest), ['schema', 'studyDigest', 'snapshotId', 'membershipDigest',
    'evidenceKind', 'positionContext', 'findings', 'metrics', 'allowedProposal', 'providerEnabled', 'paidProviderCalls',
    'requestDigest'], 'R71_HYPOTHESIS_REQUEST');
  const { requestDigest, ...body } = request;
  if (request.schema !== 'JENIOS_R71_PRIVATE_HYPOTHESIS_REQUEST_V1' || requestDigest !== digestR71Value(body) ||
      request.allowedProposal !== R71_POLICY.kind || request.providerEnabled !== false || request.paidProviderCalls !== 0 ||
      request.evidenceKind !== 'SIGNED_PRIVATE_QA_CAPTURE' || request.positionContext !== 'EXPLICIT_SYNTHETIC_POSITION_CONTEXT')
    fail('R71_HYPOTHESIS_REQUEST');
  const response = exact(copyR71(input), ['schema', 'requestDigest', 'studyDigest', 'proposal', 'status'], 'R71_HYPOTHESIS_RESPONSE');
  const expected = { kind: R71_POLICY.kind, target: 'VERSIONED_EXTERNAL_RUNTIME_WRAPPER',
    forwardPositionOpen: true, modes: ['hybrid', 'reverse'], requiresRegisteredEvaluation: true };
  if (response.schema !== 'JENIOS_R71_PRIVATE_HYPOTHESIS_RESPONSE_V1' || response.requestDigest !== requestDigest ||
      response.studyDigest !== request.studyDigest || response.status !== 'PROPOSED_NOT_APPLIED' || !sameR71(response.proposal, expected))
    fail('R71_HYPOTHESIS_RESPONSE');
  return freezeR71(response);
}
