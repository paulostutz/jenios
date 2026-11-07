/** R114: context for the EXISTING reverse and Ultra engines; never an order source.
 * Fixed thresholds are experimental. Transfers never establish trade direction.
 * Build before decision time; consume synchronously. Caller provenance is not certified.
 */
import {validWhaleEvent,WHALE_CURRENT_MS} from '../../whale-transfers.mjs';
export const FLOW_POLICY=Object.freeze({version:'R114_FLOW_V1',windowMs:20000,windows:3,
 maxAgeMs:5000,minTradesPerWindow:3,minQuoteVolumePerWindow:5000,
 adverseThreshold:.85,whaleAdverseThreshold:.60,minPriceMoveBps:2});
const SCHEMA='JENIOS_MARKET_FLOW_CONTEXT_V1';
const time=x=>Number.isSafeInteger(x)&&x>=0;
const number=x=>typeof x==='number'&&Number.isFinite(x);
const fail=code=>{throw Object.assign(Error(code),{code});};
const freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
export function unavailableFlow(reason,nowMs){
 return freeze({schema:SCHEMA,policyVersion:FLOW_POLICY.version,venue:'binance',marketType:'spot',
 symbol:'BTC-USDT',observedAtMs:nowMs,marketAsOfMs:null,usable:false,reason,
 windows:[],whales:{status:'UNAVAILABLE',recentTransfers:0,direction:null},
 authenticatedAccount:false,financialPerformanceCertified:false,ordersSent:0});
}
export function buildMarketFlowContext({trades,startMs,endMs,receivedAtMs,complete,whales=null,evidenceKind='PUBLIC_REST'}={}){
 if(!time(startMs)||!time(endMs)||!time(receivedAtMs)||endMs-startMs!==60000||
   receivedAtMs<endMs||typeof complete!=='boolean'||!Array.isArray(trades)||trades.length>12000||
   !['PUBLIC_REST','SYNTHETIC'].includes(evidenceKind))fail('FLOW_INVALID_SAMPLE');
 const windows=Array.from({length:3},(_,i)=>({startMs:startMs+i*20000,endMs:startMs+(i+1)*20000,
   count:0,buyQuote:0,sellQuote:0,firstPrice:null,lastPrice:null}));
 let lastId=-1,lastTime=-1;
 for(const t of trades){
   if(!t||!Number.isSafeInteger(t.a)||t.a<=lastId||!time(t.T)||t.T<lastTime||t.T<startMs||t.T>endMs||
      typeof t.m!=='boolean'||typeof t.p!=='string'||typeof t.q!=='string'||
      !/^\d+(\.\d+)?$/.test(t.p)||!/^\d+(\.\d+)?$/.test(t.q))fail('FLOW_INVALID_TRADE_SEQUENCE');
   const price=Number(t.p),quantity=Number(t.q),notional=price*quantity;
   if(!number(price)||price<=0||!number(quantity)||quantity<=0||!number(notional)||notional>1e15)
     fail('FLOW_INVALID_NOTIONAL');
   if(lastId>=0&&t.a!==lastId+1)complete=false;
   lastId=t.a;lastTime=t.T;
   // Binance m=true: buyer is maker, therefore the seller is the aggressor.
   const w=windows[Math.min(2,Math.floor((t.T-startMs)/20000))];
   w.count++;w[t.m?'sellQuote':'buyQuote']+=notional;
   w.firstPrice??=price;w.lastPrice=price;
 }
 for(const w of windows){
   const total=w.buyQuote+w.sellQuote;
   if(!number(total))fail('FLOW_INVALID_TOTAL');
   w.imbalance=total?(w.buyQuote-w.sellQuote)/total:0;
   w.priceMoveBps=w.firstPrice?(w.lastPrice/w.firstPrice-1)*10000:0;
   w.sufficient=w.count>=FLOW_POLICY.minTradesPerWindow&&total>=FLOW_POLICY.minQuoteVolumePerWindow;
 }
 const status=whales?.status,updated=Date.parse(status?.atualizadoEm),ids=new Set();
 let whaleStatus='UNAVAILABLE';
 if(status?.disponivel===true&&status.stale===false&&status.historico===false&&status.parcial===false&&
   Number.isFinite(updated)&&updated<=receivedAtMs&&receivedAtMs-updated<=180000&&Array.isArray(whales.rows)){
   for(const row of whales.rows){
     if(row.simbolo==='BTC'&&validWhaleEvent(row,receivedAtMs)&&receivedAtMs-Date.parse(row.data)<=WHALE_CURRENT_MS)ids.add(row.id);
   }
   whaleStatus=ids.size?'RECENT_LARGE_TRANSFERS':'NO_RECENT_TRANSFER_IN_SAMPLE';
 }
 const usable=complete&&windows.every(w=>w.sufficient)&&receivedAtMs-endMs<=FLOW_POLICY.maxAgeMs&&endMs-lastTime<=FLOW_POLICY.maxAgeMs;
 return freeze({schema:SCHEMA,policyVersion:FLOW_POLICY.version,venue:'binance',marketType:'spot',symbol:'BTC-USDT',
   observedAtMs:receivedAtMs,marketAsOfMs:endMs,evidenceKind,usable,
   reason:!complete?'INCOMPLETE_TRADE_COVERAGE':!windows.every(w=>w.sufficient)?'INSUFFICIENT_FLOW_SAMPLE':
     receivedAtMs-endMs>FLOW_POLICY.maxAgeMs||endMs-lastTime>FLOW_POLICY.maxAgeMs?'STALE_MARKET_SAMPLE':'READY_FOR_RESEARCH',windows,
   whales:{status:whaleStatus,recentTransfers:ids.size,direction:null,coverage:'EXISTING_BITCOIN_MONITOR_LIMITED_SAMPLE',
     tradeOrOwnerIdentified:false},authenticatedAccount:false,financialPerformanceCertified:false,ordersSent:0});
}
export function inspectMarketFlow(context,{symbol,venue='binance',marketType='spot',side,nowMs}={}){
 if(!time(nowMs)||!['buy','sell',null].includes(side))fail('FLOW_INVALID_DECISION');
 if(!['BTC-USDT','BINANCE:BTCUSDT'].includes(symbol)||venue!=='binance'||marketType!=='spot')
   return Object.freeze({applicable:false,wouldWait:false,reason:'FLOW_OUTSIDE_SUPPORTED_MARKET'});
 const result=(reason,wouldWait=true,extra={})=>Object.freeze({applicable:true,wouldWait,reason,...extra});
 if(!context||context.schema!==SCHEMA||context.policyVersion!==FLOW_POLICY.version||context.symbol!=='BTC-USDT'||
   context.venue!==venue||context.marketType!==marketType||!time(context.observedAtMs)||!time(context.marketAsOfMs)||
   context.observedAtMs>nowMs||context.marketAsOfMs>context.observedAtMs||
   nowMs-context.marketAsOfMs>FLOW_POLICY.maxAgeMs||nowMs-context.observedAtMs>FLOW_POLICY.maxAgeMs)
   return result('FLOW_MISSING_STALE_OR_WRONG_SCOPE');
 if(context.usable!==true||!Array.isArray(context.windows)||context.windows.length!==3)
   return result('FLOW_INCOMPLETE_OR_INSUFFICIENT');
 if(side===null)return result('CORE_ALREADY_WAITING',false);
 const sign=side==='buy'?1:-1;
 const recent=context.whales?.status==='RECENT_LARGE_TRANSFERS'&&Number.isSafeInteger(context.whales.recentTransfers)&&context.whales.recentTransfers>0;
 const threshold=recent?FLOW_POLICY.whaleAdverseThreshold:FLOW_POLICY.adverseThreshold;
 let adverse=0;
 for(const [i,w] of context.windows.entries()){
   if(!time(w.startMs)||!time(w.endMs)||w.endMs-w.startMs!==20000||w.sufficient!==true||
     w.endMs!==context.marketAsOfMs-(2-i)*20000||!number(w.imbalance)||Math.abs(w.imbalance)>1||
     !number(w.priceMoveBps))return result('FLOW_INVALID_WINDOW');
   if(sign*w.imbalance<=-threshold&&sign*w.priceMoveBps<=-FLOW_POLICY.minPriceMoveBps)adverse++;
 }
 return result(adverse===3?(recent?'LARGE_TRANSFER_WITH_PERSISTENT_ADVERSE_TRADES':'PERSISTENT_ADVERSE_TRADES'):'NO_CONFIRMED_FLOW_VETO',
   adverse===3,{adverseWindows:adverse,threshold,recentTransfers:context.whales?.recentTransfers||0,
     policyVersion:FLOW_POLICY.version,directionFromTransfers:false,profitabilityVerified:false});
}
/** Apply ONLY after chooseMode. Never reverse twice, invent entry, widen risk or block exits. */
export function refineReverseWithFlow(original,{mode='reverse',symbol,context,nowMs,action='open'}={}){
 if(!original||![null,'buy','sell'].includes(original.side))fail('FLOW_INVALID_CORE_RESULT');
 if(mode!=='reverse'||['close','cancel','reduce','stop'].includes(action)||original.side===null)return original;
 if(action!=='open')fail('FLOW_INVALID_ACTION');
 const flow=inspectMarketFlow(context,{symbol,side:original.side,nowMs});
 if(!flow.applicable)return original;
 return Object.freeze({...original,side:flow.wouldWait?null:original.side,
   action:flow.wouldWait?'wait_for_market_flow':original.action,originalSide:original.side,
   originalAction:original.action,mayClose:true,marketFlow:flow});
}
