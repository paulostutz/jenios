/**
 * R111 UltraFast V2 composite research gate. Existing R18/R23/R28/R53 models
 * are dependencies (provided by the certified bridge), never reimplemented.
 * No broker orders, no network, and no strategy rewrites.
 */
import {normalizeUltraSnapshot,scanUltraOpportunities,designUltraScalp}
  from './ultrafast-v2-intelligence.mjs';
import {assessUltraFeedHealth,planUltraSmartExecution,checkUltraPortfolioRisk,
 validateUltraExchangeReadiness,produceUltraExecutionProposal}
  from './ultrafast-v2-execution.mjs';
import {inspectMarketFlow} from './market-flow-context.mjs';
const fail=code=>{throw Object.assign(new Error(code),{code});};

export function createUltraV2ResearchPipeline(legacy){
 if(!legacy||['scoreUltrafastAsset','scoreR53Asset','adaptiveBreakevenGate',
 'availabilityGate','sessionKillSwitch'].some(k=>typeof legacy[k]!=='function'))
  fail('ULTRA_V2_LEGACY_BRIDGE_REQUIRED');
 return function analyzeUltraV2({market,nowMs,feedSamples,riskBudget,executionEconomics,
  estimatedTradeEconomics,safety,exchangeReadiness,flowContext=null}={}){
  if(!market||!estimatedTradeEconomics||!safety)fail('ULTRA_V2_PIPELINE_INPUT_REQUIRED');
  const normalized=normalizeUltraSnapshot(market,nowMs);
  const historicalR18=legacy.scoreUltrafastAsset({assetClass:'crypto',
   spreadBps:normalized.spreadBps,volatilityBps:normalized.shortVolatilityBps,
   depthUsd:normalized.depthUsd,tradesPerMinute:normalized.tradesPerMinute,
   expectedRoundTripCostBps:normalized.estimatedTotalFrictionBps,
   maxStaleMs:Math.max(1,normalized.quoteAgeMs),marketOpen:normalized.marketOpen});
  const historicalR53=legacy.scoreR53Asset({symbol:normalized.symbol,
   volatilityBps:normalized.shortVolatilityBps,spreadBps:normalized.spreadBps,
   depthUsd:normalized.depthUsd,fillProbability:normalized.fillProbability,
   roundTripCostBps:normalized.roundTripCostBps,
   adverseSelectionBps:normalized.expectedSlippageBps,
   stabilityRatio:normalized.stabilityRatio});
  const historicalR28=legacy.adaptiveBreakevenGate(estimatedTradeEconomics);
  const historicalR23=legacy.availabilityGate({symbol:normalized.symbol,
   marketStatus:normalized.marketOpen?'open':'closed',
   symbolStatus:normalized.symbolOnline?'online':'offline',
   maintenance:normalized.maintenance,sourceAgeMs:normalized.quoteAgeMs});
  const historicalKill=legacy.sessionKillSwitch(safety);
  const ranking=scanUltraOpportunities([market],{nowMs});
  const candidate=ranking[0];
  const scalp=designUltraScalp(candidate,{stopLossBps:riskBudget?.stopLossBps,
   expectedWinRate:estimatedTradeEconomics.estimatedWinRate,
   fillProbability:normalized.fillProbability,spotOnly:true});
  const feed=assessUltraFeedHealth(feedSamples,{nowMs,
   maintenance:normalized.maintenance,sourceOnline:normalized.symbolOnline});
  const risk=checkUltraPortfolioRisk({...riskBudget,feedHealthy:feed.allow});
  const execution=planUltraSmartExecution(executionEconomics);
  const exchange=validateUltraExchangeReadiness(exchangeReadiness);
  const preliminary=produceUltraExecutionProposal({candidate,feed,risk,execution,exchange});
  const historicBlocks=[];
  if(!historicalR18.eligible)historicBlocks.push('R18_ASSET_GATE');
  if(!historicalR53.eligible)historicBlocks.push('R53_ASSET_SELECTION');
  if(!historicalR28.allow)historicBlocks.push('R28_DYNAMIC_BREAKEVEN');
  if(!historicalR23.allow)historicBlocks.push('R23_AVAILABILITY');
  if(historicalKill.halt)historicBlocks.push('R18_KILL_SWITCH');
  if(scalp.classification!=='RESEARCH_CANDIDATE')historicBlocks.push('V2_SCALP_GATE');
  const blockers=[...historicBlocks,...preliminary.blockers];
  // Shadow comparison only. Cached context cannot introduce network calls or
  // override any existing gate. No added directional weight is presumed profitable.
  const marketFlow=inspectMarketFlow(flowContext,{symbol:normalized.symbol,venue:normalized.venue,
   side:['buy','sell'].includes(candidate.preferredResearchSide)?candidate.preferredResearchSide:null,nowMs});
  return Object.freeze({schema:'JENIOS_ULTRA_V2_CERTIFIED_RESEARCH_CYCLE_V1',
   symbol:normalized.symbol,venue:normalized.venue,
   eligibleForFurtherResearch:blockers.length===0,
   blockers:Object.freeze([...new Set(blockers)]),
   candidate,scalp,feed,risk,execution,
   marketFlow:Object.freeze({...marketFlow,enforcement:'OBSERVE_ONLY',affectsEligibility:false}),
   preservedHistoricalGates:Object.freeze({r18:historicalR18.eligible,
    r53:historicalR53.eligible,r28:historicalR28.allow,r23:historicalR23.allow,
    killSwitchClear:!historicalKill.halt}),
   evaluationOnly:true,requiresProspectiveEvidence:true,
   realTradeAccuracy:null,actualBrokerPnl:null,ordersSent:0,
   externalPaperEnabled:false,liveExecutionEnabled:false});
 };
}
