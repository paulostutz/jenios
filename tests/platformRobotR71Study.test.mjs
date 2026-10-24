import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { makeR71StudyFixture, makeR71RegisteredFixture } from './fixtures/r71-study-fixture.mjs';
import { collectR71PrivateStudy, inspectR71PrivateStudy, r71MembershipDigest } from '../lib/platform/research/robot-r71-private-study.mjs';
import { createR71HypothesisRequest, inspectR71HypothesisResponse } from '../lib/platform/research/robot-r71-hypothesis-contract.mjs';
import { R71_POLICY, copyR71 } from '../lib/platform/research/robot-r71-policy.mjs';

test('R71 study reads all 31 contextual batches across four immutable pages', async () => {
  const f = await makeR71StudyFixture({ count: 31 });
  assert.equal(f.study.metrics.totalRecords, 31); assert.equal(f.study.metrics.totalEntries, 248);
  assert.equal(f.study.metrics.baselineMissedExistingPositionRouting, 93);
  assert.equal(f.study.metrics.protectedCaseChanges, 0);
  assert.deepEqual(f.study.hypothesis.eligibleGenerations, [0]);
  assert.deepEqual(f.calls.map(c => c.afterOrdinal), [0, 10, 20, 30]);
  assert.deepEqual(inspectR71PrivateStudy(f.study), f.study);
  assert.equal(f.study.records[0].entries[0].mode, 'manual');
});
test('R71 empty frozen study has complete coverage and no authorized hypothesis', async () => {
  const f = await makeR71StudyFixture({ count: 0 });
  assert.equal(f.study.metrics.totalEntries, 0); assert.deepEqual(f.study.hypothesis.eligibleGenerations, []);
  assert.equal(f.snapshot.membershipDigest, createHash('sha256').update('[]').digest('hex'));
});
test('R71 membership uses explicit PostgreSQL text instead of signed JSON canonicalization', () => {
  const member = { ordinal: 1, eventId: 'evt:' + 'a'.repeat(16), recordDigest: 'b'.repeat(64), annotationDigest: 'c'.repeat(64) };
  const pgText = '[{"eventId": "' + member.eventId + '", "ordinal": 1, "recordDigest": "' + member.recordDigest +
    '", "annotationDigest": "' + member.annotationDigest + '"}]';
  assert.equal(r71MembershipDigest([member]), createHash('sha256').update(pgText).digest('hex'));
  assert.notEqual(r71MembershipDigest([member]), createHash('sha256').update(JSON.stringify([member])).digest('hex'));
  assert.throws(() => r71MembershipDigest([{ ...member, ordinal: 2 }]), /R71_MEMBERSHIP/);
});
for (const mutation of ['short_page', 'wrong_cursor', 'wrong_ordinal', 'changed_snapshot', 'changed_receipt', 'changed_signature']) {
  test('R71 complete study refuses ' + mutation, async () => {
    const f = await makeR71StudyFixture({ count: 2 });
    const store = { async readStudyPage(args) {
      const page = copyR71(await f.store.readStudyPage(args));
      if (mutation === 'short_page') page.rows.pop();
      if (mutation === 'wrong_cursor') page.nextOrdinal = 1;
      if (mutation === 'wrong_ordinal') page.rows[1].ordinal = 3;
      if (mutation === 'changed_snapshot') page.snapshot.totalEntries++;
      if (mutation === 'changed_receipt') page.rows[1].receipt.admittedAtMs++;
      if (mutation === 'changed_signature') page.rows[1].record.signatureBase64 = Buffer.alloc(64, 1).toString('base64');
      return page;
    } };
    await assert.rejects(collectR71PrivateStudy({ store, snapshot: f.snapshot, trustedSource: f.trustedSource }), /R71_/);
  });
}
test('R71 frozen membership cannot silently replace a referenced batch or its digest', async () => {
  const f = await makeR71StudyFixture();
  const tampered = copyR71(f.study); tampered.records[0].recordDigest = 'f'.repeat(64);
  assert.throws(() => inspectR71PrivateStudy(tampered), /R71_STUDY_MEMBERSHIP/);
  const another = await makeR71StudyFixture();
  await assert.rejects(collectR71PrivateStudy({ store: f.store, snapshot: f.snapshot, trustedSource: another.trustedSource }), /R71_STUDY_SOURCE/);
});
test('R71 study metrics, eligibility and hypothesis cannot be supplied instead of reconstructed', async () => {
  const f = await makeR71StudyFixture();
  for (const change of [s => s.metrics.baselineMissedExistingPositionRouting++, s => s.hypothesis.eligibleGenerations.push(2),
    s => s.hypothesis.source = 'UNVERIFIED_GENERATION', s => s.records[0].entries[0].effectiveDecision.action = 'hybrid_preview']) {
    const s = copyR71(f.study); change(s); assert.throws(() => inspectR71PrivateStudy(s), /R71_/);
  }
});
test('R71 signed validation batches remain counted separately and cannot justify their own study', async () => {
  const f = await makeR71RegisteredFixture(), v = f.validationFixture;
  const snapshot = { ...f.snapshot, period: { startMs: f.plan.startsAtMs, endMs: f.plan.endsAtMs },
    frozenAtMs: f.plan.endsAtMs, membershipDigest: r71MembershipDigest([{ ordinal: 1, eventId: v.record.annotation.eventId,
      recordDigest: v.receipt.recordDigest, annotationDigest: v.receipt.annotationDigest }]) };
  const study = await collectR71PrivateStudy({ snapshot, trustedSource: f.trustedSource,
    store: { readStudyPage: async () => ({ snapshot, rows: [{ ordinal: 1, receipt: v.receipt, record: v.record }], nextOrdinal: null }) } });
  assert.equal(study.metrics.validationEntries, 8); assert.equal(study.metrics.observationEntries, 0);
  assert.equal(study.metrics.baselineMissedExistingPositionRouting, 0); assert.deepEqual(study.hypothesis.eligibleGenerations, []);
});
test('R71 provider contract accepts only a bound unapplied wrapper proposal with paid generation disabled', async () => {
  const { study } = await makeR71StudyFixture(), request = createR71HypothesisRequest(study);
  assert.equal(request.providerEnabled, false); assert.equal(request.paidProviderCalls, 0);
  assert.equal(JSON.stringify(request).includes('nativeRawOutput'), false);
  const response = { schema: 'JENIOS_R71_PRIVATE_HYPOTHESIS_RESPONSE_V1', requestDigest: request.requestDigest,
    studyDigest: study.studyDigest, proposal: { kind: R71_POLICY.kind, target: 'VERSIONED_EXTERNAL_RUNTIME_WRAPPER',
      forwardPositionOpen: true, modes: ['hybrid', 'reverse'], requiresRegisteredEvaluation: true }, status: 'PROPOSED_NOT_APPLIED' };
  assert.deepEqual(inspectR71HypothesisResponse(response, { request }), response);
  for (const change of [r => r.proposal.code = 'run()', r => r.proposal.leverage = 10,
    r => r.proposal.modes.push('manual'), r => r.status = 'APPLIED', r => r.requestDigest = '0'.repeat(64)]) {
    const bad = copyR71(response); change(bad); assert.throws(() => inspectR71HypothesisResponse(bad, { request }), /R71_HYPOTHESIS_RESPONSE/);
  }
});
