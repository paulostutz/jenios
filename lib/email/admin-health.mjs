/** B305-R24 — read-only aggregate health for Master admin.
 * Never returns recipients, provider ids, error payloads or secrets.
 */
import {readEmailDatabasePreflight,sanitizeEmailDatabasePreflight} from './database-preflight.mjs';
import {productionEmailScope} from './production-delivery-policy.mjs';
import {emailDispatchLimits} from './dispatch-budget.mjs';
import {resendWebhookReadiness} from './resend-webhook-verifier.mjs';

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
async function countAll(db,table,column='id'){
 return countQuery(db.from(table).select(column,{count:'exact',head:true}),table+':all');
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
  'JENIOS_B305_PRIVATE_EMAIL_RUNNER_ENABLED','JENIOS_RESEND_WEBHOOK_ENABLED',
  'JENIOS_EMAIL_PRODUCTION_ENABLED','JENIOS_EMAIL_DISPATCHER_ENABLED'
 ];
 return Object.freeze(Object.fromEntries(keys.map(key=>[key,env[key]==='true'])));
}

export function emailCredentialSummary(env={}){
 return Object.freeze({
  resendApiKeyConfigured:typeof env.RESEND_API_KEY==='string'&&/^re_[A-Za-z0-9_-]{11,}$/.test(env.RESEND_API_KEY),
  supabaseServerKeyConfigured:Boolean(
   (typeof env.SUPABASE_SECRET_KEY==='string'&&env.SUPABASE_SECRET_KEY.startsWith('sb_secret_'))||
   (typeof env.SUPABASE_SERVICE_ROLE_KEY==='string'&&env.SUPABASE_SERVICE_ROLE_KEY.length>20)
  ),
  cronSecretConfigured:['JENIOS_EMAIL_DISPATCH_SECRET','CRON_SECRET']
   .some(key=>typeof env[key]==='string'&&env[key].length>=24),
  financeSenderConfigured:env.JENIOS_PAYMENT_EMAIL_FROM==='Financeiro JENIOS <financeiro@jenios.com.br>',
  resendDomainVerified:env.JENIOS_RESEND_EXPECTED_DOMAIN==='jenios.com.br'&&env.JENIOS_RESEND_DOMAIN_VERIFIED==='true',
  webhookSecretConfigured:typeof env.RESEND_WEBHOOK_SECRET==='string'&&env.RESEND_WEBHOOK_SECRET.startsWith('whsec_')&&env.RESEND_WEBHOOK_SECRET.length>=24
 });
}

async function countWebhook(db,disposition=null){
 let query=db.from('jenios_resend_webhook_events_b305').select('event_id',{count:'exact',head:true});
 if(disposition)query=query.eq('disposition',disposition);
 return countQuery(query,'jenios_resend_webhook_events_b305:'+(disposition||'all'));
}

export function emailReleaseReadiness({queues={},credentials={},gates={},databasePreflight={},env={},dispatchHealth={}}={}){
 const uncertain=['finance','transactional','dunning','marketing']
  .reduce((sum,key)=>sum+Number(queues?.[key]?.statuses?.uncertain||0),0);
 const failed=Number(queues?.marketing?.statuses?.failed||0);
 const qaLocked=Object.values(gates).every(value=>value===false);
 const checks=[
  {
   id:'database_preflight',label:'Objetos obrigatórios presentes no banco',
   state:sanitizeEmailDatabasePreflight(databasePreflight).allRequired?'ready':'blocker'
  },
  {
   id:'provider_core',label:'Resend, domínio e remetente',
   state:credentials.resendApiKeyConfigured&&credentials.resendDomainVerified&&credentials.financeSenderConfigured?'ready':'blocker'
  },
  {
   id:'server_core',label:'Supabase server-side e rotas internas',
   state:credentials.supabaseServerKeyConfigured&&credentials.cronSecretConfigured?'ready':'blocker'
  },
  {
   id:'queue_integrity',label:'Filas sem estado incerto ou falha terminal',
   state:uncertain===0&&failed===0?'ready':'blocker'
  },
  {
   id:'qa_lock',label:'Homologação com todos os gates desligados',
   state:qaLocked?'ready':'blocker'
  },
  {
   id:'auth_templates',label:'Templates do Supabase Auth publicados',
   state:env.JENIOS_AUTH_TEMPLATES_APPLIED==='true'?'ready':'pending'
  },
  {
   id:'webhook_endpoint',label:'Endpoint assinado de bounce/complaint certificado',
   state:env.JENIOS_RESEND_WEBHOOK_ENDPOINT_CERTIFIED==='true'&&credentials.webhookSecretConfigured?'ready':'pending'
  },
  {
   id:'marketing_delivery',label:'Worker externo de marketing certificado',
   state:env.JENIOS_MARKETING_DELIVERY_WORKER_CERTIFIED==='true'?'ready':'pending'
  },
  {
   id:'university_delivery',label:'Entrega dos marcos da Universidade certificada',
   state:env.JENIOS_UNIVERSITY_MILESTONE_DELIVERY_CERTIFIED==='true'?'ready':'pending'
  }
 ];
 if(env.VERCEL_ENV==='production'){
  const scope=productionEmailScope(env),limits=emailDispatchLimits(env);
  const lock=checks.findIndex(check=>check.id==='qa_lock');
  checks.splice(lock,1,
   {id:'production_scope',label:'Projeto, branch e banco de produção',state:scope.ready?'ready':'blocker'},
   {id:'application_budget',label:'Reservas duráveis e limites da aplicação',state:limits.ready&&dispatchHealth.ready===true?'ready':'blocker'},
   {id:'dispatcher',label:'Agendamento de processamento habilitado',state:gates.JENIOS_EMAIL_DISPATCHER_ENABLED?'ready':'pending'});
  const webhook=checks.find(check=>check.id==='webhook_endpoint');
  webhook.state=resendWebhookReadiness(env).ready&&env.JENIOS_RESEND_WEBHOOK_ENDPOINT_CERTIFIED==='true'?'ready':'pending';
 }
 const blockers=checks.filter(x=>x.state==='blocker').length;
 const pending=checks.filter(x=>x.state==='pending').length;
 return Object.freeze({
  mode:env.VERCEL_ENV==='production'?'production':'qa',
  state:blockers?'blocked':pending?'pending':'ready',
  activationEligible:blockers===0&&pending===0,
  blockers,pending,ready:checks.length-blockers-pending,
  checks:Object.freeze(checks.map(Object.freeze))
 });
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
 const [preferences,optedIn,optedOut,complaints,hardBounces,newsletters,drafts,approved,webhookTotal,webhookComplaints,webhookHardBounces,webhookTransient,webhookUnknown]=await Promise.all([
  countAll(db,'jenios_email_preferences_b305','user_id'),
  countBool(db,'jenios_email_preferences_b305','marketing_opt_in',true),
  countNotNull(db,'jenios_email_preferences_b305','opted_out_at'),
  countNotNull(db,'jenios_email_preferences_b305','complaint_at'),
  countNotNull(db,'jenios_email_preferences_b305','hard_bounce_at'),
  countAll(db,'jenios_newsletter_editions_b305'),
  countStatus(db,'jenios_newsletter_editions_b305','draft'),
  countStatus(db,'jenios_newsletter_editions_b305','approved'),
  countWebhook(db),
  countWebhook(db,'complaint'),
  countWebhook(db,'hard_bounce'),
  countWebhook(db,'ignored_transient'),
  countWebhook(db,'unknown_user')
 ]);
 const databasePreflight=await readEmailDatabasePreflight(db);
 let dispatchHealth=Object.freeze({ready:false,scope:'application_delivery_only'});
 if(env.VERCEL_ENV==='production'){
  try{
   const out=await db.rpc('jenios_email_dispatch_health_r42');
   const value=Array.isArray(out?.data)&&out.data.length===1?out.data[0]:out?.data;
   const keys=['daily_reserved','monthly_reserved','marketing_daily_reserved','marketing_monthly_reserved'];
   if(!out?.error&&value?.ready===true&&keys.every(key=>Number.isSafeInteger(value[key])&&value[key]>=0))
    dispatchHealth=Object.freeze({ready:true,scope:'application_delivery_only',
     ...Object.fromEntries(keys.map(key=>[key,value[key]]))});
  }catch{}
 }
 const gates=emailGateSummary(env),credentials=emailCredentialSummary(env);
 const queues=Object.freeze(Object.fromEntries(queueEntries));
 const readiness=emailReleaseReadiness({queues,credentials,gates,databasePreflight,env,dispatchHealth});
 return Object.freeze({
  status:'ready',
  source:env.VERCEL_ENV==='production'
   ?(productionEmailScope(env).ready?'production_email_ledgers':'unverified_email_ledgers'):'social_qa_email_ledgers',
  generatedAt:new Date().toISOString(),
  queues,
  preferences:Object.freeze({total:preferences,optedIn,optedOut,complaints,hardBounces}),
  newsletters:Object.freeze({total:newsletters,draft:drafts,approved}),
  webhookEvents:Object.freeze({total:webhookTotal,complaints:webhookComplaints,hardBounces:webhookHardBounces,transient:webhookTransient,unknownUsers:webhookUnknown}),
  gates,
  credentials,
  databasePreflight,
  dispatchHealth,
  readiness
 });
}
