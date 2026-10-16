import {mkdtemp,writeFile,readFile,rm,stat} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawn} from 'node:child_process';
import ffmpeg from 'ffmpeg-static';
export function videoVariantPath(path){
 if(!/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(mp4|mov|webm)$/i.test(path))throw Object.assign(Error('Arquivo de vídeo inválido.'),{status:400});
 return path.replace(/\.(mp4|mov|webm)$/i,'-stream-v1.mp4');
}
export function videoArgs(input,output){return ['-hide_banner','-loglevel','error','-nostdin','-threads','2','-protocol_whitelist','file,pipe','-format_whitelist','mov,matroska,webm','-i',input,'-map','0:v:0','-map','0:a:0?','-map_metadata','-1','-t','90','-vf',"fps=30,scale=w='min(1280,iw)':h='min(720,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2",'-c:v','libx264','-preset','veryfast','-crf','25','-maxrate','2500k','-bufsize','5000k','-pix_fmt','yuv420p','-threads','2','-c:a','aac','-b:a','96k','-movflags','+faststart','-y',output];}
export async function transcodeVideo(input,output,{binary=ffmpeg,timeout=75000}={}){
 await new Promise((resolve,reject)=>{const child=spawn(binary,videoArgs(input,output),{stdio:['ignore','ignore','pipe']});let tail='';child.stderr.on('data',d=>{tail=(tail+d.toString()).slice(-1500);});const timer=setTimeout(()=>child.kill('SIGKILL'),timeout);child.on('error',()=>{clearTimeout(timer);reject(Error('Não foi possível preparar o vídeo para reprodução.'));});child.on('close',code=>{clearTimeout(timer);code===0?resolve():reject(Error('Não foi possível preparar o vídeo. Tente novamente.'));});});
 const info=await stat(output);if(info.size<100||info.size>50*1024*1024)throw Error('Vídeo processado inválido.');
}
const inFlight=new Map();
export async function optimizeStoredVideo(db,bucket,path){
 const variant=videoVariantPath(path),user=path.split('/')[0],filename=variant.split('/')[1];
 const {data:files,error:lookupError}=await db.storage.from(bucket).list(user,{search:filename,limit:5});if(lookupError)throw Error('Não foi possível consultar a mídia.');
 const publicUrl=db.storage.from(bucket).getPublicUrl(variant).data.publicUrl;
 if(files?.some(x=>x.name===filename))return publicUrl;
 if(inFlight.has(path))return inFlight.get(path);
 const task=(async()=>{const dir=await mkdtemp(join(tmpdir(),'jenios-video-'));try{
  const {data:source,error}=await db.storage.from(bucket).download(path);if(error||!source||source.size>50*1024*1024)throw Error('Não foi possível carregar o vídeo para processamento.');
  const input=join(dir,'input'),output=join(dir,'output.mp4');await writeFile(input,Buffer.from(await source.arrayBuffer()));
  await transcodeVideo(input,output);
  const result=await db.storage.from(bucket).upload(variant,await readFile(output),{contentType:'video/mp4',cacheControl:'31536000',upsert:false});
  if(result.error&&!['409','Duplicate'].includes(String(result.error.statusCode||result.error.error)))throw Error('Não foi possível salvar a versão de reprodução.');
  return publicUrl;
 }finally{await rm(dir,{recursive:true,force:true});}})();inFlight.set(path,task);try{return await task;}finally{inFlight.delete(path);}
}
