import test from 'node:test';
import assert from 'node:assert/strict';
import { validateMediaMetadata, uploadSocialMedia } from '../lib/social/media.mjs';
test('upload rejeita áudio, SVG e HTML',()=>{for(const contentType of ['audio/mpeg','image/svg+xml','text/html'])assert.throws(()=>validateMediaMetadata({contentType,size:100,duration:1}))});
test('limites de tamanho e duração são explícitos',()=>{assert.throws(()=>validateMediaMetadata({contentType:'video/mp4',size:100,duration:91}));assert.throws(()=>validateMediaMetadata({contentType:'image/png',size:11*1024*1024}));assert.equal(validateMediaMetadata({contentType:'video/mp4',size:100,duration:90}).video,true)});
test('upload exige sessão e preserva erro, sem alegar sucesso',async()=>{await assert.rejects(()=>uploadSocialMedia([],{getAccessToken:async()=>null}),/Entre na sua conta/)});
test('URL remota só é usada após upload assinado bem-sucedido',async()=>{
  const file=new Blob(['video'],{type:'video/mp4'});const calls=[];
  const client={storage:{from:bucket=>({uploadToSignedUrl:async(path,token)=>{calls.push([bucket,path,token]);return {error:null}}})}};
  const media=await uploadSocialMedia([{src:'blob:preview',tipo:'video',duracao:30,_file:file}],{client,getAccessToken:async()=>'jwt',fetchImpl:async()=>({ok:true,json:async()=>({bucket:'social-media',path:'u/v.mp4',token:'signed',publicUrl:'https://storage.example/v.mp4'})})});
  assert.equal(media[0].remote,true);assert.equal(media[0]._file,undefined);assert.equal(media[0].src,'https://storage.example/v.mp4');assert.equal(calls.length,1);
});
test('erro de Storage não vira mídia remota persistida',async()=>{await assert.rejects(()=>uploadSocialMedia([{src:'blob:preview',tipo:'video',duracao:30,_file:new Blob(['video'],{type:'video/mp4'})}],{client:{storage:{from:()=>({uploadToSignedUrl:async()=>({error:{message:'offline'}})})}},getAccessToken:async()=>'jwt',fetchImpl:async()=>({ok:true,json:async()=>({bucket:'b',path:'p',token:'t',publicUrl:'https://example.test/a'})})}),/upload não foi concluído/)});
test('erro de validação final impede publicação da URL',async()=>{
  const client={storage:{from:()=>({uploadToSignedUrl:async()=>({error:null})})}};
  await assert.rejects(()=>uploadSocialMedia([{src:'blob:preview',tipo:'video',duracao:30,_file:new Blob(['video'],{type:'video/mp4'})}],{client,getAccessToken:async()=>'jwt',fetchImpl:async(_url,opts)=>opts.method==='PUT'?{ok:false,json:async()=>({error:'Tamanho real inválido'})}:{ok:true,json:async()=>({bucket:'b',path:'p',token:'t'})}}),/Tamanho real inválido/);
});
test('retentativa preserva arquivos já enviados sem novo upload',async()=>{
  let calls=0;const item={src:'https://storage.example/a.jpg',tipo:'imagem',remote:true};
  const result=await uploadSocialMedia([item],{client:{},getAccessToken:async()=>'jwt',fetchImpl:async()=>{calls++;throw new Error('não pode chamar')}});
  assert.equal(calls,0);assert.equal(result[0],item);
});
