/** R119 explicit adaptation of the immutable R118 preflight.
 * The 2025-12-29 global conditional limit replaces removed MAX_NUM_ALGO_ORDERS.
 * Pure structural preflight for an already selected USDⓈ-M LIMIT decision.
 * No network, signatures, credentials, order submission or account setting changes.
 * Supplied snapshots are NOT independently authenticated by this module.
 */
const UNIT=10n**18n;
const fail=code=>{throw Error(code);};
const exact=(v,keys)=>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!keys.includes(k)))fail('FUTURES_INVALID_FIELDS');};
const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};
const fingerprint=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
function fixed(v,{positive=false,signed=false}={}){
 if(typeof v!=='string'||!(signed?/^-?(0|[1-9]\d{0,17})(\.\d{1,18})?$/:/^(0|[1-9]\d{0,17})(\.\d{1,18})?$/).test(v))fail('FUTURES_INVALID_DECIMAL');
 const [a,b='']=v.replace('-','').split('.');const n=(v.startsWith('-')?-1n:1n)*(BigInt(a)*UNIT+BigInt(b.padEnd(18,'0')));if(positive&&n<=0n)fail('FUTURES_INVALID_DECIMAL');return n;
}
const format=n=>String(n/UNIT)+'.'+String(n%UNIT).padStart(18,'0');
const ceil=(a,b)=>(a+b-1n)/b;
function snapshot(v,binding,now,maxAge){
 exact(v,['product','environment','keyFingerprint','observedAtMs','value']);
 if(v.product!==binding.product||v.environment!==binding.environment||v.keyFingerprint!==binding.keyFingerprint)fail('FUTURES_SNAPSHOT_BINDING_MISMATCH');
 if(!Number.isSafeInteger(v.observedAtMs)||v.observedAtMs<=0||v.observedAtMs>now||now-v.observedAtMs>maxAge)fail('FUTURES_SNAPSHOT_STALE');return v.value;
}
function one(rows,predicate,code){if(!Array.isArray(rows)||rows.length>10000)fail(code);const found=rows.filter(predicate);if(found.length!==1)fail(code);return found[0];}

export function preflightBinanceFuturesDraftR119(input){
 exact(input,['binding','order','snapshots','nowMs']);
 const {binding,order:o,snapshots:s,nowMs:now}=input;
 exact(binding,['product','environment','keyFingerprint']);
 if(binding.product!=='usds_m_futures'||!['demo','live'].includes(binding.environment)||!fingerprint(binding.keyFingerprint)||!Number.isSafeInteger(now)||now<=0)fail('FUTURES_INVALID_BINDING');
 exact(o,['clientOrderId','symbol','side','positionSide','type','quantity','entryPrice','stopPrice','targetPrice','leverage','marginAsset']);
 if(typeof o.clientOrderId!=='string'||! /^ju_[A-Za-z0-9_-]{1,33}$/.test(o.clientOrderId)||typeof o.symbol!=='string'||! /^[A-Z0-9]{2,30}$/.test(o.symbol)||!['BUY','SELL'].includes(o.side)||o.positionSide!=='BOTH'||o.type!=='LIMIT'||o.marginAsset!=='USDT'||!Number.isSafeInteger(o.leverage)||o.leverage<1)fail('FUTURES_UNSUPPORTED_DECISION');
 exact(s,['exchangeInfo','accountConfig','symbolConfig','balances','positions','openOrders','globalAlgoOrders','markPrice']);
 const exchange=snapshot(s.exchangeInfo,binding,now,60000),account=snapshot(s.accountConfig,binding,now,5000),configuration=snapshot(s.symbolConfig,binding,now,5000),balances=snapshot(s.balances,binding,now,5000),positions=snapshot(s.positions,binding,now,5000),open=snapshot(s.openOrders,binding,now,5000),globalAlgos=snapshot(s.globalAlgoOrders,binding,now,5000),mark=snapshot(s.markPrice,binding,now,1000);
 if(account?.canTrade!==true||account.dualSidePosition!==false||account.multiAssetsMargin!==false)fail('FUTURES_ACCOUNT_MODE_UNSUPPORTED');
 const meta=one(exchange?.symbols,x=>x?.symbol===o.symbol,'FUTURES_SYMBOL_UNVERIFIED');
 if(meta.status!=='TRADING'||meta.contractType!=='PERPETUAL'||meta.marginAsset!==o.marginAsset||meta.quoteAsset!==o.marginAsset||!Array.isArray(meta.orderTypes)||!['LIMIT','STOP_MARKET','TAKE_PROFIT_MARKET'].every(t=>meta.orderTypes.includes(t))||!Array.isArray(meta.timeInForce)||!meta.timeInForce.includes('GTC'))fail('FUTURES_INSTRUMENT_UNSUPPORTED');
 const cfg=one(configuration,x=>x?.symbol===o.symbol,'FUTURES_SYMBOL_CONFIGURATION_REQUIRED');
 if(cfg.marginType!=='ISOLATED'||cfg.isAutoAddMargin!==false)fail('FUTURES_ISOLATED_MARGIN_REQUIRED');
 if(cfg.leverage!==o.leverage)fail('FUTURES_LEVERAGE_CHANGE_NOT_AUTHORIZED');
 if(!Array.isArray(positions)||positions.length>3||positions.some(p=>p?.symbol!==o.symbol||p.positionSide!=='BOTH'||fixed(p.positionAmt,{signed:true})!==0n))fail('FUTURES_EXISTING_POSITION_REQUIRES_RECONCILIATION');
 if(positions.length>1)fail('FUTURES_POSITION_SNAPSHOT_INVALID');
 exact(globalAlgos,['scope','complete','orders']);
 if(globalAlgos.scope!=='all_symbols'||globalAlgos.complete!==true||!Array.isArray(globalAlgos.orders)||globalAlgos.orders.length>200)fail('FUTURES_GLOBAL_ALGO_INVENTORY_REQUIRED');
 const seenAlgos=new Set();
 for(const a of globalAlgos.orders){
  if(typeof a?.symbol!=='string'||! /^[A-Z0-9]{2,30}$/.test(a.symbol)||!['NEW','TRIGGERING','TRIGGERED'].includes(a.algoStatus)||!(typeof a.algoId==='string'&&/^[1-9]\d{0,19}$/.test(a.algoId)||Number.isSafeInteger(a.algoId)&&a.algoId>0))fail('FUTURES_GLOBAL_ALGO_INVENTORY_INVALID');
  const id=a.symbol+':'+String(a.algoId);if(seenAlgos.has(id))fail('FUTURES_GLOBAL_ALGO_INVENTORY_INVALID');seenAlgos.add(id);
 }
 if(globalAlgos.orders.length+2>200)fail('FUTURES_GLOBAL_ALGO_CAPACITY_REQUIRED');
 if(!Array.isArray(open)||open.length||globalAlgos.orders.some(a=>a.symbol===o.symbol))fail('FUTURES_EXISTING_ORDERS_REQUIRE_RECONCILIATION');
 if(mark?.symbol!==o.symbol||!Number.isSafeInteger(mark.time)||mark.time>now||now-mark.time>3000)fail('FUTURES_MARK_PRICE_UNVERIFIED');
 const markPrice=fixed(mark.markPrice,{positive:true}),quantity=fixed(o.quantity,{positive:true}),entry=fixed(o.entryPrice,{positive:true}),stop=fixed(o.stopPrice,{positive:true}),target=fixed(o.targetPrice,{positive:true});
 const filters=new Map(),known=new Set(['PRICE_FILTER','LOT_SIZE','MARKET_LOT_SIZE','MIN_NOTIONAL','PERCENT_PRICE','MAX_NUM_ORDERS']);
 if(!Array.isArray(meta.filters))fail('FUTURES_FILTERS_REQUIRED');
 for(const f of meta.filters){if(!known.has(f?.filterType)||filters.has(f.filterType))fail('FUTURES_UNKNOWN_OR_DUPLICATE_FILTER');filters.set(f.filterType,f);}
 if([...known].some(k=>!filters.has(k)))fail('FUTURES_FILTERS_REQUIRED');
 const price=filters.get('PRICE_FILTER'),minimum=fixed(price.minPrice),maximum=fixed(price.maxPrice),tick=fixed(price.tickSize);
 if(minimum&&maximum&&minimum>maximum)fail('FUTURES_FILTERS_INVALID');
 for(const p of [entry,stop,target])if(minimum&&p<minimum||maximum&&p>maximum||tick&&(p-minimum)%tick!==0n)fail('FUTURES_PRICE_FILTER');
 for(const name of ['LOT_SIZE','MARKET_LOT_SIZE']){
  const f=filters.get(name),min=fixed(f.minQty),max=fixed(f.maxQty,{positive:true}),step=fixed(f.stepSize,{positive:true});
  if(min>max)fail('FUTURES_FILTERS_INVALID');
  if(quantity<min||quantity>max||(quantity-min)%step!==0n)fail('FUTURES_QUANTITY_FILTER');
 }
 const percent=filters.get('PERCENT_PRICE'),up=fixed(percent.multiplierUp,{positive:true}),down=fixed(percent.multiplierDown,{positive:true});if(down>up)fail('FUTURES_FILTERS_INVALID');
 if(o.side==='BUY'?entry*UNIT>markPrice*up:entry*UNIT<markPrice*down)fail('FUTURES_PERCENT_PRICE_FILTER');
 const notional=entry*quantity;
 if(notional<fixed(filters.get('MIN_NOTIONAL').notional,{positive:true})*UNIT)fail('FUTURES_MIN_NOTIONAL_FILTER');
 if(notional>fixed(cfg.maxNotionalValue,{positive:true})*UNIT)fail('FUTURES_MAX_NOTIONAL_FILTER');
 for(const [name,needed] of [['MAX_NUM_ORDERS',3]]){const limit=filters.get(name).limit;if(!Number.isSafeInteger(limit)||limit<needed)fail('FUTURES_PROTECTION_ORDER_SLOTS_REQUIRED');}
 if(o.side==='BUY'?(stop>=entry||stop>=markPrice||target<=entry||target<=markPrice):(stop<=entry||stop<=markPrice||target>=entry||target>=markPrice))fail('FUTURES_PROTECTION_DIRECTION_INVALID');
 const balance=one(balances,b=>b?.asset===o.marginAsset,'FUTURES_MARGIN_ASSET_UNVERIFIED');
 const available=fixed(balance.availableBalance),margin=ceil(notional,UNIT*BigInt(o.leverage));
 if(available<margin)fail('FUTURES_MARGIN_FLOOR_NOT_MET');
 return freeze({schema:'JENIOS_ULTRA_BINANCE_PREFLIGHT_R119',product:'usds_m_futures',environment:binding.environment,symbol:o.symbol,structuralChecksPassed:true,snapshotAuthenticationVerified:false,
  selectedSide:o.side,inversionAppliedByAdapter:false,quantity:o.quantity,marginAsset:o.marginAsset,leverage:o.leverage,
  notionalUpperBound:format(ceil(notional,UNIT)),initialMarginFloor:format(margin),feesAndSlippageReserved:false,riskReserved:false,
  entryIntent:{symbol:o.symbol,side:o.side,positionSide:o.positionSide,type:'LIMIT',timeInForce:'GTC',quantity:o.quantity,price:o.entryPrice,newClientOrderId:o.clientOrderId},
  protectionIntent:{side:o.side==='BUY'?'SELL':'BUY',positionSide:o.positionSide,quantity:o.quantity,stopPrice:o.stopPrice,targetPrice:o.targetPrice,workingType:'MARK_PRICE'},
  globalConditionalLimit:200,globalConditionalCount:globalAlgos.orders.length,globalConditionalSlotsReserved:false,protectionInstalled:false,protectionAtomic:false,canSubmit:false,ordersSent:0,
  pending:['AUTHENTICATED_NATIVE_SNAPSHOTS','KEY_PERMISSION_AUDIT','DURABLE_RISK_RESERVATION','NATIVE_PROTECTION_AND_RECOVERY','HUMAN_ACTIVATION']});
}
