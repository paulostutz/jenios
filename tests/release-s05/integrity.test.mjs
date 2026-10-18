import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolveSocialReportGate} from '../../lib/reports/social-report-gate.mjs';
import {samePublicVideoBucket} from '../../lib/social/video-playback.mjs';

const file=path=>readFileSync(path,'utf8');
const manifest=JSON.parse(file('docs/release/S05-CRITICAL-API-SHA256.json'));

test('S05 release retains exactly ten immutable API implementation hashes',()=>{
  assert.equal(Object.keys(manifest).length,10);
  for(const [path,expected] of Object.entries(manifest))
    assert.equal(createHash('sha256').update(readFileSync(path)).digest('hex'),expected,path);
});
test('S05 release does not include staging-only blocking middleware',()=>{
  assert.equal(existsSync('middleware.js'),false);
  assert.equal(existsSync('lib/staging/route-policy.mjs'),false);
  assert.equal(existsSync('app/s04-laboratorio/page.js'),false);
});
test('S05 release only pins Next.js 15.5.28 and its lockfile consistently',()=>{
  const pkg=JSON.parse(file('package.json')),lock=JSON.parse(file('package-lock.json'));
  assert.equal(pkg.dependencies.next,'15.5.28');
  assert.equal(lock.packages['node_modules/next'].version,'15.5.28');
  assert.equal(lock.packages[''].dependencies.next,'15.5.28');
});
test('free BankScore and validator detailed report access still requires Social profile',async()=>{
  const id='11111111-1111-4111-8111-111111111111';
  function client({user={id,is_anonymous:false},profile={id},error=false}={}){
    return {auth:{getUser:async()=>({data:{user},error:null})},
    from(name){assert.equal(name,'profiles');return{select(){return this},eq(field,v){assert.equal(field,'id');assert.equal(v,id);return this},async maybeSingle(){return{data:profile,error:error?new Error('database'):null}}}}};
  }
  assert.equal((await resolveSocialReportGate(client())).status,'ready');
  assert.equal((await resolveSocialReportGate(client({profile:null}))).status,'profile-missing');
  assert.equal((await resolveSocialReportGate(client({user:{id,is_anonymous:true}}))).status,'guest');
  assert.equal((await resolveSocialReportGate(client({error:true}))).status,'unavailable');
  const guard=file('lib/reports/prelaunch-access.mjs');
  assert.match(guard,/\.from\('profiles'\)/);
  assert.doesNotMatch(guard,/\.from\(['"](?:jenios_pay_orders|payments)['"]\)/);
});
test('S05 guarded PDFs are used on both report UIs',()=>{
 const helper=file('lib/reports/pdf-download.mjs');
 assert.match(helper,/application\\\/pdf/);
 assert.match(helper,/%PDF-/);
 assert.match(helper,/MAX_REPORT_PDF_BYTES/);
 for(const ui of ['BankscorePaidReport','PaidCryptoReport'])
   assert.match(file('app/components/'+ui+'.js'),/downloadVerifiedReportPdf\(/);
});
test('video remains playable with optimization disabled and never uses foreign public buckets',()=>{
 assert.match(file('app/components/SocialVideo.js'),/NEXT_PUBLIC_SOCIAL_OPTIMIZED_VIDEO/);
 assert.match(file('app/components/SocialVideo.js'),/samePublicVideoBucket/);
 const original='https://staging.supabase.co/storage/v1/object/public/social-media/a.mp4';
 assert.equal(samePublicVideoBucket(original,'https://staging.supabase.co/storage/v1/object/public/social-media/b.mp4'),true);
 assert.equal(samePublicVideoBucket(original,'https://other.test/storage/v1/object/public/social-media/b.mp4'),false);
});
