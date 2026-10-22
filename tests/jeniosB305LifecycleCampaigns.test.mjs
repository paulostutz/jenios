import test from 'node:test';
import assert from 'node:assert/strict';
import {socialWelcomeEmail,planActivatedEmail,cartRecoveryEmail,noPlanNurtureEmail,marketNewsletterEmail,JENIOS_EMAIL_CADENCE} from '../lib/email/lifecycle-campaigns.mjs';
import {marketingEligibility} from '../lib/email/marketing-policy.mjs';
const to='cliente@example.com',unsubscribeUrl='https://www.jenios.com.br/email-preferences?token=test';
test('B305-R13 social welcome and plan activation are branded one-time transactional messages',()=>{
 const w=socialWelcomeEmail({userId:'u1',to,customerName:'Cliente'});
 const p=planActivatedEmail({subscriptionId:'s1',to,customerName:'Cliente',planName:'Internacional Pro'});
 assert.match(w.html,/JENIOS Social/);assert.match(p.html,/Seu plano está ativo/);
 assert.ok((w.html.match(/jenios-logo-horizontal\.webp/g)||[]).length>=2);
 assert.equal(JENIOS_EMAIL_CADENCE.socialWelcome,'once');
});
test('B305-R13 cart recovery is capped at three content-led messages with unsubscribe',()=>{
 for(const step of [1,2,3]){const m=cartRecoveryEmail({cartId:'c1',to,customerName:'Cliente',planName:'Global Crypto',step,unsubscribeUrl});assert.match(m.html,/Gerenciar preferências/)}
 assert.throws(()=>cartRecoveryEmail({cartId:'c1',to,planName:'x',step:4,unsubscribeUrl}),/CART_RECOVERY_STEP_INVALID/);
});
test('B305-R13 no-plan nurture stops when user has an active plan',()=>{
 assert.equal(marketingEligibility({kind:'no_plan_nurture',hasActivePlan:true}).eligible,false);
 const m=noPlanNurtureEmail({userId:'u1',to,step:1,unsubscribeUrl});assert.match(m.subject,/JENIOS/);
});
test('B305-R13 weekly newsletter requires curated sourced items and unsubscribe',()=>{
 const m=marketNewsletterEmail({editionId:'2026-W43',to,unsubscribeUrl,items:[{title:'Mercado em foco',summary:'Resumo objetivo da semana.',sourceName:'Fonte exemplo',sourceUrl:'https://example.com'}]});
 assert.match(m.html,/Radar de Mercado/);assert.match(m.html,/Fonte exemplo/);assert.match(m.html,/Não constitui recomendação/);
 assert.equal(marketingEligibility({kind:'newsletter',lastSentAt:new Date(Date.now()-24*3600000).toISOString()}).eligible,false);
});
