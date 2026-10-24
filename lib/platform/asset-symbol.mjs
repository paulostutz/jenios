/** Resolve supported shorthand without guessing an exchange for unknown symbols. */
const aliases={
 WIN:'BMFBOVESPA:WIN1!',WDO:'BMFBOVESPA:WDO1!',
 'WIN1!':'BMFBOVESPA:WIN1!','WDO1!':'BMFBOVESPA:WDO1!',
 BTC:'BINANCE:BTCUSDT',ETH:'BINANCE:ETHUSDT',SOL:'BINANCE:SOLUSDT',XRP:'BINANCE:XRPUSDT',
 EURUSD:'FX:EURUSD',GBPUSD:'FX:GBPUSD',USDJPY:'FX:USDJPY',AUDUSD:'FX:AUDUSD',
 USDCAD:'FX:USDCAD',USDCHF:'FX:USDCHF',NZDUSD:'FX:NZDUSD',
 XAUUSD:'OANDA:XAUUSD',XAGUSD:'OANDA:XAGUSD',
 AAPL:'NASDAQ:AAPL',MSFT:'NASDAQ:MSFT',NVDA:'NASDAQ:NVDA',TSLA:'NASDAQ:TSLA',
 AMZN:'NASDAQ:AMZN',GOOGL:'NASDAQ:GOOGL',META:'NASDAQ:META',
 SPX:'SP:SPX',NDX:'NASDAQ:NDX'
};
export function resolveAssetSymbol(input){
 const text=typeof input==='string'?input.trim().toUpperCase():'';
 if(!text||text.length>48||!/^[A-Z0-9_.!:/-]+$/.test(text))
  return {ok:false,error:'Informe um código de ativo válido, como PETR4, BTC/USDT ou NASDAQ:AAPL.'};
 if(text.includes(':')){
  if(!/^[A-Z0-9_]{1,20}:[A-Z0-9][A-Z0-9_.!-]{0,25}$/.test(text))
   return {ok:false,error:'Use o formato BOLSA:ATIVO, como NASDAQ:AAPL.'};
  return {ok:true,symbol:text,label:text};
 }
 const compact=text.replace(/[/-]/g,'');
 const symbol=aliases[compact]||
  (/^[A-Z0-9]{2,12}USDT$/.test(compact)?'BINANCE:'+compact:null)||
  (/^[A-Z]{4}\d{1,2}$/.test(text)?'BMFBOVESPA:'+text:null);
 return symbol?{ok:true,symbol,label:text}:
  {ok:false,error:'Não foi possível identificar a bolsa. Informe BOLSA:ATIVO, como NYSE:IBM, ou use um atalho.'};
}
