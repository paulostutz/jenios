import test from 'node:test';
import assert from 'node:assert/strict';
import {emailReleaseReadiness} from '../lib/email/admin-health.mjs';

import {EMAIL_DATABASE_OBJECTS} from '../lib/email/database-preflight.mjs';
const databasePreflight={...Object.fromEntries(EMAIL_DATABASE_OBJECTS.map(key=>[key,true])),allRequired:true};

const cleanQueues={
 finance:{statuses:{uncertain:0}},
 transactional:{statuses:{uncertain:0}},
 dunning:{statuses:{uncertain:0}},
 marketing:{statuses:{uncertain:0,failed:0}}
};
const credentials={
 resendApiKeyConfigured:true,supabaseServerKeyConfigured:true,cronSecretConfigured:true,
 financeSenderConfigured:true,resendDomainVerified:true,webhookSecretConfigured:false
};
const gates={
 JENIOS_PAYMENT_EMAILS_ENABLED:false,JENIOS_TRANSACTIONAL_EMAILS_ENABLED:false,
 JENIOS_SUBSCRIPTION_DUNNING_ENABLED:false,JENIOS_MARKETING_PLANNER_ENABLED:false,
 JENIOS_MARKETING_EMAILS_ENABLED:false,JENIOS_B305_TEST_SEND_APPROVED:false,
 JENIOS_B305_PRIVATE_EMAIL_RUNNER_ENABLED:false,JENIOS_RESEND_WEBHOOK_ENABLED:false
};

test('B305-R27 readiness identifies known pending manual integrations without false blockers',()=>{
 const r=emailReleaseReadiness({queues:cleanQueues,credentials,gates,databasePreflight,env:{
  JENIOS_AUTH_TEMPLATES_APPLIED:'false',
  JENIOS_RESEND_WEBHOOK_ENDPOINT_CERTIFIED:'false',
  JENIOS_MARKETING_DELIVERY_WORKER_CERTIFIED:'false',
  JENIOS_UNIVERSITY_MILESTONE_DELIVERY_CERTIFIED:'false'
 }});
 assert.equal(r.state,'pending');
 assert.equal(r.activationEligible,false);
 assert.equal(r.blockers,0);
 assert.equal(r.pending,4);
 assert.equal(r.ready,5);
});

test('B305-R27 uncertain queue or missing core provider becomes blocker',()=>{
 const queues=structuredClone(cleanQueues);queues.finance.statuses.uncertain=1;
 const r=emailReleaseReadiness({queues,credentials:{...credentials,resendApiKeyConfigured:false},gates,databasePreflight,env:{}});
 assert.equal(r.state,'blocked');
 assert.ok(r.blockers>=2);
});

test('B305-R27 readiness can become eligible only when all manual certifications are true',()=>{
 const r=emailReleaseReadiness({queues:cleanQueues,credentials:{...credentials,webhookSecretConfigured:true},gates,databasePreflight,env:{
  JENIOS_AUTH_TEMPLATES_APPLIED:'true',
  JENIOS_RESEND_WEBHOOK_ENDPOINT_CERTIFIED:'true',
  JENIOS_MARKETING_DELIVERY_WORKER_CERTIFIED:'true',
  JENIOS_UNIVERSITY_MILESTONE_DELIVERY_CERTIFIED:'true'
 }});
 assert.equal(r.state,'ready');
 assert.equal(r.activationEligible,true);
 assert.equal(r.pending,0);
 assert.equal(r.blockers,0);
});
