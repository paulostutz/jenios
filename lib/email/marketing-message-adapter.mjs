import {marketingEligibility} from './marketing-policy.mjs';
import {cartRecoveryEmail,noPlanNurtureEmail,marketNewsletterEmail} from './lifecycle-campaigns.mjs';

const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PREF_URL='https://www.jenios.com.br/preferencias';

function ensureRecipient(to){
 const email=String(to||'').trim().toLowerCase();
 if(!EMAIL.test(email))throw Object.assign(Error('MARKETING_RECIPIENT_INVALID'),{code:'MARKETING_RECIPIENT_INVALID'});
 return email;
}

function ensureEligibility({row,preference,hasActivePlan=false,lastSentAt=null,now=Date.now()}){
 if(!row||!preference||preference.user_id!==row.user_id)
  throw Object.assign(Error('MARKETING_CONTEXT_INVALID'),{code:'MARKETING_CONTEXT_INVALID'});
 const verdict=marketingEligibility({
  marketingOptIn:preference.marketing_opt_in===true,
  optedOut:Boolean(preference.opted_out_at),
  complained:Boolean(preference.complaint_at),
  bounced:Boolean(preference.hard_bounce_at),
  hasActivePlan,
  kind:row.campaign_kind,
  lastSentAt,
  now
 });
 if(!verdict.eligible)
  throw Object.assign(Error('MARKETING_NOT_ELIGIBLE'),{code:'MARKETING_NOT_ELIGIBLE',reason:verdict.reason});
 return verdict;
}

function ensureNewsletterItems(items){
 if(!Array.isArray(items)||items.length<1||items.length>5)
  throw Object.assign(Error('NEWSLETTER_ITEMS_INVALID'),{code:'NEWSLETTER_ITEMS_INVALID'});
 return items.map(item=>{
  if(!item?.title||!item?.summary||!item?.sourceName||!item?.sourceUrl)
   throw Object.assign(Error('NEWSLETTER_ITEM_INVALID'),{code:'NEWSLETTER_ITEM_INVALID'});
  let url;
  try{url=new URL(String(item.sourceUrl));}catch{
   throw Object.assign(Error('NEWSLETTER_SOURCE_URL_INVALID'),{code:'NEWSLETTER_SOURCE_URL_INVALID'});
  }
  if(url.protocol!=='https:')
   throw Object.assign(Error('NEWSLETTER_SOURCE_URL_INVALID'),{code:'NEWSLETTER_SOURCE_URL_INVALID'});
  return {...item,sourceUrl:url.toString()};
 });
}

export function buildMarketingMessage({
 row,preference,to,customerName='Cliente JENIOS',
 order=null,product=null,newsletter=null,hasActivePlan=false,lastSentAt=null,now=Date.now()
}={}){
 const email=ensureRecipient(to);
 ensureEligibility({row,preference,hasActivePlan,lastSentAt,now});

 if(row.campaign_kind==='cart_recovery'){
  if(![1,2,3].includes(row.step)||!order||!product||
    row.order_id!==order.id||row.campaign_key!==order.id||
    row.user_id!==order.user_id||row.product_id!==order.product_id||
    order.status!=='awaiting_payment'||product.id!==row.product_id||
    product.category!=='platform'||product.billing_type!=='monthly'||product.active!==true)
   throw Object.assign(Error('MARKETING_CART_CONTEXT_INVALID'),{code:'MARKETING_CART_CONTEXT_INVALID'});
  return cartRecoveryEmail({
   cartId:order.id,to:email,customerName,planName:product.name,
   step:row.step,unsubscribeUrl:PREF_URL
  });
 }

 if(row.campaign_kind==='no_plan_nurture'){
  if(![1,2].includes(row.step)||row.campaign_key!==row.user_id||hasActivePlan)
   throw Object.assign(Error('MARKETING_NURTURE_CONTEXT_INVALID'),{code:'MARKETING_NURTURE_CONTEXT_INVALID'});
  return noPlanNurtureEmail({
   userId:row.user_id,to:email,customerName,step:row.step,unsubscribeUrl:PREF_URL
  });
 }

 if(row.campaign_kind==='newsletter'){
  if(row.step!==0||!newsletter||row.newsletter_edition_id!==newsletter.id||
    row.campaign_key!==newsletter.edition_key||newsletter.status!=='approved')
   throw Object.assign(Error('MARKETING_NEWSLETTER_CONTEXT_INVALID'),{code:'MARKETING_NEWSLETTER_CONTEXT_INVALID'});
  const scheduled=Date.parse(newsletter.scheduled_at||'');
  if(!Number.isFinite(scheduled)||scheduled>now)
   throw Object.assign(Error('MARKETING_NEWSLETTER_NOT_DUE'),{code:'MARKETING_NEWSLETTER_NOT_DUE'});
  return marketNewsletterEmail({
   editionId:newsletter.edition_key,to:email,customerName,
   items:ensureNewsletterItems(newsletter.items),unsubscribeUrl:PREF_URL
  });
 }

 throw Object.assign(Error('MARKETING_KIND_INVALID'),{code:'MARKETING_KIND_INVALID'});
}
