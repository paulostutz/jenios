/**
 * Enforce request limits by bytes before decoding JSON. Never buffer arbitrary
 * requests from anonymous or malformed sources.
 */
export async function readPlatformJson(request,maxBytes=2048) {
  const contentType=request?.headers?.get?.('content-type')||'';
  if (!/^application\/json(?:\s*;|$)/i.test(contentType)) {
    throw Object.assign(new Error('Envie JSON válido.'),{status:415});
  }
  const sizeHeader=request.headers.get('content-length');
  if(sizeHeader!==null){
    const n=Number(sizeHeader);
    if(!Number.isSafeInteger(n)||n<0)throw Object.assign(new Error('Tamanho de solicitação inválido.'),{status:400});
    if(n>maxBytes)throw Object.assign(new Error('Dados do diagnóstico excedem o limite.'),{status:413});
  }
  if (!request.body?.getReader)throw Object.assign(new Error('Dados do diagnóstico obrigatórios.'),{status:400});
  const reader=request.body.getReader();
  let length=0,text='';
  const decoder=new TextDecoder('utf-8',{fatal:true});
  try {
    for (;;) {
      const {done,value}=await reader.read();
      if(done)break;
      length+=value?.byteLength||0;
      if(length>maxBytes){
        await reader.cancel().catch(()=>{});
        throw Object.assign(new Error('Dados do diagnóstico excedem o limite.'),{status:413});
      }
      text+=decoder.decode(value,{stream:true});
    }
    text+=decoder.decode();
    return JSON.parse(text);
  } catch(error) {
    if(error?.status) throw error;
    throw Object.assign(new Error('JSON inválido.'),{status:400});
  } finally {
    try {reader.releaseLock();}catch{}
  }
}
