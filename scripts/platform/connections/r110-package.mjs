/** Package only the operator tool and its documentation; never copy environment files. */
import {mkdirSync, copyFileSync, writeFileSync, existsSync, readFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {createHash} from 'node:crypto';
const destination = resolve('dist/jenios-binance-r110');
if (existsSync(destination)) throw Error('R110_PACKAGE_ALREADY_EXISTS');
const files = [
  ['lib/platform/connections/binance-real-preflight-r110.mjs', 'lib/platform/connections/binance-real-preflight-r110.mjs'],
  ['scripts/platform/connections/r110-binance-real-preflight.mjs', 'scripts/platform/connections/r110-binance-real-preflight.mjs'],
  ['docs/release/R110-BINANCE-TESTE-CONTA-REAL-20261028.md', 'INICIAR.md']
];
const manifest = [];
for (const [source, name] of files) {
  const target = join(destination, name);
  mkdirSync(resolve(target, '..'), {recursive: true}); copyFileSync(source, target);
  manifest.push({file: name, sha256: createHash('sha256').update(readFileSync(target)).digest('hex')});
}
writeFileSync(join(destination, 'SHA256.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log('R110_OPERATOR_PACKAGE_READY');
