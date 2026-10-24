import test from 'node:test';
import assert from 'node:assert/strict';
import {subscriptionDunningStage,subscriptionDunningEmail} from '../lib/email/subscription-dunning.mjs';
const due='2026-10-22T12:00:00Z',day=86400000;
test('B305-R13 dunning stages are deterministic at D-3, D0, D+1 and D+7',()=>{
 const t=Date.parse(due);
 assert.equal(subscriptionDunningStage({dueAt:due,now:t-3*day}),'due_soon_3d');
 assert.equal(subscriptionDunningStage({dueAt:due,now:t}),'due_today');
 assert.equal(subscriptionDunningStage({dueAt:due,now:t+day}),'past_due_1d');
 assert.equal(subscriptionDunningStage({dueAt:due,now:t+7*day}),'cancelled_7d');
 assert.equal(subscriptionDunningStage({dueAt:due,now:t+8*day,paid:true}),'paid');
});
test('B305-R13 overdue notice states plan-specific seven-day cancellation',()=>{
 const m=subscriptionDunningEmail({eventKind:'past_due_1d',subscriptionId:'11111111-2222-4333-8444-555555555555',productName:'Internacional Pro',dueAt:due,to:'cliente@example.com',customerName:'Cliente'});
 assert.match(m.html,/7 dias corridos/);assert.match(m.html,/somente este plano específico/);
 assert.ok((m.html.match(/jenios-logo-horizontal\.webp/g)||[]).length>=2);
});
test('B305-R13 cancellation notice preserves account and other products',()=>{
 const m=subscriptionDunningEmail({eventKind:'cancelled_7d',subscriptionId:'11111111-2222-4333-8444-555555555555',productName:'Nacional — B3',dueAt:due,to:'cliente@example.com'});
 assert.match(m.html,/outros produtos não são afetados/);
});
