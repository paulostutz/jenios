import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 planCancellationScheduledEmail,planCancelledEmail,planReactivatedEmail,planChangedEmail
} from '../lib/email/lifecycle-campaigns.mjs';
import {validateSubscriptionLifecycleEvidence} from '../lib/email/transactional-delivery-worker.mjs';

const row={subscription_id:'s1',product_id:'p2',previous_product_id:'p1',user_id:'u1'};
const product={id:'p2',name:'Plano B',category:'platform',billing_type:'monthly',active:true};
const previous={id:'p1',name:'Plano A',category:'platform',billing_type:'monthly',active:true};
const order={id:'o2',user_id:'u1',product_id:'p2',status:'paid',currency:'BRL'};
const entitlement={order_id:'o2',user_id:'u1',product_id:'p2',status:'active'};
const sub={id:'s1',user_id:'u1',product_id:'p2',latest_order_id:'o2',status:'active',
 cancel_at_period_end:false,current_period_end:'2026-11-23T12:00:00.000Z'};

test('B305-R19 cancellation events require server subscription state',()=>{
 assert.equal(validateSubscriptionLifecycleEvidence('plan_cancel_scheduled',
  {...row,event_kind:'plan_cancel_scheduled'},{...sub,cancel_at_period_end:true},product),true);
 assert.equal(validateSubscriptionLifecycleEvidence('plan_cancel_scheduled',
  {...row,event_kind:'plan_cancel_scheduled'},sub,product),false);
 assert.equal(validateSubscriptionLifecycleEvidence('plan_cancelled',
  {...row,event_kind:'plan_cancelled'},{...sub,status:'cancelled',cancel_at_period_end:true},product),true);
 assert.equal(validateSubscriptionLifecycleEvidence('plan_cancelled',
  {...row,event_kind:'plan_cancelled'},{...sub,status:'cancelled'},product),false);
});

test('B305-R19 reactivation and plan change require paid order plus active entitlement',()=>{
 assert.equal(validateSubscriptionLifecycleEvidence('plan_reactivated',
  {...row,event_kind:'plan_reactivated'},sub,product,{order,entitlement}),true);
 assert.equal(validateSubscriptionLifecycleEvidence('plan_reactivated',
  {...row,event_kind:'plan_reactivated'},sub,product,{order:{...order,status:'pending'},entitlement}),false);
 assert.equal(validateSubscriptionLifecycleEvidence('plan_changed',
  {...row,event_kind:'plan_changed'},sub,product,{order,entitlement,previousProduct:previous}),true);
 assert.equal(validateSubscriptionLifecycleEvidence('plan_changed',
  {...row,event_kind:'plan_changed',previous_product_id:'p2'},sub,product,{order,entitlement,previousProduct:product}),false);
});

test('B305-R19 lifecycle emails use Financeiro and precise non-promissory copy',()=>{
 const messages=[
  planCancellationScheduledEmail({subscriptionId:'s1',to:'cliente@example.com',customerName:'Cliente',planName:'Plano B',effectiveAt:sub.current_period_end}),
  planCancelledEmail({subscriptionId:'s1',to:'cliente@example.com',customerName:'Cliente',planName:'Plano B',effectiveAt:sub.current_period_end}),
  planReactivatedEmail({subscriptionId:'s1',cycleKey:'o2',to:'cliente@example.com',customerName:'Cliente',planName:'Plano B'}),
  planChangedEmail({subscriptionId:'s1',changeKey:'o2',to:'cliente@example.com',customerName:'Cliente',previousPlanName:'Plano A',planName:'Plano B'})
 ];
 for(const message of messages){
  assert.equal(message.from,'Financeiro JENIOS <financeiro@jenios.com.br>');
  assert.match(message.html,/jenios-logo-horizontal\.webp/);
  assert.doesNotMatch(message.html,/lucro garantido|rentabilidade garantida|QA|homologa[cç][aã]o/i);
 }
 assert.match(messages[3].html,/Plano A/);
 assert.match(messages[3].html,/Plano B/);
});

test('B305-R19 database trigger does not send email and separates overdue cancellation',()=>{
 const sql=readFileSync('supabase/migrations/20261023004751_jenios_b305_subscription_lifecycle_emails.sql','utf8');
 assert.match(sql,/plan_cancel_scheduled/);
 assert.match(sql,/plan_cancelled/);
 assert.match(sql,/plan_reactivated/);
 assert.match(sql,/plan_changed/);
 assert.match(sql,/NEW\.cancel_at_period_end=true/);
 assert.match(sql,/OLD\.status IN \('past_due','cancelled'\)/);
 assert.match(sql,/e\.status='active'/);
 assert.doesNotMatch(sql,/api\.resend\.com|RESEND_API_KEY/);
});
