/** B305-R34 — private marketing delivery worker.
 * No import side effects or scheduler. QA and production require separate explicit scopes.
 */
import {buildMarketingMessage} from './marketing-message-adapter.mjs';
import {sendResendFinanceEmail} from './finance-outbox-worker.mjs';
import {productionEmailDeliveryPolicy} from './production-delivery-policy.mjs';

const QA_BRANCH='fix/jenios-b305-finance-email-20261022';
const QA_PROJECT='prj_9cRnjWFRsLkfTToF4U4xZQBa7Gq9';
const SOCIAL_QA_URL='https://rebzztxlzofxpfwjvbee.supabase.co';
const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const fail=(code,retryable=false,suppressed=false)=>Object.assign(Error(code),{code,retryable,suppressed});

export function marketingDeliveryReadiness(env={}){
 const preview=env.VERCEL_ENV==='preview';
 const branch=env.VERCEL_GIT_COMMIT_REF===QA_BRANCH;
 const project=env.VERCEL_PROJECT_ID===QA_PROJECT&&env.JENIOS_B305_QA_PROJECT_ID===QA_PROJECT;
 const source=env.NEXT_PUBLIC_SUPABASE_URL===SOCIAL_QA_URL;
 const locked=['JENIOS_PAY_PAYMENTS_ENABLED','JENIOS_INTER_CHARGES_ENABLED',
  'JENIOS_REAL_EXECUTION_ENABLED','JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED',
  'JENIOS_PRIVATE_PAPER_EXECUTOR','JENIOS_PAYMENT_EMAILS_ENABLED',
  'JENIOS_B305_TEST_SEND_APPROVED','JENIOS_B305_PRIVATE_EMAIL_RUNNER_ENABLED']
  .every(key=>env[key]==='false');
 const enabled=env.JENIOS_MARKETING_EMAILS_ENABLED==='true';
 const apiKey=typeof env.RESEND_API_KEY==='string'&&/^re_[A-Za-z0-9_-]{11,}$/.test(env.RESEND_API_KEY);
 const serverKey=(typeof env.SUPABASE_SECRET_KEY==='string'&&env.SUPABASE_SECRET_KEY.startsWith('sb_secret_'))||
  (typeof env.SUPABASE_SERVICE_ROLE_KEY==='string'&&env.SUPABASE_SERVICE_ROLE_KEY.length>20);
 const domain=env.JENIOS_RESEND_EXPECTED_DOMAIN==='jenios.com.br'&&env.JENIOS_RESEND_DOMAIN_VERIFIED==='true';
 const isolated=preview&&branch&&project&&source&&locked&&env.JENIOS_EMAIL_PRODUCTION_ENABLED!=='true';
 const productionPolicy=productionEmailDeliveryPolicy(env);
 const mode=productionPolicy.ready?'production':isolated?'qa':null;
 return Object.freeze({
  ready:(isolated||productionPolicy.ready)&&enabled&&apiKey&&serverKey&&domain,
  mode,productionPolicy,
  isolated,preview,branch,project,sourceVerified:source,financialOperationsDisabled:locked,
  enabled,credentialsConfigured:apiKey&&serverKey,domainVerified:domain
 });
}

async function authIdentity(db,userId){
 if(!db?.auth?.admin?.getUserById)throw fail('MARKETING_IDENTITY_LOOKUP_UNAVAILABLE');
 const result=await db.auth.admin.getUserById(userId);
 const user=result?.data?.user;
 const email=String(user?.email||'').trim().toLowerCase();
 if(result?.error||user?.id!==userId||user?.is_anonymous===true||
   !user?.email_confirmed_at||!EMAIL.test(email))
  throw fail('MARKETING_RECIPIENT_NOT_VERIFIED');
 return {email,name:String(user.user_metadata?.full_name||'Cliente JENIOS').trim()||'Cliente JENIOS'};
}

async function one(db,table,id,columns){
 const {data,error}=await db.from(table).select(columns).eq('id',id).maybeSingle();
 if(error||!data)throw fail('MARKETING_REFERENCE_UNAVAILABLE');
 return data;
}

async function preference(db,userId){
 const {data,error}=await db.from('jenios_email_preferences_b305')
  .select('user_id,marketing_opt_in,opted_out_at,complaint_at,hard_bounce_at')
  .eq('user_id',userId).maybeSingle();
 if(error||!data)throw fail('MARKETING_CONSENT_MISSING',false,true);
 return data;
}

async function activePlan(db,userId){
 const {data,error}=await db.from('jenios_pay_subscriptions')
  .select('id').eq('user_id',userId).in('status',['active','past_due']).limit(1).maybeSingle();
 if(error)throw fail('MARKETING_PLAN_STATE_UNAVAILABLE');
 return Boolean(data?.id);
}

async function lastSent(db,userId,kind){
 const {data,error}=await db.from('jenios_marketing_email_ledger_b305')
  .select('sent_at').eq('user_id',userId).eq('campaign_kind',kind)
  .eq('status','sent').not('sent_at','is',null)
  .order('sent_at',{ascending:false}).limit(1).maybeSingle();
 if(error)throw fail('MARKETING_HISTORY_UNAVAILABLE');
 return data?.sent_at||null;
}

async function suppress(db,row,reason){
 const out=await db.rpc('jenios_suppress_marketing_email_b305',{
  p_id:row.id,p_lease:row.lease_token,p_reason:reason
 });
 if(out.error||out.data!==true)throw fail('MARKETING_SUPPRESSION_LEDGER_UNCONFIRMED');
}

async function release(db,row,reason,retryable){
 const out=await db.rpc('jenios_release_marketing_email_b305',{
  p_id:row.id,p_lease:row.lease_token,p_error_code:reason,p_retryable:retryable
 });
 if(out.error||out.data!==true)throw fail('MARKETING_LEASE_RECONCILIATION_REQUIRED');
}

async function complete(db,row,providerId){
 const out=await db.rpc('jenios_complete_marketing_email_b305',{
  p_id:row.id,p_lease:row.lease_token,p_provider_email_id:providerId
 });
 if(out.error||out.data!==true)throw fail('MARKETING_DELIVERY_LEDGER_UNCONFIRMED');
}

export async function runMarketingEmailBatch({db,env=process.env,fetcher,limit=5,now=Date.now()}={}){
 const gate=marketingDeliveryReadiness(env);
 if(!gate.ready)return Object.freeze({status:'DISABLED',claimed:0,sent:0,suppressed:0,failed:0});
 if(!db?.rpc)throw fail('MARKETING_DB_UNAVAILABLE');
 if(!Number.isSafeInteger(limit)||limit<1||limit>10)throw fail('MARKETING_BATCH_LIMIT_INVALID');

 const claim=await db.rpc('jenios_claim_marketing_email_b305',{p_limit:limit});
 if(claim.error||!Array.isArray(claim.data))throw fail('MARKETING_OUTBOX_CLAIM_FAILED');

 const result={status:gate.mode==='production'?'PRODUCTION':'QA_ONLY',claimed:claim.data.length,sent:0,suppressed:0,failed:0};

 for(const row of claim.data){
  try{
   if(!row?.id||!row?.lease_token)throw fail('MARKETING_LEASE_INVALID');

   const [identity,pref,last]=await Promise.all([
    authIdentity(db,row.user_id),
    preference(db,row.user_id),
    lastSent(db,row.user_id,row.campaign_kind)
   ]);

   let order=null,product=null,newsletter=null,hasActivePlan=false;

   if(row.campaign_kind==='cart_recovery'){
    order=await one(db,'jenios_pay_orders',row.order_id,'id,user_id,product_id,status,created_at');
    product=await one(db,'jenios_pay_products',row.product_id,'id,name,category,billing_type,active');
   }else if(row.campaign_kind==='no_plan_nurture'){
    hasActivePlan=await activePlan(db,row.user_id);
   }else if(row.campaign_kind==='newsletter'){
    newsletter=await one(db,'jenios_newsletter_editions_b305',row.newsletter_edition_id,
      'id,edition_key,subject,items,scheduled_at,status');
   }

   const message=buildMarketingMessage({
    row,preference:pref,to:identity.email,customerName:identity.name,
    order,product,newsletter,hasActivePlan,lastSentAt:last,now
   });

   const providerId=await sendResendFinanceEmail(message,{apiKey:env.RESEND_API_KEY,fetcher});
   await complete(db,row,providerId);
   result.sent+=1;
  }catch(error){
   const reason=/^(MARKETING_|RESEND_)/.test(error?.code||'')?error.code:'MARKETING_SEND_FAILED';
   if(error?.suppressed===true||error?.code==='MARKETING_NOT_ELIGIBLE'){
    await suppress(db,row,reason);
    result.suppressed+=1;
   }else{
    await release(db,row,reason,error?.retryable===true);
    result.failed+=1;
   }
  }
 }

 return Object.freeze(result);
}
