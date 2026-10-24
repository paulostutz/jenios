import test from 'node:test';
import assert from 'node:assert/strict';
import {creditAttemptStorageKey,restoreCreditAttempt,creditStatusPath,projectCreditStatus,preserveCreditAttempt,validCreditAttempt} from '../app/genios-pro/credits-client.mjs';
import {proCreditActions} from '../app/genios-pro/pro-client.mjs';

const owner='40000000-0000-4000-8000-000000000004',otherOwner='50000000-0000-4000-8000-000000000005';
const quote={id:'10000000-0000-4000-8000-000000000001',currency:'BRL',amountCents:1922,retailNanoUsd:3_750_000_000,
 baseCurrency:'USD',baseAmountMinor:375,termsVersion:'approved-test-terms',pricingVersion:'test-price-v1',
 fxBrlMicrosPerUsd:5_123_456,rateSource:'BCB:PTAX_USD_VENDA',rateAt:'2026-10-20T15:00:00Z',
 createdAt:'2026-10-20T16:00:00Z',expiresAt:'2026-10-20T16:15:00Z'};
const saved={ownerId:owner,requestKey:'20000000-0000-4000-8000-000000000002',quote,orderId:null};
const orderId='30000000-0000-4000-8000-000000000003';
const result={ok:true,orderId,quoteId:quote.id,requestKey:saved.requestKey,resolvedExistingOrder:true,
 status:'paid',state:'credited',credited:true,creditedNanoUsd:quote.retailNanoUsd};
const missing={ok:false,state:'order_unconfirmed',code:'ORDER_REFERENCE_NOT_FOUND',quoteId:quote.id,
 requestKey:saved.requestKey,credited:false,referencePreserved:true,retrySameOrder:false};

test('G45 pedido incerto após expirar plano usa consulta por referência sem precisar de checkout',()=>{
 const restored=restoreCreditAttempt(saved,{userId:owner,now:Date.parse('2026-11-25T12:00:00Z')});
 assert.ok(restored);
 assert.deepEqual(proCreditActions({userId:owner,eligible:false,offerReady:false,reconciliationEnabled:true}),{canPurchase:false,canReconcile:true});
 assert.equal(creditStatusPath(restored),'status?quoteId='+quote.id+'&requestKey='+saved.requestKey);
 const credited=projectCreditStatus(result,restored);
 assert.equal(credited.orderId,orderId);assert.equal(credited.state,'credited');assert.equal(credited.retrySameOrder,false);
 assert.equal(creditStatusPath(credited),'status?orderId='+orderId);
});
test('G45 adoção de orderId exige resolução existente explícita, mesma cotação e mesma chave',()=>{
 const attempt=restoreCreditAttempt(saved,{userId:owner});
 for(const invalid of [{...result,resolvedExistingOrder:false},{...result,requestKey:'other-key'},{...result,quoteId:'other-quote'},
  {...result,orderId:'https://outside.invalid/order'},{...result,creditedNanoUsd:quote.retailNanoUsd+1}])assert.equal(projectCreditStatus(invalid,attempt),null);
 assert.equal(projectCreditStatus(result,null),null);
});
test('G45 referência não encontrada permanece consultável sem reabilitar abertura de pedido',()=>{
 const attempt=restoreCreditAttempt(saved,{userId:owner}),pending=projectCreditStatus(missing,attempt);
 assert.equal(pending.orderId,null);assert.equal(pending.statusOnly,true);assert.equal(pending.retrySameOrder,false);
 assert.equal(pending.requestKey,saved.requestKey);assert.equal(pending.quote,quote);
 assert.equal(creditStatusPath(pending),creditStatusPath(attempt));
 const afterTimeout=preserveCreditAttempt(pending,undefined);
 assert.equal(afterTimeout.retrySameOrder,false);assert.equal(afterTimeout.statusOnly,true);
 const persisted={ownerId:owner,requestKey:pending.requestKey,quote:pending.quote,orderId:pending.orderId,statusOnly:pending.statusOnly};
 const reloaded=restoreCreditAttempt(persisted,{userId:owner});
 assert.equal(reloaded.retrySameOrder,false);assert.equal(reloaded.statusOnly,true);
 assert.equal(projectCreditStatus({...missing,orderId},attempt),null);
});
test('G45 erro de vínculo preserva a referência sem adotar outro pedido nem autorizar checkout',()=>{
 const attempt=restoreCreditAttempt(saved,{userId:owner});
 const blocked=preserveCreditAttempt(attempt,{...missing,code:'ORDER_QUOTE_MISMATCH',orderId});
 assert.equal(blocked.orderId,null);assert.equal(blocked.retrySameOrder,false);assert.equal(blocked.statusOnly,true);
 assert.equal(blocked.quote,quote);assert.equal(blocked.requestKey,saved.requestKey);
});
test('G45 restauração separa as contas e recusa referências com proprietário divergente',()=>{
 assert.notEqual(creditAttemptStorageKey(owner),creditAttemptStorageKey(otherOwner));
 assert.equal(creditAttemptStorageKey(null),null);
 assert.ok(restoreCreditAttempt(saved,{userId:owner}));
 assert.equal(restoreCreditAttempt(saved,{userId:otherOwner}),null);
 assert.equal(restoreCreditAttempt(saved,{userId:null}),null);
 assert.equal(restoreCreditAttempt(null,{userId:otherOwner}),null);
 assert.equal(validCreditAttempt({...saved,statusOnly:'true'}),false);
 // Existing per-account references remain recoverable after the schema update.
 const {ownerId,...legacy}=saved;assert.ok(restoreCreditAttempt(legacy,{userId:owner}));
});
test('G45 referência incompleta ou caminho injetado não produz consulta de status',()=>{
 for(const attempt of [null,{}, {...saved,orderId:'bad'}, {...saved,quote:{id:'bad'}},{...saved,requestKey:'../../checkout'}])assert.equal(creditStatusPath(attempt),null);
});
