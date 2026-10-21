/** B292 offline evidence integration. No private engine, provider, order, or AI output. */
import {observeClosedCandleResearch} from './trading-video-hypotheses.mjs';
import {reviewB291CopilotContext,reviewB291ManualLossStreak} from './b291-three-mode-copilot.mjs';
import {reverseOperatorCommand,inspectSignalDelivery} from './b290-inversion-signal-contract.mjs';
const fail=c=>{throw Object.assign(new Error(c),{code:c});};
const round=n=>Number(n.toFixed(4));
export function reviewB292HybridClosedMarket(bars,{asOfMs,asset='BTC-USD',spreadBps=10,maxRiskPct=1}={}){
 const snapshot=observeClosedCandleResearch(bars,{asOfMs,intervalMs:3600000});
 const f=snapshot.features;
 if(!Number.isFinite(f.ema12)||!Number.isFinite(f.ema26)||!Number.isFinite(f.atr14)||
 !Number.isFinite(bars.at(-1).close)||bars.at(-1).close<=0)fail('B292_UNUSABLE_FEATURES');
 const gap=(f.ema12-f.ema26)/bars.at(-1).close;
 const marketBias=Math.abs(gap)<0.001?'NEUTRAL':gap>0?'UP':'DOWN';
 const atrPct=100*f.atr14/bars.at(-1).close;
 const reviewed=reviewB291CopilotContext({mode:'hybrid',asset,
  closedAtMs:snapshot.closedThroughMs,observedAtMs:asOfMs,
  atrPct,spreadBps,maxRiskPct,marketBias,
  providerSigned:false,operatorApproved:false});
 return Object.freeze({schema:'JENIOS_B292_HYBRID_READONLY_CONTEXT_V1',
  sourceDigest:snapshot.dataDigestSha256,sourceBars:snapshot.barCount,
  features:Object.freeze({ema12:f.ema12,ema26:f.ema26,rsi14:f.rsi14,
   stoch14:f.stoch14,atr14:f.atr14,relativeVolume20:f.relativeVolume20,
   priorHigh20:f.priorHigh20,priorLow20:f.priorLow20}),
  marketBias,atrPct:round(atrPct),copilot:reviewed,
  explanatoryText:'Leitura historica de candles fechados. Avalie risco e confirmacao antes de qualquer decisao humana.',
  sourceIndependentlyVerified:false,privateRobotSignalsVerified:false,
  geniosProviderCalled:false,assetRecommended:false,ordersSent:0,
  realExecutionAllowed:false,profitabilityCertified:false});
}
export function reviewB292ManualDeliveryAndRisk({signal,recordedAtMs,deliveredAtMs,closedTrades=[]}={}){
 const delivery=inspectSignalDelivery(signal,{recordedAtMs,deliveredAtMs});
 if(delivery.mode!=='manual')fail('B292_MANUAL_MODE_REQUIRED');
 const risk=reviewB291ManualLossStreak(closedTrades);
 return Object.freeze({schema:'JENIOS_B292_MANUAL_EVIDENCE_V1',
  delivery,risk,originalSignalVerified:false,actualDeliveryVerified:false,
  ordersSent:0,automaticModeSwitch:false});
}
export function reviewB292ReverseReference({command,megaTrendDirection=null,operatorAuthorized=true}={}){
 const result=reverseOperatorCommand(command,{megaTrendDirection,operatorAuthorized});
 return Object.freeze({schema:'JENIOS_B292_REVERSE_REFERENCE_V1',
  result,originalOrderFeedVerified:false,privateCoreVerified:false,
  positionLifecycleReconciled:false,ordersSent:0});
}
