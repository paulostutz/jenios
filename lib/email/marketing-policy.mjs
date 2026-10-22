/** B305-R13 — Marketing eligibility and frequency policy. Pure/read-only. */
export function marketingEligibility({optedOut=false,complained=false,bounced=false,marketingOptIn=true,hasActivePlan=false,kind,lastSentAt,now=Date.now()}={}){
 if(optedOut||complained||bounced||marketingOptIn!==true)return {eligible:false,reason:'SUPPRESSED'};
 if(kind==='no_plan_nurture'&&hasActivePlan)return {eligible:false,reason:'HAS_PLAN'};
 const last=lastSentAt?Date.parse(lastSentAt):NaN;
 if(Number.isFinite(last)){
  const hours=(now-last)/3600000;
  if(kind==='newsletter'&&hours<144)return {eligible:false,reason:'WEEKLY_CAP'};
  if(kind==='cart_recovery'&&hours<20)return {eligible:false,reason:'CART_CAP'};
  if(kind==='no_plan_nurture'&&hours<144)return {eligible:false,reason:'NURTURE_CAP'};
 }
 return {eligible:true,reason:'OK'};
}
