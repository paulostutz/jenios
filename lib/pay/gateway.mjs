// Adapter boundary only: does not reimplement Banco Inter or process webhooks.
export function gatewayConfig(env = process.env) {
  if (!env.JENIOS_PAY_CHECKOUT_URL || !env.JENIOS_PAY_API_TOKEN) return null;
  const url = new URL(env.JENIOS_PAY_CHECKOUT_URL);
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Configure uma URL HTTPS válida para a JENIOS PAY.');
  return { url: url.toString(), token: env.JENIOS_PAY_API_TOKEN };
}
export function safeCheckoutUrl(value, gatewayUrl, env = process.env) {
  const url = new URL(value);
  const allowed = new Set([new URL(gatewayUrl).origin, ...String(env.JENIOS_PAY_CHECKOUT_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean)]);
  if (url.protocol !== 'https:' || url.username || url.password || !allowed.has(url.origin)) throw new Error('A PAY retornou um endereço de checkout não autorizado.');
  return url.toString();
}
export async function createGatewayCheckout(payload, { fetchImpl = fetch, env = process.env } = {}) {
  const config = gatewayConfig(env);
  if (!config) throw Object.assign(new Error('O endereço da JENIOS PAY ainda não está configurado neste ambiente.'), { status: 503 });
  let returnUrl;
  if (env.JENIOS_APP_ORIGIN) {
    const origin = new URL(env.JENIOS_APP_ORIGIN);
    if (origin.protocol !== 'https:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) throw new Error('Configure uma origem HTTPS válida para o retorno.');
    returnUrl = new URL(payload.scope === 'platform' ? '/checkout' : '/social/cobrancas', origin).toString();
  }
  const response = await fetchImpl(config.url, {
    method: 'POST', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(15000),
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + config.token, 'idempotency-key': payload.orderId },
    body: JSON.stringify({ ...payload, ...(returnUrl ? { returnUrl } : {}) }),
  });
  if (!response.ok) throw Object.assign(new Error('Não foi possível obter a cobrança na JENIOS PAY. Tente novamente com o mesmo pedido.'), { status: 502 });
  const body = await response.json();
  if (body.orderId !== payload.orderId || body.amount_cents !== payload.amount_cents || body.currency !== 'BRL') throw Object.assign(new Error('Resposta da PAY não corresponde ao pedido.'), { status: 502 });
  return { checkoutUrl: safeCheckoutUrl(body.checkoutUrl, config.url, env) };
}
