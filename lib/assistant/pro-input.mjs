import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
import {PRO_TASKS,PRO_PRICING_VERSION} from './pro-pricing.mjs';
import {proReservationMaximum} from './pro-wallet-contract.mjs';
import {sensitiveInput} from '../learning/tutor.mjs';
import {readBoundedJson} from '../platform/bounded-response.mjs';
export const PRO_HEADERS=Object.freeze({'Cache-Control':'private, no-store','Vary':'Authorization','X-Content-Type-Options':'nosniff'});
export const PRO_SYMBOLS=Object.freeze(['BTC-USD','ETH-USD','SOL-USD']);
export const PRO_TIMEFRAMES=Object.freeze(['1m','5m','1h']);
// A 3 MB image encodes to 4 MB of base64, below the hosting 4.5 MB body cap.
export const PRO_INPUT_LIMIT=4_100_000;
export const proError=(message,status=400,code='PRO_INVALID')=>Object.assign(Error(message),{status,code});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const validRequestKey=value=>typeof value==='string'&&uuid.test(value);
export async function readProBody(request){
 if(!/^application\/json(?:;|$)/i.test(request.headers.get('content-type')||''))throw proError('Use JSON nesta requisição.',415);
 try{return await readBoundedJson(request,PRO_INPUT_LIMIT);}catch{throw proError('Envio inválido ou acima do limite de 3 MB para a imagem.',413);}
}
function imageDimensions(bytes,mime){
 if(mime==='image/png'){
  if(bytes.length<33||bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'||bytes.readUInt32BE(8)!==13||bytes.subarray(12,16).toString()!=='IHDR')return null;
  return {width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)};
 }
 if(mime==='image/jpeg'){
  if(bytes.length<12||bytes.readUInt16BE(0)!==0xffd8||bytes.readUInt16BE(bytes.length-2)!==0xffd9)return null;
  let p=2;
  while(p+4<bytes.length){
   if(bytes[p++]!==0xff)return null;
   while(bytes[p]===0xff)p++;
   const marker=bytes[p++];
   if(marker===0xda||marker===0xd9)return null;
   if(marker===0x01||(marker>=0xd0&&marker<=0xd7))continue;
   if(p+2>bytes.length)return null;
   const size=bytes.readUInt16BE(p);
   if(size<2||p+size>bytes.length)return null;
   if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)){
    if(size<8)return null;return {width:bytes.readUInt16BE(p+5),height:bytes.readUInt16BE(p+3)};
   }
   p+=size;
  }
  return null;
 }
 if(mime==='image/webp'){
  if(bytes.length<30||bytes.subarray(0,4).toString()!=='RIFF'||bytes.subarray(8,12).toString()!=='WEBP'||bytes.readUInt32LE(4)+8!==bytes.length)return null;
  const kind=bytes.subarray(12,16).toString();
  if(kind==='VP8X'){
   if(bytes[20]&2)return null; // animated uploads are outside this single-image flow
   return {width:1+bytes.readUIntLE(24,3),height:1+bytes.readUIntLE(27,3)};
  }
  if(kind==='VP8 '&&bytes.subarray(23,26).toString('hex')==='9d012a')return {width:bytes.readUInt16LE(26)&0x3fff,height:bytes.readUInt16LE(28)&0x3fff};
  if(kind==='VP8L'&&bytes[20]===0x2f)return {width:1+((bytes[22]&0x3f)<<8|bytes[21]),height:1+((bytes[24]&0xf)<<10|bytes[23]<<2|bytes[22]>>6)};
 }
 return null;
}
export function validateProImage(image){
 if(!image||typeof image!=='object'||Array.isArray(image)||Object.keys(image).some(k=>!['mime','base64'].includes(k))||!['image/png','image/jpeg','image/webp'].includes(image.mime)||typeof image.base64!=='string'||image.base64.length>4_000_000||!image.base64.length||image.base64.length%4!==0||!/^[A-Za-z0-9+/]+={0,2}$/.test(image.base64))throw proError('Use uma imagem PNG, JPEG ou WebP de até 3 MB.');
 const bytes=Buffer.from(image.base64,'base64');
 if(bytes.length>3_000_000||bytes.toString('base64')!==image.base64)throw proError('Arquivo de imagem inválido.');
 const dimensions=imageDimensions(bytes,image.mime);
 if(!dimensions||dimensions.width<64||dimensions.height<64||dimensions.width>4096||dimensions.height>4096)throw proError('A imagem deve ter entre 64 e 4.096 pixels em cada dimensão.');
 return {mime:image.mime,base64:image.base64,byteLength:bytes.length,...dimensions,sha256:createHash('sha256').update(bytes).digest('hex')};
}
export function normalizeProInput(body,{chat=false}={}){
 if(!body||typeof body!=='object'||Array.isArray(body))throw proError('Consulta inválida.');
 const allowed=['persona','task','prompt','symbol','timeframe','source','image','conversationId','conversationRevision','lessonId',...(chat?['requestKey','quoteId','consent','maxRetailNanoUsd']:[])];
 if(Object.keys(body).some(k=>!allowed.includes(k)))throw proError('Parâmetro não permitido.');
 const task=Object.hasOwn(PRO_TASKS,body.task)?PRO_TASKS[body.task]:null;
 if(!task||!['genio','genia'].includes(body.persona)||!['included','prepaid'].includes(body.source))throw proError('Escolha o assistente, o recurso e a origem do saldo.');
 if(typeof body.prompt!=='string'||!body.prompt.trim()||body.prompt.length>2500)throw proError('Escreva sua pergunta em até 2.500 caracteres.');
 if(sensitiveInput(body.prompt))throw proError('Remova senhas, chaves e outros dados de acesso da sua pergunta.');
 if(body.symbol!=null&&typeof body.symbol!=='string'||body.timeframe!=null&&typeof body.timeframe!=='string')throw proError('Ativo ou período inválido.');
 const symbol=body.symbol||'',timeframe=body.timeframe||'';
 if(task.requiresCurrentData&&(!PRO_SYMBOLS.includes(symbol)||!PRO_TIMEFRAMES.includes(timeframe)))throw proError('Escolha um dos ativos e períodos com fonte disponível.');
 if(symbol.length>40||timeframe.length>20)throw proError('Ativo ou período inválido.');
 if(body.image&&!task.acceptsImage)throw proError('Este recurso não recebe imagens.');
 const image=body.image?validateProImage(body.image):null;
 if(task.requiresImage&&!image)throw proError('Anexe a imagem do gráfico para continuar.');
 const hasConversation=body.conversationId!=null||body.conversationRevision!=null;
 if(hasConversation&&(!validRequestKey(body.conversationId)||!Number.isSafeInteger(body.conversationRevision)||body.conversationRevision<0||body.conversationRevision>=Number.MAX_SAFE_INTEGER-2))throw proError('Atualize o histórico desta conversa.',409,'CONVERSATION_INVALID');
 if(body.lessonId!=null&&(typeof body.lessonId!=='string'||!/^[a-z0-9-]{1,100}$/.test(body.lessonId)||body.task!=='university_tutor'))throw proError('A aula deve ser selecionada no tutor da Universidade.');
 if(chat&&(!validRequestKey(body.requestKey)||body.consent!==true||!Number.isSafeInteger(body.maxRetailNanoUsd)||body.maxRetailNanoUsd<1||typeof body.quoteId!=='string'||body.quoteId.length>4000))throw proError('Confirme o limite de consumo desta consulta.');
 const input={persona:body.persona,task:body.task,prompt:body.prompt.trim(),source:body.source,symbol,timeframe,image,model:task.model,requiresCurrentData:task.requiresCurrentData};
 if(hasConversation){input.conversationId=body.conversationId;input.conversationRevision=body.conversationRevision;}
 if(body.lessonId)input.lessonId=body.lessonId;
 input.fingerprint=createHash('sha256').update(JSON.stringify({...input,image:image?{mime:image.mime,sha256:image.sha256}:null})).digest('hex');
 return input;
}
export function quoteSecretReady(env){return typeof env?.JENIOS_PRO_QUOTE_SECRET==='string'&&Buffer.byteLength(env.JENIOS_PRO_QUOTE_SECRET)>=32;}
const quoteSignature=(encoded,secret)=>createHmac('sha256',secret).update(encoded).digest('base64url');
export function createProQuote(input,userId,config,env,now=Date.now()){
 if(!quoteSecretReady(env))throw proError('O Pro ainda aguarda configuração.',503,'PRO_DISABLED');
 const maxInputTokens=input.image||input.requiresCurrentData?32768:16384,maxOutputTokens=input.model==='gpt-6-luna'?2000:2400;
 const bound=proReservationMaximum({model:input.model,maxInputTokens,maxOutputTokens});
 if(bound.providerNanoUsd>config.maxRequestProviderNanoUsd)throw proError('Esta consulta excede o limite autorizado por resposta.',422,'REQUEST_LIMIT');
 const payload={version:PRO_PRICING_VERSION,userId,fingerprint:input.fingerprint,source:input.source,model:input.model,maxInputTokens,maxOutputTokens,maxProviderNanoUsd:bound.providerNanoUsd,maxRetailNanoUsd:bound.retailNanoUsd,expiresAt:now+5*60_000,
  ...(input.contextDigest?{contextDigest:input.contextDigest}:{})};
 const encoded=Buffer.from(JSON.stringify(payload)).toString('base64url');
 return {id:encoded+'.'+quoteSignature(encoded,env.JENIOS_PRO_QUOTE_SECRET),maxRetailNanoUsd:payload.maxRetailNanoUsd,expiresAt:new Date(payload.expiresAt).toISOString(),source:input.source,model:input.model,pricingVersion:PRO_PRICING_VERSION};
}
export function verifyProQuote(id,input,userId,maxRetailNanoUsd,env,now=Date.now()){
 if(!quoteSecretReady(env)||typeof id!=='string'||id.length>4000)throw proError('Prepare um novo orçamento.',409,'QUOTE_INVALID');
 const parts=id.split('.');
 if(parts.length!==2||!/^[A-Za-z0-9_-]+$/.test(parts[0])||!/^[A-Za-z0-9_-]{43}$/.test(parts[1]))throw proError('Prepare um novo orçamento.',409,'QUOTE_INVALID');
 const expected=Buffer.from(quoteSignature(parts[0],env.JENIOS_PRO_QUOTE_SECRET)),actual=Buffer.from(parts[1]);
 if(expected.length!==actual.length||!timingSafeEqual(expected,actual))throw proError('Orçamento inválido. Prepare novamente.',409,'QUOTE_INVALID');
 let q;try{q=JSON.parse(Buffer.from(parts[0],'base64url').toString());}catch{throw proError('Orçamento inválido.',409,'QUOTE_INVALID');}
 if(q.userId!==userId||q.fingerprint!==input.fingerprint||q.source!==input.source||q.model!==input.model||q.version!==PRO_PRICING_VERSION||q.maxRetailNanoUsd!==maxRetailNanoUsd||!Number.isSafeInteger(q.expiresAt)||q.expiresAt<=now||q.expiresAt>now+5*60_000)throw proError('A consulta ou o orçamento mudou. Prepare novamente.',409,'QUOTE_EXPIRED');
 return q;
}
