/** B194: conservative research-only gate for externally audited historical/prospective results.
 * Never authorizes order transmission, adjusts private robot strategy or promises profit.
 */
const MODES=['direct','reverse','hybrid'];
const ASSETS=['BTCUSDT','ETHUSDT','SOLUSDT'];
const COSTS=[0,10,30];
const denied=(reason,counts={})=>Object.freeze({schema:'JENIOS_B194_HOLDOUT_REVIEW',
 classification:'RESEARCH_ONLY_NO_GO',reason,counts,
 independentDataProvenance:false,allCostRegimesRobust:false,
 robotPerformanceCertified:false,liveExecutionAuthorized:false,ordersSent:0});
export function auditOriginalHoldoutEvidence(evidence){
 if(!evidence||evidence.originalCoreSha256!=='9341d9243cbe742b90bf40149663e632fc472f5586c74bf70bdfcfd114e65aea'||
  evidence.frozenHoldout!==true||!Array.isArray(evidence.rows))return denied('FROZEN_CORE_AND_HOLDOUT_REQUIRED');
 const rows=evidence.rows;
 if(rows.length!==MODES.length*ASSETS.length*COSTS.length)return denied('INCOMPLETE_STRATEGY_GRID',{rows:rows.length});
 const seen=new Set();let negative=0,totalTrades=0,minTradesPerCell=Infinity,maxReportedDrawdownR=0;
 for(const row of rows){
  if(!row||!MODES.includes(row.mode)||!ASSETS.includes(row.asset)||!COSTS.includes(row.costBps)||
   !Number.isInteger(row.trades)||row.trades<0||!Number.isFinite(row.netR)||
   !Number.isFinite(row.drawdownR)||row.drawdownR<0||!['holdout','prospective'].includes(row.sample))
   return denied('INVALID_STRATEGY_CELL');
  const id=[row.mode,row.asset,row.costBps].join('|');
  if(seen.has(id))return denied('DUPLICATE_HOLDOUT_CELL');seen.add(id);
  totalTrades+=row.trades;minTradesPerCell=Math.min(minTradesPerCell,row.trades);
  maxReportedDrawdownR=Math.max(maxReportedDrawdownR,row.drawdownR);
  if(row.netR<=0||row.trades===0)negative++;
 }
 const positiveAcrossCosts=negative===0;
 // A prospective sample requires independent provider timestamps and audited signals.
 const independentProvenance=evidence.independentProviderWitness===true&&
  evidence.prospectiveWindowCertified===true&&rows.every(r=>r.sample==='prospective');
 return Object.freeze({schema:'JENIOS_B194_HOLDOUT_REVIEW',
  classification:!positiveAcrossCosts?'RESEARCH_ONLY_NEGATIVE_OR_MIXED':
   independentProvenance?'REQUIRES_MANUAL_INDEPENDENT_REVIEW':'RESEARCH_ONLY_NO_GO',
  reason:!positiveAcrossCosts?'NOT_ROBUST_ACROSS_ASSET_MODE_AND_COST':
   independentProvenance?'INDEPENDENT_COMMITTEE_REVIEW_REQUIRED':'PROSPECTIVE_PROVENANCE_NOT_CERTIFIED',
  counts:Object.freeze({rows:rows.length,negativeOrZeroCells:negative,reportedTrades:totalTrades,
   minTradesPerCell,maxReportedDrawdownR}),
  // Client-provided booleans are unverified claims, never an independent provenance certificate.
  independentProvenanceClaimed:independentProvenance,independentDataProvenance:false,
  allCostRegimesRobust:positiveAcrossCosts,
  robotPerformanceCertified:false,liveExecutionAuthorized:false,ordersSent:0});
}
export const B182_RESEARCH_EVIDENCE=Object.freeze({
 window:'2026Q3',originalCoreSha256:'9341d9243cbe742b90bf40149663e632fc472f5586c74bf70bdfcfd114e65aea',
 originalCellsPerCost:9,positiveCellsAtZeroBps:2,positiveCellsAtTenBps:1,
 positiveCellsAtThirtyBps:1,totalOpportunities:1656,
 prospectiveCertified:false,robustNetPerformanceDemonstrated:false,liveExecutionAuthorized:false
});
