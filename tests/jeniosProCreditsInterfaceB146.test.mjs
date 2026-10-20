import test from 'node:test';
import assert from 'node:assert/strict';
import {creditOfferReady,formatBrlCents,formatFxMicros,validCreditQuote,validCreditAttempt,safeCreditCheckoutUrl,projectCreditCheckout,projectCreditStatus,preserveCreditAttempt} from '../app/genios-pro/credits-client.mjs';

const now=Date.parse('2026-10-20T16:00:00Z');
const offer={enabled:true,baseCurrency:'USD',baseAmountMinor:375,termsVersion:'approved-test-terms',settlementCurrency:'BRL',quoteRequired:true};
const quote={id:'10000000-0000-4000-8000-000000000001',currency:'BRL',amountCents:1922,retailNanoUsd:3_750_000_000,baseCurrency:'USD',baseAmountMinor:375,termsVersion:offer.termsVersion,pricingVersion:'test-price-v1',fxBrlMicrosPerUsd:5_123_456,rateSource:'BCB:PTAX_USD_VENDA',rateAt:'2026-10-20T15:00:00Z',createdAt:'2026-10-20T16:00:00Z',expiresAt:'2026-10-20T16:15:00Z'};
const attempt={requestKey:'20000000-0000-4000-8000-000000000002',quote,orderId:null,state:'order_unconfirmed',retrySameOrder:true};
const orderId='30000000-0000-4000-8000-000000000003';
const opened={ok:true,orderId,quoteId:quote.id,requestKey:attempt.requestKey,status:'awaiting_payment',state:'awaiting_payment',credited:false,checkoutUrl:'/social/pagamento?pedido='+orderId};

test('B146 UI compra exige oferta completa e autorização explícita do servidor',()=>{
 assert.equal(creditOfferReady(offer),true);
 for(const invalid of [undefined,{}, {...offer,enabled:false},{...offer,enabled:'true'},{...offer,baseCurrency:null},{...offer,baseAmountMinor:0},{...offer,settlementCurrency:'USD'},{...offer,termsVersion:''},{...offer,quoteRequired:false}])assert.equal(creditOfferReady(invalid),false);
});
test('B146 UI preço BRL e câmbio mantêm centavos e micros exatos',()=>{
 assert.equal(formatBrlCents(1922),'R$\u00a019,22');
 assert.equal(formatBrlCents(1),'R$\u00a00,01');
 assert.equal(formatFxMicros(5_123_456),'R$\u00a05,123456');
 assert.equal(formatBrlCents(null),'Valor não disponível');
 assert.equal(formatBrlCents(1.5),'Valor não disponível');
});
test('B146 UI cotação deve corresponder à oferta, ao câmbio, à moeda e ao crédito efetivo',()=>{
 assert.equal(validCreditQuote(quote,{offer,now}),true);
 for(const invalid of [{...quote,amountCents:1921},{...quote,retailNanoUsd:3_750_000_001},{...quote,currency:'USD'},{...quote,termsVersion:'different-terms'},{...quote,rateSource:'unknown'},{...quote,rateAt:'2026-10-21T15:00:00Z'},{...quote,fxBrlMicrosPerUsd:0}])assert.equal(validCreditQuote(invalid,{offer,now}),false);
 const brl={...quote,baseCurrency:'BRL',baseAmountMinor:1000,amountCents:1000,retailNanoUsd:1_960_784_313,fxBrlMicrosPerUsd:5_100_000};
 assert.equal(validCreditQuote(brl,{now}),true);
 assert.equal(validCreditQuote({...brl,retailNanoUsd:1_960_784_314},{now}),false);
});
test('B146 UI cotação vencida só serve à recuperação do mesmo pedido',()=>{
 assert.equal(validCreditQuote(quote,{now:now+900000}),false);
 assert.equal(validCreditQuote(quote,{now:now+900000,allowExpired:true}),true);
 assert.equal(validCreditAttempt(attempt,now+900000),true);
 // A backward local-clock change must not discard an unresolved purchase.
 assert.equal(validCreditQuote(quote,{now:now-60000}),false);
 assert.equal(validCreditAttempt(attempt,now-60000),true);
 assert.equal(validCreditAttempt({...attempt,requestKey:'new-key'},now),false);
 assert.equal(validCreditAttempt({...attempt,orderId:'https://untrusted.example'},now),false);
});
test('B146 UI pagamento abre somente a rota Social do pedido conferido',()=>{
 assert.equal(safeCreditCheckoutUrl(opened.checkoutUrl,orderId),opened.checkoutUrl);
 for(const value of ['https://untrusted.example/pagar','//untrusted.example','https://jenios.com.br'+opened.checkoutUrl,opened.checkoutUrl+'&next=https://untrusted.example','/social/pagamento?pedido=other','javascript:alert(1)'])assert.equal(safeCreditCheckoutUrl(value,orderId),null);
});
test('B146 UI checkout não concede crédito e não troca pedido ou cotação',()=>{
 const projected=projectCreditCheckout(opened,attempt);
 assert.equal(projected.orderId,orderId);assert.equal(projected.state,'awaiting_payment');
 assert.equal(projectCreditCheckout({...opened,credited:true,state:'credited'},attempt),null);
 assert.equal(projectCreditCheckout({...opened,quoteId:'other'},attempt),null);
 assert.equal(projectCreditCheckout({...opened,requestKey:'other'},attempt),null);
 assert.equal(projectCreditCheckout(opened,{...attempt,orderId:'40000000-0000-4000-8000-000000000004'}),null);
 assert.equal(projectCreditCheckout({...opened,checkoutUrl:'https://untrusted.example'},attempt).checkoutUrl,null);
});
test('B146 UI crédito exige recibo confirmado pelo status com valor e vínculo exatos',()=>{
 const current=projectCreditCheckout(opened,attempt),result={ok:true,orderId,quoteId:quote.id,status:'paid',state:'credited',credited:true,creditedNanoUsd:quote.retailNanoUsd};
 assert.equal(projectCreditStatus(result,current).state,'credited');
 for(const invalid of [{...result,credited:false},{...result,creditedNanoUsd:quote.retailNanoUsd+1},{...result,orderId:'other'},{...result,quoteId:'other'},{...result,status:'pending'},{...result,ok:false}])assert.equal(projectCreditStatus(invalid,current),null);
});
test('B146 UI pagamento em conferência não libera outra compra nem promete saldo',()=>{
 const current=projectCreditCheckout(opened,attempt),result={ok:false,orderId,quoteId:quote.id,status:'paid',state:'paid_pending_credit',credited:false};
 const pending=projectCreditStatus(result,current);
 assert.equal(pending.state,'paid_pending_credit');assert.equal(pending.retrySameOrder,false);assert.equal(pending.checkoutUrl,null);assert.equal(pending.pixCode,null);
});
test('B146 UI resposta perdida preserva quote e chave; rejeição definitiva encerra só a tentativa identificada',()=>{
 const unknown=preserveCreditAttempt(attempt,undefined);
 assert.equal(unknown.requestKey,attempt.requestKey);assert.equal(unknown.quote,quote);assert.equal(unknown.retrySameOrder,true);assert.equal(unknown.state,'order_unconfirmed');
 const error={state:'order_preserved',quoteId:quote.id,orderId,requestKey:attempt.requestKey,retrySameOrder:true};
 const saved=preserveCreditAttempt(attempt,error);
 assert.equal(saved.orderId,orderId);assert.equal(saved.retrySameOrder,true);
 const rejected={state:'not_started',quoteId:quote.id,requestKey:attempt.requestKey,code:'QUOTE_EXPIRED'};
 assert.equal(preserveCreditAttempt(attempt,rejected).state,'closed');
 assert.equal(preserveCreditAttempt(attempt,{...rejected,retrySameOrder:true}).state,'order_unconfirmed');
 assert.equal(preserveCreditAttempt(attempt,{...rejected,requestKey:'other'}).state,'order_unconfirmed');
 assert.equal(preserveCreditAttempt(attempt,{...rejected,code:'IDEMPOTENCY_CONFLICT'}).state,'reference_conflict');
});
test('B146 UI pedido pendente pode retomar a mesma referência; Pix aguardando não recria checkout',()=>{
 const current=projectCreditCheckout(opened,attempt);
 const status={ok:true,orderId,quoteId:quote.id,status:'pending',state:'awaiting_payment',credited:false};
 assert.equal(projectCreditStatus(status,current).retrySameOrder,true);
 assert.equal(projectCreditStatus({...status,status:'awaiting_payment'},current).retrySameOrder,false);
 assert.equal(projectCreditStatus({...status,status:'expired',state:'closed'},current).state,'closed');
});
test('B146 UI resposta de status perdida remove Pix anterior e mantém somente a conferência do mesmo pedido',()=>{
 const current=projectCreditStatus({ok:true,orderId,quoteId:quote.id,status:'awaiting_payment',state:'awaiting_payment',credited:false,pixCode:'000201-test-pix-code-from-verified-status',expiresAt:quote.expiresAt},projectCreditCheckout(opened,attempt));
 assert.ok(current.pixCode);assert.ok(current.checkoutUrl);
 const uncertain=preserveCreditAttempt(current,undefined);
 assert.equal(uncertain.orderId,orderId);assert.equal(uncertain.requestKey,attempt.requestKey);assert.equal(uncertain.quote,quote);
 assert.equal(uncertain.state,'order_preserved');assert.equal(uncertain.retrySameOrder,false);
 assert.equal(uncertain.pixCode,null);assert.equal(uncertain.pixExpiresAt,null);assert.equal(uncertain.checkoutUrl,null);
});
