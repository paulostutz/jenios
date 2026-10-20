import {assistantError,ASSISTANT_TOOLS,UUID} from './contracts.mjs';
import {sensitiveInput} from '../learning/tutor.mjs';
import {normalizeCryptoRequest} from '../crypto-validator.mjs';
function keys(value,allowed){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!allowed.includes(k)))throw assistantError('Há um parâmetro não permitido.');}
export function validateAssistantBody(body){
 keys(body,['action','revision','persona','aiConsent','message','tool','input','format','confirmed']);
 if(!Number.isSafeInteger(body.revision)||body.revision<0)throw assistantError('Versão da sessão inválida.');
 if(body.action==='preferences'){
  keys(body,['action','revision','persona','aiConsent']);
  if(!['genio','genia'].includes(body.persona)||typeof body.aiConsent!=='boolean')throw assistantError('Escolha o atendente e a opção de privacidade.');
  return {action:body.action,revision:body.revision,persona:body.persona,aiConsent:body.aiConsent};
 }
 if(body.action==='ask'){
  keys(body,['action','revision','message']);
  if(typeof body.message!=='string'||!body.message.trim()||body.message.length>1800)throw assistantError('Escreva uma pergunta de até 1.800 caracteres.');
  if(sensitiveInput(body.message))throw assistantError('Não envie senhas, chaves privadas, tokens de acesso ou frase-semente. Para um identificador público, use o formulário Cripto.',400,'SENSITIVE_INPUT');
  return {action:body.action,revision:body.revision,message:body.message.trim()};
 }
 if(body.action!=='tool'||!ASSISTANT_TOOLS.includes(body.tool))throw assistantError('Consulta não disponível neste atendimento.');
 keys(body,['action','revision','tool','input','format','confirmed']);
 if(body.confirmed!==true)throw assistantError('Confirme a consulta no botão correspondente.',400,'CONFIRMATION_REQUIRED');
 const input=body.input||{},format=body.format||'json';
 if(!['json','pdf'].includes(format)||format==='pdf'&&!['bankscore_full','crypto_full'].includes(body.tool))throw assistantError('Formato não permitido.');
 let target={};
 if(body.tool==='trends')keys(input,[]);
 else if(body.tool==='bankscore_search'){
  keys(input,['query']);if(typeof input.query!=='string'||input.query.trim().length<2||input.query.length>80)throw assistantError('Informe pelo menos duas letras do nome da instituição.');
  target={query:input.query.trim()};
 }else if(body.tool.startsWith('bankscore_')){
  keys(input,['codigo','periodo','orderId']);
  if(!/^(?:\d{1,12}|C\d{1,12})$/.test(String(input.codigo||'')))throw assistantError('Selecione uma instituição válida.');
  if(input.periodo!==undefined&&input.periodo!==''&&!/^\d{4}(?:0[1-9]|1[0-2])$/.test(String(input.periodo)))throw assistantError('Período inválido.');
  target={codigo:String(input.codigo),periodo:String(input.periodo||'')};
 }else{
  keys(input,['network','type','identifier','orderId']);
  if(!['ethereum','bitcoin','bsc','tron','solana','polygon','arbitrum','base','avalanche'].includes(input.network))throw assistantError('Rede não disponível no atendimento.');
  try{target=normalizeCryptoRequest({network:input.network,type:input.type,identifier:input.identifier});}catch{throw assistantError('Confira a rede, o tipo e o identificador público.');}
 }
 if(input.orderId!==undefined){if(typeof input.orderId!=='string'||!UUID.test(input.orderId))throw assistantError('Pedido inválido.');target.orderId=input.orderId;}
 return {action:'tool',revision:body.revision,tool:body.tool,input:target,format,confirmed:true};
}