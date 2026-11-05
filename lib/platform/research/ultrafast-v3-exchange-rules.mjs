/** R112 / Block 1 — precision-safe, offline Binance Spot LIMIT preflight.
 * No order transports. Rejects unknown/dynamic filters rather than pretending compliance.
 * Filter truth still belongs to live exchangeInfo + account-specific permissions.
 */
const fail=c=>{throw Object.assign(Error(c),{code:c});};
const DEC=/^(0|[1-9]\d*)(?:\.(\d{1,18}))?$/;
const SCALE=10n**18n;
export function fixed18(x){
  const s=typeof x==='string'?x:null,m=s?.match(DEC);
  if(!m)fail('R112_INVALID_DECIMAL');
  return BigInt(m[1])*SCALE+BigInt((m[2]||'').padEnd(18,'0'));
}
const within=(n,lo,hi)=> (!lo||fixed18(lo)===0n||n>=fixed18(lo))&&
 (!hi||fixed18(hi)===0n||n<=fixed18(hi));
const validStep=(n,step)=>!step||fixed18(step)===0n||n%fixed18(step)===0n;
const FIELDS=new Set(['PRICE_FILTER','LOT_SIZE','MARKET_LOT_SIZE','MIN_NOTIONAL','NOTIONAL',
  'PERCENT_PRICE','PERCENT_PRICE_BY_SIDE']);
export function preflightBinanceSpotLimit({symbolInfo,side,price,quantity,referencePrice=null,
  nowMs,maxInfoAgeMs=120000,accountTradeAllowed=false}={}){
  if(!symbolInfo||typeof symbolInfo.symbol!=='string'||!Array.isArray(symbolInfo.filters)||
    symbolInfo.filters.length>100||!Number.isSafeInteger(symbolInfo.observedAtMs)||
    !Number.isSafeInteger(nowMs)||symbolInfo.observedAtMs>nowMs||
    !Number.isSafeInteger(maxInfoAgeMs)||maxInfoAgeMs<1||
    !['BUY','SELL'].includes(side)||typeof accountTradeAllowed!=='boolean')
    fail('R112_EXCHANGE_INVALID_INPUT');
  const p=fixed18(price),q=fixed18(quantity), ref=referencePrice===null?null:fixed18(referencePrice);
  if(p<=0n||q<=0n)fail('R112_EXCHANGE_INVALID_SIZE');
  const issues=[];
  if(symbolInfo.status!=='TRADING'||symbolInfo.isSpotTradingAllowed!==true)issues.push('SYMBOL_NOT_TRADABLE');
  if(!accountTradeAllowed)issues.push('ACCOUNT_PERMISSION_NOT_VERIFIED');
  if(nowMs-symbolInfo.observedAtMs>maxInfoAgeMs)issues.push('EXCHANGE_RULES_STALE');
  const types=new Set();
  for(const f of symbolInfo.filters){
    if(!f||typeof f.filterType!=='string')fail('R112_EXCHANGE_INVALID_FILTER');
    if(types.has(f.filterType)){issues.push('DUPLICATE_FILTER');continue;}
    types.add(f.filterType);
    if(!FIELDS.has(f.filterType)){
      // Never certify unseen filters or requirements as satisfied.
      issues.push('UNVERIFIED_FILTER_'+f.filterType.slice(0,32));continue;
    }
    if(f.filterType==='PRICE_FILTER'){
      if(!f.minPrice||!f.maxPrice||!f.tickSize){issues.push('PRICE_RULE_INCOMPLETE');continue;}
      if(!within(p,f.minPrice,f.maxPrice)||!validStep(p,f.tickSize))issues.push('PRICE_FILTER');
    }
    if(f.filterType==='LOT_SIZE'){
      if(!f.minQty||!f.maxQty||!f.stepSize){issues.push('QTY_RULE_INCOMPLETE');continue;}
      if(!within(q,f.minQty,f.maxQty)||!validStep(q,f.stepSize))issues.push('LOT_SIZE');
    }
    if(f.filterType==='MIN_NOTIONAL'){
      if(!f.minNotional){issues.push('NOTIONAL_RULE_INCOMPLETE');continue;}
      if(p*q<SCALE*fixed18(f.minNotional))issues.push('MIN_NOTIONAL');
    }
    if(f.filterType==='NOTIONAL'){
      if(!f.minNotional||!f.maxNotional){issues.push('NOTIONAL_RULE_INCOMPLETE');continue;}
      if((p*q<SCALE*fixed18(f.minNotional))||
         (fixed18(f.maxNotional)>0n&&p*q>SCALE*fixed18(f.maxNotional)))
         issues.push('NOTIONAL');
    }
    if(['PERCENT_PRICE','PERCENT_PRICE_BY_SIDE'].includes(f.filterType)){
      if(ref===null||ref===0n){issues.push('REFERENCE_PRICE_REQUIRED');continue;}
      const up=f.filterType==='PERCENT_PRICE'?f.multiplierUp:
        side==='BUY'?f.bidMultiplierUp:f.askMultiplierUp;
      const down=f.filterType==='PERCENT_PRICE'?f.multiplierDown:
        side==='BUY'?f.bidMultiplierDown:f.askMultiplierDown;
      if(!up||!down||p*SCALE>ref*fixed18(up)||p*SCALE<ref*fixed18(down))issues.push(f.filterType);
    }
  }
  if(!types.has('PRICE_FILTER')||!types.has('LOT_SIZE')||
    !(types.has('NOTIONAL')||types.has('MIN_NOTIONAL')))issues.push('CORE_FILTERS_MISSING');
  const notional=(p*q)/SCALE;
  return Object.freeze({schema:'JENIOS_R112_SPOT_LIMIT_PREFLIGHT_V1',symbol:symbolInfo.symbol,
    allowResearchProposal:issues.length===0,issues:Object.freeze([...new Set(issues)]),
    notionalScaled18:notional.toString(),readOnly:true,
    actualBrokerAccepted:null,liveExecutionEnabled:false,ordersSent:0});
}

/** Kraken requires its own instrument metadata; no Binance rule reuse. */
export function preflightKrakenSpotLimit({instrument,side,price,quantity,nowMs,maxInfoAgeMs=120000}={}){
 if(!instrument||typeof instrument.symbol!=='string'||!['BUY','SELL'].includes(side)||
    !Number.isSafeInteger(nowMs)||!Number.isSafeInteger(instrument.observedAtMs)||
    instrument.observedAtMs>nowMs||!Number.isSafeInteger(maxInfoAgeMs)||maxInfoAgeMs<1)
    fail('R112_KRAKEN_PREFLIGHT_INVALID');
 const p=fixed18(price),q=fixed18(quantity),issues=[];
 if(instrument.status!=='online')issues.push('INSTRUMENT_OFFLINE');
 if(nowMs-instrument.observedAtMs>maxInfoAgeMs)issues.push('INSTRUMENT_METADATA_STALE');
 if(!instrument.price_increment||!instrument.qty_increment||!instrument.qty_min)
   issues.push('REQUIRED_INSTRUMENT_RULE_MISSING');
 else{
   if(!validStep(p,instrument.price_increment))issues.push('PRICE_INCREMENT');
   if(!validStep(q,instrument.qty_increment))issues.push('QTY_INCREMENT');
   if(q<fixed18(instrument.qty_min))issues.push('QTY_MIN');
 }
 if(instrument.cost_min && p*q<SCALE*fixed18(instrument.cost_min))issues.push('COST_MIN');
 return Object.freeze({schema:'JENIOS_R112_KRAKEN_LIMIT_PREFLIGHT_V1',
   symbol:instrument.symbol,allowResearchProposal:issues.length===0,
   issues:Object.freeze(issues),readOnly:true,actualBrokerAccepted:null,ordersSent:0});
}