import test from 'node:test';import assert from 'node:assert/strict';
import {auditOriginalHoldoutEvidence,B182_RESEARCH_EVIDENCE} from '../lib/platform/connections/b194-performance-acceptance.mjs';
const core=B182_RESEARCH_EVIDENCE.originalCoreSha256;
test('B194 B182 frozen historical evidence remains NO-GO on original core despite isolated positive results',()=>{
 assert.equal(B182_RESEARCH_EVIDENCE.positiveCellsAtZeroBps,2);
 assert.equal(B182_RESEARCH_EVIDENCE.positiveCellsAtTenBps,1);
 assert.equal(B182_RESEARCH_EVIDENCE.positiveCellsAtThirtyBps,1);
 assert.equal(B182_RESEARCH_EVIDENCE.robustNetPerformanceDemonstrated,false);
 const r=auditOriginalHoldoutEvidence({originalCoreSha256:core,frozenHoldout:true,rows:[]});
 assert.equal(r.classification,'RESEARCH_ONLY_NO_GO');assert.equal(r.liveExecutionAuthorized,false);
});
const modes=['direct','reverse','hybrid'],assets=['BTCUSDT','ETHUSDT','SOLUSDT'],costs=[0,10,30];
const rows=modes.flatMap(mode=>assets.flatMap(asset=>costs.map(costBps=>({mode,asset,costBps,trades:30,
 netR:1,drawdownR:2,sample:'prospective'}))));
test('B194 even all-positive but unsourced prospective cells cannot claim certified original robot results',()=>{
 const r=auditOriginalHoldoutEvidence({originalCoreSha256:core,frozenHoldout:true,rows});
 assert.equal(r.classification,'RESEARCH_ONLY_NO_GO');assert.equal(r.independentDataProvenance,false);
 assert.equal(r.robotPerformanceCertified,false);assert.equal(r.liveExecutionAuthorized,false);
});
test('B194 every cost cell must be measured: any negative or zero scenario blocks robustness',()=>{
 const copy=structuredClone(rows);copy[13].netR=-1;
 const r=auditOriginalHoldoutEvidence({originalCoreSha256:core,frozenHoldout:true,rows:copy,
 independentProviderWitness:true,prospectiveWindowCertified:true});
 assert.equal(r.classification,'RESEARCH_ONLY_NEGATIVE_OR_MIXED');assert.equal(r.counts.negativeOrZeroCells,1);
 assert.equal(r.liveExecutionAuthorized,false);
});
test('B194 even independent positive scenario grid still requires human/independent review, never automatically authorizes orders',()=>{
 const r=auditOriginalHoldoutEvidence({originalCoreSha256:core,frozenHoldout:true,rows,
 independentProviderWitness:true,prospectiveWindowCertified:true});
 assert.equal(r.classification,'REQUIRES_MANUAL_INDEPENDENT_REVIEW');
 assert.equal(r.robotPerformanceCertified,false);assert.equal(r.independentDataProvenance,false);
 assert.equal(r.liveExecutionAuthorized,false);
});
test('B194 duplicate cell, missing cell, unknown mode and tampered original SHA fail closed',()=>{
 const evidence={originalCoreSha256:core,frozenHoldout:true,rows};
 assert.equal(auditOriginalHoldoutEvidence({...evidence,rows:rows.slice(1)}).reason,'INCOMPLETE_STRATEGY_GRID');
 assert.equal(auditOriginalHoldoutEvidence({...evidence,rows:[...rows.slice(1),rows[1]]}).reason,'DUPLICATE_HOLDOUT_CELL');
 assert.equal(auditOriginalHoldoutEvidence({...evidence,rows:[{...rows[0],mode:'invented'},...rows.slice(1)]}).reason,'INVALID_STRATEGY_CELL');
 assert.equal(auditOriginalHoldoutEvidence({...evidence,originalCoreSha256:'f'.repeat(64)}).reason,'FROZEN_CORE_AND_HOLDOUT_REQUIRED');
});
