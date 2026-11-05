/** R112 offline smoke; no HTTP, no credentials, no broker order transport. */
import assert from 'node:assert/strict';
import {reconcileBinanceDepth} from '../../../lib/platform/research/ultrafast-v3-books.mjs';
import {preflightBinanceSpotLimit} from '../../../lib/platform/research/ultrafast-v3-exchange-rules.mjs';
import {inspectUltraTokenSecurity} from '../../../lib/platform/research/ultrafast-v3-token-venue.mjs';
import {markUltraSpotPortfolio,assessUltraStressBudget} from '../../../lib/platform/research/ultrafast-v3-risk.mjs';
import {inspectUltraWatchdog} from '../../../lib/platform/research/ultrafast-v3-operations.mjs';
import {evaluateUltraV3ResearchReadiness} from '../../../lib/platform/research/ultrafast-v3-gate.mjs';
const now=1800000000000;
const book=reconcileBinanceDepth({snapshot:{lastUpdateId:500,receivedAtMs:now-300,
 bids:[['100','3']],asks:[['101','3']]},events:[{U:501,u:501,timestampMs:now-100,b:[],a:[]}],nowMs:now});
const exchangeRule=preflightBinanceSpotLimit({symbolInfo:{symbol:'BTCUSDT',
 status:'TRADING',isSpotTradingAllowed:true,observedAtMs:now-100,
 filters:[{filterType:'PRICE_FILTER',minPrice:'0.01',maxPrice:'1000',tickSize:'0.01'},
 {filterType:'LOT_SIZE',minQty:'0.001',maxQty:'10',stepSize:'0.001'},
 {filterType:'MIN_NOTIONAL',minNotional:'10'}]},side:'BUY',price:'101.00',
 quantity:'0.2',nowMs:now,accountTradeAllowed:true});
const tokenSecurity=inspectUltraTokenSecurity({assetClass:'native',chain:'bitcoin',symbol:'BTC',
 observedAtMs:now-100,nowMs:now});
const mark=markUltraSpotPortfolio({positions:[],nowMs:now});
const stressBudget=assessUltraStressBudget({baseEquityUsd:10000,mark,
 realizedSessionLossUsd:0,realizedDailyLossUsd:0,pendingOrderWorstLossUsd:0,pendingNotionalUsd:0,
 proposedNotionalUsd:100,proposedStopBps:15,gapBps:20,slippageBps:5,exitFeeBps:5,
 correlatedExposureUsd:0,maxTradeLossPct:.25,maxSessionLossPct:2,maxDailyLossPct:3,
 maxGrossExposurePct:50,maxCorrelatedExposurePct:40,exchangeHealthy:true,ownerStopped:false});
const watchdog=inspectUltraWatchdog({nowMs:now,lastMarketDataAtMs:now-100,
 lastBrokerStateAtMs:now-100,disconnectCount:0,brokerErrors:0,unknownOrderCount:0,
 unreconciledFillCount:0,exchangeMaintenance:false,ownerStopped:false});
const r=evaluateUltraV3ResearchReadiness({v2Report:{
 schema:'JENIOS_ULTRA_V2_CERTIFIED_RESEARCH_CYCLE_V1',eligibleForFurtherResearch:true},
 book,exchangeRule,tokenSecurity,stressBudget,watchdog});
assert.equal(r.canContinueOfflineResearch,true);
assert.equal(r.liveExecutionEnabled,false);
assert.equal(r.externalPaperEnabled,false);
assert.equal(r.ordersSent,0);
console.log(JSON.stringify({checkpoint:'R112',mode:'RESEARCH_ONLY',
  availableForFurtherOfflineResearch:r.canContinueOfflineResearch,
  liveExecutionEnabled:r.liveExecutionEnabled,ordersSent:r.ordersSent,
  blockCount:3,scenarios:'synthetic_fixture'}));