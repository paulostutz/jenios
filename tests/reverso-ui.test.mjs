import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import {emptyReversoState, validateReversoState} from '../lib/platform/reverso/state-contract.mjs';
import {formatFinancialAmount} from '../lib/platform/ultra/client/reporting.mjs';

const require = createRequire(import.meta.url), React = require('react');
const {transformSync} = require('next/dist/build/swc');
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return {promise, resolve}; };
const first = '11111111-1111-4111-8111-111111111111';
const second = '22222222-2222-4222-8222-222222222222';
const stamp = () => new Date().toISOString();
const section = (data, mode = 'live') => ({status: 'available', mode, observedAt: stamp(), data});

function harness({sessionUser = first, now = Date.now(), fetcher = async () => ({ok: true, json: async () => emptyReversoState({subject: first})})} = {}) {
  const values = [], effects = [], pending = [], events = new Map(), timers = new Map();
  let cursor = 0, authCallback, user = sessionUser, clock = now, timerId = 0;
  class ClockDate extends Date { constructor(...args) { super(...(args.length ? args : [clock])); } static now() { return clock; } }
  const hooks = {...React,
    useState(initial) { const i = cursor++; if (!(i in values)) values[i] = typeof initial === 'function' ? initial() : initial; return [values[i], next => { values[i] = typeof next === 'function' ? next(values[i]) : next; }]; },
    useRef(initial) { const i = cursor++; if (!(i in values)) values[i] = {current: initial}; return values[i]; },
    useCallback(fn, deps) { const i = cursor++, old = values[i]; if (!old || deps.some((v, n) => !Object.is(v, old.deps[n]))) values[i] = {fn, deps}; return values[i].fn; },
    useEffect(fn, deps) { const i = cursor++, old = effects[i]; if (!old || deps.some((v, n) => !Object.is(v, old.deps[n]))) { old?.cleanup?.(); effects[i] = {deps}; pending.push(() => { effects[i].cleanup = fn(); }); } },
  };
  const platformSupabase = {auth: {
    getSession: async () => ({data: {session: user ? {access_token: 'fixture-token', user: {id: user}} : null}}),
    getUser: async () => ({data: {user: user ? {id: user} : null}}),
    onAuthStateChange(callback) { authCallback = callback; return {data: {subscription: {unsubscribe() {}}}}; },
  }};
  const module = {exports: {}};
  const code = transformSync(readFileSync('app/components/platform/PlatformReversoFinance.js', 'utf8'), {
    jsc: {parser: {syntax: 'ecmascript', jsx: true}, target: 'es2022', transform: {react: {runtime: 'automatic'}}}, module: {type: 'commonjs'},
  }).code;
  const context = vm.createContext({module, exports: module.exports, AbortController, Intl, Date: ClockDate, fetch: fetcher,
    window: {
      addEventListener: (name, fn) => events.set(name, fn), removeEventListener: name => events.delete(name),
      setTimeout(fn, delay) { const id = ++timerId; timers.set(id, {at: clock + delay, fn}); return id; },
      clearTimeout(id) { timers.delete(id); },
    },
    require(name) {
      if (name === 'react') return hooks;
      if (name === 'react/jsx-runtime') return require(name);
      if (name === 'next/link') return {__esModule: true, default: props => React.createElement('a', props)};
      if (name.endsWith('supabase-client')) return {platformSupabase};
      if (name.endsWith('state-contract.mjs')) return {validateReversoState};
      if (name.endsWith('client/reporting.mjs')) return {formatFinancialAmount};
      if (name.endsWith('BrandSignature')) return {BrandLockup: () => 'JENIOS', BrandFooter: () => 'JENIOS'};
      if (name.endsWith('PlatformReversoSubscription')) return {__esModule: true, default: props => props.renderOffers?.({})};
      if (name.endsWith('.css')) return new Proxy({}, {get: (_, key) => String(key)});
      throw Error(name);
    },
  });
  new vm.Script(code).runInContext(context);
  return {
    render(props, name = 'ReversoFinancePanel') { cursor = 0; const tree = module.exports[name](props); for (const effect of pending.splice(0)) effect(); return tree; },
    view(props) { return module.exports.ReversoFinanceView(props); },
    offers() { return module.exports.ReversoPlanOffers(); },
    focus() { events.get('focus')?.(); },
    advance(ms) {
      const end = clock + ms;
      for (;;) {
        const next = [...timers.entries()].sort((a, b) => a[1].at - b[1].at).find(([, timer]) => timer.at <= end);
        if (!next) break;
        const [id, timer] = next; clock = timer.at; timers.delete(id); timer.fn();
      }
      clock = end;
    },
    timerCount() { return timers.size; },
    unmount() { for (const effect of effects) effect?.cleanup?.(); },
    auth(next, event = 'SIGNED_IN') { user = next; authCallback?.(event, next ? {user: {id: next}} : null); },
  };
}

function expand(node) {
  if (Array.isArray(node)) return node.map(expand);
  if (!node || typeof node !== 'object') return node;
  if (typeof node.type === 'function') return expand(node.type(node.props));
  return {...node, props: {...node.props, children: expand(node.props?.children)}};
}
function content(node) {
  if (Array.isArray(node)) return node.map(content).join(' ');
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  return typeof node === 'object' ? content(node.props?.children) : String(node);
}
function find(node, predicate) {
  if (Array.isArray(node)) { for (const child of node) { const result = find(child, predicate); if (result) return result; } return null; }
  if (!node || typeof node !== 'object') return null;
  return predicate(node) ? node : find(node.props?.children, predicate);
}
function snapshot(subject, balance) {
  const state = emptyReversoState({subject});
  state.sections.wallet = section({currency: 'BRL', balanceMinor: balance, reservedMinor: 0, availableMinor: balance, debitAuthorized: false});
  return state;
}

test('Reverso offers show approved amounts and annual single-payment duration', () => {
  const body = content(expand(harness().offers()));
  assert.match(body, /R\$ 19,90/); assert.match(body, /R\$ 199,00/);
  assert.match(body, /Pagamento único por 12 meses/); assert.match(body, /vigência começa na confirmação do pagamento/);
  assert.match(body, /20%/); assert.match(body, /10%/);
});

test('Reverso unavailable financial sections never display invented zero balances', async () => {
  const h = harness(), props = {subject: first, load: async () => emptyReversoState({subject: first})};
  h.render(props); await tick();
  const body = content(expand(h.render(props)));
  assert.match(body, /Fonte autorizada indisponível/); assert.doesNotMatch(body, /0,00/);
});

test('Reverso panel shows confirmed wallet amounts without pretending a broker balance', async () => {
  const h = harness(), props = {subject: first, load: async () => snapshot(first, 12345)};
  h.render(props); await tick();
  const body = content(expand(h.render(props)));
  assert.match(body, /123,45/); assert.match(body, /Carteira da plataforma/);
});

test('Reverso wallet preserves pending amounts instead of converting them to zero', () => {
  const state = emptyReversoState({subject: first});
  state.sections.wallet = section({currency: 'BRL', balanceMinor: null, pendingMinor: null, reservedMinor: null, availableMinor: null, debitAuthorized: false});
  const body = content(expand(harness().view({state: validateReversoState(state, {subject: first})})));
  assert.match(body, /Valores pendentes/); assert.equal(body.match(/Pendente/g)?.length, 4);
  assert.doesNotMatch(body, /R\$\s*0,00/);
});

test('Reverso wallet displays an actual confirmed zero as zero', () => {
  const state = emptyReversoState({subject: first});
  state.sections.wallet = section({currency: 'BRL', balanceMinor: 0, pendingMinor: 0, reservedMinor: 0, availableMinor: 0, debitAuthorized: false});
  const body = content(expand(harness().view({state: validateReversoState(state, {subject: first})})));
  assert.equal(body.match(/R\$\s*0,00/g)?.length, 4); assert.doesNotMatch(body, /Pendente/);
});

test('Reverso panel discards stale results when the subject changes', async () => {
  const h = harness(), old = deferred(), current = deferred();
  h.render({subject: first, load: () => old.promise});
  const props = {subject: second, load: () => current.promise};
  h.render(props); current.resolve(snapshot(second, 777)); await tick();
  old.resolve(snapshot(first, 99999)); await tick();
  const body = content(expand(h.render(props)));
  assert.match(body, /7,77/); assert.doesNotMatch(body, /999,99/);
});

test('Reverso refresh reads the source again and clears an invalid response', async () => {
  const h = harness(); let reads = 0;
  const props = {subject: first, load: async () => ++reads === 1 ? snapshot(first, 12345) : {...snapshot(first, 23456), robotId: 'ultra'}};
  h.render(props); await tick(); h.render(props); h.focus(); await tick();
  const body = content(expand(h.render(props)));
  assert.equal(reads, 2); assert.match(body, /Não foi possível confirmar/); assert.doesNotMatch(body, /123,45|234,56/);
});

test('An assessed obligation is never presented as a received payment', () => {
  const state = emptyReversoState({subject: first});
  state.sections.obligations = section([{id: 'obligation', robotId: 'reverso', month: '2026-11', currency: 'BRL', amountMinor: 2000, status: 'assessed', paymentStatus: 'pending', paymentConfirmed: false, paidAt: null}]);
  const body = content(expand(harness().view({state})));
  assert.match(body, /Apurada/); assert.match(body, /Não confirmado/); assert.doesNotMatch(body, /Pagamento recebido/);
});

test('An unverified paid status does not become payment received', () => {
  const state = emptyReversoState({subject: first});
  state.sections.obligations = section([{id: 'obligation', month: '2026-11', currency: 'BRL', amountMinor: 2000, status: 'paid', paymentStatus: 'paid', paymentConfirmed: false, paidAt: stamp()}]);
  const body = content(expand(harness().view({state})));
  assert.match(body, /Não confirmado/); assert.doesNotMatch(body, /Pagamento recebido/);
});

test('Demo payment evidence is visibly demonstrated, not real receipt', () => {
  const state = emptyReversoState({subject: first});
  state.sections.obligations = section([{id: 'obligation', month: '2026-11', currency: 'BRL', amountMinor: 2000, status: 'paid', paymentStatus: 'paid', paymentConfirmed: true, paidAt: stamp()}], 'demo');
  const body = content(expand(harness().view({state})));
  assert.match(body, /Recebimento demonstrativo/); assert.doesNotMatch(body, /Pagamento recebido/);
});

test('Receipt-confirmed live payment is distinct from an assessment', () => {
  const state = emptyReversoState({subject: first});
  state.sections.obligations = section([{id: 'obligation', month: '2026-11', currency: 'BRL', amountMinor: 2000, status: 'assessed', paymentStatus: 'paid', paymentConfirmed: true, paidAt: stamp()}]);
  const body = content(expand(harness().view({state})));
  assert.match(body, /Apurada/); assert.match(body, /Pagamento recebido/);
});

test('An active demo entitlement cannot be advertised as released real access', () => {
  const state = emptyReversoState({subject: first});
  state.sections.entitlement = section({planName: 'Reverso mensal', status: 'active', paymentStatus: 'paid', accessGranted: true, performanceRate: 20, periodStart: stamp(), periodEnd: stamp()}, 'demo');
  const body = content(expand(harness().view({state})));
  assert.match(body, /Demonstrativo/); assert.doesNotMatch(body, /Liberado/);
});

test('Incomplete costs cannot show a calculated net result or participation', () => {
  const state = emptyReversoState({subject: first});
  state.sections.operations = section({rows: [{id: 'op', robotId: 'reverso', accountId: 'account', environment: 'demo', provider: 'binance', currency: 'BRL', symbol: 'TESTBRL', state: 'closed', month: '2026-11', gross: '120.00000000', fees: null, financing: null, net: '999.00000000', costsComplete: false}], costsPending: 1, hasMore: false, summaries: []});
  const body = content(expand(harness().view({state})));
  assert.match(body, /Custos pendentes/); assert.doesNotMatch(body, /999,00/);
});

test('Competence filter only uses the server attribution and leaves unassigned operations out', () => {
  const state = emptyReversoState({subject: first});
  state.sections.operations = section({rows: [
    {id: 'november', accountId: 'account', symbol: 'NOVEMBER', month: '2026-11', currency: 'BRL', costsComplete: false},
    {id: 'unassigned', accountId: 'account', symbol: 'UNASSIGNED', month: null, closedAt: '2026-11-12T10:00:00.000Z', currency: 'BRL', costsComplete: false},
    {id: 'october', accountId: 'account', symbol: 'OCTOBER', month: '2026-10', currency: 'BRL', costsComplete: false},
  ], costsPending: 3, hasMore: false, summaries: []});
  const body = content(expand(harness().view({state, period: '2026-11'})));
  assert.match(body, /NOVEMBER/); assert.doesNotMatch(body, /UNASSIGNED|OCTOBER/);
});

test('Monthly operation snapshots retain separate rendered identities across months and connections', () => {
  const state = emptyReversoState({subject: first});
  const row = {id: 'carried-operation', robotId: 'reverso', accountId: 'account', connectionId: 'connection',
    environment: 'demo', provider: 'profit', currency: 'BRL', costsComplete: false, net: null};
  state.sections.operations = section({rows: [
    {...row, month: '2026-11', symbol: 'CLOSED-NOVEMBER', state: 'closed'},
    {...row, month: '2026-10', symbol: 'OPEN-OCTOBER', state: 'open'},
    {...row, month: '2026-11', connectionId: 'another-connection', symbol: 'OTHER-CONNECTION', state: 'unknown'},
  ], costsPending: 2, hasMore: false}, 'demo');
  const tree = expand(harness().view({state})), rows = find(tree, node => node.type === 'tbody').props.children;
  assert.equal(rows.length, 3); assert.equal(new Set(rows.map(node => node.key)).size, 3);
  assert.match(content(tree), /CLOSED-NOVEMBER/); assert.match(content(tree), /OPEN-OCTOBER/); assert.match(content(tree), /OTHER-CONNECTION/);
  const selected = content(expand(harness().view({state, period: '2026-10'})));
  assert.match(selected, /OPEN-OCTOBER/); assert.doesNotMatch(selected, /CLOSED-NOVEMBER|OTHER-CONNECTION/);
});

test('A truncated monthly report does not claim no operations and pending counts follow the selected month', () => {
  const state = emptyReversoState({subject: first});
  state.sections.operations = section({rows: [
    {id: 'new', accountId: 'account', symbol: 'NOVEMBER', month: '2026-11', currency: 'BRL', state: 'unknown', costsComplete: false},
    {id: 'old', accountId: 'account', symbol: 'OCTOBER', month: '2026-10', currency: 'BRL', state: 'closed', costsComplete: false},
  ], costsPending: 2, hasMore: true}, 'demo');
  const recent = content(expand(harness().view({state, period: '2026-11'})));
  assert.match(recent, /1\s+operações aguardam custos ou confirmação/); assert.doesNotMatch(recent, /2\s+operações aguardam/);
  const older = content(expand(harness().view({state, period: '2026-09'})));
  assert.match(older, /Nenhuma operação desta competência está presente no recorte carregado/);
  assert.match(older, /Há mais operações no relatório do executor/);
  assert.doesNotMatch(older, /Nenhuma operação vinculada|Nenhuma operação registrada|operações aguardam/);
});

test('Client state load uses the authenticated endpoint without browser-chosen subject', async () => {
  const requests = [], h = harness({fetcher: async (url, options) => { requests.push({url, options}); return {ok: true, json: async () => emptyReversoState({subject: first})}; }});
  h.render({}, 'default'); await tick(); const tree = h.render({}, 'default');
  const panel = find(tree, node => node.type?.name === 'ReversoFinancePanel');
  await panel.props.load(new AbortController().signal);
  assert.equal(requests.length, 1); assert.equal(requests[0].url, '/api/platform/reverso/state');
  assert.equal(requests[0].options.cache, 'no-store'); assert.equal(requests[0].options.method, undefined);
});

test('State load refuses an identity changed while the response was in flight', async () => {
  const pending = deferred(), h = harness({fetcher: () => pending.promise});
  h.render({}, 'default'); await tick(); const tree = h.render({}, 'default');
  const panel = find(tree, n => n.type?.name === 'ReversoFinancePanel');
  const loading = panel.props.load(new AbortController().signal);
  await tick(); h.auth(second);
  pending.resolve({ok: true, json: async () => snapshot(first, 12345)});
  await assert.rejects(loading, /SESSION_CHANGED/);
});

test('Admin selection survives token renewal but is cleared on identity change', async () => {
  const h = harness(); h.render({admin: true}, 'default'); await tick();
  let tree = h.render({admin: true}, 'default');
  find(tree, n => n.type === 'input').props.onChange({target: {value: second}});
  tree = h.render({admin: true}, 'default'); find(tree, n => n.type === 'form').props.onSubmit({preventDefault() {}});
  tree = h.render({admin: true}, 'default'); assert.equal(find(tree, n => n.type?.name === 'ReversoFinancePanel').props.subject, second);
  h.auth(first, 'TOKEN_REFRESHED'); tree = h.render({admin: true}, 'default'); assert.equal(find(tree, n => n.type?.name === 'ReversoFinancePanel').props.subject, second);
  h.auth(second); tree = h.render({admin: true}, 'default'); assert.equal(find(tree, n => n.type?.name === 'ReversoFinancePanel').props.subject, null);
});

test('Admin request is an explicit read scoped to the selected customer', async () => {
  const requests = [], h = harness({fetcher: async (url, options) => { requests.push({url, options}); return {ok: true, json: async () => emptyReversoState({subject: second})}; }});
  h.render({admin: true}, 'default'); await tick();
  let tree = h.render({admin: true}, 'default');
  assert.equal(requests.length, 0);
  find(tree, n => n.type === 'input').props.onChange({target: {value: second}});
  tree = h.render({admin: true}, 'default'); find(tree, n => n.type === 'form').props.onSubmit({preventDefault() {}});
  tree = h.render({admin: true}, 'default');
  await find(tree, n => n.type?.name === 'ReversoFinancePanel').props.load(new AbortController().signal);
  assert.equal(requests.length, 1); assert.equal(requests[0].url, '/api/platform/admin/robots/reverso?subject=' + second);
  assert.equal(requests[0].options.method, undefined); assert.equal(requests[0].options.body, undefined);
});

const fixedNow = Date.parse('2026-11-12T22:00:00.000Z');
function authorizedSnapshot({subject = first, now = fixedNow, generatedAgo = 0, observedAgo = 0, sourceFor = 90000, periodFor = 3600000} = {}) {
  const state = emptyReversoState({subject, now: now - generatedAgo});
  state.sections.entitlement = {status: 'available', mode: 'live', observedAt: new Date(now).toISOString(), data: {
    robotId: 'reverso', planId: 'platform-reverso-monthly', planName: 'Reverso mensal', status: 'active',
    paymentStatus: 'confirmed', accessGranted: true, performanceRate: 20, cancelAtPeriodEnd: false,
    periodStart: new Date(now - 3600000).toISOString(), periodEnd: new Date(now + periodFor).toISOString(),
    sourceValidUntil: new Date(now + sourceFor).toISOString(), reason: null,
  }};
  state.sections.wallet = {status: 'available', mode: 'live', observedAt: new Date(now - observedAgo).toISOString(), data: {
    currency: 'BRL', balanceMinor: 12345, reservedMinor: 0, availableMinor: 12345, pendingMinor: 0, debitAuthorized: false,
  }};
  return state;
}

test('Reverso shows the confirmed historical contract price without replacing it by the current catalog', () => {
  const state = authorizedSnapshot();
  Object.assign(state.sections.entitlement.data, {amountCents: 14990, currency: 'BRL', interval: 'contract'});
  const body = content(expand(harness().view({state: validateReversoState(state, {subject: first, now: fixedNow})})));
  assert.match(body, /Valor contratado.*149,90/); assert.match(body, /Modalidade.*Contrato anterior/);
  assert.doesNotMatch(body, /19,90|199,00/);
});

test('Reverso leaves the price and modality pending when the contract does not provide them', () => {
  const state = authorizedSnapshot();
  const body = content(expand(harness().view({state: validateReversoState(state, {subject: first, now: fixedNow})})));
  assert.match(body, /Valor contratado Pendente/); assert.match(body, /Modalidade Pendente/);
  assert.doesNotMatch(body, /19,90|199,00/);
});

test('Reverso displays the actual monthly and annual payment modalities', () => {
  for (const [interval, amountCents, expected] of [['month', 1990, /Modalidade Mensal/], ['year', 19900, /Modalidade Pagamento único por 12 meses/]]) {
    const state = authorizedSnapshot();
    Object.assign(state.sections.entitlement.data, {amountCents, currency: 'BRL', interval});
    const body = content(expand(harness().view({state: validateReversoState(state, {subject: first, now: fixedNow})})));
    assert.match(body, expected);
  }
});

test('A manual native plan shows its scheduled end without implying cancellation or automatic renewal', () => {
  for (const [interval, amountCents] of [['month', 1990], ['year', 19900]]) {
    const state = authorizedSnapshot();
    Object.assign(state.sections.entitlement.data, {amountCents, currency: 'BRL', interval, cancelAtPeriodEnd: true});
    const render = () => content(expand(harness().view({state: validateReversoState(state, {subject: first, now: fixedNow})})));
    const manual = render();
    assert.match(manual, /Encerramento ao fim da vigência\s+Previsto; período pago preservado/);
    assert.match(manual, /Plano\s+Ativo/); assert.match(manual, /Acesso ao Reverso\s+Liberado/);
    assert.doesNotMatch(manual, /Cancelamento ao fim|Cancelado|renovação automática/i);
    state.sections.entitlement.data.cancelAtPeriodEnd = false;
    const unspecified = render();
    assert.match(unspecified, /Encerramento ao fim da vigência\s+Sem indicação na fonte/);
    assert.doesNotMatch(unspecified, /Cancelamento ao fim|Cancelado|Previsto; período pago preservado|renovação automática/i);
  }
});

for (const scenario of [
  {name: 'snapshot generation freshness', change: {generatedAgo: 45000}, expiresIn: 15000},
  {name: 'an individual financial section freshness', change: {observedAgo: 50000}, expiresIn: 10000},
  {name: 'the authorized access source deadline', change: {sourceFor: 30000}, expiresIn: 30000},
  {name: 'the active paid period end', change: {periodFor: 5000}, expiresIn: 5000},
]) test('Reverso clears access at ' + scenario.name + ' before refreshing', async () => {
  const h = harness({now: fixedNow}), next = deferred(); let reads = 0;
  const props = {subject: first, load: async () => ++reads === 1 ? authorizedSnapshot(scenario.change) : next.promise};
  h.render(props); await tick();
  assert.match(content(expand(h.render(props))), /Liberado/);
  assert.equal(h.timerCount(), 1);
  h.advance(scenario.expiresIn - 1);
  assert.equal(reads, 1); assert.match(content(expand(h.render(props))), /Liberado/);
  h.advance(1);
  const loading = content(expand(h.render(props)));
  assert.equal(reads, 2); assert.equal(h.timerCount(), 0);
  assert.match(loading, /Consultando os dados autorizados/); assert.doesNotMatch(loading, /Liberado|123,45/);
  next.resolve(emptyReversoState({subject: first, now: fixedNow + scenario.expiresIn})); await tick();
  const recovered = content(expand(h.render(props)));
  assert.match(recovered, /Fonte autorizada indisponível/); assert.doesNotMatch(recovered, /Liberado|123,45/);
  h.unmount(); assert.equal(h.timerCount(), 0);
});

test('Reverso expires a stale response instead of scheduling an immediate refresh loop', async () => {
  const h = harness({now: fixedNow}), response = deferred();
  const props = {subject: first, load: () => response.promise};
  h.render(props); h.advance(60000);
  response.resolve(authorizedSnapshot()); await tick();
  const body = content(expand(h.render(props)));
  assert.match(body, /Não foi possível confirmar/); assert.doesNotMatch(body, /Liberado|123,45/);
  assert.equal(h.timerCount(), 0);
});

test('Reverso cancels the previous subject expiry timer and cleans up on unmount', async () => {
  const h = harness({now: fixedNow}); let firstReads = 0, secondReads = 0, oldSignal;
  h.render({subject: first, load: async signal => { oldSignal = signal; firstReads++; return authorizedSnapshot({sourceFor: 5000}); }}); await tick();
  assert.equal(h.timerCount(), 1);
  const props = {subject: second, load: async () => { secondReads++; return authorizedSnapshot({subject: second}); }};
  h.render(props); await tick();
  assert.equal(oldSignal.aborted, true); assert.equal(h.timerCount(), 1);
  h.advance(5000);
  assert.equal(firstReads, 1); assert.equal(secondReads, 1); assert.match(content(expand(h.render(props))), /Liberado/);
  h.unmount(); assert.equal(h.timerCount(), 0);
  h.advance(90000); assert.equal(firstReads, 1); assert.equal(secondReads, 1);
});

test('Reverso focus refresh replaces the previous expiration schedule', async () => {
  const h = harness({now: fixedNow}); let reads = 0;
  const props = {subject: first, load: async () => authorizedSnapshot(++reads === 1 ? {sourceFor: 5000} : {now: fixedNow + 1000})};
  h.render(props); await tick(); h.advance(1000); h.focus(); await tick();
  assert.equal(reads, 2); assert.equal(h.timerCount(), 1);
  h.advance(4000); assert.equal(reads, 2); assert.match(content(expand(h.render(props))), /Liberado/);
  h.unmount(); assert.equal(h.timerCount(), 0);
});
