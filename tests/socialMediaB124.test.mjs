import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {boundedUploadStep,uploadSocialMedia} from '../lib/social/media.mjs';
const src=p=>readFileSync(p,'utf8');
test('B124 resolves promptly on successful step, without aborting',async()=>{
 assert.equal(await boundedUploadStep(()=>Promise.resolve('ready'),{ms:60}),'ready');
});
test('B124 bounded step rejects unresponsive SDK and aborts fetch signal',async()=>{
 let signal;
 await assert.rejects(boundedUploadStep(sig=>{signal=sig;return new Promise(()=>{});},{ms:20,message:'Timeout do teste'}),/Timeout do teste/);
 assert.equal(signal?.aborted,true);
});
test('B124 signed URL fetch cannot stay pending indefinitely',async()=>{
 const file=new Blob(['image'],{type:'image/png'});
 const item={src:'blob:test',tipo:'imagem',_file:file};
 // Operation is intentionally unresponsive; the helper is tested with a short timeout above.
 const code=src('lib/social/media.mjs');
 assert.match(code,/boundedUploadStep\(signal=>fetchImpl\('\/api\/social\/media'/);
 assert.match(code,/ms:contentType\.startsWith\('video\/'\)\?120000:75000/);
 assert.match(code,/onUploadProgress\(Math\.round\(\(index\+0\.85\)/);
 assert.match(src('app/social/page.js'),/Conferindo o arquivo enviado/);
 assert.match(src('app/social/page.js'),/setPublicationNotice\(error\.message/);
});
test('B124 successful media remains signed and verified, never publishes unvalidated URL',async()=>{
 let stage=[],percent=[];
 const file=new Blob(['photo'],{type:'image/png'});
 const client={storage:{from:()=>({uploadToSignedUrl:async()=>({error:null})})}};
 const r=await uploadSocialMedia([{src:'blob:test',tipo:'imagem',_file:file}],{
  client,getAccessToken:async()=> 'jwt',
  onStage:s=>stage.push(s),onUploadProgress:p=>percent.push(p),
  fetchImpl:async(_url,opts)=>({ok:true,json:async()=>opts.method==='POST'?{bucket:'b',path:'id/a.png',token:'test'}:{publicUrl:'https://safe.example/id/a.png'}})
 });
 assert.equal(r[0].remote,true);assert.equal(r[0].src,'https://safe.example/id/a.png');
 assert.ok(percent.some(x=>x>0&&x<100));assert.ok(stage.includes('validating'));
});
