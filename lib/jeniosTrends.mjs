// Tendencias de busca do CoinGecko: nao representam novos lancamentos nem recomendacoes.
const ENDPOINT = 'https://api.coingecko.com/api/v3/search/trending';
export function normalizeCoinGeckoTrending(payload) {
  if (!payload || !Array.isArray(payload.coins)) throw new TypeError('INVALID_PROVIDER_RESPONSE');
  const seen = new Set();
  return payload.coins.slice(0, 20).flatMap(entry => {
    const coin = entry?.item;
    if (!coin || typeof coin.id !== 'string' || !coin.id || typeof coin.name !== 'string' || !coin.name || typeof coin.symbol !== 'string') return [];
    if (!/^[a-z0-9_-]{1,100}$/i.test(coin.id) || !coin.name.trim() || coin.name.length > 160 || !coin.symbol.trim() || coin.symbol.length > 32 || seen.has(coin.id)) return [];
    seen.add(coin.id);
    return [{ id:coin.id, nome:coin.name.trim(), simbolo:coin.symbol.trim().toUpperCase(), rankingMercado:Number.isInteger(coin.market_cap_rank) && coin.market_cap_rank > 0 ? coin.market_cap_rank : null, scoreBusca:Number.isFinite(coin.score) && coin.score >= 0 ? coin.score : null }];
  });
}
export async function getJeniosTrends({ fetchImpl = fetch, timeoutMs = 8000, env = process.env } = {}) {
  const result = { disponivel:false, atualizadoEm:null, fonte:null, megapulse:[], tokens:[], baleias:[], mensagem:'Dados temporariamente indisponíveis.', modulos:{megapulse:{disponivel:false,mensagem:'Fonte B3 ainda não homologada.'},tokens:{disponivel:false,mensagem:'Tendências CoinGecko indisponíveis.'},baleias:{disponivel:false,mensagem:'Fonte de movimentações institucionais ainda não homologada.'}} };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const pro = env.COINGECKO_PRO_API_KEY;
    const demo = env.COINGECKO_DEMO_API_KEY;
    const endpoint = pro ? 'https://pro-api.coingecko.com/api/v3/search/trending' : ENDPOINT;
    const response = await fetchImpl(endpoint, {headers:{Accept:'application/json',...(pro ? {'x-cg-pro-api-key':pro} : demo ? {'x-cg-demo-api-key':demo} : {})},signal:controller.signal,cache:'no-store',redirect:'error'});
    if (!response.ok) {
      result.modulos.tokens.mensagem = response.status === 429 ? 'Limite de consultas da fonte atingido. Nova tentativa será feita com intervalo.' : response.status === 401 || response.status === 403 ? 'A fonte exige conferir a chave e a autorização da API no servidor.' : 'A fonte não respondeu com dados válidos.';
      result.retryAfterSeconds = response.status === 429 ? 300 : 60;
      return result;
    }
    const tokens = normalizeCoinGeckoTrending(await response.json());
    if (!tokens.length) return result;
    result.disponivel = true;
    result.atualizadoEm = new Date().toISOString();
    result.fonte = 'CoinGecko Search Trending';
    result.horarioTipo = 'consulta_servidor';
    result.tokens = tokens;
    result.mensagem = null;
    result.modulos.tokens = {disponivel:true,mensagem:null};
    return result;
  } catch { return result; }
  finally { clearTimeout(timer); }
}

// Per-process cache: avoids one provider request per visitor/poll; no database writes.
export function createTrendsService({ loader = getJeniosTrends, now = Date.now, freshMs = 600000, staleMs = 3600000, retryMs = 60000 } = {}) {
  let snapshot = null, savedAt = 0, nextAttemptAt = 0, lastResult = null, inFlight = null;
  function response() {
    const current = now();
    if (snapshot && current - savedAt <= staleMs) {
      const stale = lastResult?.disponivel !== true || current - savedAt >= freshMs;
      const value = structuredClone(snapshot);
      value.stale = stale;
      value.cacheAgeSeconds = Math.max(0, Math.floor((current - savedAt) / 1000));
      value.proximaTentativaEm = new Date(nextAttemptAt).toISOString();
      if (stale) {
        value.disponivel = false;
        value.mensagem = 'Última leitura válida preservada; não representa uma fonte online agora.';
        value.modulos.tokens = { disponivel: false, stale: true, mensagem: lastResult?.modulos?.tokens?.mensagem || value.mensagem };
      }
      return value;
    }
    const value = structuredClone(lastResult);
    value.stale = false; value.proximaTentativaEm = new Date(nextAttemptAt).toISOString(); return value;
  }
  return async function trends() {
    if (inFlight) return structuredClone(await inFlight);
    if (lastResult && now() < nextAttemptAt) return response();
    inFlight = (async () => {
      try { lastResult = await loader(); }
      catch { lastResult = { disponivel: false, atualizadoEm: null, fonte: null, tokens: [], megapulse: [], baleias: [], modulos: { tokens: { disponivel: false, mensagem: 'Falha ao consultar a fonte.' } } }; }
      if (lastResult.disponivel) { snapshot = structuredClone(lastResult); savedAt = now(); nextAttemptAt = savedAt + freshMs; }
      else nextAttemptAt = now() + Math.max(retryMs, Math.min(3600000, Number(lastResult.retryAfterSeconds || 0) * 1000));
      return response();
    })();
    try { return structuredClone(await inFlight); } finally { inFlight = null; }
  };
}
export const getCachedJeniosTrends = createTrendsService();
