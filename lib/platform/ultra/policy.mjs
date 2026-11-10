/** R115. Customer planning and advisory policy. Never a broker permission. */
export const ULTRA_POLICY_VERSION='ultra-r115-1';
export const ULTRA_MARKETS=Object.freeze([
 {id:'b3',label:'Ações e índices · B3',provider:'profit',currency:'BRL',guide:'/integracoes?provider=profit',requirements:['ProfitDLL com roteamento habilitado','Ponte Windows e conta da corretora verificadas']},
 {id:'crypto',label:'Cripto',provider:'binance',currency:'USDT',guide:'/integracoes?provider=binance',requirements:['Produto Spot ou Futures elegível para a conta','Conector Futures, margem e confirmações validados']},
 {id:'forex',label:'Forex e índices internacionais',provider:'mt5',currency:'USD',guide:'/integracoes?provider=mt5',requirements:['Conta e terminal MT5 autorizados','Ponte MT5 e posições conciliadas']}
]);
const fail=message=>{throw Object.assign(Error(message),{status:400});};
const number=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
function exact(obj,keys){if(!obj||typeof obj!=='object'||Array.isArray(obj)||Object.keys(obj).some(k=>!keys.includes(k)))fail('Configuração inválida.');}
export function normalizeUltraConfig(input){
 exact(input,['markets','sessionMinutes','maxPositions','tradeRiskPct','dailyLossPct','maxAssetPct','excludedSymbols']);
 if(!Array.isArray(input.markets)||input.markets.length<1||input.markets.length>3)fail('Selecione pelo menos um mercado.');
 const seen=new Set();
 const markets=input.markets.map(m=>{
  exact(m,['id','capital','leverage','currency']);
  if(!ULTRA_MARKETS.some(x=>x.id===m.id)||seen.has(m.id))fail('Mercado inválido ou repetido.');seen.add(m.id);
  if(!number(m.capital,0.01,1e9)||Math.abs(m.capital*100-Math.round(m.capital*100))>0.0001)fail('Informe um capital válido, com até duas casas decimais.');
  if(!number(m.leverage,1,1000))fail('Informe uma alavancagem entre 1 e 1.000 para o planejamento.');
  if(!['BRL','USD','USDT','EUR'].includes(m.currency)||(m.id==='b3'&&m.currency!=='BRL'))fail('Moeda inválida para o mercado.');
  return {id:m.id,capital:m.capital,leverage:m.leverage,currency:m.currency};
 }).sort((a,b)=>a.id.localeCompare(b.id));
 if(!Number.isInteger(input.sessionMinutes)||!number(input.sessionMinutes,1,1440))fail('A sessão deve durar entre 1 e 1.440 minutos.');
 if(!Number.isInteger(input.maxPositions)||!number(input.maxPositions,1,20))fail('Escolha entre 1 e 20 posições simultâneas.');
 if(!number(input.tradeRiskPct,0.01,100)||!number(input.dailyLossPct,0.01,100)||!number(input.maxAssetPct,1,100))fail('Revise os percentuais de risco e concentração.');
 if(!Array.isArray(input.excludedSymbols)||input.excludedSymbols.length>50||input.excludedSymbols.some(s=>typeof s!=='string'||!/^[-A-Za-z0-9_./:!]{1,40}$/.test(s)))fail('Informe símbolos válidos, separados por vírgula.');
 return {markets,sessionMinutes:input.sessionMinutes,maxPositions:input.maxPositions,tradeRiskPct:input.tradeRiskPct,dailyLossPct:input.dailyLossPct,maxAssetPct:input.maxAssetPct,excludedSymbols:[...new Set(input.excludedSymbols.map(s=>s.toUpperCase()))].sort()};
}
export function assessUltraLeverage(input){
 const config=normalizeUltraConfig(input);
 const markets=config.markets.map(m=>{
  const exposure=m.capital*m.leverage;
  return {...m,exposure,adverseMoveToConsumeCapitalPct:100/m.leverage,
   scenarios:[1,2,5].map(movePct=>({movePct,loss:exposure*movePct/100,capitalLossPct:m.leverage*movePct})),
   highRisk:m.leverage>=10||m.leverage*5>=25};
 });
 const warnings=[];
 if(markets.some(m=>m.highRisk))warnings.push('A exposição escolhida pode consumir todo o capital destinado ao Ultra e, conforme o produto e as garantias, atingir outros recursos da conta.');
 if(config.tradeRiskPct>2)warnings.push('O risco escolhido por operação representa uma parcela elevada do capital.');
 if(config.dailyLossPct>10)warnings.push('O limite diário permite uma perda relevante antes da pausa de novas entradas.');
 if(config.maxAssetPct>50)warnings.push('Mais da metade do capital poderá ficar concentrada em um único ativo.');
 return {policyVersion:ULTRA_POLICY_VERSION,config,markets,warnings,requiresAcknowledgement:warnings.length>0,
  explanation:'Cenários matemáticos com 100% do capital exposto à alavancagem escolhida, antes de taxas, funding e slippage. Não são previsão de perda nem preço de liquidação. Stops podem executar em preço diferente do previsto.',
  liveExecutionEnabled:false};
}
export function ultraConnectionReadiness(){
 return ULTRA_MARKETS.map(m=>({...m,connected:false,canStart:false,status:'awaiting_connection'}));
}
/** Only objective adapter state may enable execution. Risk acknowledgement never substitutes it. */
export function ultraOperationalBlockers(state={}){
 const required=['authenticated','ownerVerified','tradingPermitted','instrumentSupported','marketOpen','freshQuotes','marginSufficient','reconciled','protectiveOrdersSupported','durableJournalReady','transportCertified'];
 return required.filter(k=>state[k]!==true);
}
