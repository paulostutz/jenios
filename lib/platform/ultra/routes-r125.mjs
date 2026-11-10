/** A broker is not a terminal or a market. Route selection never grants access. */
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
const routes=freeze({
 b3:[
  {provider:'mt5',broker:'genial',label:'MetaTrader 5 · B3',guide:'https://suporte.genialinvestimentos.com.br/hc/pt-br/articles/360055400032-Que-tipo-de-rob%C3%B4-eu-posso-usar-para-operar-no-MetaTrader-5',requirements:['MT5 da corretora para mercado brasileiro, no ambiente do titular','Conta, servidor e contratos com vencimento conferidos no terminal','Coleta somente leitura disponível; executor nativo ainda pendente']},
  {provider:'profit',broker:'genial',label:'Profit · B3',guide:'/integracoes?provider=profit',requirements:['ProfitDLL oficial contratado e compatível com a ponte Windows','Roteamento e instrumentos habilitados na conta do titular']}
 ],
 crypto:[{provider:'binance',broker:'binance',label:'Binance · Spot / Futures elegíveis',guide:'/integracoes?provider=binance',requirements:['Confirmar o produto e a elegibilidade da própria conta; Futures não é presumido para contas brasileiras','Spot e USDⓈ-M Futures têm contratos, permissões e custos separados','Credenciais somente no ambiente do trader; transporte real permanece pendente']},{provider:'pending',broker:'genial',label:'Genial Cripto · API pendente',guide:null,requirements:['Cripto à vista e futuros são objetivos separados do Ultra','Acesso automatizado da Genial para esses produtos ainda não comprovado','A rota Binance é separada; acesso à Genial Cripto não é inferido dela']}]
});
export function ultraProvidersForMarket(market){if(!Object.hasOwn(routes,market))throw Error('ULTRA_MARKET_INVALID');return routes[market];}
export function ultraRouteForMarket(market,provider){const entries=ultraProvidersForMarket(market),route=entries.find(r=>r.provider===(provider??(market==='crypto'?'pending':entries[0].provider)));if(!route)throw Error('ULTRA_MARKET_PROVIDER_MISMATCH');return route;}
export function ultraRouteSelection({market,provider}){const r=ultraRouteForMarket(market,provider);return freeze({market,broker:r.broker,provider:r.provider,routeConfirmed:false,credentialLocation:'trader_device',accountConnected:false,canStart:false,executionAvailable:false,brokerApprovalPerRobotRequired:null});}
