/** Admin input boundary. The approved email formatter remains unchanged. */
export const NEWSLETTER_SUBJECT='JENIOS | Radar de Mercado';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const bad=message=>{throw Object.assign(new Error(message),{status:400});};
const plain=(value,min,max,label)=>{
 if(typeof value!=='string')bad(label+' inválido.');
 const text=value.trim();
 if(text.length<min||text.length>max||/[\u0000-\u001f\u007f]/.test(text))bad(label+' inválido.');
 return text;
};
function fields(value,allowed){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!allowed.includes(k)))
  bad('Dados da edição inválidos.');
}
export function normalizeNewsletterAction(input,{now=Date.now()}={}){
 fields(input,['action','id','revision','editionKey','items','scheduledAt']);
 const action=input.action;
 if(!['create','save','approve','retire'].includes(action))bad('Operação inválida.');
 const id=input.id??null,revision=input.revision??null;
 if(action==='create'){
  if(id!==null||revision!==null)bad('Uma nova edição não pode substituir outra.');
 }else if(!UUID.test(String(id))||!Number.isSafeInteger(revision)||revision<0){
  bad('Identificação ou versão da edição inválida.');
 }
 let payload={};
 if(action==='create'||action==='save'){
  const editionKey=plain(input.editionKey,3,120,'Identificação');
  if(!/^[a-z0-9][a-z0-9-]*$/.test(editionKey))bad('Identificação inválida.');
  if(!Array.isArray(input.items)||input.items.length<1||input.items.length>5)
   bad('Inclua de um a cinco destaques com fontes.');
  const items=input.items.map(item=>{
   fields(item,['title','summary','sourceName','sourceUrl']);
   const title=plain(item.title,3,180,'Título'),summary=plain(item.summary,10,1400,'Resumo');
   const sourceName=plain(item.sourceName,2,120,'Nome da fonte');
   const sourceUrl=plain(item.sourceUrl,8,2000,'Link da fonte');
   let url;try{url=new URL(sourceUrl);}catch{bad('Use um link HTTPS válido para a fonte.');}
   if(url.protocol!=='https:'||url.username||url.password||!url.hostname.includes('.')||
      /^(localhost|127\.|0\.|\[|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(url.hostname))
    bad('Use um link HTTPS público para a fonte.');
   return {title,summary,sourceName,sourceUrl:url.toString()};
  });
  const scheduled=Date.parse(input.scheduledAt||'');
  if(!Number.isFinite(scheduled)||scheduled<now-86400000||scheduled>now+366*86400000)
   bad('Informe uma data de envio válida, até um ano à frente.');
  payload={edition_key:editionKey,subject:NEWSLETTER_SUBJECT,items,scheduled_at:new Date(scheduled).toISOString()};
 }else if(input.editionKey!==undefined||input.items!==undefined||input.scheduledAt!==undefined){
  bad('Salve o conteúdo antes de alterar o estado da edição.');
 }
 return {action,id,revision,payload};
}

export async function readNewsletterBody(request){
 if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type')||''))bad('Envie os dados em JSON.');
 const announced=Number(request.headers.get('content-length')||0);
 if(announced>24000)throw Object.assign(new Error('A edição excede o tamanho permitido.'),{status:413});
 const reader=request.body?.getReader();
 if(!reader)bad('Dados da edição ausentes.');
 const chunks=[];let length=0;
 try{
  while(true){const {done,value}=await reader.read();if(done)break;
   length+=value.byteLength;if(length>24000){await reader.cancel();throw Object.assign(new Error('A edição excede o tamanho permitido.'),{status:413});}
   chunks.push(value);
  }
 }finally{reader.releaseLock();}
 const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
 try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{bad('Dados JSON inválidos.');}
}
