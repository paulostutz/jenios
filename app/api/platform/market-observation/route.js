import {fetchPublicCandles,PUBLIC_MARKET_PRODUCTS,PUBLIC_MARKET_GRANULARITIES}
 from '../../../../lib/platform/public-market-candles.mjs';
export const dynamic='force-dynamic';
const failed=(error)=>Response.json({
 available:false,source:'coinbase_exchange_public_rest',
 error:error?.codeStatus===400?'Selecione um ativo e intervalo válidos.':
  'Dados públicos ainda não confirmados nesta leitura. Aguarde antes de tentar novamente.',
 code:error?.codeStatus===400?'INVALID_REQUEST':'MARKET_UNAVAILABLE',
 realExecutionAllowed:false
},{status:error?.codeStatus===400?400:503,headers:{'Cache-Control':'no-store'}});
/** Fixed HTTPS upstream, allowlisted assets and no client-supplied addresses. */
export async function GET(request){
 try{
  const url=new URL(request.url);
  const product=url.searchParams.get('product')||'BTC-USD';
  const seconds=Number(url.searchParams.get('granularity')||300);
  if(!PUBLIC_MARKET_PRODUCTS.includes(product)||!PUBLIC_MARKET_GRANULARITIES.includes(seconds))
   return failed({codeStatus:400});
  const data=await fetchPublicCandles(product,seconds);
  return Response.json({
   ...data,realExecutionAllowed:false,
   warning:'Cotações históricas públicas para pesquisa; sem garantia de continuidade, licenciamento comercial ou execução real.'
  },{headers:{'Cache-Control':'public,s-maxage=60,stale-while-revalidate=30'}});
 }catch(error){return failed(error);}
}
