import test from 'node:test';import assert from 'node:assert/strict';
import {inspectCustomerReadRevocation} from '../lib/platform/release250/b243-revocation-observer.mjs';
const now=1792540000000;
const account={provider:'alpaca',environment:'paper',status:'active'};
const snapshot={provider:'alpaca',environment:'paper',complete:true,accountReadConfirmed:true,observedAtMs:now,
 positions:[{key:'position-AAPL',symbol:'AAPL',side:'long',quantity:'2'}],openOrders:[{key:'order-X',symbol:'AAPL',side:'sell',status:'new',quantity:'2',filledQuantity:'0'}]};
test('B243 disappeared open order is not proof of fill or cancellation',()=>{
 const next={...snapshot,observedAtMs:now+1000,openOrders:[]};
 const r=inspectCustomerReadRevocation({connection:account,previousSnapshot:snapshot,currentSnapshot:next});
 assert.equal(r.missingOpenOrders,1);assert.equal(r.state,'REVIEW_REQUIRED');assert.equal(r.missingDoesNotImplyFill,true);
 assert.equal(r.brokerOrdersCancelled,false);
});
test('B243 revocation of JENIOS link never claims broker key revocation or closing',()=>{
 const r=inspectCustomerReadRevocation({connection:{...account,status:'revoked'}});
 assert.equal(r.providerKeyRevokedAtBroker,false);assert.equal(r.positionClosed,false);
});
