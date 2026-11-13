import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {createReversoSubscriptionHandlerV2} from '../../lib/platform/reverso/subscription/http-v2.mjs';
import {REVERSO_SUBSCRIPTION_CAPABILITIES_V2} from '../../lib/platform/reverso/subscription/view-v2.mjs';
import {createReversoStateHandler} from '../../lib/platform/reverso/http.mjs';
import {emptyReversoState} from '../../lib/platform/reverso/state-contract.mjs';

const require = createRequire(import.meta.url), React = require('react'), {transformSync} = require('next/dist/build/swc');
export const USER = '11111111-1111-4111-8111-111111111111', OTHER = '22222222-2222-4222-8222-222222222222';
export const ADMIN = '33333333-3333-4333-8333-333333333333';
export const NOW = Date.parse('2026-11-12T22:00:00Z');
export const SYNTHETIC_PASSWORD = 'SyntheticOnly!42';
export const tick = () => new Promise(done => setImmediate(done));
export const deferred = () => {let resolve; const promise = new Promise(done => {resolve = done;}); return {promise, resolve};};
export function offer(interval = 'month') {
  const terms = 'Termos fictícios da jornada local: vigência a partir da confirmação, sem cobrança ou acesso reais.';
  return {product_code: interval === 'month' ? 'platform-reverso-monthly' : 'platform-reverso-annual', amount_cents: interval === 'month' ? 1990 : 19900,
    currency: 'BRL', terms_version: 'reverso-subscription-revfin001-v1', version: 'reverso-offer-2026-11-12-v1', producer_version: 'reverso-native-subscription-revfin001-v1',
    robot_id: 'reverso', interval, access_basis: 'central_confirmed_period', access_months: interval === 'month' ? 1 : 12,
    access_timezone: 'America/Sao_Paulo', payment_count: 1, installments: 1, performance_rate: 20, auto_renew: false, automatic_debit: false,
    terms_text: terms, terms_sha256: createHash('sha256').update(terms).digest('hex'), synthetic_only: true, production_enabled: false,
    period_start: '2026-11-12T03:00:00Z', period_end: interval === 'month' ? '2026-12-12T03:00:00Z' : '2027-11-12T03:00:00Z'};
}
export function view(subject, {kind = 'status', offer: quoted = null, order = null, now = NOW, replayed = false} = {}) {
  return {schema: 'REVERSO_SUBSCRIPTION_VIEW_V2', kind, platform: 'jenios', robotId: 'reverso', subject, mode: 'demo',
    observedAt: new Date(now).toISOString(), validUntil: new Date(now + 30000).toISOString(), capabilities: {...REVERSO_SUBSCRIPTION_CAPABILITIES_V2},
    offer: quoted, order, replayed};
}
export function text(node) {
  if (Array.isArray(node)) return node.map(text).join(' ');
  if (node == null || typeof node === 'boolean') return '';
  return typeof node === 'object' ? text(node.props?.children) : String(node);
}
export function findAll(node, predicate) {
  if (Array.isArray(node)) return node.flatMap(child => findAll(child, predicate));
  if (!node || typeof node !== 'object') return [];
  return [...(predicate(node) ? [node] : []), ...findAll(node.props?.children, predicate)];
}

/** Executes actual React components, dedicated guards and HTTP handlers with
 * synthetic sessions and an in-memory source. It is not a browser/layout test. */
export function createJourney({actor = USER, admin = false, socialMaster = false, storage = new Map(), records = new Map(),
  entryPath = null, adminAccessProps = null} = {}) {
  const root = resolve('.'), instances = new Map(), modules = new Map(), pendingEffects = [], authListeners = new Set(), events = new Map(), timers = new Map();
  const requests = [], sourceCalls = [], stateSources = new Map(), redirects = [], revoked = new Set(), signIns = [];
  let active, dirty = false, tree, clock = NOW, timerId = 0, sequence = 0, adminAllowed = true, unavailable = false, sourceHook, stateHook, loseResponse, failBefore;
  let anonymous = false, pagePath = entryPath || (admin ? '/platform/admin/robos/reverso' : '/platform/reverso'), refreshes = 0;
  const token = id => 'synthetic-token-' + id;
  const session = id => id ? {access_token: token(id), user: {id, is_anonymous: anonymous}} : null;
  const auth = {getSession: async () => ({data: {session: session(actor)}}), getUser: async () => ({data: {user: session(actor)?.user || null}}),
    async signInWithPassword({email, password}) {
      signIns.push({email});
      const id = {'cliente@reverso.example.invalid': USER, 'outro@reverso.example.invalid': OTHER,
        'admin@reverso.example.invalid': ADMIN, 'anonimo@reverso.example.invalid': USER}[email];
      if (!id || password !== SYNTHETIC_PASSWORD) return {data: {session: null}, error: Error('synthetic invalid credentials')};
      actor = id; anonymous = email === 'anonimo@reverso.example.invalid';
      for (const fn of authListeners) fn('SIGNED_IN', session(actor));
      return {data: {session: session(actor)}, error: null};
    },
    onAuthStateChange(fn) {authListeners.add(fn); return {data: {subscription: {unsubscribe: () => authListeners.delete(fn)}}};}};
  const getUser = async request => {
    const value = request.headers.get('authorization');
    const id = [USER, OTHER, ADMIN].find(id => value === 'Bearer ' + token(id));
    return id && !revoked.has(id) ? {id, is_anonymous: false} : null;
  };
  const requireAdmin = async request => {const user = await getUser(request); return {user, permissions: user?.id === ADMIN && adminAllowed ? ['platform.admin'] : []};};
  const envelope = (subject, fields = {}) => view(subject, {...fields, now: clock});
  const source = async ({subject, input}, {guard}) => {
    sourceCalls.push({subject, input: structuredClone(input)}); await guard();
    if (unavailable) return null;
    if (sourceHook) await sourceHook({subject, input});
    await guard();
    if (failBefore === input.action) {failBefore = null; throw Error('synthetic failure before mutation');}
    const own = records.get(subject) || []; records.set(subject, own);
    if (input.action === 'status') return own.length ? envelope(subject, {kind: 'order', order: {...own.at(-1).order}}) : envelope(subject);
    if (input.action === 'quote') return envelope(subject, {kind: 'quote', offer: offer(input.interval)});
    if (input.action === 'lookup') {const record = own.find(row => row.requestKey === input.requestKey); return record ? envelope(subject, {kind: 'order', order: {...record.order}}) : envelope(subject);}
    if (input.action === 'prepare') {
      let record = own.find(row => row.requestKey === input.requestKey), replayed = !!record;
      if (record) assert.deepEqual(record.offer, input.offer);
      else {
        const monthly = input.offer.interval === 'month';
        record = {requestKey: input.requestKey, offer: structuredClone(input.offer), order: {id: 'aaaaaaaa-aaaa-4aaa-8aaa-' + String(++sequence).padStart(12, '0'),
          productCode: input.offer.product_code, interval: input.offer.interval, amountCents: monthly ? 1990 : 19900, currency: 'BRL', status: 'prepared',
          paymentStatus: 'pending', cancelled: false, cancelAtPeriodEnd: true, periodStart: null, periodEnd: null}};
        own.push(record);
      }
      return envelope(subject, {kind: 'order', order: {...record.order}, replayed});
    }
    const record = own.find(row => row.order.id === input.orderId);
    if (!record) throw Error('synthetic order is outside authorized owner scope');
    if (input.action === 'refresh' && record.order.status === 'prepared') record.order.status = 'issued';
    if (input.action === 'cancel') record.order.cancelAtPeriodEnd = true;
    if (input.action === 'void_unsent') {assert.equal(record.order.status, 'prepared'); Object.assign(record.order, {status: 'void', cancelled: true, paymentStatus: 'cancelled'});}
    return envelope(subject, {kind: 'order', order: {...record.order}});
  };
  const subscriptionHandler = createReversoSubscriptionHandlerV2({getUser, source, now: () => clock});
  const readState = async context => {if (stateHook) await stateHook(context); const value = stateSources.get(context.subject); return value ? typeof value === 'function' ? value(context, clock) : structuredClone(value) : emptyReversoState({subject: context.subject, now: clock});};
  const clientStateHandler = createReversoStateHandler({getUser, readState, now: () => clock});
  const adminStateHandler = createReversoStateHandler({getUser, requireAdmin, readState, now: () => clock, admin: true});
  async function fetcher(url, init = {}) {
    const target = new URL(url, 'https://jenios.fixture'), headers = new Headers(init.headers);
    assert.equal(target.origin, 'https://jenios.fixture', 'No external requests are allowed in the fixture');
    if (init.method === 'POST') {headers.set('origin', target.origin); headers.set('sec-fetch-site', 'same-origin');}
    const request = new Request(target, {...init, headers});
    requests.push({url: target.pathname + target.search, method: request.method, headers: Object.fromEntries(headers), body: init.body ? JSON.parse(init.body) : null});
    if (target.pathname === '/api/platform/reverso/subscription') {
      const response = await subscriptionHandler(request);
      if (loseResponse && init.body && JSON.parse(init.body).action === loseResponse) {loseResponse = null; throw Error('synthetic response lost after server completion');}
      return response;
    }
    if (target.pathname === '/api/platform/reverso/state') return clientStateHandler(request);
    if (target.pathname === '/api/platform/admin/robots/reverso') return adminStateHandler(request);
    if (target.pathname === '/api/platform/admin/access') {const grant = await requireAdmin(request); return Response.json({permissions: grant.permissions}, {status: grant.user ? 200 : 401});}
    if (target.pathname === '/api/admin/access' && socialMaster) return Response.json({isMaster: true});
    throw Error('Unexpected fixture request: ' + target.pathname);
  }
  const setTimer = (fn, delay = 0) => {const id = ++timerId; timers.set(id, {at: clock + delay, fn}); return id;};
  const clearTimer = id => timers.delete(id);
  const hook = () => {assert.ok(active, 'A hook needs a mounted fixture component'); return {instance: active, index: active.cursor++};};
  const hooks = {...React,
    useState(initial) {const {instance, index} = hook(); if (!(index in instance.slots)) instance.slots[index] = typeof initial === 'function' ? initial() : initial;
      return [instance.slots[index], next => {if (!instance.alive) return; instance.slots[index] = typeof next === 'function' ? next(instance.slots[index]) : next; dirty = true;}];},
    useRef(initial) {const {instance, index} = hook(); return instance.slots[index] ??= {current: initial};},
    useCallback(fn, deps) {const {instance, index} = hook(), old = instance.slots[index];
      if (!old || deps.some((v, i) => !Object.is(v, old.deps[i]))) instance.slots[index] = {fn, deps}; return instance.slots[index].fn;},
    useEffect(fn, deps) {const {instance, index} = hook(), old = instance.effects[index];
      if (!old || deps.some((v, i) => !Object.is(v, old.deps[i]))) {
        old?.cleanup?.(); instance.effects[index] = {deps};
        pendingEffects.push(() => {if (instance.alive) instance.effects[index].cleanup = fn();});
      }},
    useContext() {return null;},
  };
  class ClockDate extends Date {constructor(...args) {super(...(args.length ? args : [clock]));} static now() {return clock;}}
  const route = value => {redirects.push(value); if (entryPath) navigate(value);};
  const router = {replace: route, push: route, refresh: () => {refreshes++;}};
  const window = {setTimeout: setTimer, clearTimeout: clearTimer,
    location: new URL(pagePath, 'https://jenios.fixture'),
    sessionStorage: {getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key)},
    addEventListener(name, fn) {if (!events.has(name)) events.set(name, new Set()); events.get(name).add(fn);},
    removeEventListener(name, fn) {events.get(name)?.delete(fn);}};
  const styles = new Map();
  function load(file) {
    file = resolve(root, file); if (!existsSync(file)) file += '.js';
    if (modules.has(file)) return modules.get(file).exports;
    const module = {exports: {}}; modules.set(file, module);
    const sourceText = readFileSync(file, 'utf8'), code = transformSync(sourceText, {
      jsc: {parser: {syntax: 'ecmascript', jsx: true}, target: 'es2022', transform: {react: {runtime: 'automatic'}}}, module: {type: 'commonjs'},
    }).code;
    vm.runInNewContext(code, {module, exports: module.exports, Date: ClockDate, Intl, Request, Response, Headers, AbortController, URLSearchParams,
      process: {env: {NEXT_PUBLIC_PLATFORM_SIGNUP_ENABLED: 'false'}},
      structuredClone, fetch: fetcher, window, setTimeout: setTimer, clearTimeout: clearTimer,
      crypto: {randomUUID: () => 'bbbbbbbb-bbbb-4bbb-8bbb-' + String(++sequence).padStart(12, '0')},
      require(name) {
        if (name === 'react') return hooks;
        if (name === 'react/jsx-runtime') return require(name);
        if (name === 'next/navigation') return {useRouter: () => router};
        if (name === 'next/link') return {__esModule: true, default: props => React.createElement('a', props)};
        if (name.endsWith('/SocialAccessForm')) return {__esModule: true,
          default: () => React.createElement('p', null, 'Formulário Social fora do escopo desta jornada fictícia.')};
        if (name === 'next/image') return {__esModule: true, default: ({priority, unoptimized, fill, ...props}) => {
          const path = resolve(root, 'public', props.src.replace(/^\//, ''));
          return React.createElement('img', {...props, src: 'data:image/webp;base64,' + readFileSync(path).toString('base64')});
        }};
        if (name.endsWith('supabase-client')) return {platformSupabase: {auth}};
        if (name.endsWith('/lib/supabase') || name === '../../../lib/supabase') return {supabase: {auth: {getSession: async () => ({data: {session: socialMaster ? {access_token: 'synthetic-social-token', user: {id: OTHER}} : null}})}}};
        if (name.endsWith('unified-entry.mjs')) return {resolveSocialPortalEntry: async () => socialMaster ? {source: 'social', userId: OTHER} : null,
          observeSocialPortalAuth: () => ({data: {subscription: {unsubscribe() {}}}})};
        const resolved = resolve(dirname(file), name);
        if (name.endsWith('.module.css')) {
          const prefix = resolved.split('/').at(-1).replace('.module.css', '').toLowerCase() + '-';
          styles.set(resolved, readFileSync(resolved, 'utf8').replace(/\.([a-zA-Z_][a-zA-Z0-9_-]*)/g, '.' + prefix + '$1'));
          return {__esModule: true, default: new Proxy({}, {get: (_, key) => prefix + String(key)})};
        }
        if (name.endsWith('.mjs')) return require(resolved);
        if (name.startsWith('.')) return load(resolved);
        throw Error('Unexpected fixture module: ' + name);
      },
    }, {filename: file});
    return module.exports;
  }
  function pageFor(path) {
    const pages = {'/platform/entrar': 'app/platform/entrar/page.js', '/platform/reverso': 'app/platform/reverso/page.js',
      '/platform/admin/robos/reverso': 'app/platform/admin/robos/reverso/page.js'};
    const pathname = new URL(path, 'https://jenios.fixture').pathname;
    return pages[pathname] ? load(pages[pathname]).default
      : function OutOfScopeDestination() {return React.createElement('main', null, 'Destino fora do escopo: ' + pathname);};
  }
  let Page = adminAccessProps === null ? pageFor(pagePath)
    : function LegacyAdminFixture() {return React.createElement(load('app/components/platform/PlatformAdminAccess.js').default,
      adminAccessProps, React.createElement('main', null, 'Conteúdo administrativo fictício'));};
  function navigate(value) {
    const url = new URL(value, 'https://jenios.fixture');
    assert.equal(url.origin, 'https://jenios.fixture', 'Fixture navigation must remain local');
    pagePath = url.pathname + url.search; window.location = url; Page = pageFor(pagePath); dirty = true;
  }
  function render() {
    dirty = false; const seen = new Set();
    function visit(node, path = 'root') {
      if (Array.isArray(node)) return node.map((child, i) => visit(child, path + '/' + i));
      if (!node || typeof node !== 'object') return node;
      if (typeof node.type === 'function') {
        const id = path + ':' + node.type.name + ':' + (node.key ?? ''); seen.add(id);
        let instance = instances.get(id); if (!instance) {instance = {slots: [], effects: [], alive: true}; instances.set(id, instance);}
        const before = active; active = instance; instance.cursor = 0;
        const child = node.type(node.props); active = before;
        return visit(child, id);
      }
      if (typeof node.type !== 'string') return visit(node.props?.children, path + '/provider');
      return {...node, props: {...node.props, children: visit(node.props?.children, path + '/children')}};
    }
    tree = visit(React.createElement(Page));
    for (const [id, instance] of instances) if (!seen.has(id)) {instance.alive = false; for (const effect of instance.effects) effect?.cleanup?.(); instances.delete(id);}
    for (const effect of pendingEffects.splice(0)) effect();
    return tree;
  }
  const button = label => {const matches = findAll(tree, node => node.type === 'button' && text(node).trim() === label); assert.equal(matches.length, 1, 'Button: ' + label); return matches[0];};
  return {
    requests, sourceCalls, records, storage, redirects, signIns, auth, fetcher, source, subscriptionHandler, adminStateHandler, clientStateHandler,
    get path() {return pagePath;}, get refreshes() {return refreshes;}, navigate,
    now: () => clock, get tree() {return tree;}, text: () => text(tree), render,
    async settle() {for (let i = 0; i < 30; i++) {render(); await tick(); if (!dirty) return tree;} throw Error('Fixture render did not settle');},
    button, click(label) {const node = button(label); assert.notEqual(node.props.disabled, true, 'Button disabled: ' + label); return node.props.onClick?.();},
    followLink(label) {const links = findAll(tree, node => node.type === 'a' && text(node).trim() === label); assert.equal(links.length, 1); navigate(links[0].props.href);},
    async signIn(email, password = SYNTHETIC_PASSWORD) {
      for (const [type, value] of [['email', email], ['password', password]]) {
        const input = findAll(tree, node => node.type === 'input' && node.props.type === type)[0]; assert.ok(input, 'Login input: ' + type);
        input.props.onChange({target: {value}}); render();
      }
      const forms = findAll(tree, node => node.type === 'form'); assert.equal(forms.length, 1);
      await forms[0].props.onSubmit({preventDefault() {}});
    },
    accept(value = true) {const input = findAll(tree, node => node.type === 'input' && node.props.type === 'checkbox')[0]; assert.ok(input); input.props.onChange({target: {checked: value}});},
    selectCustomer(id) {const input = findAll(tree, node => node.type === 'input' && node.props.placeholder === 'Identificador da conta Platform')[0]; assert.ok(input); input.props.onChange({target: {value: id}}); render();
      const form = findAll(tree, node => node.type === 'form')[0]; form.props.onSubmit({preventDefault() {}});},
    setActor(next) {actor = next; for (const fn of authListeners) fn(next ? 'SIGNED_IN' : 'SIGNED_OUT', session(next));},
    setAdmin(value) {adminAllowed = value;}, revoke(id) {revoked.add(id);},
    setUnavailable(value) {unavailable = value;}, setSourceHook(fn) {sourceHook = fn;}, setStateHook(fn) {stateHook = fn;},
    setState(subject, value) {stateSources.set(subject, value);},
    loseNextResponse(action) {loseResponse = action;}, failNextBefore(action) {failBefore = action;},
    advance(ms) {const end = clock + ms; for (;;) {const next = [...timers.entries()].sort((a, b) => a[1].at - b[1].at).find(([, timer]) => timer.at <= end); if (!next) break;
      const [id, timer] = next; clock = timer.at; timers.delete(id); timer.fn();} clock = end;},
    focus() {for (const fn of events.get('focus') || []) fn();},
    html() {return require('react-dom/server').renderToStaticMarkup(tree);}, css() {return [...styles.values()].join('\n');},
    unmount() {for (const instance of instances.values()) {instance.alive = false; for (const effect of instance.effects) effect?.cleanup?.();} instances.clear();},
  };
}
