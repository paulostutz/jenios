import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeFeeEvidence,effectiveUltrafastCost} from '../lib/platform/research/robot-r26-fee-evidence.mjs';
import {nextRecoveryState,recoverToReady} from '../lib/platform/research/robot-r26-recovery-state.mjs';

test('R26 fee evidence never treats official schedule reference as customer tier verification',()=>{
 const e=normalizeFeeEvidence({kind:'official_schedule_reference',provider:'kraken',makerBps:25,takerBps:40,
   sourceLabel:'Kraken official fee schedule reference',observedAtMs:1,accountTierVerified:false});
 assert.equal(e.accountTierVerified,false);
 const c=effectiveUltrafastCost({feeEvidence:e,spreadBps:2,slippageBps:1});
 assert.equal(c.commercialFeeClaimAllowed,false);assert.equal(c.actualBrokerPnl,null);
});

test('R26 verified account tier requires explicit verified flag',()=>{
 assert.throws(()=>normalizeFeeEvidence({kind:'verified_account_tier',provider:'coinbase',makerBps:10,takerBps:20,
   sourceLabel:'account tier',observedAtMs:1,accountTierVerified:false}),/R26_UNVERIFIED_ACCOUNT_TIER/);
});

test('R26 synthetic stress profile cannot masquerade as verified account tier',()=>{
 assert.throws(()=>normalizeFeeEvidence({kind:'synthetic_stress',provider:'generic',makerBps:1,takerBps:2,
   sourceLabel:'stress',observedAtMs:1,accountTierVerified:true}),/R26_SYNTHETIC_MUST_NOT_VERIFY_ACCOUNT/);
});

test('R26 recovery blocks entries until every reconciliation stage completes',()=>{
 let x=nextRecoveryState('HALTED',{});assert.equal(x.state,'RECONNECTING');assert.equal(x.newEntriesAllowed,false);
 x=nextRecoveryState('RECONNECTING',{transportConnected:true});assert.equal(x.state,'MARKET_RESYNC');
 x=nextRecoveryState('MARKET_RESYNC',{marketDataFresh:true,sequenceContinuous:true});assert.equal(x.state,'ACCOUNT_RECONCILE');
 x=nextRecoveryState('ACCOUNT_RECONCILE',{openOrdersKnown:true,positionsKnown:true});assert.equal(x.state,'RISK_RECONCILE');
 x=nextRecoveryState('RISK_RECONCILE',{riskLedgerMatches:true,unknownExposure:false});assert.equal(x.state,'READY');assert.equal(x.newEntriesAllowed,true);
});

test('R26 unknown exposure prevents READY',()=>{
 const r=recoverToReady([
  {transportConnected:true},
  {marketDataFresh:true,sequenceContinuous:true},
  {openOrdersKnown:true,positionsKnown:true},
  {riskLedgerMatches:true,unknownExposure:true}
 ]);
 assert.equal(r.finalState,'RISK_RECONCILE');assert.equal(r.newEntriesAllowed,false);assert.equal(r.ordersSent,0);
});

test('R26 complete recovery trace reaches READY with zero transport',()=>{
 const r=recoverToReady([
  {transportConnected:true},
  {marketDataFresh:true,sequenceContinuous:true},
  {openOrdersKnown:true,positionsKnown:true},
  {riskLedgerMatches:true,unknownExposure:false}
 ]);
 assert.equal(r.finalState,'READY');assert.equal(r.newEntriesAllowed,true);
 assert.equal(r.ordersSent,0);assert.equal(r.paperOrdersSent,0);
});
