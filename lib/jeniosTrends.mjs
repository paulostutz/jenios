// Tendencias de busca do CoinGecko: nao representam novos lancamentos nem recomendacoes.
const ENDPOINT = 'https://api.coingecko.com/api/v3/search/trending';
export function normalizeCoinGeckoTrending(payload) {
  if (!payload || !Array.isArray(payload.coins)) throw new TypeError('INVALID_PROVIDER_RESPONSE');
  return payload.coins.slice(0, 20).flatMap(entry => {
    const coin = entry?.item;
    if (!coin || typeof coin.id !== 'string' || !coin.id || typeof coin.name !== 'string' || !coin.name || typeof coin.symbol !== 'string') return [];
    return [{ id:coin.id, nome:coin.name, simbolo:coin.symbol.toUpperCase(), rankingMercado:Number.isInteger(coin.market_cap_rank) ? coin.market_cap_rank : null, scoreBusca:Number.isFinite(coin.score) ? coin.score : null }];
  });
}
export async function getJeniosTrends({ fetchImpl = fetch, timeoutMs = 8000 } = {}) {
  const result = { disponivel:false, atualizadoEm:null, fonte:null, megapulse:[], tokens:[], baleias:[], mensagem:'Dados temporariamente indisponíveis.', modulos:{megapulse:{disponivel:false,mensagem:'Fonte B3 ainda não homologada.'},tokens:{disponivel:false,mensagem:'Tendências CoinGecko indisponíveis.'},baleias:{disponivel:false,mensagem:'Fonte de movimentações institucionais ainda não homologada.'}} };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(ENDPOINT, {headers:{Accept:'application/json'},signal:controller.signal,cache:'no-store'});
    if (!response.ok) return result;
    const tokens = normalizeCoinGeckoTrending(await response.json());
    if (!tokens.length) return result;
    result.disponivel = true;
    result.atualizadoEm = new Date().toISOString();
    result.fonte = 'CoinGecko Search Trending';
    result.tokens = tokens;
    result.mensagem = null;
    result.modulos.tokens = {disponivel:true,mensagem:null};
    return result;
  } catch { return result; }
  finally { clearTimeout(timer); }
}
