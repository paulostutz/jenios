/** R111 offline smoke: public/synthetic fixtures only; never connects to an exchange. */
import {scanUltraOpportunities,designUltraScalp} from '../../../lib/platform/research/ultrafast-v2-intelligence.mjs';
import {assessUltraFeedHealth,planUltraSmartExecution,checkUltraPortfolioRisk,
 validateUltraExchangeReadiness,produceUltraExecutionProposal} from '../../../lib/platform/research/ultrafast-v2-execution.mjs';
import {replayUltraShadowSession,buildUltraResearchDashboard} from '../../../lib/platform/research/ultrafast-v2-shadow.mjs';
const nowMs=1_800_000_000_000;
const snapshot={symbol:'BTC-USD',venue:'kraken',timestampMs:nowMs-100,bid:100,ask:100.02,
 last:100.3,referencePrice:100,shortVolatilityBps:55,bidDepthUsd:2000000,
 askDepthUsd:2000000,tradesPerMinute:160,aggressiveBuyUsd:200000,
 aggressiveSellUsd:100000,roundTripCostBps:3,expectedSlippageBps:1,
 fillProbability:.9,stabilityRatio:.95,marketOpen:true,symbolOnline:true,maintenance:false};
const ranking=scanUltraOpportunities([snapshot],{nowMs});
const scalp=designUltraScalp(ranking[0],{stopLossBps:15,expectedWinRate:.68,fillProbability:.9});
const feed=assessUltraFeedHealth([{timestampMs:nowMs-150,sequence:5,bid:100,ask:100.02},
 {timestampMs:nowMs-80,sequence:6,bid:100.01,ask:100.03}],{nowMs});
const risk=checkUltraPortfolioRisk({accountEquityUsd:10000,orderNotionalUsd:200,
 stopLossBps:15,existingExposureUsd:300,correlatedExposureUsd:300,
 realizedSessionLossUsd:0,realizedDailyLossUsd:0,maxTradeLossPct:.25,
 maxSessionLossPct:2,maxDailyLossPct:3,maxTotalExposurePct:50,
 maxCorrelatedExposurePct:40,userStopped:false,feedHealthy:feed.allow});
const execution=planUltraSmartExecution({spreadBps:2,makerFeeBps:0,
 takerFeeBps:2,slippageBps:1,adverseSelectionBps:1,
 makerFillProbability:.9,expectedGrossEdgeBps:20,latencyMs:90,
 queueAheadUsd:1000,availableDepthUsd:2000000,orderNotionalUsd:200});
const exchange=validateUltraExchangeReadiness({venue:'kraken',publicMarketDataAvailable:true,
 authenticatedPaperVerified:false,realAccountApproved:false,reconciliationCertified:false,
 killSwitchCertified:false,stopProtectionCertified:false,regulatoryReviewComplete:false});
const proposal=produceUltraExecutionProposal({candidate:ranking[0],feed,risk,execution,exchange});
const ticks=[{timestampMs:1,bid:100,ask:100.05,signal:'buy'},
 {timestampMs:2,bid:100.2,ask:100.25,signal:'wait'},
 {timestampMs:3,bid:101,ask:101.05,signal:'wait'}];
const shadow=replayUltraShadowSession(ticks);
const dashboard=buildUltraResearchDashboard({ranking,feed,risk,shadow,exchange,checkedAtMs:nowMs});
const result={schema:'JENIOS_R111_ULTRA_V2_OFFLINE_SMOKE_V1',
 scalpClassification:scalp.classification,proposalEligible:proposal.eligible,
 shadowTradeCount:dashboard.performance.hypotheticalTradeCount,
 liveExecutionEnabled:false,externalPaperEnabled:false,actualBrokerPnl:null,
 readyForLive:false,remainingBlockers:exchange.blockers};
if(!ranking[0].eligible||!feed.allow||!risk.allow||!execution.allowProposal||!proposal.eligible)
 throw Error('ULTRA_V2_OFFLINE_SMOKE_FAILED');
process.stdout.write(JSON.stringify(result,null,2)+'\n');