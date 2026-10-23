import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {certifyR59Ledger} from '../lib/platform/research/robot-r59-final-certification.mjs';

const ledger=JSON.parse(fs.readFileSync(new URL('../docs/platform/evidence/ROBOT_MASTER_PERFORMANCE_LEDGER.json',import.meta.url),'utf8'));

test('R59 final ledger certification passes permanent invariants',()=>{
 const x=certifyR59Ledger(ledger);
 assert.equal(x.pass,true);
 assert.equal(x.classification,'RESEARCH_CERTIFIED_FINAL');
 assert.equal(x.productionApproved,false);
 assert.equal(x.commercialPerformanceCertified,false);
 assert.equal(x.realOrdersSent,0);
 assert.equal(x.externalPaperOrdersSent,0);
 assert.equal(x.actualBrokerPnl,null);
 assert.equal(x.actualLossesAvoided,null);
 assert.equal(x.realTradeAccuracy,null);
});

test('R59 fails closed if alignment threshold changes',()=>{
 const clone=structuredClone(ledger);
 clone.robots.find(r=>r.robot==='hybrid').alignmentGuardThreshold=.5;
 const x=certifyR59Ledger(clone);
 assert.equal(x.pass,false);
 assert.ok(x.issues.includes('HYBRID_ALIGNMENT_THRESHOLD_CHANGED'));
});

test('R59 fails closed if synthetic losseshometer is mislabeled',()=>{
 const clone=structuredClone(ledger);
 clone.robots.find(r=>r.robot==='reverse').finalRefinement.r58.losseshometroSyntheticOnly=false;
 const x=certifyR59Ledger(clone);
 assert.equal(x.pass,false);
 assert.ok(x.issues.includes('LOSSESHOMETRO_NOT_SYNTHETIC_ONLY'));
});

test('R59 fails closed if real execution flag changes',()=>{
 const clone=structuredClone(ledger);
 clone.globalRules.realOrdersSent=1;
 const x=certifyR59Ledger(clone);
 assert.equal(x.pass,false);
 assert.ok(x.issues.includes('REAL_ORDERS_NOT_ZERO'));
});