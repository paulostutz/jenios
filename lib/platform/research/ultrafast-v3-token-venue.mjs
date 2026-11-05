/** R112 / Block 1 — risk heuristics for token & venue comparison.
 * Offline metadata only; cannot certify that a token is safe or tradeable.
 */
const fail=c=>{throw Object.assign(Error(c),{code:c});};
const f=x=>typeof x==='number'&&Number.isFinite(x);
const round=x=>Number(x.toFixed(8));
export function inspectUltraTokenSecurity(x){
 if(!x||!['native','token','stablecoin'].includes(x.assetClass)||
    typeof x.chain!=='string'||!x.chain.trim()||typeof x.symbol!=='string'||!x.symbol.trim()||
    !Number.isSafeInteger(x.observedAtMs)||!Number.isSafeInteger(x.nowMs)||
    x.observedAtMs>x.nowMs)fail('R112_TOKEN_INVALID_INPUT');
 const reasons=[];
 if(x.nowMs-x.observedAtMs>120000)reasons.push('TOKEN_EVIDENCE_STALE');
 if(x.assetClass!=='native'){
   if(!['VERIFIED','UNVERIFIED','UNKNOWN'].includes(x.contractVerification))
     fail('R112_TOKEN_INVALID_VERIFICATION');
   if(x.contractVerification!=='VERIFIED')reasons.push('CONTRACT_NOT_VERIFIED');
   if(x.canSell!==true)reasons.push('SALE_NOT_PROVEN');
   if(x.hasOwnerPrivileges!==false)reasons.push('PRIVILEGED_OWNER_NOT_CLEARED');
   if(x.mintAuthorityActive!==false)reasons.push('MINT_AUTHORITY_RISK');
   if(x.freezeAuthorityActive!==false)reasons.push('FREEZE_AUTHORITY_RISK');
   if(!f(x.top10HolderPct)||x.top10HolderPct<0||x.top10HolderPct>100)reasons.push('HOLDER_DATA_UNVERIFIED');
   else if(x.top10HolderPct>65)reasons.push('HIGH_HOLDER_CONCENTRATION');
   if(!f(x.buyTaxBps)||!f(x.sellTaxBps)||x.buyTaxBps<0||x.sellTaxBps<0)
     reasons.push('TAXES_UNVERIFIED');
   else if(x.buyTaxBps+x.sellTaxBps>150)reasons.push('TRANSFER_TAX_RISK');
   if(!f(x.liquidityUsd)||x.liquidityUsd<0)reasons.push('LIQUIDITY_UNVERIFIED');
   else if(x.liquidityUsd<250000)reasons.push('LOW_TOKEN_LIQUIDITY');
   if(x.liquidityCanBeRemoved!==false)reasons.push('LIQUIDITY_REMOVAL_RISK');
 }
 if(x.assetClass==='stablecoin'){
   if(!f(x.usdReferencePrice)||x.usdReferencePrice<=0)reasons.push('PEG_REFERENCE_UNVERIFIED');
   else if(Math.abs(x.usdReferencePrice-1)>=.015)reasons.push('STABLECOIN_DEPEG_RISK');
 }
 return Object.freeze({schema:'JENIOS_R112_TOKEN_RISK_V1',symbol:x.symbol,
   riskFlags:Object.freeze(reasons),eligibleForFurtherResearch:reasons.length===0,
   safetyCertified:false,contractAuditedByJenios:false,readOnly:true,ordersSent:0});
}

/** Compare same base/quote on two venues. Both accounts must be pre-funded.
 * Transfer during execution is NOT modeled. A price dislocation is only a
 * research hypothesis, never an executable arbitrage guarantee.
 */
export function compareUltraVenuePrices(quotes,{nowMs,maxAgeMs=1000,minEdgeBps=5,
 availableBaseOnSellVenue=0,availableQuoteOnBuyVenue=0,tradeBaseQty=0}={}){
 if(!Array.isArray(quotes)||quotes.length<2||quotes.length>100||
   !Number.isSafeInteger(nowMs)||!Number.isSafeInteger(maxAgeMs)||maxAgeMs<1||
   !f(minEdgeBps)||minEdgeBps<0||!f(availableBaseOnSellVenue)||!f(availableQuoteOnBuyVenue)||
   !f(tradeBaseQty)||availableBaseOnSellVenue<0||availableQuoteOnBuyVenue<0||tradeBaseQty<=0)
   fail('R112_VENUE_INVALID_INPUT');
 const seen=new Set();
 for(const q of quotes){
   if(!q||typeof q.venue!=='string'||!q.venue||typeof q.base!=='string'||!q.base||
     typeof q.quote!=='string'||!q.quote||!f(q.bid)||!f(q.ask)||q.bid<=0||q.ask<q.bid||
     !f(q.takerFeeBps)||q.takerFeeBps<0||!f(q.slippageBps)||q.slippageBps<0||
     !f(q.depthBase)||q.depthBase<0||!Number.isSafeInteger(q.timestampMs)||q.timestampMs>nowMs)
     fail('R112_VENUE_INVALID_QUOTE');
   if(q.base!==quotes[0].base||q.quote!==quotes[0].quote)fail('R112_VENUE_NOT_COMPARABLE');
   if(seen.has(q.venue))fail('R112_VENUE_DUPLICATE');seen.add(q.venue);
 }
 let best=null;
 for(const buy of quotes)for(const sell of quotes){
   if(buy.venue===sell.venue)continue;
   const mid=(buy.ask+sell.bid)/2;
   const grossBps=(sell.bid-buy.ask)/mid*10000;
   const costs=buy.takerFeeBps+sell.takerFeeBps+buy.slippageBps+sell.slippageBps;
   const netBps=grossBps-costs;
   const blocked=[];
   if(nowMs-buy.timestampMs>maxAgeMs||nowMs-sell.timestampMs>maxAgeMs)blocked.push('STALE_CROSS_VENUE_QUOTE');
   if(buy.depthBase<tradeBaseQty||sell.depthBase<tradeBaseQty)blocked.push('INSUFFICIENT_VISIBLE_DEPTH');
   if(availableBaseOnSellVenue<tradeBaseQty||availableQuoteOnBuyVenue<buy.ask*tradeBaseQty*(1+buy.takerFeeBps/10000))
     blocked.push('PREFUNDING_REQUIRED');
   if(netBps<minEdgeBps)blocked.push('INSUFFICIENT_NET_DISLOCATION');
   const candidate={buyVenue:buy.venue,sellVenue:sell.venue,symbol:`${buy.base}/${buy.quote}`,
     grossSpreadBps:round(grossBps),estimatedCostsBps:round(costs),
     estimatedNetBps:round(netBps),eligibleForResearch:blocked.length===0,
     blockers:Object.freeze(blocked),requiresSimultaneousExecution:true,
     transferNotModeled:true,liveExecutionEnabled:false,ordersSent:0};
   if(!best || (candidate.eligibleForResearch&&!best.eligibleForResearch) ||
      (candidate.eligibleForResearch===best.eligibleForResearch &&
       candidate.estimatedNetBps>best.estimatedNetBps))best=candidate;
 }
 return Object.freeze({schema:'JENIOS_R112_VENUE_COMPARISON_V1',...best,
   capitalOnEachVenueNotVerified:true,actualFillUnknown:true,notArbitrageGuarantee:true});
}