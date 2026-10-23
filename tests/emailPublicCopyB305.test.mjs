import test from 'node:test';
import assert from 'node:assert/strict';
import {paymentConfirmationEmail} from '../lib/email/finance-payment-confirmation.mjs';
import {subscriptionDunningEmail} from '../lib/email/subscription-dunning.mjs';
import {
  socialWelcomeEmail,planActivatedEmail,planCancellationScheduledEmail,planCancelledEmail,
  planReactivatedEmail,planChangedEmail,cartRecoveryEmail,
  noPlanNurtureEmail,marketNewsletterEmail
} from '../lib/email/lifecycle-campaigns.mjs';

const INTERNAL=/(?:\bB\d{3}\b|\bR\d{1,3}\b|\bQA\b|homologa(?:c|ç)[aã]o)/i;
const assertPublic=(message)=>{
  for(const [field,value] of Object.entries({subject:message.subject,html:message.html,text:message.text||''})){
    assert.doesNotMatch(String(value||''),INTERNAL,field+' leaked internal marker');
  }
};

test('B305-R15 customer finance emails never expose internal release markers',()=>{
  const paid=paymentConfirmationEmail({
    orderId:'123e4567-e89b-12d3-a456-426614174000',
    status:'paid',bankVerified:true,receiptId:'E1234567890123456789012345678901',
    amountCents:14990,currency:'BRL',paidAt:'2026-10-23T00:00:00.000Z',
    customerName:'Cliente',productName:'JENIOS',to:'cliente@example.com'
  });
  assertPublic(paid);

  for(const eventKind of ['due_soon_3d','due_today','past_due_1d','cancelled_7d']){
    assertPublic(subscriptionDunningEmail({
      eventKind,subscriptionId:'sub_123',productName:'JENIOS',
      dueAt:'2026-10-23T12:00:00.000Z',to:'cliente@example.com',customerName:'Cliente'
    }));
  }
});

test('B305-R15 customer lifecycle emails never expose internal release markers',()=>{
  const unsubscribeUrl='https://www.jenios.com.br/preferencias?token=public-example';
  const messages=[
    socialWelcomeEmail({userId:'user_1',to:'cliente@example.com',customerName:'Cliente'}),
    planActivatedEmail({subscriptionId:'sub_1',to:'cliente@example.com',customerName:'Cliente',planName:'Plano JENIOS'}),
    planCancellationScheduledEmail({subscriptionId:'sub_1',to:'cliente@example.com',customerName:'Cliente',planName:'Plano JENIOS',effectiveAt:'2026-11-23T12:00:00.000Z'}),
    planCancelledEmail({subscriptionId:'sub_1',to:'cliente@example.com',customerName:'Cliente',planName:'Plano JENIOS',effectiveAt:'2026-11-23T12:00:00.000Z'}),
    planReactivatedEmail({subscriptionId:'sub_1',cycleKey:'order_2',to:'cliente@example.com',customerName:'Cliente',planName:'Plano JENIOS'}),
    planChangedEmail({subscriptionId:'sub_1',changeKey:'order_3',to:'cliente@example.com',customerName:'Cliente',previousPlanName:'Plano A',planName:'Plano B'}),
    ...[1,2,3].map(step=>cartRecoveryEmail({cartId:'cart_1',to:'cliente@example.com',customerName:'Cliente',planName:'Plano JENIOS',step,unsubscribeUrl})),
    ...[1,2].map(step=>noPlanNurtureEmail({userId:'user_1',to:'cliente@example.com',customerName:'Cliente',step,unsubscribeUrl})),
    marketNewsletterEmail({
      editionId:'edition_1',to:'cliente@example.com',customerName:'Cliente',unsubscribeUrl,
      items:[{title:'Mercado em foco',summary:'Resumo informativo da semana.',sourceName:'Fonte pública',sourceUrl:'https://example.com/news'}]
    })
  ];
  for(const message of messages) assertPublic(message);
});
