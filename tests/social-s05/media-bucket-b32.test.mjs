import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MEDIA_TYPES,validateMediaMetadata } from '../../lib/social/media.mjs';

const file=path=>readFileSync(path,'utf8');
const sql=file('supabase/staging/20261018_s05_b32_media_bucket_isolated.sql');
const route=file('app/api/social/media/route.js');
const hook=file('lib/social/media.mjs');

test('B32 bucket creation is limited to the S04 isolated staging marker',()=>{
  assert.match(sql,/jenios_s04_staging_guard_20261017/);
  assert.match(sql,/S05_MEDIA_NOT_ISOLATED/);
  assert.match(sql,/S05_MEDIA_BUCKET_ALREADY_EXISTS_REVIEW_MANUALLY/);
  assert.doesNotMatch(sql,/\bDROP\s+(?:TABLE|POLICY|BUCKET)\b|\bTRUNCATE\b/i);
});
test('B32 production-compatible bucket is public with 50 MB total cap',()=>{
  assert.match(sql,/INSERT INTO storage\.buckets\(id,name,public,file_size_limit,allowed_mime_types\)/);
  assert.match(sql,/'social-media','social-media',true,52428800/);
  assert.equal(52428800,50*1024*1024);
});
test('B32 six allowed MIME types match server-side media metadata validator',()=>{
  const types=['image/jpeg','image/png','image/webp','video/mp4','video/webm','video/quicktime'];
  assert.deepEqual(Object.keys(MEDIA_TYPES).sort(),types.sort());
  for(const type of types)assert.ok(sql.includes("'"+type+"'"),type);
});
test('B32 upload requires a verified owner token and an owner-prefixed random object path',()=>{
  assert.match(route,/requirePayToken\(request\)/);
  assert.match(route,/requirePayUser\(request,db\)/);
  assert.match(route,/getBucket\(bucket\)/);
  assert.match(route,/config\?\.public/);
  assert.match(route,/createSignedUploadUrl\(path,\{upsert:false\}\)/);
  assert.match(route,/const path=user\.id\+'\/'\+randomUUID\(\)/);
});
test('B32 rejects unknown file extensions and oversized media before signing',()=>{
  assert.throws(()=>validateMediaMetadata({contentType:'application/pdf',size:3}),/Formato não permitido/);
  assert.throws(()=>validateMediaMetadata({contentType:'image/jpeg',size:10*1024*1024+1}),/10 MB/);
  assert.throws(()=>validateMediaMetadata({contentType:'video/mp4',size:50*1024*1024+1,duration:20}),/50 MB/);
  assert.throws(()=>validateMediaMetadata({contentType:'video/mp4',size:1,duration:91}),/90 segundos/);
  assert.equal(validateMediaMetadata({contentType:'video/mp4',size:1,duration:90}).video,true);
});
test('B32 uploaded paths are revalidated against the session owner before media finalization',()=>{
  assert.match(route,/parts\[0\]!==user\.id/);
  assert.match(route,/\.list\(user\.id,\{limit:10,search:parts\[1\]\}\)/);
  assert.match(route,/validateMediaMetadata\(\{contentType:file\.metadata\?\.mimetype,size:Number\(file\.metadata\?\.size\),duration:body\.duration\}\)/);
});
test('B32 authorization uses signed uploads, not an unsafe public INSERT storage RLS policy',()=>{
  assert.doesNotMatch(sql,/\bCREATE\s+POLICY\b|\bGRANT\s+INSERT\b/i);
  assert.match(hook,/uploadToSignedUrl\(/);
  assert.match(hook,/const checked=await fetchImpl\('\/api\/social\/media'/);
});
