export const MEDIA_TYPES=Object.freeze({'image/jpeg':'jpg','image/png':'png','image/webp':'webp','video/mp4':'mp4','video/webm':'webm','video/quicktime':'mov'});
export function validateMediaMetadata(input) {
  const extension=MEDIA_TYPES[input?.contentType];
  if(!extension)throw new Error('Formato não permitido. Use JPG, PNG, WebP, MP4, WebM ou MOV.');
  const size=Number(input.size),video=input.contentType.startsWith('video/');
  if(!Number.isSafeInteger(size)||size<1||size>(video?50:10)*1024*1024)throw new Error(video?'Vídeo acima de 50 MB.':'Imagem acima de 10 MB.');
  if(video&&(!Number.isFinite(input.duration)||input.duration<=0||input.duration>90))throw new Error('O vídeo deve ter até 90 segundos.');
  return {extension,contentType:input.contentType,size,video};
}
export async function uploadSocialMedia(items,{client,getAccessToken,fetchImpl=fetch,onProgress=()=>{},onUploadProgress=()=>{},onStage=()=>{}}) {
  if(items.length>10)throw new Error('Use até dez fotos e vídeos por publicação.');
  if(!await getAccessToken())throw new Error('Entre na sua conta antes de enviar mídia.');
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
    const token=await getAccessToken();if(!token)throw new Error('Sua sessão mudou.');
    let data={path:item._uploadedPath};
    if(!data.path){
    onStage('uploading');
    const response=await fetchImpl('/api/social/media',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+token},body:JSON.stringify({contentType,size,duration:item.duracao})});
    data=await response.json();if(!response.ok)throw new Error(data.error||'Falha ao preparar upload.');
    onUploadProgress(Math.round(index/items.length*100));
    if(file.size>6*1024*1024&&data.resumableEndpoint){
      const {uploadResumable}=await import('./resumable-upload.mjs');
      await uploadResumable(file,{endpoint:data.resumableEndpoint,bucket:data.bucket,path:data.path,token:data.token,getAccessToken,onProgress:fraction=>onUploadProgress(Math.min(99,Math.round((index+fraction)/items.length*100)))});
    }else{
      const {error}=await client.storage.from(data.bucket).uploadToSignedUrl(data.path,data.token,file,{contentType,upsert:false,cacheControl:'31536000'});
      if(error)throw new Error('O upload não foi concluído. Seu texto foi preservado.');
    }
    onProgress([...uploaded,{...item,_uploadedPath:data.path},...items.slice(index+1)]);
    }
    onStage(item.tipo==='video'?'processing':'validating');
    const currentToken=await getAccessToken();if(!currentToken)throw new Error('Sua sessão mudou.');
    const checked=await fetchImpl('/api/social/media',{method:'PUT',headers:{'content-type':'application/json',authorization:'Bearer '+currentToken},body:JSON.stringify({path:data.path,duration:item.duracao})});
    const verified=await checked.json();if(!checked.ok)throw new Error(verified.error||'O arquivo enviado não passou pela validação.');
    if(!await getAccessToken())throw new Error('Sua sessão mudou.');
    const clean={...item,src:verified.publicUrl,remote:true};delete clean._file;delete clean._uploadedPath;uploaded.push(clean);
    onProgress([...uploaded,...items.slice(index+1)]);
  }
  onStage('saving');
  onUploadProgress(100);
  return uploaded;
}
