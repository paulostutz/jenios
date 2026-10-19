import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync,existsSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
test('B110 official transparent JENIOS assets are lightweight and local',()=>{
 for(const [path,budget] of [
  ['public/brand/jenios-logo-horizontal.webp',90000],
  ['public/brand/jenios-j.webp',50000],
  ['app/icon.png',75000],
  ['app/apple-icon.png',60000],
  ['app/favicon.ico',20000]
 ]){
  assert.ok(existsSync(path),path);
  assert.ok(statSync(path).size>1000&&statSync(path).size<budget,path+' size');
 }
 assert.equal(readFileSync('app/icon.png').subarray(0,8).toString('hex'),'89504e470d0a1a0a');
 assert.equal(readFileSync('app/favicon.ico').subarray(0,4).toString('hex'),'00000100');
 assert.equal(readFileSync('public/brand/jenios-j.webp').subarray(0,4).toString('ascii'),'RIFF');
});
test('B110 image size is fixed in all footers, preventing large intrinsic WebP dimensions',()=>{
 const code=read('app/components/brand/BrandSignature.js');
 assert.match(code,/style=\{\{width:width,height:width,objectFit:'contain',flexShrink:0\}\}/);
 assert.match(code,/BrandMark size=\{29\} decorative/);
 assert.match(code,/Math\.min\(80,Number\(size\)\|\|42\)/);
});
test('B110 new J replaces purple Next icon and Apple touch icon',()=>{
 assert.equal(existsSync('app/icon.svg'),false);
 assert.equal(existsSync('app/apple-icon.js'),false);
 assert.ok(existsSync('app/icon.png'));
 assert.ok(existsSync('app/apple-icon.png'));
});
test('B110 JENIOS brand reused across approved UI surfaces',()=>{
 const code=read('app/components/brand/BrandSignature.js');
 for(const part of ['BrandMark','BrandLockup','BrandFooter','jenios-j.webp','jenios-logo-horizontal.webp'])
  assert.ok(code.includes(part),part);
 for(const path of ['app/lp/page.js','app/social/page.js','app/dashboard/page.js',
  'app/mesa-operacoes/page.js','app/dashboard-logado/page.js','app/admin/page.js',
  'app/admin/login/page.js','app/platform/admin/page.js','app/page.js']){
  assert.match(read(path),/BrandFooter|BrandLockup|BrandMark/,path);
 }
});
test('B110 institutional footer stays accessible and never changes business rules',()=>{
 const code=read('app/components/brand/BrandSignature.js');
 assert.match(code,/Rodapé institucional JENIOS/);
 const social=read('app/social/page.js');
 for(const token of ['SocialPostCard','SocialSidebarPremium','useSocialFeed','SocialMobileRail',
  'Sala de Controle','onCreateComment={feed.comment}','onCurtir={curtirPost}'])assert.ok(social.includes(token));
 assert.match(read('app/admin/page.js'),/AdminAccess permission/);
 assert.match(read('app/platform/admin/page.js'),/PlatformAdminAccess permission="platform.admin"/);
 assert.match(read('app/lp/page.js'),/BrandFooter tone="dark" scope="Platform"/);
});
