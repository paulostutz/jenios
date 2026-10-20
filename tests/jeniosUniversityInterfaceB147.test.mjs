import test from 'node:test';
import assert from 'node:assert/strict';
import {UNIVERSITY_MONTHLY,validUniversityOffer,validUniversityAccess,validUniversityScheduled,canStartUniversityPurchase,validUniversityAttempt,universityCheckoutUrl,
 projectUniversityOrder,restoreUniversityAttempt,preserveUniversityAttempt,universityAttemptReference,universityDate} from '../app/universidade/university-client.mjs';
import {socialAuthReturnPath} from '../app/components/social-auth-return.mjs';

const offer={...UNIVERSITY_MONTHLY,available:true};
const noAccess={kind:'none',active:false,included:false,validUntil:null};
const monthly={kind:'university-monthly',active:true,included:false,validUntil:'2026-11-20T15:30:00Z'};
const account={kind:'ready',data:{offer,access:noAccess,canPurchase:true,canRenew:false}};
const requestKey='20000000-0000-4000-8000-000000000002',orderId='30000000-0000-4000-8000-000000000003';
const draft={...UNIVERSITY_MONTHLY,requestKey,orderId:null,state:'order_unconfirmed'};
const order={...UNIVERSITY_MONTHLY,ok:true,requestKey,orderId,status:'awaiting_payment',state:'awaiting_payment',checkoutUrl:'/social/pagamento?pedido='+orderId};

test('B147 UI oferta fixa exige preço BRL4990, mês de calendário e renovação manual identificada',()=>{
 assert.equal(validUniversityOffer(offer),true);
 for(const value of [null,{}, {...offer,amountCents:499},{...offer,amountCents:4990.5},{...offer,currency:'USD'},{...offer,billingType:'one_time'},{...offer,renewalMode:'automatic'},{...offer,productCode:'social-university-pass'},{...offer,termsVersion:'different-terms'},{...offer,available:'true'}])assert.equal(validUniversityOffer(value),false);
 assert.equal(validUniversityOffer({...offer,available:false}),true);
});
test('B147 UI contratação exige conta conferida e oferta disponível; planos incluídos nunca recebem nova cobrança',()=>{
 assert.equal(canStartUniversityPurchase(account),true);
 for(const invalid of [{kind:'guest',data:account.data},{kind:'checking',data:account.data},{kind:'unavailable',data:account.data},
  {kind:'ready',data:{...account.data,offer:{...offer,available:false}}},{kind:'ready',data:{...account.data,canPurchase:false}},
  {kind:'ready',data:{...account.data,access:{...monthly,kind:'subscription',included:true}}},
  {kind:'ready',data:{...account.data,access:{kind:'admin-preview',included:true,active:true,validUntil:null}}}])assert.equal(canStartUniversityPurchase(invalid),false);
});
test('B147 UI renovação antecipada precisa de permissão e não duplica passe legado vigente',()=>{
 assert.equal(canStartUniversityPurchase({kind:'ready',data:{...account.data,access:monthly,canRenew:true}}),true);
 assert.equal(canStartUniversityPurchase({kind:'ready',data:{...account.data,access:monthly,canRenew:false}}),false);
 assert.equal(canStartUniversityPurchase({kind:'ready',data:{...account.data,access:{...monthly,kind:'purchased-pass'},canRenew:true}}),false);
});
test('B147 UI acesso ativo exige origem e vigência; saldo Pro não concede Universidade',()=>{
 for(const access of [noAccess,monthly,{...monthly,kind:'subscription',included:true},{kind:'admin-preview',active:true,included:true,validUntil:null}])assert.equal(validUniversityAccess(access),true);
 for(const access of [{},{kind:'none',active:true,included:false}, {...monthly,validUntil:'invalid'},{...monthly,included:true},{...monthly,kind:'subscription'},{...monthly,kind:'pro-credits'}])assert.equal(validUniversityAccess(access),false);
});
test('B147 UI checkout aceita pedido canônico já existente sem trocar um pedido conhecido',()=>{
 const next=projectUniversityOrder(order,draft);assert.equal(next.orderId,orderId);assert.equal(next.state,'awaiting_payment');
 const canonical={...order,requestKey:'canonical_existing_key_123'};
 assert.equal(projectUniversityOrder(canonical,draft).requestKey,canonical.requestKey);
 assert.equal(projectUniversityOrder(canonical,next),null);
 assert.equal(projectUniversityOrder({...order,orderId:'40000000-0000-4000-8000-000000000004'},next),null);
 for(const invalid of [{...order,amountCents:5000},{...order,productCode:'social-ai-pro-credits'},{...order,currency:'USD'},{...order,status:'paid'},{...order,requestKey:'short'}])assert.equal(projectUniversityOrder(invalid,draft),null);
});
test('B147 UI comprovante pendente nunca libera estudos como pagamento confirmado',()=>{
 const current=projectUniversityOrder(order,draft);
 const pending=projectUniversityOrder({...order,ok:false,status:'paid',state:'paid_pending_access'},current);
 assert.equal(pending.state,'paid_pending_access');assert.equal(pending.access,null);assert.equal(pending.retrySameOrder,false);assert.equal(pending.checkoutUrl,null);
 assert.equal(projectUniversityOrder({...order,status:'paid',state:'active'},current),null);
 assert.equal(projectUniversityOrder({...order,status:'paid',state:'active',access:{...monthly,active:false}},current),null);
 assert.equal(projectUniversityOrder({...order,ok:false,status:'paid',state:'active',access:monthly},current),null);
 assert.equal(projectUniversityOrder({...order,status:'paid',state:'active',access:monthly},current).access.validUntil,monthly.validUntil);
 assert.equal(projectUniversityOrder({...order,status:'paid',state:'active',access:{...monthly,kind:'subscription',included:true}},current).access.included,true);
 assert.equal(projectUniversityOrder({...order,ok:false},current),null);
});
test('B147 UI período futuro já pago bloqueia outra compra sem antecipar aulas nem trocar o recibo',()=>{
 const scheduled={kind:'university-monthly',productCode:UNIVERSITY_MONTHLY.productCode,orderId,startsAt:'2026-11-20T15:30:00Z',validUntil:'2026-12-20T15:30:00Z'};
 assert.equal(validUniversityScheduled(scheduled),true);
 assert.equal(canStartUniversityPurchase({kind:'ready',data:{...account.data,scheduled}}),false);
 const future=projectUniversityOrder({...order,status:'paid',state:'scheduled',access:noAccess,scheduled});
 assert.equal(future.state,'scheduled');assert.equal(future.access.active,false);assert.equal(future.checkoutUrl,null);assert.equal(future.retrySameOrder,false);
 assert.equal(projectUniversityOrder({...order,status:'paid',state:'scheduled',access:monthly,scheduled}),null);
 assert.equal(projectUniversityOrder({...order,status:'paid',state:'scheduled',access:noAccess,scheduled:{...scheduled,orderId:'40000000-0000-4000-8000-000000000004'}}),null);
 assert.equal(validUniversityScheduled({...scheduled,startsAt:scheduled.validUntil}),false);
 assert.equal(validUniversityScheduled({...scheduled,validUntil:'invalid'}),false);
});
test('B147 UI status final não reutiliza Pix nem permite estado financeiro contraditório',()=>{
 const current=projectUniversityOrder(order,draft);
 for(const status of ['cancelled','expired','refunded']){
  const result=projectUniversityOrder({...order,status,state:'closed',pixCode:'000201-payable-code-should-not-survive',expiresAt:'2026-11-20T16:00:00Z'},current);
  assert.equal(result.state,'closed');assert.equal(result.pixCode,null);assert.equal(result.checkoutUrl,null);assert.equal(result.retrySameOrder,false);
 }
 assert.equal(projectUniversityOrder({...order,status:'paid',state:'closed'},current),null);
 assert.equal(projectUniversityOrder({...order,status:'paid',state:'closed',access:noAccess},current).state,'closed');
});
test('B147 UI somente abre a página interna do pedido correto e confere o Pix recebido',()=>{
 assert.equal(universityCheckoutUrl(order.checkoutUrl,orderId),order.checkoutUrl);
 for(const url of ['//example.test', 'https://jenios.com.br'+order.checkoutUrl,order.checkoutUrl+'&next=https://example.test','javascript:alert(1)','/social/pagamento?pedido=other'])assert.equal(universityCheckoutUrl(url,orderId),null);
 const result=projectUniversityOrder({...order,pixCode:'000201-university-pix-response-code',expiresAt:'2026-10-20T16:00:00Z'},draft);
 assert.ok(result.pixCode);assert.equal(result.pixExpiresAt,'2026-10-20T16:00:00Z');
 assert.equal(projectUniversityOrder({...order,pixCode:'bad',expiresAt:'tomorrow'},draft).pixCode,null);
});
test('B147 UI falha de rede conserva referência e remove código de pagamento desatualizado',()=>{
 const current=projectUniversityOrder({...order,pixCode:'000201-university-pix-response-code',expiresAt:'2026-10-20T16:00:00Z'},draft);
 const next=preserveUniversityAttempt(current,undefined);
 assert.equal(next.orderId,orderId);assert.equal(next.requestKey,requestKey);assert.equal(next.state,'order_preserved');
 assert.equal(next.retrySameOrder,false);assert.equal(next.pixCode,null);assert.equal(next.checkoutUrl,null);assert.equal(next.access,null);
 const uncertain=preserveUniversityAttempt(draft,undefined);assert.equal(uncertain.orderId,null);assert.equal(uncertain.requestKey,requestKey);assert.equal(uncertain.retrySameOrder,true);
 const known=preserveUniversityAttempt(draft,{...UNIVERSITY_MONTHLY,requestKey,orderId,state:'order_preserved',retrySameOrder:true});
 assert.equal(known.orderId,orderId);assert.equal(known.requestKey,requestKey);assert.equal(known.retrySameOrder,true);
 assert.equal(preserveUniversityAttempt(current,{...order,orderId:'40000000-0000-4000-8000-000000000004',state:'order_preserved'}).orderId,orderId);
});
test('B147 UI só encerra tentativa não iniciada quando o servidor confirma a referência exata',()=>{
 const rejected={...UNIVERSITY_MONTHLY,requestKey,state:'not_started',code:'UNIVERSITY_INCLUDED'};
 assert.equal(preserveUniversityAttempt(draft,rejected).state,'not_started');
 assert.equal(preserveUniversityAttempt(draft,{...rejected,requestKey:'different_request_123'}).state,'order_unconfirmed');
 assert.equal(preserveUniversityAttempt(draft,{...rejected,retrySameOrder:true}).state,'order_unconfirmed');
 assert.equal(preserveUniversityAttempt({...draft,orderId},rejected).state,'order_preserved');
});
test('B147 UI recuperação não confia em estado, acesso, token, Pix ou destino guardados no navegador',()=>{
 const injected={...draft,orderId,state:'active',status:'paid',pixCode:'stored-pix-code',access:monthly,checkoutUrl:'https://example.test',accessToken:'private-token'};
 const ref=universityAttemptReference(injected);
 assert.deepEqual(Object.keys(ref).sort(),['amountCents','currency','orderId','productCode','requestKey','termsVersion']);
 const restored=restoreUniversityAttempt(injected);
 assert.equal(restored.state,'restored');assert.equal(restored.status,null);assert.equal(restored.pixCode,null);assert.equal(restored.access,null);assert.equal(restored.checkoutUrl,null);
 assert.equal(restored.retrySameOrder,false);assert.equal(restoreUniversityAttempt(draft).retrySameOrder,true);
 assert.equal(validUniversityAttempt({...draft,amountCents:0}),false);assert.equal(restoreUniversityAttempt({...draft,orderId:'wrong-id'}),null);
});
test('B147 UI data de vigência é exibida no horário de Brasília sem cálculo local do período',()=>{
 assert.equal(universityDate('2026-11-20T15:30:00Z').includes('12:30'),true);
 assert.equal(universityDate('invalid'),'Data em conferência');
});
test('B147 autenticação retorna somente à Universidade ou à Social, sem redirecionamento externo',()=>{
 assert.equal(socialAuthReturnPath('/universidade'),'/universidade');
 for(const unsafe of [undefined,null,'','/social','//example.test','https://example.test','https://jenios.com.br/universidade','/universidade?next=https://example.test','/universidade/../admin','javascript:alert(1)',{},['/universidade']])assert.equal(socialAuthReturnPath(unsafe),'/social');
});
