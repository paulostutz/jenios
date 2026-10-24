// Names for the platform's supported shortcuts. Explicit exchange:ticker remains available.
export const ASSET_CATALOG=[
 ['PETR3','Petrobras ON','BMFBOVESPA:PETR3','petroleo brasileiro'],
 ['PETR4','Petrobras PN','BMFBOVESPA:PETR4','petroleo brasileiro'],
 ['VALE3','Vale ON','BMFBOVESPA:VALE3'],
 ['ITUB3','Itaú Unibanco ON','BMFBOVESPA:ITUB3'],
 ['ITUB4','Itaú Unibanco PN','BMFBOVESPA:ITUB4'],
 ['BBDC3','Bradesco ON','BMFBOVESPA:BBDC3'],
 ['BBDC4','Bradesco PN','BMFBOVESPA:BBDC4'],
 ['BBAS3','Banco do Brasil ON','BMFBOVESPA:BBAS3'],
 ['WEGE3','WEG ON','BMFBOVESPA:WEGE3'],
 ['ABEV3','Ambev ON','BMFBOVESPA:ABEV3'],
 ['B3SA3','B3 ON','BMFBOVESPA:B3SA3','bolsa brasileira'],
 ['RENT3','Localiza ON','BMFBOVESPA:RENT3'],
 ['GGBR4','Gerdau PN','BMFBOVESPA:GGBR4'],
 ['SUZB3','Suzano ON','BMFBOVESPA:SUZB3'],
 ['RADL3','Raia Drogasil ON','BMFBOVESPA:RADL3'],
 ['WIN1!','Mini-Índice','BMFBOVESPA:WIN1!','win mini indice ibovespa'],
 ['WDO1!','Mini-Dólar','BMFBOVESPA:WDO1!','wdo mini dolar'],
 ['BTC/USDT','Bitcoin','BINANCE:BTCUSDT','btc'],
 ['ETH/USDT','Ethereum','BINANCE:ETHUSDT','eth ether'],
 ['SOL/USDT','Solana','BINANCE:SOLUSDT','sol'],
 ['XRP/USDT','XRP','BINANCE:XRPUSDT','ripple'],
 ['EUR/USD','Euro / Dólar','FX:EURUSD','eurusd'],
 ['GBP/USD','Libra / Dólar','FX:GBPUSD','gbpusd'],
 ['USD/JPY','Dólar / Iene','FX:USDJPY','usdjpy'],
 ['AUD/USD','Dólar australiano / Dólar','FX:AUDUSD','audusd'],
 ['USD/CAD','Dólar / Dólar canadense','FX:USDCAD','usdcad'],
 ['USD/CHF','Dólar / Franco suíço','FX:USDCHF','usdchf'],
 ['NZD/USD','Dólar neozelandês / Dólar','FX:NZDUSD','nzdusd'],
 ['XAU/USD','Ouro','OANDA:XAUUSD','xauusd gold'],
 ['XAG/USD','Prata','OANDA:XAGUSD','xagusd silver'],
 ['AAPL','Apple','NASDAQ:AAPL'],['MSFT','Microsoft','NASDAQ:MSFT'],
 ['NVDA','Nvidia','NASDAQ:NVDA'],['TSLA','Tesla','NASDAQ:TSLA'],
 ['AMZN','Amazon','NASDAQ:AMZN'],['GOOGL','Alphabet / Google','NASDAQ:GOOGL'],
 ['META','Meta Platforms','NASDAQ:META','facebook'],
 ['SPX','S&P 500','SP:SPX','sp500 sp 500'],['NDX','Nasdaq 100','NASDAQ:NDX']
].map(([ticker,name,symbol,aliases=''])=>({ticker,name,symbol,aliases,label:`${name} (${ticker})`}));
const normalize=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export function findAssets(query){
 const key=normalize(query);
 if(key.length<2||key.length>80)return [];
 const words=key.split(/\s+/);
 return ASSET_CATALOG.filter(item=>words.every(word=>normalize(`${item.ticker} ${item.name} ${item.aliases} ${item.symbol}`).includes(word)))
  .sort((a,b)=>Number(normalize(b.ticker)===key)-Number(normalize(a.ticker)===key))
  .slice(0,8);
}
