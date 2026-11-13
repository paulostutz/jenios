import test from 'node:test';
import assert from 'node:assert/strict';
import {createJourney, findAll, text, USER, ADMIN} from './helpers/reverso-journey-harness-v2.mjs';

const adminPath = '/platform/admin/robos/reverso';
const adminLogin = '/platform/entrar?dedicated=1&next=%2Fplatform%2Fadmin%2Frobos%2Freverso';
const clientLogin = '/platform/entrar?dedicated=1&next=%2Fplatform%2Freverso';
const loginLinks = h => findAll(h.tree, node => node.type === 'a' && text(node).trim() === 'Entrar na Platform');
const financeCalls = h => h.requests.filter(row => /reverso/.test(row.url));

test('REVSRC001 Admin entry preserves the dedicated Reverso return before any client read', async t => {
  const h = createJourney({actor: null, admin: true, entryPath: adminPath}); t.after(() => h.unmount());
  await h.settle();
  assert.equal(loginLinks(h)[0].props.href, adminLogin);
  assert.equal(financeCalls(h).length, 0);
  h.followLink('Entrar na Platform'); await h.settle();
  assert.equal(h.path, adminLogin);
  assert.match(h.text(), /Acesso da Platform/);
  assert.doesNotMatch(h.text(), /Formulário Social fora do escopo/);
});

test('REVSRC001 default and unapproved Admin return paths preserve the legacy login', async t => {
  for (const props of [{}, {returnTo: 'https://outside.invalid/', requireDedicated: true},
    {returnTo: '//outside.invalid'}, {returnTo: '/platform/admin/robos/reverso?unsafe=1'}]) {
    const h = createJourney({actor: null, adminAccessProps: props}); t.after(() => h.unmount());
    await h.settle(); assert.equal(loginLinks(h)[0].props.href, '/platform/entrar');
    assert.equal(financeCalls(h).length, 0);
  }
});

test('REVSRC001 actual client guard and login form return to Reverso with synthetic dedicated identity', async t => {
  const h = createJourney({actor: null, entryPath: '/platform/reverso'}); t.after(() => h.unmount());
  await h.settle(); assert.equal(h.path, clientLogin); assert.equal(financeCalls(h).length, 0);
  await h.signIn(' CLIENTE@REVERSO.EXAMPLE.INVALID '); await h.settle();
  assert.equal(h.path, '/platform/reverso'); assert.equal(h.refreshes, 1);
  assert.deepEqual(h.signIns, [{email: 'cliente@reverso.example.invalid'}]);
  assert.match(h.text(), /Seu Reverso, em detalhes/);
  assert.ok(h.requests.some(row => row.url === '/api/platform/reverso/state'));
  assert.equal(h.requests.some(row => row.method === 'POST'), false);
  assert.equal(h.sourceCalls.every(row => row.subject === USER), true);
});

test('REVSRC001 actual Admin guard and login form return to Admin and retain read-only customer selection', async t => {
  const h = createJourney({actor: null, admin: true, entryPath: adminPath}); t.after(() => h.unmount());
  await h.settle(); h.followLink('Entrar na Platform'); await h.settle();
  await h.signIn('admin@reverso.example.invalid'); await h.settle();
  assert.equal(h.path, adminPath); assert.match(h.text(), /Gestão do Reverso/);
  assert.equal(financeCalls(h).length, 0);
  h.selectCustomer(USER); await h.settle();
  assert.equal(financeCalls(h).length, 1);
  assert.equal(financeCalls(h)[0].url, '/api/platform/admin/robots/reverso?subject=' + USER);
  assert.equal(h.requests.some(row => row.method === 'POST'), false);
  assert.equal(h.sourceCalls.length, 0);
  assert.equal((await h.auth.getUser()).data.user.id, ADMIN);
});

test('REVSRC001 failed dedicated login stays on the return form, clears password and fetches no finance', async t => {
  const h = createJourney({actor: null, entryPath: adminLogin}); t.after(() => h.unmount());
  await h.settle(); await h.signIn('admin@reverso.example.invalid', 'wrong-synthetic-password'); await h.settle();
  assert.equal(h.path, adminLogin); assert.match(h.text(), /Não foi possível autenticar/);
  assert.equal(findAll(h.tree, node => node.type === 'input' && node.props.type === 'password')[0].props.value, '');
  assert.equal(financeCalls(h).length, 0); assert.equal(h.refreshes, 0);
});

test('REVSRC001 anonymous synthetic response never completes dedicated login', async t => {
  const h = createJourney({actor: null, entryPath: clientLogin}); t.after(() => h.unmount());
  await h.settle(); await h.signIn('anonimo@reverso.example.invalid'); await h.settle();
  assert.equal(h.path, clientLogin); assert.match(h.text(), /Não foi possível autenticar/);
  assert.equal(financeCalls(h).length, 0); assert.equal(h.refreshes, 0);
});

test('REVSRC001 a client signing in through Admin return receives no Admin permission or finance data', async t => {
  const h = createJourney({actor: null, entryPath: adminLogin}); t.after(() => h.unmount());
  await h.settle(); await h.signIn('cliente@reverso.example.invalid'); await h.settle();
  assert.equal(h.path, adminPath); assert.match(h.text(), /Sua conta não possui permissão administrativa/);
  assert.doesNotMatch(h.text(), /Consultar cliente/); assert.equal(financeCalls(h).length, 0);
});

test('REVSRC001 Social Master shell remains restricted until dedicated Admin login completes', async t => {
  const h = createJourney({actor: null, admin: true, socialMaster: true, entryPath: adminPath}); t.after(() => h.unmount());
  await h.settle(); assert.match(h.text(), /sessão administrativa exclusiva da Platform/);
  assert.equal(h.button('Consultar').props.disabled, true); assert.equal(financeCalls(h).length, 0);
  assert.equal(loginLinks(h)[0].props.href, adminLogin);
  h.followLink('Entrar na Platform'); await h.settle();
  assert.equal(h.path, adminLogin); assert.match(h.text(), /Acesso da Platform/);
  await h.signIn('admin@reverso.example.invalid'); await h.settle();
  assert.equal(h.path, adminPath); assert.equal(h.button('Consultar').props.disabled, false);
  assert.equal(financeCalls(h).length, 0);
});

test('REVSRC001 signing out after login removes client data and returns to the dedicated login', async t => {
  const h = createJourney({actor: null, entryPath: clientLogin}); t.after(() => h.unmount());
  await h.settle(); await h.signIn('cliente@reverso.example.invalid'); await h.settle();
  assert.match(h.text(), /Seu Reverso, em detalhes/);
  h.setActor(null); h.advance(0); await h.settle();
  assert.equal(h.path, clientLogin); assert.doesNotMatch(h.text(), /Acompanhamento da conta/);
  assert.match(h.text(), /Acesso da Platform/);
});

test('REVSRC001 login still rejects an external next using the existing exact allowlist', async t => {
  const h = createJourney({actor: null, entryPath: '/platform/entrar?dedicated=1&next=https%3A%2F%2Foutside.invalid'}); t.after(() => h.unmount());
  await h.settle(); await h.signIn('cliente@reverso.example.invalid'); await h.settle();
  assert.equal(h.path, '/social'); assert.equal(financeCalls(h).length, 0);
  assert.equal(h.redirects.some(path => /^https?:/.test(path)), false);
});
