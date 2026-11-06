import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {verifyR106PublicGuidance} from '../scripts/check-authentication-r106.mjs';
const blob=s=>{const b=Buffer.from(s);return createHash('sha1').update(Buffer.from('blob '+b.length+'\0')).update(b).digest('hex');};
test('Kivoryn footer changes only one text insertion; all JENIOS identity bytes are preserved',()=>{
 const source=readFileSync('app/components/brand/BrandSignature.js','utf8');
 const line='  <span className={styles.footerCredit}>Kivoryn Technologies © 2026</span>\n';
 assert.equal(source.split(line).length,2);
 assert.equal(blob(source.replace(line,'')),'ae7765da8fdab64f8b27126822dc3483865ae050');
});
test('Footer style is append-only and preserves every previous style byte',()=>{
 const source=readFileSync('app/components/brand/BrandSignature.module.css','utf8');
 const marker='\n/* Developer attribution stays separate from the JENIOS identity. */';
 assert.equal(source.split(marker).length,2);
 assert.equal(blob(source.slice(0,source.indexOf(marker))),'17b8a04f229f5992461191b3cb55236f9f2576a3');
 assert.match(source,/color:#6b7280;font-size:12px;font-weight:400/);
 assert.match(source,/\.dark \.footerCredit\{color:#a9b2bf\}/);
});
test('Exact source inventory rejects altered signature bytes and manifest tampering',()=>{
 for(const target of ['app/components/brand/BrandSignature.js','app/components/brand/BrandSignature.module.css','docs/release/KIVORYN-TEXT-FOOTER-20261106.json']){
  assert.throws(()=>verifyR106PublicGuidance({read:path=>path===target?Buffer.from('unreviewed change'):readFileSync(path)}));
 }
});
