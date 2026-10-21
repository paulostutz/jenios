import test from 'node:test';import assert from 'node:assert/strict';
import {inspectProspectiveSignalWindow} from '../lib/platform/launch/b226-prospective-witness-review.mjs';
const nowMs=1792530000000,rows=['direct','reverse','hybrid'].map((mode,i)=>({eventId:'signal-'+i,mode,asset:'BTCUSDT',
 signalAtMs:nowMs-100000+i*10000,closeAtMs:nowMs-90000+i*10000,
 recordedAtMs:nowMs-80000+i*10000,realOrder:false,predictedProfit:null}));
test('B226 all modes included but no external attestation or performance certificate',()=>{
 const r=inspectProspectiveSignalWindow(rows,{nowMs});assert.equal(r.minimumThreeModesCovered,true);
 assert.equal(r.independentClockWitnessed,false);assert.equal(r.netProfitCertified,false);
});
test('B226 rejects lookahead and duplicates',()=>{
 assert.throws(()=>inspectProspectiveSignalWindow(rows.map((x,i)=>i===1?{...x,signalAtMs:x.closeAtMs}:x),{nowMs}),/B226_INVALID_OR_LOOKAHEAD_SIGNAL/);
 assert.throws(()=>inspectProspectiveSignalWindow(rows.map((x,i)=>i===1?{...x,eventId:rows[0].eventId}:x),{nowMs}),/B226_DUPLICATE_SIGNAL/);
});
