/**
 * R26 — fee evidence contract.
 * Never assumes a customer's live tier. Accepts either verified evidence or an explicitly synthetic stress profile.
 */
const fail=c=>{throw Object.assign(new Error(c),{code:c});};
const finite=x=>typeof x==='number'&&Number.isFinite(x);

export function normalizeFeeEvidence(e){
 if(!e||!['verified_account_tier','official_schedule_reference','synthetic_stress'].includes(e.kind)||
   !['binance','kraken','coinbase','generic'].includes(e.provider)||
   !finite(e.makerBps)||e.makerBps<0||!finite(e.takerBps)||e.takerBps<0||
   typeof e.sourceLabel!=='string'||e.sourceLabel.length<3||e.sourceLabel.length>160||
   !Number.isSafeInteger(e.observedAtMs)||e.observedAtMs<1||
   typeof e.accountTierVerified!=='boolean')
   fail('R26_INVALID_FEE_EVIDENCE');
 if(e.kind==='verified_account_tier'&&e.accountTierVerified!==true)fail('R26_UNVERIFIED_ACCOUNT_TIER');
 if(e.kind==='synthetic_stress'&&e.accountTierVerified!==false)fail('R26_SYNTHETIC_MUST_NOT_VERIFY_ACCOUNT');
 return Object.freeze({...e});
}

export function effectiveUltrafastCost({feeEvidence,spreadBps,slippageBps,fundingBps=0}={}){
 const e=normalizeFeeEvidence(feeEvidence);
 for(const x of [spreadBps,slippageBps,fundingBps])if(!finite(x)||x<0)fail('R26_INVALID_COST_INPUT');
 return Object.freeze({
  schema:'JENIOS_R26_EFFECTIVE_COST_V1',
  provider:e.provider,kind:e.kind,
  makerTotalBps:Number((e.makerBps+spreadBps/2+slippageBps+fundingBps).toFixed(6)),
  takerTotalBps:Number((e.takerBps+spreadBps/2+slippageBps+fundingBps).toFixed(6)),
  accountTierVerified:e.accountTierVerified,
  commercialFeeClaimAllowed:e.kind==='verified_account_tier',
  actualBrokerPnl:null,ordersSent:0
 });
}
