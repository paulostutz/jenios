// Screening heuristic, not a prediction. Pool creation is NOT token creation.
export const RADAR_RULES = Object.freeze({ maxAgeHours:48, minAgeMinutes:15, minLiquidityUsd:25000, minVolumeH1Usd:50000, minBuysH1:100, minBuyersH1:50, minBuyShare:0.6, minPriceChangeH1:5, maxVolumeLiquidity:20 });
const numeric = value => (typeof value === 'number' || typeof value === 'string' && value.trim() !== '') && Number.isFinite(Number(value)) ? Number(value) : null;
const count = value => { const n = numeric(value); return Number.isSafeInteger(n) && n >= 0 ? n : null; };
const safe = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value);
const majors = /^(W?BTC|W?ETH|W?BNB|W?SOL|USDT|USDC|DAI|USDE|FDUSD|TUSD|WBTC|WSTETH)$/i;

export function screenNewPools(payload, { now = Date.now() } = {}) {
  if (!Array.isArray(payload?.data) || !Array.isArray(payload?.included)) throw Error('INVALID_PROVIDER_RESPONSE');
  const metadata = new Map(payload.included.filter(item => item.type === 'token').map(item => [item.id, item.attributes]));
  const candidates = [];
  for (const pool of payload.data.slice(0, 20)) {
    const a = pool?.attributes, tokenId = pool?.relationships?.base_token?.data?.id;
    const token = metadata.get(tokenId);
    if (pool?.type !== 'pool' || typeof tokenId !== 'string' || !token) continue;
    const network = tokenId.slice(0, tokenId.indexOf('_'));
    if (!safe(network) || !safe(a?.address) || !safe(token.address) || tokenId !== `${network}_${token.address}` || pool.id !== `${network}_${a.address}`) continue;
    if (typeof token.name !== 'string' || !token.name.trim() || token.name.length > 160 || typeof token.symbol !== 'string' || !token.symbol.trim() || token.symbol.length > 32) continue;
    // Conservative exclusions; missing CoinGecko ID does not prove novelty.
    if (token.coingecko_coin_id || majors.test(token.symbol.trim()) || /^0x0+$/.test(token.address)) continue;
    const created = Date.parse(a.pool_created_at), age = (now - created) / 3600000;
    const liquidity = numeric(a.reserve_in_usd), volume = numeric(a.volume_usd?.h1), change = numeric(a.price_change_percentage?.h1);
    const buys = count(a.transactions?.h1?.buys), sells = count(a.transactions?.h1?.sells), buyers = count(a.transactions?.h1?.buyers);
    if (![created, age, liquidity, volume, change, buys, sells, buyers].every(Number.isFinite)) continue;
    const share = buys / (buys + sells), ratio = volume / liquidity;
    const r = RADAR_RULES;
    if (age < r.minAgeMinutes / 60 || age > r.maxAgeHours || liquidity < r.minLiquidityUsd || volume < r.minVolumeH1Usd || buys < r.minBuysH1 || buyers < r.minBuyersH1 || buyers > buys || share < r.minBuyShare || change < r.minPriceChangeH1 || ratio > r.maxVolumeLiquidity) continue;
    candidates.push({ id:tokenId, nome:token.name.trim(), simbolo:token.symbol.trim(), rede:network, contrato:token.address, pool:a.address, poolCriadoEm:new Date(created).toISOString(), liquidezUsd:liquidity, volumeH1Usd:volume, comprasH1:buys, vendasH1:sells, compradoresH1:buyers, proporcaoCompras:share, variacaoH1:change, volumeLiquidez:ratio,
      criacaoTokenConfirmada:false, comprasInstitucionaisConfirmadas:false,
      url:`https://www.geckoterminal.com/${encodeURIComponent(network)}/pools/${encodeURIComponent(a.address)}` });
  }
  // Rank observable activity only; never call this a probability of appreciation.
  candidates.sort((a,b) => b.compradoresH1 - a.compradoresH1 || b.volumeH1Usd - a.volumeH1Usd || a.id.localeCompare(b.id));
  const seen = new Set();
  return candidates.filter(row => { if (seen.has(row.id)) return false; seen.add(row.id); return true; }).slice(0, 10);
}

export function createNewTokenRadar({ fetchImpl = fetch, now = Date.now, env = process.env, timeoutMs = 8000 } = {}) {
  let cached = null, next = 0, inFlight = null;
  return async function radar() {
    if (cached && now() < next) return structuredClone(cached);
    if (inFlight) return structuredClone(await inFlight);
    inFlight = (async () => {
      const controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeoutMs);
      const base = { disponivel:false, candidatos:[], atualizadoEm:null, fonte:'GeckoTerminal — pools recentes', regras:RADAR_RULES, cobertura:'Amostra de até 20 pools recentes retornados pelo provedor; não é varredura de todos os tokens.', mensagem:'Não foi possível consultar a fonte. Nenhum dado antigo foi apresentado como atual.' };
      try {
        const pro = env.COINGECKO_PRO_API_KEY, demo = env.COINGECKO_DEMO_API_KEY;
        const endpoint = pro ? 'https://pro-api.coingecko.com/api/v3/onchain/networks/new_pools?include=base_token' : demo ? 'https://api.coingecko.com/api/v3/onchain/networks/new_pools?include=base_token' : 'https://api.geckoterminal.com/api/v2/networks/new_pools?include=base_token';
        const response = await fetchImpl(endpoint, { signal:controller.signal, redirect:'error', cache:'no-store', headers:{ Accept:'application/json', ...(pro ? {'x-cg-pro-api-key':pro} : demo ? {'x-cg-demo-api-key':demo} : {}) } });
        if (!response.ok) { next = now() + (response.status === 429 ? 300000 : 60000); return cached = base; }
        const candidatos = screenNewPools(await response.json(), {now:now()});
        next = now() + 300000;
        return cached = { ...base, disponivel:true, candidatos, atualizadoEm:new Date(now()).toISOString(), mensagem:null };
      } catch { next = now() + 60000; return cached = base; }
      finally { clearTimeout(timer); }
    })();
    try { return structuredClone(await inFlight); } finally { inFlight = null; }
  };
}
export const getNewTokenRadar = createNewTokenRadar();
