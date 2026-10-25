/** M02 exact source verification, preserving the complete G47 release. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
export function verifyMobileM02(){
 const raw=readFileSync('docs/mobile/M02-INTEGRATION-BASELINE.json');
 assert.equal(createHash('sha256').update(raw).digest('hex'),"809c4629a0a78cefdd59d26ca9dae52e5c590fe44e01356b6ff4291524169787");
 const base=JSON.parse(raw),review=JSON.parse(readFileSync('docs/mobile/M02-REVIEWED-CHANGES.json','utf8'));
 assert.equal(base.baseCommit,"dec6ae5965b443ed0b8baabf05f750e33b403067");assert.equal(review.baseCommit,base.baseCommit);
 const allowed=new Set([".github/workflows/jenios-genios-addon-g46.yml", ".github/workflows/jenios-mobile-m02.yml", ".github/workflows/jenios-platform-monthly-g47.yml", "app/components/MobileAreaSwitcher.js", "app/layout.js", "app/suporte/page.js", "docs/mobile/M02-CHECKPOINT.md", "docs/mobile/M02-INTEGRATION-BASELINE.json", "lib/release/environment-scope.mjs", "native-app/.gitignore", "native-app/AGENTS.md", "native-app/App.tsx", "native-app/LICENSE", "native-app/README.md", "native-app/app.json", "native-app/assets/android-icon-background.png", "native-app/assets/android-icon-foreground.png", "native-app/assets/android-icon-monochrome.png", "native-app/assets/favicon.png", "native-app/assets/icon.png", "native-app/assets/jenios-icon.png", "native-app/assets/jenios-j.png", "native-app/assets/jenios-j.webp", "native-app/assets/splash-icon.png", "native-app/eslint.config.cjs", "native-app/index.ts", "native-app/package-lock.json", "native-app/package.json", "native-app/plugins/withUnsignedRelease.cjs", "native-app/src/Portal.tsx", "native-app/src/Portal.web.tsx", "native-app/src/file-bridge.ts", "native-app/src/navigation.ts", "native-app/tests/file-bridge.test.mjs", "native-app/tests/navigation.test.mjs", "native-app/tsconfig.json", "public/jenios-mobile-sw.js", "public/mobile.html", "public/mobile/apple-touch-icon.png", "public/mobile/downloads.html", "public/mobile/entry.css", "public/mobile/entry.js", "public/mobile/icon-256.png", "public/mobile/icon-512.webp", "public/mobile/manifest.webmanifest", "public/mobile/offline.html", "scripts/check-email-release-r42.mjs", "scripts/check-genios-activation-g44.mjs", "scripts/check-mobile-m02.mjs", "tests/mobilePwaM02.test.mjs"]);
 assert.deepEqual(Object.keys(review.reviewedBlobs).sort(),[...allowed].sort());
 const blob=body=>createHash('sha1').update(Buffer.from('blob '+body.byteLength+'\0')).update(body).digest('hex');
 for(const [path,expected] of Object.entries({...base.blobs,...review.reviewedBlobs}))assert.equal(blob(readFileSync(path)),expected,'Unreviewed M02 change: '+path);
 const files=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
 assert.deepEqual(files.sort(),[...new Set([...Object.keys(base.blobs),...allowed,'docs/mobile/M02-REVIEWED-CHANGES.json'])].sort());
 console.log('M02_INTEGRATED_SOURCE_PASS: '+Object.keys(base.blobs).length+' inherited files, '+allowed.size+' reviewed changes.');
}
if(process.argv[1]?.endsWith('/check-mobile-m02.mjs'))verifyMobileM02();
