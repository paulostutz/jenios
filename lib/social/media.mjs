export const MEDIA_TYPES=Object.freeze({'image/jpeg':'jpg','image/png':'png','image/webp':'webp','video/mp4':'mp4','video/webm':'webm','video/quicktime':'mov'});
export function validateMediaMetadata(input) {
  const extension=MEDIA_TYPES[input?.contentType];
  if(!extension)throw new Error('Formato não permitido. Use JPG, PNG, WebP, MP4, WebM ou MOV.');
  const size=Number(input.size),video=input.contentType.startsWith('video/');
  if(!Number.isSafeInteger(size)||size<1||size>(video?50:10)*1024*1024)throw new Error(video?'Vídeo acima de 50 MB.':'Imagem acima de 10 MB.');
  if(video&&(!Number.isFinite(input.duration)||input.duration<=0||input.duration>90))throw new Error('O vídeo deve ter até 90 segundos.');
  return {extension,contentType:input.contentType,size,video};
}
/** B124: bound every network step, even when an SDK promise never settles.
 * Timeout does not imply remote upload cancellation; never mark failed bytes as published. */
export async function boundedUploadStep(work,{ms=25000,message='O envio demorou além do limite seguro. Seu rascunho foi preservado.'}={}){
 const abort=new AbortController();let timer;
 try{return await Promise.race([
  Promise.resolve().then(()=>work(abort.signal)),
  new Promise((_,reject)=>{timer=setTimeout(()=>{abort.abort();reject(Error(message));},ms);})
 ]);}finally{clearTimeout(timer);}
}
export async function uploadSocialMedia(items,{client,getAccessToken,fetchImpl=fetch,onProgress=()=>{},onUploadProgress=()=>{},onStage=()=>{}}) {
  if(items.length>10)throw new Error('Use até dez fotos e vídeos por publicação.');
  if(!await boundedUploadStep(()=>getAccessToken(),{ms:12000,message:'Não foi possível validar sua sessão a tempo. Tente novamente.'}))throw new Error('Entre na sua conta antes de enviar mídia.');
  const uploaded=[];
  for(const [index,item] of items.entries()){
    if(item.remote){uploaded.push(item);continue;}
    let file=item._file;
    if(!file){
      if(!/^data:image\/(jpeg|png|webp);base64,/.test(item.src||''))throw new Error('Não foi possível preparar a imagem.');
      file=await (await fetchImpl(item.src)).blob();
    }
    const contentType=file.type;const size=file.size;
    validateMediaMetadata({contentType,size,duration:item.duracao});
    const token=await boundedUploadStep(()=>getAccessToken(),{ms:12000,message:'A verificação da sessão demorou demais.'});if(!token)throw new Error('Sua sessão mudou.');
    let data={path:item._uploadedPath};
    if(!data.path){
    onStage('uploading');
    const response=await boundedUploadStep(signal=>fetchImpl('/api/social/media',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+token},body:JSON.stringify({contentType,size,duration:item.duracao}),signal}),{ms:25000,message:'A preparação da mídia não respondeu em 25 segundos. Seu rascunho foi preservado.'});
    data=await response.json();if(!response.ok)throw new Error(data.error||'Falha ao preparar upload.');
    onUploadProgress(Math.round((index+0.08)/items.length*100));
    if(file.size>6*1024*1024&&data.resumableEndpoint){
      const {uploadResumable}=await import('./resumable-upload.mjs');
      await boundedUploadStep(()=>uploadResumable(file,{endpoint:data.resumableEndpoint,bucket:data.bucket,path:data.path,token:data.token,getAccessToken,onProgress:fraction=>onUploadProgress(Math.min(99,Math.round((index+fraction)/items.length*100)))}),{ms:180000,message:'O envio do vídeo excedeu três minutos. Sua publicação continua em rascunho.'});
    }else{
      const {error}=await boundedUploadStep(()=>client.storage.from(data.bucket).uploadToSignedUrl(data.path,data.token,file,{contentType,upsert:false,cacheControl:'31536000'}),{ms:contentType.startsWith('video/')?120000:75000,message:'O armazenamento demorou para responder. A foto e o texto foram mantidos no formulário para tentar novamente.'});
      if(error)throw new Error('O upload não foi concluído. Seu texto foi preservado.');
    }
    onUploadProgress(Math.round((index+0.85)/items.length*100));
    onProgress([...uploaded,{...item,_uploadedPath:data.path},...items.slice(index+1)]);
    }
    onStage(item.tipo==='video'?'processing':'validating');
    const currentToken=await boundedUploadStep(()=>getAccessToken(),{ms:12000,message:'Não foi possível confirmar sua sessão após o envio.'});if(!currentToken)throw new Error('Sua sessão mudou.');
    const checked=await boundedUploadStep(signal=>fetchImpl('/api/social/media',{method:'PUT',headers:{'content-type':'application/json',authorization:'Bearer '+currentToken},body:JSON.stringify({path:data.path,duration:item.duracao}),signal}),{ms:item.tipo==='video'?120000:25000,message:'A confirmação do arquivo demorou demais. O rascunho foi preservado para tentar novamente.'});
    const verified=await checked.json();if(!checked.ok)throw new Error(verified.error||'O arquivo enviado não passou pela validação.');
    if(!await boundedUploadStep(()=>getAccessToken(),{ms:12000,message:'A sessão demorou a responder após o envio.'}))throw new Error('Sua sessão mudou.');
    const clean={...item,src:verified.publicUrl,remote:true};delete clean._file;delete clean._uploadedPath;uploaded.push(clean);
    onProgress([...uploaded,...items.slice(index+1)]);
  }
  onStage('saving');
  onUploadProgress(100);
  return uploaded;
}
