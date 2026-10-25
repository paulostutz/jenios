/** JENIOS Pro — policy only; never initiates a payment or provider call.
 * Prices snapshot: OpenAI API Standard, 2026-10-20 (short context).
 * Ledger amounts are integer nanoUSD ($0.000000001). Legacy microUSD fields
 * are display values and may be fractional; never persist them as integers.
 * Retail debits are exactly 2x provider charges for supported model/tool use.
 */
export const PRO_PRICING_VERSION='2026-10-20-v2-nano';
export const PRO_NANO_USD_PER_USD=1_000_000_000;
// B135 proposals retained for compatibility; these are NOT approved sale prices.
export const PRO_TOPUP_APPROVAL_REQUIRED=true;
export const PRO_MIN_TOPUP_CLIENT_MICRO_USD=10_000_000;
export const PRO_PACKS=Object.freeze([
 {id:'start',retailMicroUsd:10_000_000},
 {id:'study',retailMicroUsd:25_000_000},
 {id:'intensive',retailMicroUsd:50_000_000},
 {id:'professional',retailMicroUsd:100_000_000}
].map(p=>Object.freeze({...p,proposed:true,purchaseAuthorized:false})));
export const PRO_MULTIPLIER=2n;
export const PRO_MODEL_RATES=Object.freeze({
 'gpt-6-luna':Object.freeze({input:100_000,cachedInput:10_000,cacheWrite:125_000,output:500_000}),
 'gpt-6.1-sol':Object.freeze({input:2_000_000,cachedInput:100_000,cacheWrite:2_500_000,output:10_000_000})
});
export const PRO_TOOL_COST_MICRO_USD=Object.freeze({web_search:10_000,file_search:2_500});
export const PRO_TASKS=Object.freeze({
 advanced_question:Object.freeze({label:'Pergunta avançada',model:'gpt-6-luna',requiresCurrentData:false,acceptsImage:false}),
 university_tutor:Object.freeze({label:'Tutor avançado',model:'gpt-6-luna',requiresCurrentData:false,acceptsImage:false}),
 chart_screenshot:Object.freeze({label:'Analisar gráfico por foto',model:'gpt-6.1-sol',requiresCurrentData:false,acceptsImage:true,requiresImage:true}),
 market_moment:Object.freeze({label:'Cenário do gráfico enviado',model:'gpt-6.1-sol',requiresCurrentData:false,acceptsImage:true,requiresImage:true}),
 opportunities:Object.freeze({label:'Cenários na imagem',model:'gpt-6.1-sol',requiresCurrentData:false,acceptsImage:true,requiresImage:true}),
 manual_support:Object.freeze({label:'Apoio à leitura do gráfico',model:'gpt-6.1-sol',requiresCurrentData:false,acceptsImage:true,requiresImage:true})
});
function integer(n,label,max=1_000_000_000){
 if(!Number.isSafeInteger(n)||n<0||n>max)throw Object.assign(Error('Valor inválido: '+label),{status:400});
 return n;
}
const ceilDiv=(n,d)=>(n+d-1n)/d;
export function proPackQuote(packId,brlCentsPerUsd,{rateSource,rateAt,now=Date.now()}={}){
 const pack=PRO_PACKS.find(p=>p.id===packId);
 if(!pack)throw Object.assign(Error('Pacote desconhecido.'),{status:400});
 integer(brlCentsPerUsd,'fx',100_000);
 if(brlCentsPerUsd<100)throw Object.assign(Error('Taxa de câmbio inválida.'),{status:503});
 if(typeof rateSource!=='string'||!/^BCB:[a-z0-9_.-]{1,40}$/i.test(rateSource))
  throw Object.assign(Error('Câmbio verificável indisponível.'),{status:503});
 const timestamp=Date.parse(rateAt);
 if(!Number.isFinite(timestamp)||timestamp>now||now-timestamp>72*3600_000)
  throw Object.assign(Error('Cotação vencida; obtenha nova cotação antes de cobrar.'),{status:503});
 const priceCents=Number(ceilDiv(BigInt(pack.retailMicroUsd)*BigInt(brlCentsPerUsd),1_000_000n));
 return Object.freeze({packId,productCode:'social-ai-pro-credits',retailMicroUsd:pack.retailMicroUsd,
  proposed:true,purchaseAuthorized:false,approvalRequired:true,
  upstreamCapacityMicroUsd:pack.retailMicroUsd/2,priceCents,currency:'BRL',
  fxBrlCentsPerUsd:brlCentsPerUsd,rateSource,rateAt,version:PRO_PRICING_VERSION,
  expiresAt:new Date(now+15*60_000).toISOString()});
}
/** Use provider response.usage including all billed output/reasoning tokens.
 * Cached tokens are SUBSET of input_tokens, never an extra input charge.
 * Tool counts must originate from verified provider output, not the client.
 */
export function proProviderCost(usage,{model,tools={}}={}){
 const price=PRO_MODEL_RATES[model];
 if(!price)throw Object.assign(Error('Modelo não precificado. Operação bloqueada.'),{status:503});
 if(!usage||typeof usage!=='object')throw Object.assign(Error('Faltou o consumo confirmado pelo provedor.'),{status:502});
 const input=integer(usage.input_tokens,'entrada');
 const output=integer(usage.output_tokens,'saída');
 const cached=integer(usage.input_tokens_details?.cached_tokens??0,'cache');
 const cacheWrite=integer(usage.input_tokens_details?.cache_write_tokens??0,'gravação do cache');
 if(cached+cacheWrite>input)throw Object.assign(Error('Uso de cache inválido.'),{status:502});
 const billable=BigInt(input-cached-cacheWrite)*BigInt(price.input)+BigInt(cached)*BigInt(price.cachedInput)+BigInt(cacheWrite)*BigInt(price.cacheWrite)+BigInt(output)*BigInt(price.output);
 // Rates are microUSD per million tokens. Dividing by 1,000 converts the
 // token product to nanoUSD. Reject an unrepresentable tariff, never round
 // each call upward and silently charge more than exactly twice its cost.
 if(billable%1_000n!==0n)throw Object.assign(Error('Tarifa sem precisão suficiente para conciliação.'),{status:503});
 let totalNano= billable/1_000n;
 if(!tools||typeof tools!=='object'||Array.isArray(tools))throw Object.assign(Error('Uso de ferramentas inválido.'),{status:502});
 for(const [tool,count] of Object.entries(tools)){
  if(!Object.hasOwn(PRO_TOOL_COST_MICRO_USD,tool))throw Object.assign(Error('Ferramenta não precificada.'),{status:503});
  totalNano+=BigInt(integer(count,'uso de ferramenta',100))*BigInt(PRO_TOOL_COST_MICRO_USD[tool])*1_000n;
 }
 const providerCostNanoUsd=Number(totalNano),retailDebitNanoUsd=Number(totalNano*PRO_MULTIPLIER);
 if(!Number.isSafeInteger(providerCostNanoUsd)||!Number.isSafeInteger(retailDebitNanoUsd))throw Object.assign(Error('Consumo acima do limite contábil.'),{status:502});
 return {version:PRO_PRICING_VERSION,model,providerCostNanoUsd,retailDebitNanoUsd,
  providerCostMicroUsd:providerCostNanoUsd/1_000,retailDebitMicroUsd:retailDebitNanoUsd/1_000,
  inputTokens:input,outputTokens:output,cachedInputTokens:cached,cacheWriteInputTokens:cacheWrite,tools};
}
export function validateProTask(input,{now=Date.now(),verifiedMarketData=null}={}){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Object.assign(Error('Operação inválida.'),{status:400});
 if(Object.keys(input).some(k=>!['task','symbol','timeframe','prompt','image'].includes(k)))
  throw Object.assign(Error('Parâmetro não permitido.'),{status:400});
 const task=Object.hasOwn(PRO_TASKS,input.task)?PRO_TASKS[input.task]:null;
 if(!task)throw Object.assign(Error('Recurso Pro não disponível.'),{status:400});
 if(typeof input.prompt!=='string'||!input.prompt.trim()||input.prompt.length>2500)
  throw Object.assign(Error('Descreva sua dúvida em até 2.500 caracteres.'),{status:400});
 if(task.requiresImage&&!input.image)throw Object.assign(Error('Anexe uma foto ou print do gráfico para continuar.'),{status:400});
 if(input.image){
  if(!task.acceptsImage)throw Object.assign(Error('Este serviço não aceita fotografias.'),{status:400});
  // Uploads must be resolved server-side from authenticated owner's private media store.
  const image=input.image;
  if(typeof image!=='object'||Object.keys(image).some(k=>!['mime','byteLength','width','height','storageId'].includes(k))||
     !['image/png','image/jpeg','image/webp'].includes(image.mime)||
     !/^[0-9a-f-]{36}$/i.test(image.storageId||'')||
     !Number.isSafeInteger(image.byteLength)||image.byteLength<=0||image.byteLength>3_000_000||
     !Number.isSafeInteger(image.width)||image.width<64||image.width>4096||
     !Number.isSafeInteger(image.height)||image.height<64||image.height>4096)
    throw Object.assign(Error('Imagem inválida ou acima do limite; use uma imagem nítida de até 3 MB.'),{status:400});
 }
 if(task.requiresCurrentData){
  const data=verifiedMarketData;
  if(!data||typeof data!=='object'||data.verified!==true||!Array.isArray(data.candles)||data.candles.length<30)
   throw Object.assign(Error('Sem dados reais verificados, a análise do momento não será gerada.'),{status:422});
  const at=Date.parse(data.sourceAt);
  if(!Number.isFinite(at)||at>now+60_000||now-at>15*60_000)
   throw Object.assign(Error('Fonte desatualizada. Consulte novamente antes de gerar análise.'),{status:422});
  // Only a server-side market-data adapter can supply verifiedMarketData.
 }
 return {task:input.task,model:task.model,symbol:String(input.symbol||'').slice(0,40),
  timeframe:String(input.timeframe||'').slice(0,20),prompt:input.prompt.trim(),
  acceptsImage:task.acceptsImage,requiresCurrentData:task.requiresCurrentData,
  executionEnabled:false,autoTrading:false,personalizedOrderEnabled:false};
}
