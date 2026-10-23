/** B305-R24 — read-only aggregate health for Master admin.
 * Never returns recipients, provider ids, error payloads or secrets.
 */
const QUEUES=Object.freeze({
 finance:Object.freeze({table:'jenios_pay_email_outbox_b305',statuses:['pending','processing','retry','sent','blocked','uncertain']}),
 transactional:Object.freeze({table:'jenios_transactional_email_outbox_b305',statuses:['pending','processing','retry','sent','blocked','uncertain','superseded']}),
 dunning:Object.freeze({table:'jenios_subscription_dunning_outbox_b305',statuses:['pending','processing','retry','sent','blocked','uncertain','superseded']}),
 marketing:Object.freeze({table:'jenios_marketing_email_ledger_b305',statuses:['planned','processing','retry','sent','suppressed','failed','uncertain']})
});

async function countQuery(query,label){
 const result=await query;
 if(result.error||!Number.isSafeInteger(result.count)||result.count<0)
  throw Object.assign(Error('EMAIL_ADMIN_HEALTH_UNAVAILABLE'),{code:'EMAIL_ADMIN_HEALTH_UNAVAILABLE',label});
 return result.count;
}
async function countStatus(db,table,status){
 return countQuery(db.from(table).select('id',{count:'exact',head:true}).eq('status',status),table+':'+status);
}
async function countAll(db,table){
 return countQuery(db.from(table).select('id',{count:'exact',head:true}),table+':all');
}
async function countBool(db,table,column,value){
 return countQuery(db.from(table).select('user_id',{count:'exact',head:true}).eq(column,value),table+':'+column);
}
async function countNotNull(db,table,column){
 return countQuery(db.from(table).select('user_id',{count:'exact',head:true}).not(column,'is',null),table+':'+column);
}

export function emailGateSummary(env={}){
 const keys=[
  'JENIOS_PAYMENT_EMAILS_ENABLED','JENIOS_TRANSACTIONAL_EMAILS_ENABLED',
  'JENIOS_SUBSCRIPTION_DUNNING_ENABLED','JENIOS_MARKETING_PLANNER_ENABLED',
  'JENIOS_MARKETING_EMAILS_ENABLED','JENIOS_B305_TEST_SEND_APPROVED',
  'JENIOS_B305_PRIVATE_EMAIL_RUNNER_ENABLED'
 ];
 return Object.freeze(Object.fromEntries(keys.map(key=>[key,env[key]==='true'])));
}

export async function readEmailAdminHealth(db,env=process.env){
 if(!db?.from)throw Object.assign(Error('EMAIL_ADMIN_DB_UNAVAILABLE'),{code:'EMAIL_ADMIN_DB_UNAVAILABLE'});
 const queueEntries=await Promise.all(Object.entries(QUEUES).map(async([name,config])=>{
  const values=await Promise.all([
   countAll(db,config.table),
   ...config.statuses.map(status=>countStatus(db,config.table,status))
  ]);
  return [name,Object.freeze({
   total:values[0],
   statuses:Object.freeze(Object.fromEntries(config.statuses.map((status,index)=>[status,values[index+1]])))
  })];
 }));
 const [preferences,optedIn,optedOut,complaints,hardBounces,newsletters,drafts,approved]=await Promise.all([
  countAll(db,'jenios_email_preferences_b305'),
  countBool(db,'jenios_email_preferences_b305','marketing_opt_in',true),
  countNotNull(db,'jenios_email_preferences_b305','opted_out_at'),
  countNotNull(db,'jenios_email_preferences_b305','complaint_at'),
  countNotNull(db,'jenios_email_preferences_b305','hard_bounce_at'),
  countAll(db,'jenios_newsletter_editions_b305'),
  countStatus(db,'jenios_newsletter_editions_b305','draft'),
  countStatus(db,'jenios_newsletter_editions_b305','approved')
 ]);
 return Object.freeze({
  status:'ready',
  source:'social_qa_email_ledgers',
  generatedAt:new Date().toISOString(),
  queues:Object.freeze(Object.fromEntries(queueEntries)),
  preferences:Object.freeze({total:preferences,optedIn,optedOut,complaints,hardBounces}),
  newsletters:Object.freeze({total:newsletters,draft:drafts,approved}),
  gates:emailGateSummary(env)
 });
}
