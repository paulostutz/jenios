/** Public, self-generated protocol keys and deployment declarations only.
 * No original executable, hosted deployment or independent identity evidence.
 */
import { generateKeyPairSync } from 'node:crypto';
import { R67_EVIDENCE, r67SourceKeyDigest } from '../../lib/platform/research/robot-r67-private-protocol.mjs';
import { R70_TARGET_PINS_SCHEMA } from '../../lib/platform/research/robot-r70-preflight-protocol.mjs';

export function createR70PreflightFixture({ origin = 'https://r70-fixture.vercel.app' } = {}) {
  const pair = generateKeyPairSync('ed25519');
  const privateKeyPem = pair.privateKey.export({ type: 'pkcs8', format: 'pem' });
  const trustedSource = { scopeId: 'scope:7070707070707070', sourceId: 'source:7070707070707070',
    publicKeyPem: pair.publicKey.export({ type: 'spki', format: 'pem' }), enabled: true, evidenceKind: R67_EVIDENCE };
  const targetPins = { schema: R70_TARGET_PINS_SCHEMA, origin, projectId: 'prj_r70PublicFixture',
    deploymentId: 'dpl_r70PublicFixture', commitSha: '70'.repeat(20), scopeId: trustedSource.scopeId,
    sourceId: trustedSource.sourceId, sourceKeySha256: r67SourceKeyDigest(trustedSource) };
  const env = { VERCEL_ENV: 'preview', VERCEL_TARGET_ENV: 'preview', VERCEL_URL: new URL(origin).host,
    VERCEL_PROJECT_ID: targetPins.projectId, VERCEL_DEPLOYMENT_ID: targetPins.deploymentId,
    VERCEL_GIT_COMMIT_SHA: targetPins.commitSha, JENIOS_QA_CANDIDATE_ENABLED: 'true', JENIOS_ROBOT_QA_ENABLED: 'true',
    JENIOS_ROBOT_R67_ENABLED: 'true', JENIOS_ROBOT_R70_PREFLIGHT_ENABLED: 'true',
    JENIOS_ROBOT_ANALYST_PAID_ENABLED: 'false', JENIOS_REAL_EXECUTION_ENABLED: 'false',
    JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED: 'false', JENIOS_PRIVATE_PAPER_EXECUTOR: 'false',
    JENIOS_ROBOT_R67_SCOPE_ID: trustedSource.scopeId, JENIOS_ROBOT_R67_SOURCE_ID: trustedSource.sourceId,
    JENIOS_ROBOT_R67_SOURCE_PUBLIC_KEY: trustedSource.publicKeyPem };
  return { targetPins, trustedSource, privateKeyPem, env,
    evidence: 'SELF_GENERATED_PUBLIC_PREFLIGHT_PROTOCOL_FIXTURE_NOT_DEPLOYMENT_ATTESTATION' };
}
