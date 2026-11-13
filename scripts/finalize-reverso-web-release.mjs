/** REVFIN001 exact-source closure. This tool only writes the review manifest and
 * verifier. It does not stage, commit, push, deploy, grant access or activate money.
 * Run without arguments to inspect the proposed inventory. Run --finalize only
 * once the candidate source and evidence have been reviewed and stopped changing.
 */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync, writeFileSync, lstatSync, existsSync} from 'node:fs';
import {createHash} from 'node:crypto';

const BASE = '0edbbef8c4b6bd5c9a6f5fb5e93c33eb7f11ce47';
const BASE_TREE = 'c86e7eaef0a3c96efdb2daedf40ecccfcc56af32';
const HELPER = 'scripts/check-ultra-owner-web.mjs';
const PREDECESSOR = 'scripts/check-reverso-web-baseline.mjs';
const GENERATOR = 'scripts/finalize-reverso-web-release.mjs';
const CHECKER_CLI = 'scripts/check-reverso-web-release.mjs';
const MANIFEST = 'docs/release/REVFIN001-WEB-RELEASE.json';
const DOCUMENTATION = 'docs/release/REVFIN001-SOURCE-VERIFICATION.md';
const HISTORY_COMMIT = '2c8ba6ed56178add03b1cebcab88599e27abb3c4';
const HISTORY_TREE = '068b4dc3eae6e5d45c3ec35d42459eaca638f423';
const HISTORY_HELPER = 'scripts/check-reverso-web-history.mjs';
const HISTORY_MANIFEST = 'docs/release/REVFIN001-HISTORY-WEB-PREDECESSOR.json';
const HISTORY_HELPER_BLOB = 'ac41d6c1a3f4164991246aca17aa787360af5928';
const HISTORY_MANIFEST_BLOB = '5ebd3fecf1ea3e9bee28f2694e303024d9f5a818';
const ISOLATION_RPC = 'lib/platform/reverso/subscription/isolation-rpc-v1.mjs';
const PLACEHOLDER = '__REVFIN_MANIFEST_BLOB__';
const REPLACEMENTS = new Set(['app/dashboard-logado/page.js', 'app/platform/admin/robos/page.js', 'lib/pay/catalog.mjs',
  'lib/pay/letter-billing-cb006.mjs', 'lib/platform/monthly-billing.mjs', 'tests/payCatalog.test.mjs']);
const git = (...args) => execFileSync('git', args, {maxBuffer: 64 * 1024 * 1024});
const blob = bytes => createHash('sha1').update(Buffer.from('blob ' + bytes.byteLength + '\0')).update(bytes).digest('hex');
const paths = bytes => bytes.toString().split('\0').filter(Boolean);
const entries = () => Object.fromEntries(paths(git('ls-tree', '-r', '-z', BASE)).map(line => {
  const [metadata, path] = line.split('\t');
  const [mode, type, sha] = metadata.split(' ');
  assert.equal(type, 'blob', 'REVFIN001 expects a complete source tree without submodules');
  return [path, {mode, sha}];
}));
const allowedAddition = name => [PREDECESSOR, GENERATOR, CHECKER_CLI, DOCUMENTATION, HISTORY_HELPER, ISOLATION_RPC].includes(name)
  || /^app\/api\/platform\/(?:reverso\/state|admin\/robots\/reverso)\/route\.js$/.test(name)
  || /^app\/components\/platform\/PlatformReversoFinance(?:\.js|\.module\.css)$/.test(name)
  || /^app\/platform\/(?:reverso|admin\/robos\/reverso)\/page\.js$/.test(name)
  || /^lib\/platform\/reverso\/[a-z][a-z0-9-]*\.(?:mjs|d\.mts)$/.test(name)
  || /^tests\/reverso-[a-z0-9-]+\.test\.mjs$/.test(name)
  || /^docs\/reverso\/[A-Za-z0-9_.-]+\.(?:md|json)$/.test(name)
  || /^docs\/release\/REVFIN001-[A-Za-z0-9_.-]+\.(?:md|json)$/.test(name);

const TEMPLATE = `// REVFIN001: exact reviewed source; production/environment gates are unchanged.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {verifyOwnerWebRelease as previous} from './check-reverso-web-history.mjs';
const base='${BASE}',baseTree='${BASE_TREE}';
const manifest='${MANIFEST}',helper='${HELPER}',predecessor='${PREDECESSOR}';
const historyCommit='${HISTORY_COMMIT}',historyTree='${HISTORY_TREE}';
const historyHelper='${HISTORY_HELPER}',historyManifest='${HISTORY_MANIFEST}';
const pinnedManifestBlob='${PLACEHOLDER}';
const git=(...args)=>execFileSync('git',args,{maxBuffer:64*1024*1024});
const blob=bytes=>createHash('sha1').update(Buffer.from('blob '+bytes.byteLength+'\\0')).update(bytes).digest('hex');
const historySources=new Map();
const readHistory=name=>{if(!historySources.has(name))historySources.set(name,git('show',historyCommit+':'+name));return Buffer.from(historySources.get(name))};
const normalizeHelper=bytes=>{
 const value=bytes.toString(),pattern=/^const pinnedManifestBlob='([a-f0-9]{40})';$/gm;
 const pins=[...value.matchAll(pattern)];assert.equal(pins.length,1,'REVFIN001 verifier pin changed');
 assert.equal(pins[0][1],pinnedManifestBlob,'REVFIN001 verifier pin changed');
 return Buffer.from(value.replace(pattern,"const pinnedManifestBlob='${PLACEHOLDER}';"));
};
export function verifyOwnerWebRelease({read=readFileSync,tracked}={}){
 const bytes=read(manifest);assert.equal(blob(bytes),pinnedManifestBlob,'REVFIN001 manifest changed');
 const m=JSON.parse(bytes);assert.equal(m.schema,'JENIOS_REVFIN001_EXACT_WEB_SOURCE_V1');
 assert.equal(m.baseCommit,base);assert.equal(m.baseTree,baseTree);
 assert.equal(git('rev-parse',base+'^{tree}').toString().trim(),baseTree,'REVFIN001 predecessor tree changed');
 for(const key of ['publicationApproved','actualExecutionAuthorized','realDebitAuthorized','liveExecutionAllowed','realBillingAllowed','paymentIssuanceAllowed'])assert.equal(m[key],false,'REVFIN001 capability must stay false: '+key);
 const entries=Object.fromEntries(git('ls-tree','-r','-z',base).toString().split('\\0').filter(Boolean).map(line=>{const [meta,name]=line.split('\\t');return[name,meta.split(' ')[2]]}));
 const files=tracked??git('ls-files','-z').toString().split('\\0').filter(Boolean);
 assert.deepEqual([...files].sort(),[...Object.keys(entries),...Object.keys(m.additions),manifest].sort(),'REVFIN001 exact inventory');
 assert.deepEqual(Object.keys(m.replacements).sort(),['app/dashboard-logado/page.js','app/platform/admin/robos/page.js','lib/pay/catalog.mjs','lib/pay/letter-billing-cb006.mjs','lib/platform/monthly-billing.mjs','tests/payCatalog.test.mjs'],'REVFIN001 replacement scope changed');
 assert.equal(blob(read(predecessor)),entries[helper],'REVFIN001 predecessor verifier changed');
 assert.equal(blob(normalizeHelper(read(helper))),m.verifierTemplateBlob,'REVFIN001 verifier source changed');
 assert.equal(blob(read(historyHelper)),'${HISTORY_HELPER_BLOB}','REVFIN001 history verifier changed');
 assert.equal(blob(read(historyManifest)),'${HISTORY_MANIFEST_BLOB}','REVFIN001 history manifest changed');
 assert.equal(git('rev-parse',historyCommit+'^{tree}').toString().trim(),historyTree,'REVFIN001 history checkpoint changed');
 const historyFiles=git('ls-tree','-r','--name-only','-z',historyCommit).toString().split('\\0').filter(Boolean);
 const inherited=previous({tracked:historyFiles,read:name=>name===helper?read(historyHelper):name===manifest?read(historyManifest):readHistory(name)});
 for(const [name,sha] of Object.entries(entries)){
  if(name===helper)continue;
  const change=m.replacements[name];if(change)assert.equal(change.baseline,sha,'REVFIN001 replacement predecessor mismatch: '+name);
  assert.equal(blob(read(name)),change?.target??sha,'REVFIN001 inherited source changed: '+name);
 }
 for(const [name,sha] of Object.entries(m.additions)){
  assert.ok(!Object.hasOwn(entries,name)&&name!==manifest,'REVFIN001 addition cannot replace predecessor: '+name);
  assert.match(sha,/^[a-f0-9]{40}$/);assert.equal(blob(read(name)),sha,'REVFIN001 addition changed: '+name);
 }
 return {...inherited,reversoHistorySourceRelease:true,reversoFinanceRelease:true,exactSource:true,publicationApproved:false,actualExecutionAuthorized:false,realDebitAuthorized:false,brokerPermissionsGranted:false,liveExecutionAllowed:false,realBillingAllowed:false,paymentIssuanceAllowed:false};
}
if(process.argv[1]?.endsWith('/check-ultra-owner-web.mjs'))console.log('REVFIN001_EXACT_WEB_SOURCE_PASS',verifyOwnerWebRelease());
`;

function normalizeCurrentHelper(bytes) {
  const value = bytes.toString();
  if (!value.startsWith('// REVFIN001: exact reviewed source;')) return null;
  const pattern = /^const pinnedManifestBlob='[a-f0-9]{40}';$/gm;
  assert.equal([...value.matchAll(pattern)].length, 1, 'Existing REVFIN001 verifier has an invalid manifest pin');
  return Buffer.from(value.replace(pattern, "const pinnedManifestBlob='" + PLACEHOLDER + "';"));
}

export function buildReversoWebReview() {
  assert.equal(git('rev-parse', BASE + '^{tree}').toString().trim(), BASE_TREE);
  assert.equal(git('rev-parse', HISTORY_COMMIT + '^{tree}').toString().trim(), HISTORY_TREE, 'Keep the reviewed history checkpoint');
  const baseline = entries();
  assert.equal(blob(readFileSync(PREDECESSOR)), baseline[HELPER].sha, 'Keep the exact published verifier as the predecessor');
  assert.equal(blob(readFileSync(HISTORY_HELPER)), HISTORY_HELPER_BLOB, 'Keep the exact reviewed history verifier');
  assert.equal(blob(readFileSync(HISTORY_MANIFEST)), HISTORY_MANIFEST_BLOB, 'Keep the exact reviewed history manifest');
  const helperBytes = readFileSync(HELPER);
  if (blob(helperBytes) !== baseline[HELPER].sha) {
    if (blob(helperBytes) === HISTORY_HELPER_BLOB) {
      assert.equal(blob(readFileSync(MANIFEST)), HISTORY_MANIFEST_BLOB, 'History verifier migration requires its exact manifest');
    } else {
      const normalized = normalizeCurrentHelper(helperBytes);
      assert.ok(normalized, 'Unknown helper modifications are not overwritten');
      assert.equal(blob(normalized), blob(Buffer.from(TEMPLATE)), 'Review changed verifier code explicitly before finalizing');
    }
  }
  const files = [...new Set(paths(git('ls-files', '--cached', '--others', '--exclude-standard', '-z')))];
  const additions = {}, replacements = {};
  for (const name of Object.keys(baseline)) {
    assert.ok(files.includes(name) && existsSync(name), 'Inherited source deleted: ' + name);
    if (name === HELPER) continue;
    const target = blob(readFileSync(name));
    if (target !== baseline[name].sha) {
      assert.ok(REPLACEMENTS.has(name), 'REVFIN001 cannot change inherited source: ' + name);
      replacements[name] = {baseline: baseline[name].sha, target};
    }
  }
  assert.deepEqual(Object.keys(replacements).sort(), [...REPLACEMENTS].sort(), 'Review the six catalog, navigation and disabled-isolation consumer replacements explicitly');
  for (const name of files.sort()) {
    if (Object.hasOwn(baseline, name) || name === MANIFEST) continue;
    assert.ok(allowedAddition(name), 'Unreviewed REVFIN001 addition: ' + name);
    assert.ok(lstatSync(name).isFile(), 'REVFIN001 additions must be regular files: ' + name);
    additions[name] = blob(readFileSync(name));
  }
  for (const name of [PREDECESSOR, GENERATOR, CHECKER_CLI, DOCUMENTATION, HISTORY_HELPER, HISTORY_MANIFEST, ISOLATION_RPC, 'lib/platform/reverso/state-contract.mjs', 'lib/platform/reverso/state-reader.mjs', 'tests/reverso-state.test.mjs']) assert.ok(Object.hasOwn(additions, name), 'Required REVFIN001 source missing: ' + name);
  const manifest = {schema: 'JENIOS_REVFIN001_EXACT_WEB_SOURCE_V1', baseCommit: BASE, baseTree: BASE_TREE,
    verifierTemplateBlob: blob(Buffer.from(TEMPLATE)), additions, replacements,
    publicationApproved: false, actualExecutionAuthorized: false, realDebitAuthorized: false,
    liveExecutionAllowed: false, realBillingAllowed: false, paymentIssuanceAllowed: false};
  const manifestBytes = Buffer.from(JSON.stringify(manifest, null, 2) + '\n');
  const helper = Buffer.from(TEMPLATE.replace(PLACEHOLDER, blob(manifestBytes)));
  // Only the pin declaration is replaced; the normalization constant stays literal.
  assert.equal(blob(normalizeCurrentHelper(helper)), manifest.verifierTemplateBlob);
  return {manifest, manifestBytes, helper, manifestBlob: blob(manifestBytes), inventory: [...Object.keys(baseline), ...Object.keys(additions), MANIFEST].sort()};
}

if (process.argv[1]?.endsWith('/finalize-reverso-web-release.mjs')) {
  const args = process.argv.slice(2);
  assert.ok(args.length === 0 || args.length === 1 && args[0] === '--finalize', 'Use no arguments for review or --finalize for exact closure');
  const review = buildReversoWebReview();
  if (args[0] === '--finalize') {
    writeFileSync(MANIFEST, review.manifestBytes);
    writeFileSync(HELPER, review.helper);
  }
  console.log(JSON.stringify({status: args[0] === '--finalize' ? 'exact_source_manifest_written' : 'review_only_no_files_changed',
    baseCommit: BASE, baseTree: BASE_TREE, manifest: MANIFEST, manifestBlob: review.manifestBlob,
    additions: Object.keys(review.manifest.additions), replacements: Object.keys(review.manifest.replacements),
    inventoryFiles: review.inventory.length, publicationApproved: false, realBillingAllowed: false, liveExecutionAllowed: false,
    next: 'Review the diff, stage the exact files and run the existing source, unit and release checks. No deployment gate was changed.'}, null, 2));
}
