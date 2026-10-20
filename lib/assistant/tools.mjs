import {assistantError,ASSISTANT_TOOLS} from './contracts.mjs';
// Exact existing route handlers are injected. Never fetch a URL selected by a model or user.
export async function invokeExistingTool(input,authorization,handlers){
 if(!ASSISTANT_TOOLS.includes(input.tool))throw assistantError('Ferramenta não autorizada.',403);
 const {orderId,...target}=input.input;let key,method='POST',path,body;
 switch(input.tool){
  case 'trends':key='trends';method='GET';path='/api/tendencias';break;
  case 'bankscore_search':key='bankscoreSearch';method='GET';path='/api/bankscore/instituicoes';break;
  case 'bankscore_basic':key='bankscoreBasic';method='GET';path='/api/bankscore/laudo?'+new URLSearchParams(target);break;
  case 'bankscore_full':key='bankscoreFull';path='/api/bankscore/detailed';body={target,orderId,format:input.format};break;
  case 'crypto_basic':key='cryptoBasic';path='/api/crypto-validator';body=target;break;
  case 'crypto_full':key='cryptoFull';path='/api/crypto-validator/detailed';body={target,orderId,format:input.format};break;
 }
 if(typeof handlers[key]!=='function')throw assistantError('Consulta não configurada.',503);
 return handlers[key](new Request('https://jenios.internal'+path,{method,headers:{authorization,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}));
}
const text=v=>typeof v==='string'?v.slice(0,1200):v==null?'Não informado':typeof v==='number'&&Number.isFinite(v)?String(v):'Não informado';
const normalize=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const pct=v=>typeof v==='number'&&Number.isFinite(v)?v.toLocaleString('pt-BR',{maximumFractionDigits:2})+'%':'Não informado';
export function projectToolResult(input,data,now=Date.now()){
 const common={mode:'tool',tool:input.tool,consultedAt:new Date(now).toISOString(),executionEnabled:false,monitoringEnabled:false,notice:'Consulta ao serviço existente. O horário desta requisição não é necessariamente a data do dado.'};
 if(input.tool==='bankscore_search'){
  if(!Array.isArray(data.instituicoes))throw assistantError('Cadastro de instituições em formato inválido.',502);
  const q=normalize(input.input.query),all=data.instituicoes.filter(x=>normalize(x.nome).includes(q));
  return {...common,title:'Instituições encontradas',institutions:all.slice(0,40).filter(x=>/^(\d{1,12}|C\d{1,12})$/.test(String(x.codigo))).map(x=>({codigo:String(x.codigo),nome:text(x.nome)})),periodo:data.periodo,partial:data.completo!==true||all.length>40,facts:[{label:'Referência do cadastro',value:text(data.periodo)}],notices:[text(data.fonte),...(data.completo!==true?['O cadastro retornado não está completo.']:[])],links:[]};
 }
 if(input.tool==='trends'){
  const sections=['megapulse','baleias','tokens'].map(key=>({key,title:{megapulse:'Megapulse',baleias:'Movimento das Baleias',tokens:'Tokens'}[key],status:{disponivel:data.modulos?.[key]?.disponivel===true,historico:data.modulos?.[key]?.historico===true,stale:data.modulos?.[key]?.stale===true,reason:text(data.modulos?.[key]?.motivo||data.modulos?.[key]?.mensagem)},items:(Array.isArray(data[key])?data[key]:[]).slice(0,5).map(x=>({name:text(x.nome||x.simbolo),symbol:text(x.simbolo),timestamp:text(x.negociadoEm||x.data||x.atualizadoEm),variation:x.variacao==null?'Não informado':pct(x.variacao)}))}));
  return {...common,title:'Hub de Tendências',sections,facts:[],links:[{label:'Abrir Hub completo',href:'/tendencias'}],notices:['Ausência de horário, indisponibilidade ou histórico não devem ser tratados como sinal atual. Transferências não comprovam compras; nenhuma entrada é recomendada.']};
 }
 if(input.tool.startsWith('bankscore_')){
  const r=input.tool==='bankscore_full'?data.report:data,i=r?.instituicao;
  if(!i||String(i.codigo)!==input.input.codigo)throw assistantError('Resposta incompatível com a instituição selecionada.',502);
  if(input.input.periodo&&String(i.periodo)!==input.input.periodo)throw assistantError('A fonte não confirmou o período solicitado.',502);
  const href='/bankscore/detalhado?'+new URLSearchParams({codigo:input.input.codigo,periodo:String(i.periodo||input.input.periodo||''),...(input.input.orderId?{pedido:input.input.orderId}:{})});
  return {...common,title:text(i.nome),facts:[{label:'Código',value:text(i.codigo)},{label:'Referência',value:text(i.periodo)},{label:'Basileia',value:pct(i.percentual)},{label:'Revisão',value:text(i.revisao)}],explanation:input.tool==='bankscore_full'?text(r.interpretacao||r.conclusao):'Consulta básica da fonte, sem interpretação completa nesta resposta.',notices:[text(r.fonte),...(r.homologacao?['Dados em homologação; conferir a fonte oficial.']:[]),'Indicador isolado não garante segurança nem permite prever liquidação.'],links:[{label:'Abrir relatório no módulo original',href}]};
 }
 const r=data.report;
 if(!r||r.network!==input.input.network||r.type!==input.input.type||r.identifier!==input.input.identifier)throw assistantError('Resposta incompatível com o identificador consultado.',502);
 return {...common,title:'Validador de criptoativos',facts:[{label:'Rede',value:text(r.networkLabel||r.network)},{label:'Tipo',value:text(r.type)},{label:'Identificador',value:text(r.identifier)},{label:'Estado observado',value:text(r.status)},{label:'Horário da fonte',value:text(r.checkedAt)}],findings:(r.detail?.findings||[]).slice(0,12).map(x=>({title:text(x.title),explanation:text(x.explanation),level:text(x.level)})),explanation:r.providerError?'A fonte está indisponível. Não há conclusão atual.':text(r.disclaimer||r.detail?.methodology||'Consulta informativa ao serviço de validação.'),notices:[...(r.detail?.limitations||[]).map(text),'Registro não comprova titularidade, resgate, liquidez nem segurança do contrato.'],links:[{label:'Abrir consulta no módulo original',href:'/social/consulta-detalhada?'+new URLSearchParams({network:input.input.network,type:input.input.type,identifier:input.input.identifier,...(input.input.orderId?{pedido:input.input.orderId}:{})})}]};
}