/** JENIOS Pro — policy only; never initiates a payment or provider call.
 * Prices snapshot: OpenAI API Standard, 2026-10-20 (short context).
 * One credit microUSD represents $0.000001 of JENIOS retail balance.
 * Retail debits are exactly 2x provider charges for supported model/tool use.
 */
export const PRO_PRICING_VERSION='2026-10-20-v1';
export const PRO_MIN_TOPUP_CLIENT_MICRO_USD=10_000_000;
export const PRO_PACKS=Object.freeze([
 {id:'start',retailMicroUsd:10_000_000},
 {id:'study',retailMicroUsd:25_000_000},
 {id:'intensive',retailMicroUsd:50_000_000},
 {id:'professional',retailMicroUsd:100_000_000}
].map(p=>Object.freeze(p)));
export const PRO_MULTIPLIER=2n;
export const PRO_MODEL_RATES=Object.freeze({
 'gpt-6-luna':Object.freeze({input:100_000,cachedInput:10_000,output:500_000}),
 'gpt-6.1-sol':Object.freeze({input:2_000_000,cachedInput:100_000,output:10_000_000})
});
export const PRO_TOOL_COST_MICRO_USD=Object.freeze({web_search:10_000,file_search:2_500});
export const PRO_TASKS=Object.freeze({
 advanced_question:Object.freeze({label:'Pergunta avançada',model:'gpt-6-luna',requiresCurrentData:false,acceptsImage:false}),
 university_tutor:Object.freeze({label:'Tutor avançado',model:'gpt-6-luna',requiresCurrentData:false,acceptsImage:false}),
 chart_screenshot:Object.freeze({label:'Analisar gráfico por foto',model:'gpt-6.1-sol',requiresCurrentData:false,acceptsImage:true}),
 market_moment:Object.freeze({label:'Análise do momento de um ativo',model:'gpt-6.1-sol',requiresCurrentData:true,acceptsImage:false}),
 opportunities:Object.freeze({label:'Oportunidades sob observação',model:'gpt-6.1-sol',requiresCurrentData:true,acceptsImage:false}),
 manual_support:Object.freeze({label:'Apoio analítico à operação manual',model:'gpt-6.1-sol',requiresCurrentData:true,acceptsImage:true})
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
 if(cached>input)throw Object.assign(Error('Uso de cache inválido.'),{status:502});
 const billable=BigInt(input-cached)*BigInt(price.input)+BigInt(cached)*BigInt(price.cachedInput)+BigInt(output)*BigInt(price.output);
 let total=ceilDiv(billable,1_000_000n);
 for(const [tool,count] of Object.entries(tools)){
  if(!Object.hasOwn(PRO_TOOL_COST_MICRO_USD,tool))throw Object.assign(Error('Ferramenta não precificada.'),{status:503});
  total+=BigInt(integer(count,'uso de ferramenta',100))*BigInt(PRO_TOOL_COST_MICRO_USD[tool]);
 }
 const providerCostMicroUsd=Number(total);
 if(!Number.isSafeInteger(providerCostMicroUsd))throw Error('OVERFLOW');
 return {version:PRO_PRICING_VERSION,model,providerCostMicroUsd,
  retailDebitMicroUsd:providerCostMicroUsd*2,
  inputTokens:input,outputTokens:output,cachedInputTokens:cached,tools};
}
export function validateProTask(input,{now=Date.now(),verifiedMarketData=null}={}){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Object.assign(Error('Operação inválida.'),{status:400});
 if(Object.keys(input).some(k=>!['task','symbol','timeframe','prompt','image'].includes(k)))
  throw Object.assign(Error('Parâmetro não permitido.'),{status:400});
 const task=PRO_TASKS[input.task];
 if(!task)throw Object.assign(Error('Recurso Pro não disponível.'),{status:400});
 if(typeof input.prompt!=='string'||!input.prompt.trim()||input.prompt.length>2500)
  throw Object.assign(Error('Descreva sua dúvida em até 2.500 caracteres.'),{status:400});
 if(input.image){
  if(!task.acceptsImage)throw Object.assign(Error('Este serviço não aceita fotografias.'),{status:400});
  // Uploads must be resolved server-side from authenticated owner's private media store.
  const image=input.image;
  if(typeof image!=='object'||Object.keys(image).some(k=>!['mime','byteLength','width','height','storageId'].includes(k))||
     !['image/png','image/jpeg','image/webp'].includes(image.mime)||
     !/^[0-9a-f-]{36}$/i.test(image.storageId||'')||
     !Number.isSafeInteger(image.byteLength)||image.byteLength<=0||image.byteLength>4_000_000||
     !Number.isSafeInteger(image.width)||image.width<64||image.width>4096||
     !Number.isSafeInteger(image.height)||image.height<64||image.height>4096)
    throw Object.assign(Error('Imagem inválida ou acima do limite; use uma imagem nítida de até 4 MB.'),{status:400});
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
