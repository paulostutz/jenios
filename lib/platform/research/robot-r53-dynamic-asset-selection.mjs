/**
 * R53 — dynamic UltraFast asset selection under changing costs/liquidity.
 */
const fail=c=>{throw Object.assign(new Error(c),{code:c});};
const finite=x=>typeof x==='number'&&Number.isFinite(x);
export function scoreR53Asset(x){
 if(!x||typeof x.symbol!=='string'||!finite(x.volatilityBps)||!finite(x.spreadBps)||
   !finite(x.depthUsd)||!finite(x.fillProbability)||!finite(x.roundTripCostBps)||
   !finite(x.adverseSelectionBps)||!finite(x.stabilityRatio))fail('R53_INVALID_ASSET');
 const liquidity=Math.min(1,x.depthUsd/2_000_000);
 const movement=Math.min(1,x.volatilityBps/50);
 const cost=Math.min(1,(x.roundTripCostBps+x.adverseSelectionBps)/30);
 const spread=Math.min(1,x.spreadBps/20);
 const score=movement*30+liquidity*25+x.fillProbability*20+x.stabilityRatio*15-cost*20-spread*10;
 const eligible=x.depthUsd>=100000&&x.fillProbability>=.25&&x.stabilityRatio>=.6&&x.volatilityBps>(x.roundTripCostBps+x.adverseSelectionBps)*1.5;
 return Object.freeze({...x,eligible,score:Number(score.toFixed(6))});
}
export function rankR53Assets(rows=[]){
 if(!Array.isArray(rows)||rows.length<2)fail('R53_INVALID_ROWS');
 return Object.freeze(rows.map(scoreR53Asset).sort((a,b)=>b.score-a.score||a.symbol.localeCompare(b.symbol)));
}
export function runR53Battery(){
 const base=[
  {symbol:'BTC-USD',volatilityBps:24,spreadBps:1.2,depthUsd:3000000,fillProbability:.92,roundTripCostBps:3,adverseSelectionBps:1,stabilityRatio:.9},
  {symbol:'ETH-USD',volatilityBps:30,spreadBps:1.8,depthUsd:1800000,fillProbability:.88,roundTripCostBps:4,adverseSelectionBps:1.5,stabilityRatio:.86},
  {symbol:'SOL-USD',volatilityBps:42,spreadBps:3,depthUsd:900000,fillProbability:.80,roundTripCostBps:5,adverseSelectionBps:2,stabilityRatio:.82}
 ];
 const normal=rankR53Assets(base);
 const shocked=rankR53Assets(base.map(x=>x.symbol==='SOL-USD'?{...x,spreadBps:14,depthUsd:90000,fillProbability:.2,roundTripCostBps:12,adverseSelectionBps:8}:x));
 return Object.freeze({
  normalTop:normal[0].symbol,
  shockedSolIneligible:shocked.find(x=>x.symbol==='SOL-USD').eligible===false,
  shockChangesRanking:normal.map(x=>x.symbol).join(',')!==shocked.map(x=>x.symbol).join(','),
  pass:shocked.find(x=>x.symbol==='SOL-USD').eligible===false&&normal.some(x=>x.eligible),
  actualBrokerPnl:null,ordersSent:0,paperOrdersSent:0
 });
}