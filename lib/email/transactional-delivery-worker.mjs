/** B305-R16 — private delivery workers for transactional lifecycle and dunning.
 * No scheduler or import side effects. Disabled unless the dedicated QA Preview
 * is explicitly armed; finance/execution gates must remain off.
 */
import {socialWelcomeEmail,planActivatedEmail,planCancellationScheduledEmail,planCancelledEmail,planReactivatedEmail,planChangedEmail} from './lifecycle-campaigns.mjs';
import {subscriptionDunningEmail} from './subscription-dunning.mjs';
import {sendResendFinanceEmail} from './finance-outbox-worker.mjs';
import {JENIOS_FINANCE_SENDER} from './jenios-identity.mjs';
import {buildUniversityMilestoneMessage} from './university-milestone-message.mjs';

const QA_BRANCH='fix/jenios-b305-finance-email-20261022';
const QA_PROJECT='prj_9cRnjWFRsLkfTToF4U4xZQBa7Gq9';
const SOCIAL_QA_URL='https://rebzztxlzofxpfwjvbee.supabase.co';
const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DAY=24*60*60*1000;
const fail=(code,retryable=false)=>Object.assign(Error(code),{code,retryable});

export function transactionalDeliveryReadiness(env={}){
 const preview=env.VERCEL_ENV==='preview';
 const branch=env.VERCEL_GIT_COMMIT_REF===QA_BRANCH;
 const project=env.JENIOS_B305_QA_PROJECT_ID===QA_PROJECT &&
  env.VERCEL_PROJECT_ID===QA_PROJECT;
 const source=env.NEXT_PUBLIC_SUPABASE_URL===SOCIAL_QA_URL;
 const locked=['JENIOS_PAY_PAYMENTS_ENABLED','JENIOS_INTER_CHARGES_ENABLED',
  'JENIOS_REAL_EXECUTION_ENABLED','JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED',
  'JENIOS_PRIVATE_PAPER_EXECUTOR','JENIOS_PAYMENT_EMAILS_ENABLED',
  'JENIOS_B305_TEST_SEND_APPROVED','JENIOS_B305_PRIVATE_EMAIL_RUNNER_ENABLED',
  'JENIOS_SUBSCRIPTION_DUNNING_ENABLED'].every(k=>env[k]==='false');
 const enabled=env.JENIOS_TRANSACTIONAL_EMAILS_ENABLED==='true';
 const apiKey=typeof env.RESEND_API_KEY==='string'&&/^re_[A-Za-z0-9_-]{11,}$/.test(env.RESEND_API_KEY);
 const serverKey=(typeof env.SUPABASE_SECRET_KEY==='string'&&env.SUPABASE_SECRET_KEY.startsWith('sb_secret_'))||
  (typeof env.SUPABASE_SERVICE_ROLE_KEY==='string'&&env.SUPABASE_SERVICE_ROLE_KEY.length>20);
 const sender=env.JENIOS_PAYMENT_EMAIL_FROM===JENIOS_FINANCE_SENDER;
 const domain=env.JENIOS_RESEND_EXPECTED_DOMAIN==='jenios.com.br'&&env.JENIOS_RESEND_DOMAIN_VERIFIED==='true';
 const isolated=preview&&branch&&project&&source&&locked;
 return Object.freeze({ready:isolated&&enabled&&apiKey&&serverKey&&sender&&domain,
  isolated,preview,branch,project,sourceVerified:source,financialOperationsDisabled:locked,
  enabled,credentialsConfigured:apiKey&&serverKey,senderVerified:sender,domainVerified:domain});
}

export function validatePlanActivationEvidence(row,subscription,product,order,entitlement){
 return validateSubscriptionLifecycleEvidence('plan_activated',row,subscription,product,{order,entitlement});
}

export function validateSubscriptionLifecycleEvidence(eventKind,row,subscription,product,{order=null,entitlement=null,previousProduct=null}={}){
 if(!row||!subscription||!product||row.event_kind!==eventKind||
  subscription.id!==row.subscription_id||subscription.user_id!==row.user_id||
  subscription.product_id!==row.product_id||product.id!==row.product_id||
  product.category!=='platform'||product.billing_type!=='monthly')return false;

 if(eventKind==='plan_cancel_scheduled')
  return subscription.cancel_at_period_end===true&&
   ['active','past_due'].includes(subscription.status)&&
   Number.isFinite(Date.parse(subscription.current_period_end||''));

 if(eventKind==='plan_cancelled')
  return subscription.cancel_at_period_end===true&&subscription.status==='cancelled'&&
   Number.isFinite(Date.parse(subscription.current_period_end||''));

 const paid=Boolean(subscription.status==='active'&&subscription.latest_order_id&&
  product.active===true&&order?.id===subscription.latest_order_id&&
  order.user_id===row.user_id&&order.product_id===row.product_id&&
  order.status==='paid'&&order.currency==='BRL'&&
  entitlement?.order_id===order.id&&entitlement.user_id===row.user_id&&
  entitlement.product_id===row.product_id&&entitlement.status==='active');
 if(eventKind==='plan_activated'||eventKind==='plan_reactivated')return paid;
 if(eventKind==='plan_changed')return paid&&row.previous_product_id&&
  previousProduct?.id===row.previous_product_id&&previousProduct.id!==product.id&&
  previousProduct.category==='platform'&&previousProduct.billing_type==='monthly';
 return false;
}

export function validateDunningEvidence(row,subscription,product,{now=Date.now()}={}){
 if(!row||!subscription||!product||subscription.id!==row.subscription_id||
  subscription.user_id!==row.user_id||subscription.product_id!==row.product_id||
  product.id!==row.product_id||product.category!=='platform'||product.billing_type!=='monthly')
  return false;
 const due=Date.parse(row.due_at||''),current=typeof now==='number'?now:Date.parse(now||'');
 if(!Number.isFinite(due)||!Number.isFinite(current)||
  Date.parse(subscription.current_period_end||'')!==due)return false;
 if(row.event_kind==='due_soon_3d')return subscription.status==='active'&&current>=due-3*DAY&&current<due;
 if(row.event_kind==='due_today')return subscription.status==='active'&&current>=due&&current<due+DAY;
 if(row.event_kind==='past_due_1d')return subscription.status==='past_due'&&current>=due+DAY&&current<due+7*DAY;
 if(row.event_kind==='cancelled_7d')return subscription.status==='cancelled'&&current>=due+7*DAY;
 return false;
}

async function authUser(db,userId){
 if(!db?.auth?.admin?.getUserById)throw fail('EMAIL_IDENTITY_LOOKUP_UNAVAILABLE');
 const result=await db.auth.admin.getUserById(userId),user=result?.data?.user;
 const email=String(user?.email||'').trim().toLowerCase();
 if(result?.error||user?.id!==userId||user?.is_anonymous===true||
  !user?.email_confirmed_at||!EMAIL.test(email))throw fail('EMAIL_RECIPIENT_NOT_VERIFIED');
 return {user,email,name:String(user.user_metadata?.full_name||'Cliente JENIOS').trim()||'Cliente JENIOS'};
}
async function one(db,table,id,columns){
 const {data,error}=await db.from(table).select(columns).eq('id',id).maybeSingle();
 if(error||!data)throw fail('EMAIL_REFERENCE_UNAVAILABLE');
 return data;
}
async function learningState(db,userId){
 const {data,error}=await db.from('jenios_learning_state')
  .select('user_id,revision,state,updated_at').eq('user_id',userId).maybeSingle();
 if(error||!data)throw fail('EMAIL_LEARNING_STATE_UNAVAILABLE');
 return data;
}
async function entitlement(db,{orderId,userId,productId}){
 const {data,error}=await db.from('jenios_pay_entitlements')
  .select('order_id,user_id,product_id,status').eq('order_id',orderId)
  .eq('user_id',userId).eq('product_id',productId).maybeSingle();
 if(error||!data)throw fail('EMAIL_ENTITLEMENT_UNAVAILABLE');
 return data;
}
async function send(message,env,fetcher){
 return sendResendFinanceEmail(message,{apiKey:env.RESEND_API_KEY,fetcher});
}
async function release(db,rpc,row,reason,retryable){
 const out=await db.rpc(rpc,{p_id:row.id,p_lease:row.lease_token,p_error_code:reason,p_retryable:retryable});
 if(out.error||out.data!==true)throw fail('EMAIL_LEASE_RECONCILIATION_REQUIRED');
}
async function complete(db,rpc,row,providerId){
 const out=await db.rpc(rpc,{p_id:row.id,p_lease:row.lease_token,p_provider_email_id:providerId});
 if(out.error||out.data!==true)throw fail('EMAIL_DELIVERY_LEDGER_UNCONFIRMED');
}

export async function runTransactionalEmailBatch({db,env=process.env,fetcher,limit=5}={}){
 const gate=transactionalDeliveryReadiness(env);
 if(!gate.ready)return Object.freeze({status:'DISABLED',claimed:0,sent:0,blocked:0});
 if(!db?.rpc)throw fail('EMAIL_DB_UNAVAILABLE');
 if(!Number.isSafeInteger(limit)||limit<1||limit>10)throw fail('EMAIL_BATCH_LIMIT_INVALID');
 const claim=await db.rpc('jenios_claim_transactional_email_b305',{p_limit:limit});
 if(claim.error||!Array.isArray(claim.data))throw fail('EMAIL_OUTBOX_CLAIM_FAILED');
 const result={status:'QA_ONLY',claimed:claim.data.length,sent:0,blocked:0};
 for(const row of claim.data){
  let sent=false,reason='EMAIL_SEND_BLOCKED',retryable=false;
  try{
   if(!row?.id||!row?.lease_token)throw fail('EMAIL_LEASE_INVALID');
   const identity=await authUser(db,row.user_id);
   let message;
   if(row.event_kind==='social_welcome'){
    if(identity.user.user_metadata?.registration_source!=='social')throw fail('EMAIL_EVENT_SOURCE_INVALID');
    message=socialWelcomeEmail({userId:row.user_id,to:identity.email,customerName:identity.name});
   }else if(['plan_activated','plan_cancel_scheduled','plan_cancelled','plan_reactivated','plan_changed'].includes(row.event_kind)){
    const subscription=await one(db,'jenios_pay_subscriptions',row.subscription_id,'id,user_id,product_id,latest_order_id,status,current_period_start,current_period_end,cancel_at_period_end');
    const product=await one(db,'jenios_pay_products',row.product_id,'id,name,category,billing_type,active,price_cents');
    let order=null,ent=null,previousProduct=null;
    if(['plan_activated','plan_reactivated','plan_changed'].includes(row.event_kind)){
      order=await one(db,'jenios_pay_orders',subscription.latest_order_id,'id,user_id,product_id,status,currency');
      ent=await entitlement(db,{orderId:order.id,userId:row.user_id,productId:row.product_id});
    }
    if(row.event_kind==='plan_changed')
      previousProduct=await one(db,'jenios_pay_products',row.previous_product_id,'id,name,category,billing_type,active,price_cents');
    if(!validateSubscriptionLifecycleEvidence(row.event_kind,row,subscription,product,{order,entitlement:ent,previousProduct}))
      throw fail('EMAIL_SUBSCRIPTION_EVENT_UNVERIFIED');
    if(row.event_kind==='plan_activated')
      message=planActivatedEmail({subscriptionId:subscription.id,to:identity.email,customerName:identity.name,planName:product.name});
    if(row.event_kind==='plan_cancel_scheduled')
      message=planCancellationScheduledEmail({subscriptionId:subscription.id,to:identity.email,customerName:identity.name,planName:product.name,effectiveAt:subscription.current_period_end});
    if(row.event_kind==='plan_cancelled')
      message=planCancelledEmail({subscriptionId:subscription.id,to:identity.email,customerName:identity.name,planName:product.name,effectiveAt:subscription.current_period_end});
    if(row.event_kind==='plan_reactivated')
      message=planReactivatedEmail({subscriptionId:subscription.id,cycleKey:subscription.latest_order_id,to:identity.email,customerName:identity.name,planName:product.name});
    if(row.event_kind==='plan_changed')
      message=planChangedEmail({subscriptionId:subscription.id,changeKey:subscription.latest_order_id,to:identity.email,customerName:identity.name,previousPlanName:previousProduct.name,planName:product.name});
   }else if(row.event_kind==='university_milestone'){
    const learning=await learningState(db,row.user_id);
    message=buildUniversityMilestoneMessage({
      row,learning,to:identity.email,customerName:identity.name
    });
   }else throw fail('EMAIL_EVENT_KIND_INVALID');
   const providerId=await send(message,env,fetcher);
   await complete(db,'jenios_complete_transactional_email_b305',row,providerId);
   sent=true;result.sent++;
  }catch(error){
   reason=/^(EMAIL_|RESEND_)/.test(error?.code||'')?error.code:'EMAIL_SEND_BLOCKED';
   retryable=error?.retryable===true;
  }
  if(!sent){await release(db,'jenios_release_transactional_email_b305',row,reason,retryable);result.blocked++;}
 }
 return Object.freeze(result);
}

export async function runDunningEmailBatch({db,env=process.env,fetcher,limit=5,now=Date.now()}={}){
 const gate=transactionalDeliveryReadiness(env);
 if(!gate.ready)return Object.freeze({status:'DISABLED',claimed:0,sent:0,blocked:0});
 if(!db?.rpc)throw fail('EMAIL_DB_UNAVAILABLE');
 if(!Number.isSafeInteger(limit)||limit<1||limit>10)throw fail('EMAIL_BATCH_LIMIT_INVALID');
 const claim=await db.rpc('jenios_claim_dunning_email_b305',{p_limit:limit});
 if(claim.error||!Array.isArray(claim.data))throw fail('DUNNING_OUTBOX_CLAIM_FAILED');
 const result={status:'QA_ONLY',claimed:claim.data.length,sent:0,blocked:0};
 for(const row of claim.data){
  let sent=false,reason='DUNNING_SEND_BLOCKED',retryable=false;
  try{
   if(!row?.id||!row?.lease_token)throw fail('EMAIL_LEASE_INVALID');
   const identity=await authUser(db,row.user_id);
   const subscription=await one(db,'jenios_pay_subscriptions',row.subscription_id,'id,user_id,product_id,latest_order_id,status,current_period_end');
   const product=await one(db,'jenios_pay_products',row.product_id,'id,name,category,billing_type,active');
   if(!validateDunningEvidence(row,subscription,product,{now}))throw fail('DUNNING_EVIDENCE_STALE');
   const message=subscriptionDunningEmail({eventKind:row.event_kind,subscriptionId:row.subscription_id,
    productName:product.name,dueAt:row.due_at,to:identity.email,customerName:identity.name});
   const providerId=await send(message,env,fetcher);
   await complete(db,'jenios_complete_dunning_email_b305',row,providerId);
   sent=true;result.sent++;
  }catch(error){
   reason=/^(EMAIL_|DUNNING_|RESEND_)/.test(error?.code||'')?error.code:'DUNNING_SEND_BLOCKED';
   retryable=error?.retryable===true;
  }
  if(!sent){await release(db,'jenios_release_dunning_email_b305',row,reason,retryable);result.blocked++;}
 }
 return Object.freeze(result);
}
