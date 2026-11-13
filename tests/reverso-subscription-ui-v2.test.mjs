import test from 'node:test';
import assert from 'node:assert/strict';
import {createJourney, USER, OTHER, ADMIN, NOW, deferred, findAll, view, offer} from './helpers/reverso-journey-harness-v2.mjs';
import {createReversoSubscriptionClient} from '../lib/platform/reverso/subscription/client-v2.mjs';
import {available, emptyReversoState} from '../lib/platform/reverso/state-contract.mjs';
import {socialAuthReturnPath} from '../app/components/social-auth-return.mjs';

async function quoteAndAccept(h, interval = 'month') {
  await h.settle(); await h.click(interval === 'month' ? 'Selecionar mensal' : 'Selecionar anual'); await h.settle();
  assert.equal(h.button('Confirmar contratação demonstrativa').props.disabled, true);
  h.accept(); await h.settle();
}
const prepares = h => h.requests.filter(r => r.body?.action === 'prepare');

test('Reverso dedicated login returns are nominal and preserve rejection of other destinations', () => {
  for (const path of ['/platform/reverso', '/platform/admin/robos/reverso', '/platform/ultra', '/dashboard-logado', '/social']) assert.equal(socialAuthReturnPath(path), path);
  for (const path of ['https://outside.invalid', '//outside.invalid', '/platform/reverso?subject=' + OTHER, '/platform/reverso/../admin', '/platform/admin/robos', '/platform/reverso#checkout']) assert.equal(socialAuthReturnPath(path), '/social');
});

test('authenticated financial view keeps unknown, confirmed zero and pending commercial policy distinct', async () => {
  const h = createJourney(); let phase = 'unknown';
  h.setState(USER, (_ctx, now) => {
    const state = emptyReversoState({subject: USER, now}), stamp = new Date(now).toISOString();
    const amount = phase === 'zero' ? 0 : null;
    state.sections.wallet = available({currency: 'BRL', availableMinor: amount, balanceMinor: amount, pendingMinor: amount, reservedMinor: amount, debitAuthorized: false}, {mode: 'demo', observedAt: stamp});
    state.sections.performance = phase === 'concurrent' ? {status: 'unavailable', data: null, reason: 'Dados financeiros em atualização concorrente.'}
      : available({periods: []}, {mode: 'demo', observedAt: stamp});
    state.sections.policy = available({status: 'pending', reason: 'Regras do Reverso aguardam aprovação.'}, {mode: 'demo', observedAt: stamp});
    return state;
  });
  try {
    await h.settle(); assert.doesNotMatch(h.text(), /R\$\s*0,00/); assert.match(h.text(), /Pendente/);
    assert.match(h.text(), /simulação mensal não valida a política comercial do Reverso/); assert.match(h.text(), /Regras do Reverso aguardam aprovação/);
    phase = 'zero'; await h.click('Atualizar dados'); await h.settle(); assert.equal((h.text().match(/R\$\s*0,00/g) || []).length, 4);
    phase = 'concurrent'; await h.click('Atualizar dados'); await h.settle(); assert.match(h.text(), /Dados financeiros em atualização concorrente/);
  } finally {h.unmount();}
});

test('a signed-out client follows the dedicated login guard without financial requests', async () => {
  const h = createJourney({actor: null, socialMaster: true});
  try {await h.settle(); assert.ok(h.redirects.includes('/platform/entrar?dedicated=1&next=%2Fplatform%2Freverso')); assert.equal(h.requests.length, 0);} finally {h.unmount();}
});

test('a Social Master shell explains the missing dedicated Admin session and sends no Reverso request', async () => {
  const h = createJourney({actor: null, socialMaster: true, admin: true});
  try {
    await h.settle(); assert.match(h.text(), /sessão administrativa exclusiva da Platform/); assert.equal(h.button('Consultar').props.disabled, true);
    assert.equal(h.requests.some(r => /reverso/.test(r.url)), false); assert.equal(h.requests.some(r => r.method === 'POST'), false);
  } finally {h.unmount();}
});

test('Admin reads only the selected customer through its existing grant and never mounts subscription writes', async () => {
  const h = createJourney({actor: ADMIN, admin: true});
  try {
    await h.settle(); h.selectCustomer(USER); await h.settle();
    assert.ok(h.requests.some(r => r.url === '/api/platform/admin/robots/reverso?subject=' + USER));
    assert.equal(h.requests.some(r => r.url.includes('/subscription')), false); assert.equal(h.requests.some(r => r.method === 'POST'), false);
    assert.match(h.text(), /Gestão do Reverso/); assert.doesNotMatch(h.text(), /Confirmar contratação demonstrativa/);
  } finally {h.unmount();}
});

test('Admin permission revoked during the read suppresses selected customer data', async () => {
  const h = createJourney({actor: ADMIN, admin: true}), held = deferred();
  try {
    await h.settle(); h.setState(USER, (_ctx, now) => {const state = emptyReversoState({subject: USER, now});
      state.sections.wallet = available({currency: 'BRL', availableMinor: 876543, balanceMinor: null, pendingMinor: null, reservedMinor: null, debitAuthorized: false}, {mode: 'demo', observedAt: new Date(now).toISOString()}); return state;});
    h.setStateHook(() => held.promise); h.selectCustomer(USER); await h.settle(); h.setAdmin(false); held.resolve(); await h.settle();
    assert.match(h.text(), /Não foi possível confirmar/); assert.doesNotMatch(h.text(), /8\.765,43/);
  } finally {held.resolve(); h.unmount();}
});

test('HTTP integration refuses browser-selected payer and owner before source access', async () => {
  const h = createJourney(), auth = {Authorization: 'Bearer synthetic-token-' + USER};
  try {
    const before = h.sourceCalls.length;
    const owner = await h.fetcher('/api/platform/reverso/subscription?subject=' + OTHER, {headers: auth}); assert.equal(owner.status, 400);
    const payer = await h.fetcher('/api/platform/reverso/subscription', {method: 'POST', headers: {...auth, 'Content-Type': 'application/json', 'X-Jenios-Reverso-Intent': 'subscription'},
      body: JSON.stringify({action: 'prepare', requestKey: OTHER, offer: offer(), accept: true, payer: {name: 'synthetic'}})});
    assert.equal(payer.status, 400); assert.equal(h.sourceCalls.length, before);
  } finally {h.unmount();}
});

test('client adapter rejects stale, cross-owner and real-action capability responses', async () => {
  const auth = {getSession: async () => ({data: {session: {user: {id: USER}, access_token: 'synthetic-token'}}}), getUser: async () => ({data: {user: {id: USER}}})};
  for (const mutate of [v => v.subject = OTHER, v => v.mode = 'live', v => v.capabilities.realBillingAllowed = true,
    v => v.validUntil = new Date(NOW).toISOString(), v => v.capabilities.actualExecutionAuthorized = true]) {
    const state = view(USER); mutate(state);
    const api = createReversoSubscriptionClient({subject: USER, auth, now: () => NOW, fetchImpl: async () => Response.json(state)});
    await assert.rejects(api.status(), /RESPONSE_INVALID/);
  }
});

test('a response lost after prepare is recovered by requestKey without another POST', async () => {
  const h = createJourney();
  try {
    await quoteAndAccept(h); h.loseNextResponse('prepare'); await h.click('Confirmar contratação demonstrativa'); await h.settle();
    const key = prepares(h)[0].body.requestKey;
    assert.match(h.text(), /tentativa ainda sem resultado confirmado/); assert.equal(h.records.get(USER).length, 1);
    await h.click('Consultar a mesma tentativa'); await h.settle();
    assert.ok(h.requests.some(r => r.url.endsWith('?requestKey=' + key))); assert.equal(prepares(h).length, 1);
    assert.match(h.text(), /Pedido demonstrativo/); assert.doesNotMatch(h.text(), /tentativa ainda sem resultado/);
  } finally {h.unmount();}
});

test('absence during lookup preserves requestKey and exact accepted offer for explicit replay', async () => {
  const h = createJourney();
  try {
    await quoteAndAccept(h, 'year'); h.failNextBefore('prepare'); await h.click('Confirmar contratação demonstrativa'); await h.settle();
    const original = prepares(h)[0].body; h.advance(31000); await h.settle();
    await h.click('Consultar a mesma tentativa'); await h.settle();
    assert.match(h.text(), /não confirma que a tentativa anterior foi rejeitada/);
    await h.click('Repetir a mesma tentativa demonstrativa'); await h.settle();
    assert.equal(prepares(h).length, 2); assert.deepEqual(prepares(h)[1].body, original); assert.equal(h.records.get(USER).length, 1);
    assert.match(h.text(), /Preparado em demonstração/);
  } finally {h.unmount();}
});

test('a changed dedicated session discards the old completed order and isolates the new owner', async () => {
  const h = createJourney(), held = deferred();
  try {
    await quoteAndAccept(h); h.setSourceHook(({input}) => input.action === 'prepare' ? held.promise : undefined);
    const pending = h.click('Confirmar contratação demonstrativa'); await h.settle();
    h.setActor(OTHER); h.advance(0); await h.settle(); held.resolve(); await pending; await h.settle();
    assert.equal(h.records.get(USER).length, 1); assert.equal(h.records.get(OTHER)?.length || 0, 0);
    assert.doesNotMatch(h.text(), /Pedido demonstrativo|Preparado em demonstração/);
    assert.equal(h.button('Selecionar mensal').props.disabled, false);
  } finally {held.resolve(); h.unmount();}
});

test('paid test history and preserved access period remain separate from ending or revoking the right', async () => {
  const h = createJourney();
  try {
    await quoteAndAccept(h); await h.click('Confirmar contratação demonstrativa'); await h.settle();
    const order = h.records.get(USER)[0].order;
    Object.assign(order, {status: 'paid', paymentStatus: 'recorded_in_test', cancelAtPeriodEnd: false,
      periodStart: '2026-11-12T22:00:00Z', periodEnd: '2026-12-12T22:00:00Z'});
    await h.click('Consultar pedido'); await h.settle();
    assert.match(h.text(), /Registro em teste; sem confirmação financeira atual/); assert.doesNotMatch(h.text(), /Pagamento recebido/);
    await h.click('Registrar encerramento ao fim da vigência'); await h.settle();
    assert.equal(order.periodStart, '2026-11-12T22:00:00Z'); assert.equal(order.periodEnd, '2026-12-12T22:00:00Z');
    assert.equal(order.cancelAtPeriodEnd, true); assert.match(h.text(), /Previsto; período pago preservado/);
    Object.assign(order, {status: 'cancelled', cancelled: true, periodStart: null, periodEnd: null});
    await h.click('Consultar pedido'); await h.settle();
    assert.match(h.text(), /Pedido\s+Cancelado/); assert.match(h.text(), /Pagamento\s+Registro em teste/);
    assert.doesNotMatch(h.text(), /Pagamento\s+Cancelado|Estorno registrado/);
  } finally {h.unmount();}
});

test('a prepared candidate order is voided by the fixture without payment or real access', async () => {
  const h = createJourney();
  try {
    await quoteAndAccept(h); await h.click('Confirmar contratação demonstrativa'); await h.settle();
    await h.click('Anular pedido demonstrativo ainda não enviado'); await h.settle();
    assert.match(h.text(), /Anulado antes do envio/); assert.match(h.text(), /Pagamento\s+Cancelado/);
    assert.doesNotMatch(h.text(), /Pagamento recebido|Acesso ao Reverso\s+Liberado/);
  } finally {h.unmount();}
});

for (const [interval, amount] of [['month', 1990], ['year', 19900]]) test('authenticated manual ' + interval + ' journey quotes, accepts and prepares only a synthetic order', async () => {
  const h = createJourney();
  try {
    await quoteAndAccept(h, interval);
    const confirmed = h.click('Confirmar contratação demonstrativa'), duplicate = h.click('Confirmar contratação demonstrativa');
    await Promise.all([confirmed, duplicate]); await h.settle();
    assert.equal(prepares(h).length, 1); assert.equal(h.records.get(USER).length, 1);
    const body = prepares(h)[0].body;
    assert.deepEqual(Object.keys(body).sort(), ['accept', 'action', 'offer', 'requestKey']);
    assert.equal(body.offer.interval, interval); assert.equal(body.offer.amount_cents, amount); assert.equal(body.accept, true);
    assert.equal(prepares(h)[0].headers['x-jenios-reverso-intent'], 'subscription');
    assert.equal(prepares(h)[0].headers.origin, 'https://jenios.fixture');
    assert.match(h.text(), /Preparado em demonstração/); assert.match(h.text(), /Pagamento\s+Pendente/);
    assert.match(h.text(), /Início da vigência\s+Pendente/); assert.match(h.text(), /Previsto; período pago preservado/);
    assert.doesNotMatch(h.text(), /Pagamento recebido|QR Code|Pix copia|Acesso ao Reverso\s+Liberado/);
    assert.equal(findAll(h.tree, n => n.type === 'input' && n.props.type !== 'checkbox').length, 0);
    assert.ok(h.requests.every(r => !/[?&](subject|customer|payer)=/.test(r.url)));
  } finally {h.unmount();}
});

test('a missing host disables candidate choices and never posts or invents a zero balance', async () => {
  const h = createJourney(); h.setUnavailable(true);
  try {
    await h.settle(); assert.equal(h.button('Selecionar mensal').props.disabled, true); assert.equal(h.button('Selecionar anual').props.disabled, true);
    assert.match(h.text(), /contratação ainda não está habilitada/); assert.doesNotMatch(h.text(), /R\$\s*0,00/);
    assert.equal(h.requests.some(r => r.method === 'POST'), false);
    h.setUnavailable(false); await h.click('Consultar disponibilidade'); await h.settle();
    assert.equal(h.button('Selecionar mensal').props.disabled, false);
  } finally {h.unmount();}
});

test('an expired capability removes offer and acceptance while the authenticated quote is pending', async () => {
  const h = createJourney(), held = deferred();
  try {
    await quoteAndAccept(h); h.setSourceHook(({input}) => input.action === 'quote' ? held.promise : undefined);
    h.advance(30000); h.render();
    assert.match(h.text(), /Consultando o pedido/); assert.equal(findAll(h.tree, n => n.type === 'input' && n.props.type === 'checkbox').length, 0);
    assert.equal(h.button('Selecionar mensal').props.disabled, true); assert.equal(prepares(h).length, 0);
    held.resolve(); await h.settle(); assert.equal(h.button('Confirmar contratação demonstrativa').props.disabled, true);
  } finally {held.resolve(); h.unmount();}
});

test('a tab remount recovers an uncertain accepted order from its persisted reference without another POST', async () => {
  const storage = new Map(), records = new Map(), original = createJourney({storage, records});
  let resumed;
  try {
    await quoteAndAccept(original); original.loseNextResponse('prepare'); await original.click('Confirmar contratação demonstrativa'); await original.settle();
    const prepared = prepares(original)[0].body;
    assert.equal(storage.size, 1); assert.doesNotMatch([...storage.values()][0], /access_token|synthetic-token|payer/);
    original.unmount(); resumed = createJourney({storage, records}); await resumed.settle();
    assert.ok(resumed.requests.some(r => r.url.endsWith('?requestKey=' + prepared.requestKey)));
    assert.equal(prepares(resumed).length, 0); assert.equal(records.get(USER).length, 1);
    assert.match(resumed.text(), /Preparado em demonstração/); assert.equal(storage.size, 0);
  } finally {original.unmount(); resumed?.unmount();}
});

test('a tab remount with an absent order preserves the exact accepted offer and request key for replay', async () => {
  const storage = new Map(), records = new Map(), original = createJourney({storage, records});
  let resumed;
  try {
    await quoteAndAccept(original, 'year'); original.failNextBefore('prepare'); await original.click('Confirmar contratação demonstrativa'); await original.settle();
    const prepared = prepares(original)[0].body;
    original.unmount(); resumed = createJourney({storage, records}); await resumed.settle();
    assert.match(resumed.text(), /não confirma que a tentativa anterior foi rejeitada/);
    assert.equal(resumed.button('Selecionar mensal').props.disabled, true);
    await resumed.click('Repetir a mesma tentativa demonstrativa'); await resumed.settle();
    assert.deepEqual(prepares(resumed)[0].body, prepared); assert.equal(records.get(USER).length, 1); assert.equal(storage.size, 0);
  } finally {original.unmount(); resumed?.unmount();}
});

test('unreadable or unwritable recovery storage blocks new preparation without sending a POST', async () => {
  const unreadable = createJourney({storage: {get() {throw Error('synthetic unavailable storage');}}});
  const unwritable = createJourney();
  try {
    await unreadable.settle(); assert.match(unreadable.text(), /uma nova contratação está bloqueada/);
    assert.equal(unreadable.button('Selecionar mensal').props.disabled, true); assert.equal(prepares(unreadable).length, 0);
    await quoteAndAccept(unwritable); unwritable.storage.set = () => {throw Error('synthetic storage quota failure');};
    await unwritable.click('Confirmar contratação demonstrativa'); await unwritable.settle();
    assert.match(unwritable.text(), /pedido não foi enviado/); assert.equal(prepares(unwritable).length, 0);
    assert.equal(unwritable.records.get(USER).length, 0);
  } finally {unreadable.unmount(); unwritable.unmount();}
});

test('an uncertain intent in the same tab is isolated from a different authenticated owner', async () => {
  const storage = new Map(), records = new Map(), original = createJourney({storage, records});
  let other;
  try {
    await quoteAndAccept(original); original.failNextBefore('prepare'); await original.click('Confirmar contratação demonstrativa'); await original.settle();
    const saved = [...storage.entries()]; original.unmount(); other = createJourney({storage, records, actor: OTHER}); await other.settle();
    assert.equal(other.requests.some(r => r.url.includes('requestKey=')), false); assert.doesNotMatch(other.text(), /tentativa ainda sem resultado/);
    assert.deepEqual([...storage.entries()], saved); assert.equal(other.button('Selecionar mensal').props.disabled, false);
  } finally {original.unmount(); other?.unmount();}
});

test('capability expiry during session resolution prevents the authenticated POST', async () => {
  let now = NOW, calls = 0;
  const auth = {getSession: async () => {now += 30001; return {data: {session: {user: {id: USER}, access_token: 'synthetic-token'}}};}, getUser: async () => ({data: {user: {id: USER}}})};
  const api = createReversoSubscriptionClient({subject: USER, auth, now: () => now, fetchImpl: async () => {calls++; return Response.json(view(USER));}});
  const source = view(USER, {kind: 'quote', offer: offer()});
  await assert.rejects(api.prepare({requestKey: OTHER, offer: source.offer, accept: true}, source)); assert.equal(calls, 0);
});
