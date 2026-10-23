/**
 * R59 — final research certification gate for Manual, Hybrid, Reverse and UltraFast.
 * Reads the master ledger shape supplied by caller and enforces permanent invariants.
 */
const fail=c=>{throw Object.assign(new Error(c),{code:c});};

export function certifyR59Ledger(ledger){
 if(!ledger||typeof ledger!=='object'||!Array.isArray(ledger.robots))fail('R59_INVALID_LEDGER');
 const byName=Object.fromEntries(ledger.robots.map(r=>[r.robot,r]));
 const required=['manual','hybrid','reverse','ultrafast'];
 const missing=required.filter(k=>!byName[k]);
 const issues=[];
 if(missing.length)issues.push('MISSING_ROBOTS:'+missing.join(','));

 const g=ledger.globalRules||{};
 if(g.realOrdersSent!==0)issues.push('REAL_ORDERS_NOT_ZERO');
 if(g.externalPaperOrdersSent!==0)issues.push('EXTERNAL_PAPER_NOT_ZERO');
 if(g.productionDeployPerformed!==false)issues.push('PRODUCTION_DEPLOY_FLAG_NOT_FALSE');
 if(g.actualBrokerPnl!==null)issues.push('ACTUAL_BROKER_PNL_NOT_NULL');
 if(g.actualLossesAvoided!==null)issues.push('ACTUAL_LOSSES_AVOIDED_NOT_NULL');
 if(g.realTradeAccuracy!==null)issues.push('REAL_TRADE_ACCURACY_NOT_NULL');
 if(g.commercialPerformanceCertified!==false)issues.push('COMMERCIAL_PERFORMANCE_MUST_REMAIN_UNCERTIFIED');

 if(byName.manual){
   if(byName.manual.status!=='RESEARCH_VALIDATED_FINAL')issues.push('MANUAL_NOT_FINAL_RESEARCH_VALIDATED');
   const r15=byName.manual.prospectiveEvidence?.r15;
   if(r15!=='W01_VALID_W02_NO_GO_OTHER_WINDOWS_NOT_RETROFILLED')issues.push('R15_PROSPECTIVE_BACKFILL_INVARIANT_BROKEN');
 }
 if(byName.hybrid){
   if(byName.hybrid.status!=='RESEARCH_VALIDATED_FINAL')issues.push('HYBRID_NOT_FINAL_RESEARCH_VALIDATED');
   if(byName.hybrid.alignmentGuardThreshold!==.65)issues.push('HYBRID_ALIGNMENT_THRESHOLD_CHANGED');
 }
 if(byName.reverse){
   if(byName.reverse.status!=='RESEARCH_VALIDATED_FINAL')issues.push('REVERSE_NOT_FINAL_RESEARCH_VALIDATED');
   if(byName.reverse.alignmentGuardThreshold!==.65)issues.push('REVERSE_ALIGNMENT_THRESHOLD_CHANGED');
   if(byName.reverse.finalRefinement?.r58?.losseshometroSyntheticOnly!==true)issues.push('LOSSESHOMETRO_NOT_SYNTHETIC_ONLY');
 }
 if(byName.ultrafast){
   if(byName.ultrafast.technicalSafety!=='PASS')issues.push('ULTRAFAST_TECHNICAL_SAFETY_NOT_PASS');
   if(byName.ultrafast.commercialAccess?.perTradeFee!==false)issues.push('ULTRAFAST_PER_TRADE_FEE_CHANGED');
 }

 for(const r of ledger.robots){
   if(r.syntheticPerformance?.notes&&/real|broker/i.test(r.syntheticPerformance.notes)&&!/não é PnL real|sintétic/i.test(r.syntheticPerformance.notes)){
     issues.push('AMBIGUOUS_SYNTHETIC_LABEL:'+r.robot);
   }
 }

 return Object.freeze({
   schema:'JENIOS_R59_FINAL_CERTIFICATION_V1',
   scope:ledger.scope,
   robots:Object.freeze(required),
   issues:Object.freeze(issues),
   pass:issues.length===0,
   classification:issues.length===0?'RESEARCH_CERTIFIED_FINAL':'RESEARCH_CERTIFICATION_FAILED',
   productionApproved:false,
   commercialPerformanceCertified:false,
   realOrdersSent:g.realOrdersSent??null,
   externalPaperOrdersSent:g.externalPaperOrdersSent??null,
   actualBrokerPnl:g.actualBrokerPnl??null,
   actualLossesAvoided:g.actualLossesAvoided??null,
   realTradeAccuracy:g.realTradeAccuracy??null
 });
}