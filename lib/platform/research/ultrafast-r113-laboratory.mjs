/**
 * R113 — UI integration of certified R111/R112 UltraFast OFFLINE research.
 * This adapter never transmits broker orders, reads private accounts or promotes models.
 * All scenario inputs below are synthetic and must never be mistaken for market evidence.
 */
import {replayUltraShadowSession,summarizeUltraShadowPerformance} from './ultrafast-v2-shadow.mjs';
import {reconcileBinanceDepth} from './ultrafast-v3-books.mjs';
import {preflightBinanceSpotLimit} from './ultrafast-v3-exchange-rules.mjs';
import {inspectUltraTokenSecurity,compareUltraVenuePrices} from './ultrafast-v3-token-venue.mjs';
import {markUltraSpotPortfolio,assessUltraStressBudget,suggestUltraCapitalWeights} from './ultrafast-v3-risk.mjs';
import {simulateUltraDepthSweep,simulateUltraMakerQueue,assessUltraExecutionSlippage} from './ultrafast-v3-microstructure.mjs';
import {evaluateUltraCandidateHoldout} from './ultrafast-v3-validation.mjs';
import {buildUltraDecisionChain,inspectUltraWatchdog} from './ultrafast-v3-operations.mjs';
import {evaluateUltraV3ResearchReadiness} from './ultrafast-v3-gate.mjs';
import {createHash} from 'node:crypto';

const MODES=Object.freeze(['favorable','risk','stale']);
const digits=x=>Number(x.toFixed(6));
function frozenCopy(x){return JSON.parse(JSON.stringify(x));}
function tickSet(mode){
 const px=mode==='risk'?[100,99.3,98.5,97.6,98.1,96.8,96.4,96.1]:[100,100.1,100.9,101.2,100.8,101.5,101.2,101.9];
 return px.map((p,i)=>({timestampMs:1_000+i*1_000,bid:p,ask:p+0.02,signal:i===0||i===3?'buy':'wait'}));
}
function demoFixture(mode,nowMs){
 const stale=mode==='stale', risky=mode==='risk';
 const age=stale?5200:110;
 const market={symbol:'BTC-USD',venue:'binance',timestampMs:nowMs-age,
  bid:100,ask:risky?102:100.02,last:risky?110:100.3,referencePrice:100,
  shortVolatilityBps:risky?105:55,bidDepthUsd:risky?3000:2_000_000,
  askDepthUsd:risky?4000:2_000_000,tradesPerMinute:risky?4:160,
  aggressiveBuyUsd:risky?2000:200_000,aggressiveSellUsd:risky?9000:100_000,
  roundTripCostBps:risky?32:3,expectedSlippageBps:risky?22:1,
  fillProbability:risky?.13:.9,stabilityRatio:risky?.25:.95,
  marketOpen:true,symbolOnline:true,maintenance:false};
 const baseRisk={accountEquityUsd:10000,orderNotionalUsd:risky?5200:200,stopLossBps:15,
  existingExposureUsd:risky?3900:300,correlatedExposureUsd:risky?3900:300,
  realizedSessionLossUsd:risky?190:0,realizedDailyLossUsd:risky?250:0,
  maxTradeLossPct:.25,maxSessionLossPct:2,maxDailyLossPct:3,
  maxTotalExposurePct:50,maxCorrelatedExposurePct:40,userStopped:false};
 const feedSamples=[{timestampMs:nowMs-(stale?5400:150),sequence:501,bid:100,ask:100.02},
  {timestampMs:nowMs-(stale?5200:80),sequence:502,bid:100.01,ask:100.03}];
 const estimated={totalCostBps:risky?38:4,fillProbability:risky?.13:.9,
  estimatedWinRate:risky?.3:.68,grossWinBps:35,grossLossBps:15};
 const execution={spreadBps:risky?180:2,makerFeeBps:0,takerFeeBps:2,
  slippageBps:risky?28:1,adverseSelectionBps:risky?30:1,
  makerFillProbability:risky?.1:.9,expectedGrossEdgeBps:risky?5:20,
  latencyMs:stale?900:90,queueAheadUsd:risky?250000:1000,
  availableDepthUsd:risky?9000:2000000,orderNotionalUsd:baseRisk.orderNotionalUsd};
 const safety={sessionRealizedR:0,sessionDrawdownPct:risky?2.1:0,
  consecutiveLosses:0,quoteAgeMs:age,rejectionsLastMinute:0,
  marketOpen:true,userStopped:false};
 const exchangeReadiness={venue:'binance',publicMarketDataAvailable:true,
  authenticatedPaperVerified:false,realAccountApproved:false,
  reconciliationCertified:false,killSwitchCertified:false,
  stopProtectionCertified:false,regulatoryReviewComplete:false};
 return {market,baseRisk,feedSamples,estimated,execution,safety,exchangeReadiness,risky,stale};
}

export function runUltraR113Laboratory(scenario,{nowMs,analyzeV2}={}){
 if(!MODES.includes(scenario)||!Number.isSafeInteger(nowMs)||nowMs<1_000_000||typeof analyzeV2!=='function')
  throw Object.assign(Error('R113_INVALID_INPUT'),{code:'R113_INVALID_INPUT'});
 const x=demoFixture(scenario,nowMs);
 const v2=analyzeV2({market:x.market,nowMs,feedSamples:x.feedSamples,riskBudget:x.baseRisk,
  executionEconomics:x.execution,estimatedTradeEconomics:x.estimated,safety:x.safety,
  exchangeReadiness:x.exchangeReadiness});
 if(v2?.schema!=='JENIOS_ULTRA_V2_CERTIFIED_RESEARCH_CYCLE_V1'||
    v2.liveExecutionEnabled!==false||v2.ordersSent!==0)throw Error('R113_R111_BOUNDARY_NOT_VERIFIED');
 const age=x.stale?5200:110;
 const book=reconcileBinanceDepth({nowMs,maxAgeMs:1000,
  snapshot:{lastUpdateId:600,receivedAtMs:nowMs-age,bids:[['100.00','10.00']],asks:[['100.02','10.00']]},
  events:[{U:601,u:601,timestampMs:nowMs-age,b:[['100.00','9.50']],a:[['100.02','9.50']]}]});
 const exchangeRule=preflightBinanceSpotLimit({symbolInfo:{symbol:'BTCUSD',status:'TRADING',
  isSpotTradingAllowed:true,observedAtMs:nowMs-100,filters:[
   {filterType:'PRICE_FILTER',minPrice:'0.01',maxPrice:'9999999',tickSize:'0.01'},
   {filterType:'LOT_SIZE',minQty:'0.001',maxQty:'10000',stepSize:'0.001'},
   {filterType:'MIN_NOTIONAL',minNotional:'10'}]},
  side:'BUY',price:x.risky?'102.00':'100.02',quantity:'2.000',referencePrice:'100.00',
  nowMs,accountTradeAllowed:true}); // SYNTHETIC permission flag, never verified with exchange.
 const tokenSecurity=inspectUltraTokenSecurity(x.risky?{
  assetClass:'token',chain:'ethereum',symbol:'TOKEN-TEST',observedAtMs:nowMs-50,nowMs,
  contractVerification:'UNVERIFIED',canSell:false,hasOwnerPrivileges:true,
  mintAuthorityActive:true,freezeAuthorityActive:true,top10HolderPct:85,
  buyTaxBps:50,sellTaxBps:110,liquidityUsd:10000,liquidityCanBeRemoved:true}: {
  assetClass:'native',chain:'bitcoin',symbol:'BTC',observedAtMs:nowMs-50,nowMs});
 const marked=markUltraSpotPortfolio({positions:x.risky?[{symbol:'ETH-USD',quantity:3,
  entryPrice:500,bid:400,quoteAtMs:nowMs-40,stopPrice:350}]:[],nowMs});
 const stress=assessUltraStressBudget({baseEquityUsd:10000,mark:marked,
  realizedSessionLossUsd:x.risky?190:0,realizedDailyLossUsd:x.risky?250:0,
  pendingOrderWorstLossUsd:x.risky?100:0,pendingNotionalUsd:0,
  proposedNotionalUsd:x.risky?5200:200,proposedStopBps:15,gapBps:50,
  slippageBps:x.risky?40:5,exitFeeBps:3,correlatedExposureUsd:x.risky?4000:300,
  maxTradeLossPct:.25,maxSessionLossPct:2,maxDailyLossPct:3,
  maxGrossExposurePct:50,maxCorrelatedExposurePct:40,
  exchangeHealthy:!x.stale,ownerStopped:false});
 const watchdog=inspectUltraWatchdog({nowMs,lastMarketDataAtMs:nowMs-age,
  lastBrokerStateAtMs:nowMs-(x.stale?6000:100),disconnectCount:x.stale?3:0,
  brokerErrors:0,unknownOrderCount:0,unreconciledFillCount:0,
  exchangeMaintenance:false,ownerStopped:false});
 const v3=evaluateUltraV3ResearchReadiness({v2Report:v2,book,exchangeRule,
  tokenSecurity,stressBudget:stress,watchdog});
 const comparison=compareUltraVenuePrices([
  {venue:'kraken',base:'BTC',quote:'USD',bid:99.98,ask:100.02,takerFeeBps:4,
   slippageBps:1,depthBase:100,timestampMs:nowMs-100},
  {venue:'binance',base:'BTC',quote:'USD',bid:100.05,ask:100.08,takerFeeBps:4,
   slippageBps:1,depthBase:100,timestampMs:nowMs-100}],
  {nowMs,tradeBaseQty:1,availableBaseOnSellVenue:1,
   availableQuoteOnBuyVenue:150,minEdgeBps:3});
 const allocations=suggestUltraCapitalWeights([
  {symbol:'BTC-USD',score:80,riskCluster:'majors',eligible:true},
  {symbol:'ETH-USD',score:70,riskCluster:'majors',eligible:true},
  {symbol:'TEST-USD',score:2,riskCluster:'speculative',eligible:false}]);
 const bookSweep=simulateUltraDepthSweep({side:'BUY',quantity:2,referencePrice:100.02,
  levels:[{price:100.02,qty:1.1},{price:100.03,qty:1.4}],latencySlippageBps:1});
 const maker=simulateUltraMakerQueue({side:'BUY',limitPrice:100.00,quantity:2,
  queueAheadQty:1,submittedAtMs:1000,latencyMs:100,expiresAtMs:5000,
  events:[{timestampMs:2000,aggressorSide:'SELL',price:100,quantity:1.5},
    {timestampMs:2500,aggressorSide:'SELL',price:100,quantity:1.0}]});
 const executionQuality=assessUltraExecutionSlippage({expectedPrice:100.02,
  observedPrice:bookSweep.simulatedVwap,side:'BUY',expectedFeeUsd:0.01,
  observedFeeUsd:bookSweep.estimatedFeesUsd,quantity:2,source:'SIMULATED'});
 const shadow=replayUltraShadowSession(tickSet(scenario),{startingCashUsd:10000,
  tradeNotionalUsd:500,stopLossBps:25,takeProfitBps:35,
  feePerSideBps:2,slippagePerSideBps:1});
 const performance=summarizeUltraShadowPerformance(shadow);
 // Prospective evidence not available. Generate an illustrative paired holdout only;
 // its result is never passed as actual real market evidence into the composite gate.
 const testStartMs=80_000;
 const baseline=Array.from({length:40},(_,i)=>({signalAtMs:testStartMs+10+i*400,
  entryAtMs:testStartMs+20+i*400,exitAtMs:testStartMs+40+i*400,
  netPnlBps:i%2===0?1:-1,costBps:2}));
 const study=evaluateUltraCandidateHoldout({folds:[{
  trainEndMs:0,testStartMs,testEndMs:testStartMs+20_000,baselineTrades:baseline}],
  candidates:[{id:'illustrative_ultra',folds:[{trades:baseline.map((e,i)=>({...e,
   netPnlBps:e.netPnlBps+(i%2===0?0.2:-0.2)}))}]}],
  bootstrapSamples:250,operatorApproved:false});
 const digest=createHash('sha256').update(`R113_NO_REAL_MARKET:${scenario}`).digest('hex');
 const audit=buildUltraDecisionChain({sourceDigest:digest,events:[{
  id:'r113_sample_001',timestampMs:nowMs,type:v3.canContinueOfflineResearch?'RESEARCH_CANDIDATE':'WAIT',
  reasons:v3.blockers,strategyVersion:'R111_R112_RESEARCH_ONLY'}]});
 return Object.freeze({schema:'JENIOS_R113_ULTRA_READONLY_LAB_V1',scenario,
  checkedAt:new Date(nowMs).toISOString(),source:'SYNTHETIC_FIXTURE_NOT_A_MARKET_SIGNAL',
  v2:{eligibleForFurtherResearch:v2.eligibleForFurtherResearch,
   blockers:v2.blockers,legacyGates:v2.preservedHistoricalGates,
   candidate:v2.candidate,execution:v2.execution},
  v3:{canContinueOfflineResearch:v3.canContinueOfflineResearch,
   blockers:v3.blockers,bookIntegrity:book.allow,exchangeRuleResearchOnly:exchangeRule.allowResearchProposal,
   tokenRiskFlags:tokenSecurity.riskFlags,stressBudgetResearchOnly:stress.allowFurtherResearch,
   watchdogHealthy:watchdog.healthy},
  simulators:{shadowPerformance:performance,depthSweep:bookSweep,makerQueue:maker,
   executionQuality,venueComparison:comparison,capitalAllocation:allocations,
   holdoutIsSynthetic:true,holdoutPassing:study.passingCandidateIds,
   auditEventCount:audit.eventCount,auditRootDigest:audit.rootDigest},
  externalPaperEnabled:false,liveExecutionEnabled:false,ordersSent:0,
  noBrokerCredentials:true,financialPerformanceCertified:false});
}