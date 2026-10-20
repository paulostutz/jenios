import test from 'node:test';import assert from 'node:assert/strict';
import {paperOrderProposal,prepareBinancePaperOrder,sendPaperOrder,sendRealOrder} from '../lib/platform/connections/paper-order-proposal.mjs';
import {CORE_SHA} from '../lib/platform/pilot-prep/contracts.mjs';
const arg={provider:'alpaca',environment:'paper',userId:'testuser-a',mode:'direct',signal:{originalCoreSha256:CORE_SHA.engine,executionEnabled:false,mode:'direct',side:'buy',contextDigest:'a'.repeat(64),reviewStatus:'allow'},order:{clientOrderId:'paper-0001',symbol:'AAPL',side:'buy',quantity:'1',entry:'150.00',stop:'149.00',target:'153.00'},source:{provider:'alpaca',environment:'paper',accountAuthenticated:true,ownershipVerified:true,permissionsVerified:true,marketDataVerified:true,prospective:true,liveAccount:false}};
const propose=(patch={})=>paperOrderProposal({...arg,...patch});
test('B172 paper bracket proposal does not send or reserve risk',()=>{const r=propose();assert.equal(r.body.order_class,'bracket');assert.equal(r.body.time_in_force,'day');assert.equal(r.body.stop_loss.stop_price,'149.00');assert.equal(r.body.client_order_id,'paper-0001');assert.equal(r.sent,false);assert.equal(r.canSubmit,false);assert.equal(r.ledgerRiskReserved,false);assert.equal(r.ordersSent,0);assert.equal(r.conceptualStopRiskUnits,'100000000');assert.equal(r.conceptualNotionalUnits,'15000000000');assert.equal(r.proposalDigest.length,64);});
test('B172 reverse and hybrid modes require the matching original signal',()=>{for(const mode of ['reverse','hybrid']){const x=propose({mode,signal:{...arg.signal,mode}});assert.equal(x.engineMode,mode)}assert.throws(()=>propose({mode:'reverse'}),/ORIGINAL_CORE_REVIEW_REQUIRED/);});
for(const p of [
 {order:{...arg.order,entry:'150.001'}},
 {order:{...arg.order,stop:'151.00'}},
 {order:{...arg.order,target:'149.00'}},
 {order:{...arg.order,quantity:'0'}},
 {provider:'binance'},
 {environment:'live'},
 {signal:{...arg.signal,executionEnabled:true}},
 {source:{...arg.source,permissionsVerified:false}},
 {source:{...arg.source,ownershipVerified:false}},
 {source:{...arg.source,prospective:false}},
 {source:{...arg.source,liveAccount:true}}
])test('B172 invalid condition fails closed '+JSON.stringify(p),()=>assert.throws(()=>propose(p)));
test('B172 Binance spot and all order transports remain explicitly closed',()=>{assert.throws(()=>prepareBinancePaperOrder(),/BINANCE_SPOT_ATOMIC_PROTECTION_NOT_CERTIFIED/);assert.throws(()=>sendPaperOrder(),/PAPER_ORDER_SENDER_DISABLED/);assert.throws(()=>sendRealOrder(),/REAL_ORDER_SENDER_DISABLED/);});
