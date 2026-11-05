/** R112 / Block 3 — bind new R112 guards to unmodified R111 UltraFast V2.
 * All outputs remain research-only. Fail closed on missing evidence.
 */
export function evaluateUltraV3ResearchReadiness({v2Report,book,exchangeRule,
 tokenSecurity,stressBudget,watchdog,holdout=null}={}){
 const blockers=[];
 if(v2Report?.schema!=='JENIOS_ULTRA_V2_CERTIFIED_RESEARCH_CYCLE_V1'||
    v2Report.eligibleForFurtherResearch!==true)blockers.push('R111_V2_RESEARCH_GATE');
 if(book?.allow!==true)blockers.push('R112_BOOK_INTEGRITY');
 if(exchangeRule?.allowResearchProposal!==true)blockers.push('R112_EXCHANGE_RULES');
 if(tokenSecurity?.eligibleForFurtherResearch!==true)blockers.push('R112_TOKEN_RISK');
 if(stressBudget?.allowFurtherResearch!==true)blockers.push('R112_PORTFOLIO_STRESS');
 if(watchdog?.healthy!==true)blockers.push('R112_WATCHDOG');
 if(holdout!==null&&(
   holdout?.schema!=='JENIOS_R112_WALK_FORWARD_V1'||
   holdout.passingCandidateIds?.length===0))blockers.push('R112_HOLDOUT_EVIDENCE');
 return Object.freeze({schema:'JENIOS_R112_COMPOSITE_RESEARCH_GATE_V1',
  canContinueOfflineResearch:blockers.length===0,
  blockers:Object.freeze(blockers),automaticModelPromotion:false,
  exchangeTransportImplemented:false,financialPerformanceCertified:false,
  externalPaperEnabled:false,liveExecutionEnabled:false,ordersSent:0});
}