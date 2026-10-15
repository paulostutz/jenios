export async function uploadResumable(file,{endpoint,bucket,path,token,getAccessToken,onProgress=()=>{}}){
 const {Upload}=await import('tus-js-client');
 return new Promise((resolve,reject)=>{
  const upload=new Upload(file,{
   endpoint,headers:{'x-signature':token},retryDelays:[0,1000,3000,5000],chunkSize:6*1024*1024,
   uploadDataDuringCreation:true,storeFingerprintForResuming:false,removeFingerprintOnSuccess:true,
   metadata:{bucketName:bucket,objectName:path,contentType:file.type,cacheControl:'31536000'},
   onBeforeRequest:async()=>{if(!await getAccessToken())throw Error('Sua sessão mudou.');},
   onShouldRetry:error=>{const status=error.originalResponse?.getStatus?.();return !status||status===409||status===429||status>=500;},
   onProgress:(sent,total)=>onProgress(total?sent/total:0),
   onSuccess:resolve,onError:()=>reject(Error('O envio foi interrompido. Tente novamente; seu texto foi preservado.'))
  });
  upload.start();
 });
}
