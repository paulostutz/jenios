import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileBinanceDepth,calculateKrakenBookChecksum,verifyKrakenBook}
  from '../lib/platform/research/ultrafast-v3-books.mjs';
import {fixed18,preflightBinanceSpotLimit,preflightKrakenSpotLimit}
  from '../lib/platform/research/ultrafast-v3-exchange-rules.mjs';
import {inspectUltraTokenSecurity,compareUltraVenuePrices}
  from '../lib/platform/research/ultrafast-v3-token-venue.mjs';
const now=1800000000000;
const b={snapshot:{lastUpdateId:101,receivedAtMs:now-500,
 bids:[['100.00','2.000'],['99.00','3.0']],asks:[['100.20','1.0'],['101.00','3.0']]},
 events:[{U:100,u:104,timestampMs:now-150,b:[['100.10','1.5']],a:[['100.20','0'],['100.25','2']]},
 {U:105,u:107,timestampMs:now-50,b:[],a:[['100.25','1.9']]}],nowMs:now};
test('Binance depth: bridges snapshot, applies zero qty deletes and correct ordering',()=>{
 const r=reconcileBinanceDepth(b);assert.equal(r.allow,true);assert.equal(r.lastUpdateId,107);
 assert.equal(r.top.bid,'100.1');assert.equal(r.top.ask,'100.25');
 assert.equal(r.book.asks.some(v=>v[0]==='100.20'),false);
});
test('Binance depth: update gap, time reversal, stale snapshot and crossed books block',()=>{
 assert.equal(reconcileBinanceDepth({...b,events:[{...b.events[0],U:105,u:107}]}).allow,false);
 assert.ok(reconcileBinanceDepth({...b,events:[{...b.events[0],U:105,u:107}]}).issues.includes('DEPTH_SEQUENCE_GAP'));
 assert.ok(reconcileBinanceDepth({...b,events:[],nowMs:now+1500}).issues.includes('BOOK_STALE'));
 assert.ok(reconcileBinanceDepth({...b,events:[]}).issues.includes('NO_DEPTH_STREAM_EVIDENCE'));
 assert.ok(reconcileBinanceDepth({...b,events:[{...b.events[0],b:[['102','5']]}]}).issues.includes('CROSSED_OR_EMPTY_AFTER_DIFF'));
});
const kraken={bids:[
 ['45283.5','0.10000000'],['45283.4','1.54582015'],['45282.1','0.10000000'],
 ['45281.0','0.10000000'],['45280.3','1.54592586'],['45279.0','0.07990000'],
 ['45277.6','0.03310103'],['45277.5','0.30000000'],['45277.3','1.54602737'],['45276.6','0.15445238']
 ].map(([price,qty])=>({price,qty})),asks:[
 ['45285.2','0.00100000'],['45286.4','1.54571953'],['45286.6','1.54571109'],
 ['45289.6','1.54560911'],['45290.2','0.15890660'],['45291.8','1.54553491'],
 ['45294.7','0.04454749'],['45296.1','0.35380000'],['45297.5','0.09945542'],['45299.5','0.18772827']
 ].map(([price,qty])=>({price,qty}))};
test('Kraken checksum matches official published v2 vector; rejects corruption',()=>{
 assert.equal(calculateKrakenBookChecksum(kraken),3310070434);
 assert.equal(verifyKrakenBook({...kraken,expectedChecksum:3310070434,receivedAtMs:now-50,nowMs:now}).allow,true);
 assert.ok(verifyKrakenBook({...kraken,expectedChecksum:1,receivedAtMs:now-50,nowMs:now}).issues.includes('CRC32_MISMATCH'));
});
const info={symbol:'BTCUSDT',status:'TRADING',isSpotTradingAllowed:true,observedAtMs:now-50,
 filters:[{filterType:'PRICE_FILTER',minPrice:'0.01',maxPrice:'1000000.00',tickSize:'0.01'},
 {filterType:'LOT_SIZE',minQty:'0.00001',maxQty:'100',stepSize:'0.00001'},
 {filterType:'MIN_NOTIONAL',minNotional:'10.00',applyToMarket:true}]};
test('price / quantity Binance filters use exact decimal BigInt arithmetic',()=>{
 assert.equal(fixed18('0.00001'),10000000000000n);
 const props={symbolInfo:info,side:'BUY',price:'63332.37',quantity:'0.00123',nowMs:now,accountTradeAllowed:true};
 assert.equal(preflightBinanceSpotLimit(props).allowResearchProposal,true);
 assert.ok(preflightBinanceSpotLimit({...props,price:'63332.371'}).issues.includes('PRICE_FILTER'));
 assert.ok(preflightBinanceSpotLimit({...props,quantity:'0.000001'}).issues.includes('LOT_SIZE'));
 assert.ok(preflightBinanceSpotLimit({...props,quantity:'0.00001'}).issues.includes('MIN_NOTIONAL'));
 assert.ok(preflightBinanceSpotLimit({...props,accountTradeAllowed:false}).issues.includes('ACCOUNT_PERMISSION_NOT_VERIFIED'));
 assert.ok(preflightBinanceSpotLimit({...props,nowMs:now+150000}).issues.includes('EXCHANGE_RULES_STALE'));
});
test('Binance dynamic/unsupported constraints fail closed; Kraken metadata separate',()=>{
 const props={symbolInfo:{...info,filters:[...info.filters,{filterType:'PERCENT_PRICE_BY_SIDE',bidMultiplierUp:'1.1',bidMultiplierDown:'0.9',askMultiplierUp:'1.2',askMultiplierDown:'0.8'}]},
 side:'BUY',price:'100',quantity:'0.2',nowMs:now,accountTradeAllowed:true};
 assert.ok(preflightBinanceSpotLimit(props).issues.includes('REFERENCE_PRICE_REQUIRED'));
 assert.ok(preflightBinanceSpotLimit({...props,referencePrice:'50'}).issues.includes('PERCENT_PRICE_BY_SIDE'));
 const kr={instrument:{symbol:'BTC/USD',status:'online',observedAtMs:now,price_increment:'0.1',qty_increment:'0.001',qty_min:'0.001',cost_min:'10'},side:'BUY',price:'60000.1',quantity:'0.001',nowMs:now};
 assert.equal(preflightKrakenSpotLimit(kr).allowResearchProposal,true);
 assert.ok(preflightKrakenSpotLimit({...kr,quantity:'0.0011'}).issues.includes('QTY_INCREMENT'));
});
test('token screening blocks missing risk evidence, suspicious token and depeg',()=>{
 const native=inspectUltraTokenSecurity({assetClass:'native',chain:'bitcoin',symbol:'BTC',observedAtMs:now,nowMs:now});
 assert.equal(native.eligibleForFurtherResearch,true);assert.equal(native.safetyCertified,false);
 const token={assetClass:'token',chain:'ethereum',symbol:'NEW',observedAtMs:now,nowMs:now,
 contractVerification:'VERIFIED',canSell:true,hasOwnerPrivileges:false,mintAuthorityActive:false,
 freezeAuthorityActive:false,top10HolderPct:30,buyTaxBps:0,sellTaxBps:0,liquidityUsd:800000,liquidityCanBeRemoved:false};
 assert.equal(inspectUltraTokenSecurity(token).eligibleForFurtherResearch,true);
 assert.ok(inspectUltraTokenSecurity({...token,canSell:null,top10HolderPct:80}).riskFlags.includes('SALE_NOT_PROVEN'));
 assert.ok(inspectUltraTokenSecurity({...token,assetClass:'stablecoin',usdReferencePrice:0.95}).riskFlags.includes('STABLECOIN_DEPEG_RISK'));
});
test('cross-venue scanner requires actual prefunding, same asset and fresh depth',()=>{
 const quotes=[{venue:'a',base:'BTC',quote:'USD',bid:99,ask:100,takerFeeBps:2,slippageBps:1,depthBase:5,timestampMs:now-100},
 {venue:'b',base:'BTC',quote:'USD',bid:101,ask:102,takerFeeBps:2,slippageBps:1,depthBase:5,timestampMs:now-100}];
 const good=compareUltraVenuePrices(quotes,{nowMs:now,tradeBaseQty:.1,availableBaseOnSellVenue:1,availableQuoteOnBuyVenue:1000});
 assert.equal(good.eligibleForResearch,true);assert.equal(good.actualFillUnknown,true);
 assert.equal(compareUltraVenuePrices(quotes,{nowMs:now,tradeBaseQty:.1}).eligibleForResearch,false);
 assert.throws(()=>compareUltraVenuePrices([quotes[0],{...quotes[1],base:'ETH'}],{nowMs:now,tradeBaseQty:1}),/NOT_COMPARABLE/);
});

test('buffered diff preceding REST snapshot receipt is valid; numeric price spellings normalize',()=>{
 const r=reconcileBinanceDepth({...b,events:[{...b.events[0],timestampMs:now-700,
    b:[['100.1000','2.0']],a:[['100.20','0'],['100.25','2']]},b.events[1]]});
 assert.equal(r.allow,true);assert.equal(r.book.bids.filter(v=>v[0]==='100.1').length,1);
 assert.equal(r.book.bids.find(v=>v[0]==='100.1')[1],'2.0');
});

test('incomplete exchange rules fail closed rather than skipping tick validation',()=>{
 const props={symbolInfo:{...info,filters:[{filterType:'PRICE_FILTER',minPrice:'0',maxPrice:'1000000'},
   info.filters[1],info.filters[2]]},side:'BUY',price:'100',quantity:'0.2',nowMs:now,accountTradeAllowed:true};
 assert.ok(preflightBinanceSpotLimit(props).issues.includes('PRICE_RULE_INCOMPLETE'));
});