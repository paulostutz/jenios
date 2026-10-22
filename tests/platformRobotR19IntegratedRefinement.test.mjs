import test from 'node:test';import assert from 'node:assert/strict';
import {ultrafastEntitlement} from '../lib/platform/ultrafast-entitlement.mjs';
import {operatorAlignmentGuard,refineAssistedDecision} from '../lib/platform/research/robot-r19-assisted-refinement.mjs';
import {runR19MicrostructureLab} from '../lib/platform/research/robot-r19-ultrafast-microstructure.mjs';
test('R19 UltraFast entitlement starts at Global Crypto',()=>{
 assert.equal(ultrafastEntitlement('platform-nacional').allowed,false);
 assert.equal(ultrafastEntitlement('platform-global-crypto').allowed,true);
 assert.equal(ultrafastEntitlement('platform-internacional-pro').allowed,true);
});
test('R19 alignment guard avoids harming already aligned operator',()=>{
 const g=operatorAlignmentGuard({operatorSide:'buy',technicalSide:'buy',confidence:.9});
 assert.equal(g.intervene,false);assert.equal(g.aligned,true);
 assert.equal(refineAssistedDecision({mode:'hybrid',operatorSide:'buy',technicalSide:'buy',confidence:.9}).action,'KEEP_OPERATOR_DECISION');
});
test('R19 hybrid advises and reverse references only on material disagreement',()=>{
 assert.equal(refineAssistedDecision({mode:'hybrid',operatorSide:'buy',technicalSide:'sell',confidence:.9}).action,'ADVISE_REVIEW');
 assert.equal(refineAssistedDecision({mode:'reverse',operatorSide:'buy',technicalSide:'sell',confidence:.9}).action,'REVERSE_REFERENCE');
});
test('R19 microstructure lab covers a large cost-aware matrix with zero execution',()=>{
 const x=runR19MicrostructureLab();
 assert.ok(x.total>100000);assert.ok(x.eligible>0);assert.ok(x.preview>0);assert.ok(x.costBlocked>0);assert.ok(x.staleBlocked>0);
 assert.equal(x.ordersSent,0);assert.equal(x.paperOrdersSent,0);assert.equal(x.actualBrokerPnl,null);
});
