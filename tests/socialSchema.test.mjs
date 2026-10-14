import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { storedMedia, publicPost } from '../lib/social/schema.mjs';
test('mídia única usa campos existentes',()=>{assert.deepEqual(storedMedia([{url:'https://example.test/a.jpg',type:'image'}]),{media_type:'image',media_path:'https://example.test/a.jpg'})});
test('carrossel misto faz ida e volta sem novas tabelas',()=>{
  const media=[{url:'https://example.test/a.jpg',type:'image'},{url:'https://example.test/a.mp4',type:'video'}];
  assert.deepEqual(publicPost({body:'',...storedMedia(media)}).media,media);
});
test('URL insegura legada não é enviada ao navegador',()=>{assert.deepEqual(publicPost({body:'texto',media_path:'javascript:alert(1)'}).media,[])});
test('APIs usam somente tabelas reais, sem deleted_at inexistente',()=>{
  for(const path of ['posts','comments','likes']){const source=readFileSync(new URL('../app/api/social/'+path+'/route.js',import.meta.url),'utf8');assert.doesNotMatch(source,/jenios_social_|deleted_at/)}
});
