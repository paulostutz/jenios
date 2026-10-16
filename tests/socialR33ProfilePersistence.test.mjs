import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createSocialFeedClient,SocialFeedError} from '../lib/social/feed-client.mjs';
import {storedMedia,publicPost} from '../lib/social/schema.mjs';
import {validatePostPayload} from '../lib/social/post-validation.mjs';
const read=p=>readFileSync(p,'utf8');
const A='11111111-1111-4111-8111-111111111111';
const mediaUrl='https://qa.invalid/storage/v1/object/public/social-media/'+A+'/stored.jpg';

test('R33 permanent posts API writes only confirmed authenticated owner ID',()=>{
 const source=read('app/api/social/posts/route.js');
 assert.match(source,/db\.auth\.getUser\(token\)/);
 assert.match(source,/\.insert\(\{ author_id: ctx\.userId, body: body\.trim\(\), \.\.\.storedMedia\(media\) \}\)/);
 assert.match(source,/\.select\(POST_FIELDS\)\.single\(\)/);
 assert.match(source,/POST_NOT_SAVED/);
 assert.match(source,/201\)/);
});

test('R33 profile GET queries stored author posts, excludes archive, paginates independently of feed',()=>{
 const route=read('app/api/social/profiles/route.js');
 assert.match(route,/\.eq\('author_id', id\)/);
 assert.match(route,/\.is\('archived_at',null\)/);
 assert.match(route,/\.order\('created_at', \{ ascending: false \}\)/);
 assert.match(route,/\.range\(offset,offset\+19\)/);
 assert.match(route,/postsCount:posts\.count\|\|0/);
 const social=read('app/social/page.js');
 assert.match(social,/await feed\.visit\(usuario,offset\)/);
 assert.match(social,/feed\.archivedPosts:profilePosts/);
 assert.match(social,/p\.authorId === perfilVisitado\.id/);
});

test('R33 3-column square gallery CSS is imported and overrides legacy mobile rule',()=>{
 const layout=read('app/layout.js'),css=read('app/social/profile-grid.css'),social=read('app/social/page.js');
 assert.match(layout,/import '\.\/social\/profile-grid\.css'/);
 assert.match(layout,/grid-template-columns: 1fr !important/);
 assert.match(social,/repeat\(auto-fill, minmax\(160px, 1fr\)\)/);
 assert.match(css,/grid-template-columns: repeat\(3, minmax\(0, 1fr\)\) !important/);
 assert.match(css,/aspect-ratio: 1/);
 assert.match(css,/object-fit: cover/);
});

test('R33 single image stays a permanent HTTPS reference through SQL payload and client rendering',()=>{
 assert.equal(validatePostPayload({body:'Imagem publicada',media:[{url:mediaUrl,type:'image'}]}),null);
 const row={id:'demo',author_id:A,body:'Imagem publicada',...storedMedia([{url:mediaUrl,type:'image'}]),created_at:'2026-10-16T15:00:00Z',archived_at:null};
 const p=publicPost(row);assert.equal(p.media[0].url,mediaUrl);assert.equal(p.media[0].type,'image');
});

test('R33 mixed carousel and video persist as reconstructable media entries',()=>{
 const media=[{url:mediaUrl,type:'image'},{url:mediaUrl.replace('.jpg','.mp4'),type:'video'}];
 const saved=storedMedia(media);
 assert.equal(saved.media_type,'video');assert.equal(typeof saved.media_path,'string');
 const got=publicPost({body:'Vídeo e foto',...saved});assert.deepEqual(got.media,media);
});

test('R33 blob previews and data URIs cannot be stored as post media',()=>{
 for(const url of ['blob:http://localhost/preview','data:image/png;base64,aaaa','javascript:alert(1)','http://qa.invalid/asset.jpg'])
  assert.equal(validatePostPayload({body:'teste',media:[{url,type:'image'}]}),'INVALID_MEDIA');
});

test('R33 official client profile call is authenticated and has cache=no-store',async()=>{
 let called=null;
 const client=createSocialFeedClient({getAccessToken:async()=> 'fixture-token',fetchImpl:async(url,options)=>{called={url,options};return {ok:true,status:200,json:async()=>({profile:{id:A},posts:[],postsCount:0,nextOffset:null})};}});
 const data=await client.profile({handle:'@qa_a'},20);
 assert.equal(data.postsCount,0);assert.match(called.url,/profiles\?handle=qa_a&offset=20$/);
 assert.equal(called.options.cache,'no-store');assert.equal(called.options.headers.Authorization,'Bearer fixture-token');
});

test('R33 no session never calls server from social client',async()=>{
 let calls=0;
 const client=createSocialFeedClient({getAccessToken:async()=> null,fetchImpl:async()=>{calls++;return {ok:true,status:200,json:async()=>({})};}});
 await assert.rejects(()=>client.profile({handle:'qa_a'}),e=>e instanceof SocialFeedError&&e.status===401);
 assert.equal(calls,0);
});

test('R33 profile archived posts are private and not inserted into public profile grid',()=>{
 const route=read('app/api/social/profiles/route.js'),page=read('app/social/page.js');
 assert.match(route,/\.is\('archived_at',null\)/);
 assert.match(page,/perfilVisitado\.id === meuPerfil\.id/);
 assert.match(page,/p\.archivedAt/);
 assert.match(read('supabase/migrations/20261015214615_social_post_archive_r22.sql'),/as restrictive for select to authenticated/);
});

test('R33 after confirmed POST local UI adds own post and profile refresh replaces with persisted results',()=>{
 const source=read('app/social/page.js');
 assert.match(source,/const created=await feed\.publish/);
 assert.match(source,/setProfilePosts\(old=>\[ownPost/);
 assert.match(source,/setProfilePosts\(old=>offset\?\[\.\.\.old/);
 assert.match(source,/Publicado no feed e no seu perfil\./);
});
