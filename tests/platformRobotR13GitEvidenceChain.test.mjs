import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {canonical} from '../lib/platform/pilot-prep/contracts.mjs';
import {auditR13GitEvidenceChain,R13_GIT_EVIDENCE_PROTOCOL}
 from '../lib/platform/research/robot-r13-git-evidence-chain.mjs';
import {readFileSync} from 'node:fs';

const OPEN=Date.parse('2026-10-22T13:00:00Z'),CLOSE=OPEN+3600000;
const sha=o=>createHash('sha256').update(canonical(o)).digest('hex');
const orig=()=>({
 schema:'JENIOS_R9_PRIVATE_ORIGINAL_PRECOMMIT_V1',
 studyId:'R9-20261022-FORWARD-ORIGINAL-CORE',asset:'BTC-USD',
 targetOpenMs:OPEN,targetCloseMs:CLOSE,
 capturedAtMs:1792671455651,decidedAtMs:1792671583754,registeredAtMs:1792671583754,
 engineSha256:'9341d9243cbe742b90bf40149663e632fc472f5586c74bf70bdfcfd114e65aea',
 serviceSha256:'cbb92005459f79bf6e23a0edc7c5542cc62b632b6c301e3f23b98ebd514ce5be',
 inputSha256:'e5fbb979bdd09b1ecf37808f4b4ae4c8c06d8834149e67df034c05591c1a28ee',
 modeResults:['manual','hybrid','reverse'].flatMap(mode=>
  ['buy','sell'].map(intent=>({mode,intent,action:'wait_for_context',side:null}))),
 originalCorePrivate:true,liveExecutionDisabled:true,ordersSent:0
});
const pub=()=>({
 schema:'JENIOS_R9_PUBLIC_HASH_ONLY_FORWARD_PRIVATE_ORIGINAL_V1',
 studyId:'R9-20261022-FORWARD-ORIGINAL-CORE',
 commitmentSha256:'2b9734aada05ad3fcbfbcb9f0d24859dfd17547cb9e16d3424c27681fb21a36d',
 publicContextInputSha256:'c03c70d57d59699b936f9d2996833f1a4bd021fe34296c8e8aae24578ca3d726',
 originalCoreEngineSha256:'9341d9243cbe742b90bf40149663e632fc472f5586c74bf70bdfcfd114e65aea',
 originalCoreServiceSha256:'cbb92005459f79bf6e23a0edc7c5542cc62b632b6c301e3f23b98ebd514ce5be',
 declaredCapturedAtMs:1792671455651,declaredPrivateCalculatedAtMs:1792671583754,
 declaredPrivateRegisteredAtMs:1792671583754,
 futureTargetOpenMs:OPEN,futureTargetCloseMs:CLOSE,
 isCommitmentNotResult:true,futureOutcomeKnownAtPublication:false,ordersSent:0,paperOrdersSent:0
});
const git=()=>({commitSha:R13_GIT_EVIDENCE_PROTOCOL.publicCommitSha,
 committedAtUtc:R13_GIT_EVIDENCE_PROTOCOL.publicCommitAtUtc,
 origin:'GITHUB_COMMIT_METADATA_NOT_RUNTIME_ATTESTATION'});
const objectEvidence=()=>({
 commitSha:R13_GIT_EVIDENCE_PROTOCOL.publicCommitSha,
 filePath:R13_GIT_EVIDENCE_PROTOCOL.publicFilePath,
 blobSha:R13_GIT_EVIDENCE_PROTOCOL.publicFileBlobSha,
 committedAtUtc:R13_GIT_EVIDENCE_PROTOCOL.publicCommitAtUtc,
 source:'GITHUB_COMMIT_AND_BLOB_METADATA'
});
const fixture=()=>({privateRecord:orig(),publicRecord:pub(),gitMetadata:git(),
 gitObjectEvidence:objectEvidence(),reviewedAtMs:CLOSE+3600000});

test('R13 pins the real R9 Git commit and blob while preserving NO-GO semantics',()=>{
 const f=fixture();
 assert.equal(sha(f.privateRecord),f.publicRecord.commitmentSha256);
 const out=auditR13GitEvidenceChain(f);
 assert.equal(out.gitPublicArtifactIdentityPinned,true);
 assert.equal(out.publicFileBlobSha,'a79156e31e328771481a63f92e9f210716bc9c21');
 assert.equal(out.independentRuntimeAttestationVerified,false);
 assert.equal(out.independentMarketEvidenceVerified,false);
 assert.equal(out.actualBrokerRealizedPnl,null);
 assert.equal(out.actualLossesAvoided,null);
 assert.equal(out.tradeAccuracy,null);
 assert.equal(out.decision,'R13_GIT_CHAIN_VERIFIED_NO_INDEPENDENT_MARKET_EVIDENCE');
});

test('R13 rejects altered Git commit, path, blob, timestamp or source identity',()=>{
 const f=fixture();
 for(const patch of [
  {commitSha:'0'.repeat(40)},
  {filePath:'docs/platform/evidence/other.json'},
  {blobSha:'0'.repeat(40)},
  {committedAtUtc:'2026-10-22T12:21:00.000Z'},
  {source:'CALLER_ASSERTION'}
 ]) assert.throws(()=>auditR13GitEvidenceChain({
  ...f,gitObjectEvidence:{...f.gitObjectEvidence,...patch}
 }),e=>e?.code==='R13_GIT_OBJECT_IDENTITY_MISMATCH');
});

test('R13 still rejects altered R9 private/public evidence through R12 gates',()=>{
 const f=fixture();
 assert.throws(()=>auditR13GitEvidenceChain({
  ...f,privateRecord:{...f.privateRecord,ordersSent:1}
 }));
 assert.throws(()=>auditR13GitEvidenceChain({
  ...f,publicRecord:{...f.publicRecord,paperOrdersSent:1}
 }));
});

test('R13 source has no network, broker, secrets, paid AI or proprietary engine import',()=>{
 const source=readFileSync(new URL('../lib/platform/research/robot-r13-git-evidence-chain.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(source,/\bfetch\s*\(|submitOrder|createOrder|OPENAI_API_KEY|process\.env|original-core|private-core/i);
 const v=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8'));
 assert.equal(v.git.deploymentEnabled['fix/jenios-robot-r13-git-evidence-chain-20261022'],false);
});
