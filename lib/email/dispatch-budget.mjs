/** R42: limits for application delivery only. They do not represent the provider
 * account's total usage, which can also include Auth or other applications. */
const ISO_UTC=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const CHANNELS=new Set(['finance','transactional','dunning','marketing']);

function integer(env,key,fallback,max){
 const value=env[key];
 if(value===undefined||value==='')return fallback;
 if(typeof value!=='string'||!/^\d+$/.test(value))return null;
 const number=Number(value);
 return Number.isSafeInteger(number)&&number>=1&&number<=max?number:null;
}

export function emailDispatchLimits(env={},now=Date.now()){
 const raw=env.JENIOS_EMAIL_DELIVERY_START_AT;
 const start=typeof raw==='string'&&ISO_UTC.test(raw)?Date.parse(raw):NaN;
 const dailyLimit=integer(env,'JENIOS_EMAIL_APP_DAILY_LIMIT',40,90);
 const monthlyLimit=integer(env,'JENIOS_EMAIL_APP_MONTHLY_LIMIT',1000,2500);
 const marketingDailyLimit=integer(env,'JENIOS_EMAIL_MARKETING_DAILY_LIMIT',10,30);
 const marketingMonthlyLimit=integer(env,'JENIOS_EMAIL_MARKETING_MONTHLY_LIMIT',250,1000);
 const maxAgeHours=integer(env,'JENIOS_EMAIL_MAX_EVENT_AGE_HOURS',24,168);
 const batchLimit=integer(env,'JENIOS_EMAIL_DISPATCH_BATCH_LIMIT',1,2);
 const ready=Number.isFinite(now)&&Number.isFinite(start)&&start<=now&&
  [dailyLimit,monthlyLimit,marketingDailyLimit,marketingMonthlyLimit,maxAgeHours,batchLimit]
   .every(value=>value!==null)&&dailyLimit<=monthlyLimit&&
  marketingDailyLimit<dailyLimit&&marketingMonthlyLimit<monthlyLimit&&marketingDailyLimit<=marketingMonthlyLimit;
 return Object.freeze({ready,startAt:Number.isFinite(start)?new Date(start).toISOString():null,
  dailyLimit,monthlyLimit,marketingDailyLimit,marketingMonthlyLimit,maxAgeHours,batchLimit,
  scope:'application_delivery_only'});
}

const CLAIMS=Object.freeze({finance:'pay',transactional:'transactional',dunning:'dunning',marketing:'marketing'});
const DEFER_REASONS=new Set(['DAILY_LIMIT','MONTHLY_LIMIT','MARKETING_DAILY_LIMIT','MARKETING_MONTHLY_LIMIT']);
const fail=(code,retryable=false)=>Object.assign(Error(code),{code,retryable});
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function emailClaimRequest(channel,{production=false,limit,limits}={}){
 if(!CHANNELS.has(channel))throw fail('EMAIL_CHANNEL_INVALID');
 if(production&&!limits?.ready)throw fail('EMAIL_BUDGET_NOT_CONFIGURED');
 return Object.freeze({
  name:'jenios_claim_'+CLAIMS[channel]+'_email_'+(production?'r42':'b305'),
  args:production?{p_limit:limit,p_start_at:limits.startAt,p_max_age_hours:limits.maxAgeHours}:{p_limit:limit}
 });
}

/** Reserve before the provider request; denial is durably deferred without
 * spending a transport attempt. An accepted/uncertain reservation is retained. */
export async function reserveEmailDelivery({db,channel,row,message,limits,now=Date.now()}={}){
 if(!CHANNELS.has(channel)||!limits?.ready||!db?.rpc||!row?.id||!row?.lease_token||
  !/^[a-f0-9]{64}$/.test(message?.idempotencyKey||''))throw fail('EMAIL_BUDGET_CONTEXT_INVALID');
 const result=await db.rpc('jenios_reserve_email_budget_r42',{
  p_channel:channel,p_id:row.id,p_lease:row.lease_token,p_idempotency_key:message.idempotencyKey,
  p_daily_limit:limits.dailyLimit,p_monthly_limit:limits.monthlyLimit,
  p_marketing_daily_limit:limits.marketingDailyLimit,p_marketing_monthly_limit:limits.marketingMonthlyLimit
 });
 const data=Array.isArray(result?.data)&&result.data.length===1?result.data[0]:result?.data;
 if(result?.error||!data||Array.isArray(data)||typeof data.allowed!=='boolean')
  throw fail('EMAIL_BUDGET_UNCONFIRMED',true);
 if(data.allowed){
  if(!['RESERVED','REUSED'].includes(data.reason)||!UUID.test(data.reservation_id||'')||
   data.reused!==(data.reason==='REUSED'))throw fail('EMAIL_BUDGET_UNCONFIRMED',true);
  return true;
 }
 if(!DEFER_REASONS.has(data.reason))throw fail('EMAIL_BUDGET_BLOCKED');
 const retryAt=Date.parse(data.retry_at||'');
 if(!Number.isFinite(retryAt)||retryAt<=now||retryAt>now+35*86400000)
  throw fail('EMAIL_BUDGET_UNCONFIRMED',true);
 const deferred=await db.rpc('jenios_defer_email_r42',{
  p_channel:channel,p_id:row.id,p_lease:row.lease_token,
  p_reason:data.reason,p_retry_at:new Date(retryAt).toISOString()
 });
 if(deferred?.error||deferred?.data!==true)throw fail('EMAIL_BUDGET_DEFER_UNCONFIRMED',true);
 return false;
}

export function emailEventIsCurrent(channel,row,limits,now=Date.now()){
 if(!CHANNELS.has(channel)||!limits?.ready||!row)return false;
 const value=channel==='finance'?row.paid_at:channel==='marketing'?row.due_at:row.created_at;
 let eventAt=Date.parse(value||'');
 // Cadence can postpone an eligible campaign, but cannot revive a pre-activation
 // event or reset the age/window of an earlier provider attempt.
 if(channel==='marketing'){
  if(!Number.isFinite(eventAt)||eventAt<Date.parse(limits.startAt))return false;
  const deferredAt=Date.parse(row.cadence_deferred_until_r42||'');
  const attemptedAt=Date.parse(row.first_attempt_at||'');
  if(Number.isFinite(deferredAt)&&(row.first_attempt_at==null||attemptedAt>=deferredAt))
   eventAt=Math.max(eventAt,deferredAt);
 }
 return Number.isFinite(eventAt)&&eventAt>=Date.parse(limits.startAt)&&
  // A planner in the same bounded invocation can create a row after its start.
  eventAt>=now-limits.maxAgeHours*3600000&&eventAt<=now+60000;
}
