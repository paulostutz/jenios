import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BASE, BRANCH, CHECKER, MANIFEST, FALSE_CAPABILITIES, git, blob, inventory, verifyReversoRevpub002} from '../scripts/check-reverso-revpub002.mjs';
import {checkReversoRevpub002Environment, verifyReversoRevpub002Deployment} from '../scripts/check-reverso-revpub002-deployment.mjs';
import {createJourney, USER, ADMIN, findAll, text} from './helpers/reverso-journey-harness-v2.mjs';

test('REVPUB002 customer sees three separate items, monthly closure and blocked undefined fee event', async () => {
  const h = createJourney({actor: USER}); h.setUnavailable(true);
  try {
    await h.settle(); const body = h.text();
    assert.match(body, /R\$ 19,90/); assert.match(body, /R\$ 199,00/);
    assert.match(body, /assinatura é exclusiva do Reverso; não concede Ultra/);
    assert.match(body, /Taxa de uso · R\$ 5,00/); assert.match(body, /cobrança real permanece indisponível/);
    assert.match(body, /participação · fechamento mensal/i);
    assert.match(body, /10% para quem contrata os planos com Reverso/);
    assert.match(body, /20% para quem contrata somente o Reverso avulso, mensal ou anual/);
    assert.doesNotMatch(body, /20% no plano de entrada/);
    assert.match(body, /Dados indisponíveis não são saldo zero/);
    assert.match(body, /se zero ou negativo, não há cobrança de participação/);
    assert.match(body, /A taxa de R\$ 5,00 fica fora dessa base/);
    assert.ok(body.indexOf('Negociações detalhadas do Reverso') < body.indexOf('Resultados por competência'));
    assert.ok(body.indexOf('Operações — Start ao fechamento') < body.indexOf('Resultados por competência'));
    assert.equal(h.requests.some(r => r.method === 'POST'), false);
    const section = findAll(h.tree, n => n.type === 'section' && n.props['aria-labelledby'] === 'reverso-costs-title')[0];
    assert.ok(section); assert.equal(findAll(section, n => ['button', 'input', 'form'].includes(n.type)).length, 0);
  } finally { h.unmount(); }
});
test('REVPUB002 Admin sees the same conditions without granting a customer or issuing a payment', async () => {
  const h = createJourney({actor: ADMIN, admin: true});
  try { await h.settle(); assert.match(h.text(), /Gestão do Reverso/); assert.match(h.text(), /fechamento mensal/);
    assert.match(h.text(), /Start ao fechamento confirmado/);
    assert.match(h.text(), /10% para quem contrata os planos com Reverso/);
    assert.match(h.text(), /20% para quem contrata somente o Reverso avulso, mensal ou anual/);
    assert.equal(h.requests.some(r => r.method === 'POST'), false);
    assert.equal(h.records.size, 0);
  } finally { h.unmount(); }
});
test('REVPUB002 reuses exact REVSRC001 login correction and leaves all runtime routes and Ultra intact', () => {
  // Exact Git blob IDs compared with recovered REVSRC001 before publication;
  // that local-only commit is not assumed to exist in a shallow deploy checkout.
  for (const [name, sha] of [['app/components/platform/PlatformAdminAccess.js', 'aad1b907d67b5bc9598cd36e0dc2fbdd6530572e'],
    ['app/platform/admin/robos/reverso/page.js', '32737d34ec51c9d92f4b2d6ce9b1e60d087470d4']])
    assert.equal(blob(readFileSync(name)), sha);
  for (const name of ['app/api/platform/reverso/state/route.js', 'app/api/platform/reverso/subscription/route.js',
    'app/api/platform/admin/robots/reverso/route.js', 'lib/platform/reverso/publication-boundary-v1.mjs',
    'lib/platform/reverso/subscription/isolation-rpc-v1.mjs', 'lib/release/environment-scope.mjs'])
    assert.deepEqual(readFileSync(name), git('show', BASE + ':' + name));
});
test('REVPUB002 exact release retains the historical source chain and denies every money capability', () => {
  const result = verifyReversoRevpub002();
  assert.equal(result.reversoRevpub002Release, true); assert.equal(result.ultraProductionScopeRelease, true);
  for (const flag of FALSE_CAPABILITIES) assert.equal(result[flag], false);
});
test('REVPUB002 rejects altered code, manifest and verifier without modifying the checkout', () => {
  for (const target of [MANIFEST, CHECKER, 'app/components/platform/PlatformReversoFinance.js',
    'app/api/platform/reverso/state/route.js', 'lib/platform/reverso/publication-boundary-v1.mjs']) {
    const read = name => name === target ? Buffer.concat([readFileSync(name), Buffer.from('\n')]) : readFileSync(name);
    assert.throws(() => verifyReversoRevpub002({read}));
  }
});
test('REVPUB002 rejects extra, missing and duplicate files', () => {
  const files = inventory();
  for (const tracked of [[...files, 'unreviewed.mjs'], files.slice(1), [...files, files[0]]])
    assert.throws(() => verifyReversoRevpub002({tracked}), /exact inventory/);
});
const env = {VERCEL_ENV: 'production', VERCEL_GIT_COMMIT_REF: BRANCH, VERCEL_GIT_COMMIT_SHA: 'a'.repeat(40),
  VERCEL_GIT_PROVIDER: 'github', VERCEL_PROJECT_ID: 'prj_44ipBY3R9sHlQDAXY7NUn1zDguw4',
  NEXT_PUBLIC_SUPABASE_URL: 'https://igayfjorjmucthlfoasf.supabase.co', SOCIAL_SUPABASE_URL: 'https://igayfjorjmucthlfoasf.supabase.co',
  SUPABASE_SECRET_KEY: 'fixture-only-secret', NEXT_PUBLIC_SUP_PUBLISHABLE_KEY: 'fixture-only-public',
  PLATFORM_SUPABASE_URL: 'https://xaicvhagftzjkqphnbgx.supabase.co', NEXT_PUBLIC_PLATFORM_SUPABASE_URL: 'https://xaicvhagftzjkqphnbgx.supabase.co',
  NEXT_PUBLIC_PLATFORM_SUPABASE_PUBLISHABLE_KEY: 'fixture-only-public', PLATFORM_SUPABASE_SERVICE_ROLE_KEY: 'fixture-only-server-key-over-twenty',
  JENIOS_S05_SCHEMA_CERTIFIED: 'true', JENIOS_S05_E2E_CERTIFIED: 'true'};
test('REVPUB002 environment keeps identity, dedicated backend and trial restrictions', () => {
  assert.equal(checkReversoRevpub002Environment(env).ok, true);
  for (const change of [{VERCEL_GIT_COMMIT_REF: 'main'}, {VERCEL_PROJECT_ID: 'different'}, {VERCEL_GIT_PROVIDER: 'gitlab'},
    {VERCEL_GIT_COMMIT_SHA: 'short'}, {PLATFORM_SUPABASE_URL: 'https://invalid.example'}, {JENIOS_TRIAL_ENABLED: 'true'},
    {JENIOS_S05_SCHEMA_CERTIFIED: 'false'}]) assert.equal(checkReversoRevpub002Environment({...env, ...change}).ok, false);
});
test('REVPUB002 refuses enabled or ambiguous financial gates', () => {
  for (const key of ['REVERSO_RUNTIME_READ_ENABLED', 'REVERSO_SUBSCRIPTION_DEMO_ENABLED', 'JENIOS_REVERSO_PLAN_ISOLATION_V1'])
    for (const value of ['true', '1', 'TRUE', true]) assert.equal(checkReversoRevpub002Environment({...env, [key]: value}).ok, false);
});
test('REVPUB002 refuses stale or dirty deployed source and broadened capabilities', () => {
  const source = {reversoRevpub002Release: true, exactSource: true, webPublicationApproved: true,
    publicationScope: 'web-only-disabled-finance', ...Object.fromEntries(FALSE_CAPABILITIES.map(f => [f, false]))};
  const gitRead = (...args) => args[0] === 'rev-parse' ? env.VERCEL_GIT_COMMIT_SHA : '';
  assert.equal(verifyReversoRevpub002Deployment(env, {gitRead, verify: () => source}).ok, true);
  for (const operation of ['rev-parse', 'diff', 'ls-files']) assert.throws(() => verifyReversoRevpub002Deployment(env,
    {gitRead: (...args) => args[0] === operation ? 'unexpected' : gitRead(...args), verify: () => source}));
  for (const flag of FALSE_CAPABILITIES) assert.throws(() => verifyReversoRevpub002Deployment(env,
    {gitRead, verify: () => ({...source, [flag]: true})}));
});
