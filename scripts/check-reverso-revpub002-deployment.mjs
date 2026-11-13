import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {checkS05DeploymentScope, REVERSO_WEB_RELEASE_BRANCH, REVERSO_UNHOMOLOGATED_GATES} from '../lib/release/environment-scope.mjs';
import {BRANCH, FALSE_CAPABILITIES, git, verifyReversoRevpub002} from './check-reverso-revpub002.mjs';

export function checkReversoRevpub002Environment(env) {
  if (!env.VERCEL_ENV) return checkS05DeploymentScope(env);
  if (!['production', 'preview'].includes(env.VERCEL_ENV) || env.VERCEL_GIT_COMMIT_REF !== BRANCH
    || env.VERCEL_GIT_PROVIDER !== 'github' || env.VERCEL_PROJECT_ID !== 'prj_44ipBY3R9sHlQDAXY7NUn1zDguw4'
    || !/^[a-f0-9]{40}$/.test(env.VERCEL_GIT_COMMIT_SHA ?? '')) return {ok: false, reason: 'REVPUB002_GIT_IDENTITY_NOT_CONFIRMED'};
  if (REVERSO_UNHOMOLOGATED_GATES.some(key => env[key] !== undefined && env[key] !== '' && env[key] !== 'false'))
    return {ok: false, reason: 'REVPUB002_FINANCIAL_ACTIVATION_BLOCKED'};
  // The new branch inherits all REVPUB001 environment restrictions, including
  // dedicated identity, preview isolation, trial and existing product checks.
  return checkS05DeploymentScope({...env, VERCEL_GIT_COMMIT_REF: REVERSO_WEB_RELEASE_BRANCH});
}
export function verifyReversoRevpub002Deployment(env, {gitRead = git, verify = verifyReversoRevpub002} = {}) {
  const scope = checkReversoRevpub002Environment(env);
  assert.equal(scope.ok, true, scope.reason);
  if (env.VERCEL_ENV) {
    assert.equal(gitRead('rev-parse', 'HEAD').toString().trim(), env.VERCEL_GIT_COMMIT_SHA, 'REVPUB002_CHECKOUT_SHA_MISMATCH');
    assert.equal(gitRead('diff', '--name-status', '--no-renames', '-z', 'HEAD').toString(), '', 'REVPUB002_DIRTY_CHECKOUT');
    assert.equal(gitRead('ls-files', '--others', '--exclude-standard', '-z').toString(), '', 'REVPUB002_UNTRACKED_SOURCE');
  }
  const source = verify();
  assert.equal(source.reversoRevpub002Release, true); assert.equal(source.exactSource, true);
  assert.equal(source.webPublicationApproved, true);
  assert.equal(source.publicationScope, 'web-only-disabled-finance');
  for (const flag of FALSE_CAPABILITIES) assert.equal(source[flag], false, 'REVPUB002 financial capability changed');
  return {ok: true, mode: scope.mode, branch: BRANCH, scope: source.publicationScope, realBillingAllowed: false};
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  console.log('REVPUB002_DEPLOYMENT_PASS', verifyReversoRevpub002Deployment(process.env));
