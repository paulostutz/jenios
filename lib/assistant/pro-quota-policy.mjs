/** G45 — approved provider-cost budgets; presentation never grants a balance.
 * The existing financial ledger debits 2x provider cost. These limits are API
 * cost, while the matching stored allowances are 4e9 / 8e9 ledger nanoUSD.
 * Activation and a verified active subscription remain server responsibilities.
 */
export const PRO_APPROVED_PROVIDER_BUDGETS=Object.freeze({
 'platform-global-crypto':2_000_000_000,
 'platform-internacional-pro':4_000_000_000
});
export const PRO_QUOTA_WARNING_PERCENT=80;
const MAX_NANO_USD=1_000_000_000_000_000;
const amount=value=>{
 if(typeof value==='string'&&/^(0|[1-9]\d{0,15})$/.test(value))value=Number(value);
 return Number.isSafeInteger(value)&&value>=0&&value<=MAX_NANO_USD?value:null;
};
export function proEligibleSubscription(plan,now=Date.now()){
 if(!plan||typeof plan.code!=='string'||!Object.hasOwn(PRO_APPROVED_PROVIDER_BUDGETS,plan.code))return false;
 const start=Date.parse(plan.periodStart),end=Date.parse(plan.periodEnd);
 return Number.isFinite(now)&&Number.isFinite(start)&&Number.isFinite(end)&&start<=now&&end>now&&end>start;
}
export function proQuotaSummary(allowance){
 const periodEnd=typeof allowance?.periodEnd==='string'&&Number.isFinite(Date.parse(allowance.periodEnd))?allowance.periodEnd:null;
 const transitionRequired=allowance?.status==='pending_transition'&&allowance.transitionRequired===true&&allowance.transitionCode==='INCLUDED_PERIOD_TRANSITION_REQUIRED';
 const unknown={state:'unconfigured',usedPercent:null,providerLimitNanoUsd:null,providerSpentNanoUsd:null,
  providerReservedNanoUsd:null,providerAvailableNanoUsd:null,periodEnd,
  ...(transitionRequired?{transitionRequired:true,transitionCode:'INCLUDED_PERIOD_TRANSITION_REQUIRED'}:{})};
 if(allowance?.status!=='configured'||!periodEnd)return unknown;
 const total=amount(allowance.totalNanoUsd),spent=amount(allowance.spentNanoUsd),reserved=amount(allowance.reservedNanoUsd),available=amount(allowance.availableNanoUsd);
 if([total,spent,reserved,available].some(n=>n===null)||total===0||spent+reserved>total||available!==total-spent-reserved)return unknown;
 const committed=BigInt(spent)+BigInt(reserved),limit=BigInt(total);
 const state=available===0?'exhausted':committed*100n>=limit*BigInt(PRO_QUOTA_WARNING_PERCENT)?'near_limit':'available';
 // Half a nanoUSD is exact in JS; never round away fractions or turn missing
 // accounting into a zero-cost claim. Percentage includes outstanding holds.
 return {state,usedPercent:Number(committed*10_000n/limit)/100,
  providerLimitNanoUsd:total/2,providerSpentNanoUsd:spent/2,
  providerReservedNanoUsd:reserved/2,providerAvailableNanoUsd:available/2,periodEnd};
}
