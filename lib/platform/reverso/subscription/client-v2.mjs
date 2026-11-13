/** Dedicated Platform transport. The browser never supplies payer, customer
 * or payment evidence. All capabilities use the shared server view validator. */
import {validateReversoSubscriptionViewV2, validateReversoSubscriptionOfferV2} from './view-v2.mjs';
const endpoint = '/api/platform/reverso/subscription';
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);
const failure = (code, {status = null, uncertain = false} = {}) => Object.assign(Error(code), {code, status, uncertain});
const acceptedIntent = value => {
  if (!value || Object.keys(value).sort().join() !== 'accept,offer,requestKey' || !uuid(value.requestKey) || value.accept !== true) throw failure('REVERSO_SUBSCRIPTION_RECOVERY_INVALID');
  validateReversoSubscriptionOfferV2(value.offer);
  return structuredClone(value);
};

/** Only the accepted offer and idempotency reference survive a tab reload.
 * No token, payer or payment evidence is stored. Invalid/unavailable storage
 * prevents a new prepare; it never silently produces another request key. */
export function createReversoSubscriptionIntentStore({subject, storage} = {}) {
  if (!uuid(subject)) throw failure('REVERSO_SUBSCRIPTION_CLIENT_REQUIRED');
  const key = 'jenios:reverso:subscription:v2:' + subject;
  const safe = operation => {
    try { return operation(); }
    catch { throw failure('REVERSO_SUBSCRIPTION_RECOVERY_STORAGE_UNAVAILABLE'); }
  };
  return Object.freeze({
    read: () => safe(() => {
      const text = storage.getItem(key);
      if (text === null) return null;
      if (typeof text !== 'string' || text.length > 20000) throw Error('invalid stored intent');
      return acceptedIntent(JSON.parse(text));
    }),
    save: value => safe(() => {
      const text = JSON.stringify(acceptedIntent(value));
      storage.setItem(key, text);
      if (storage.getItem(key) !== text) throw Error('intent persistence failed');
    }),
    clear: () => safe(() => {
      storage.removeItem(key);
      if (storage.getItem(key) !== null) throw Error('intent removal failed');
    }),
  });
}

export function createReversoSubscriptionClient({subject, auth, pendingIntent = null, validateView = validateReversoSubscriptionViewV2, fetchImpl = fetch, now = Date.now} = {}) {
  if (!uuid(subject) || typeof auth?.getSession !== 'function' || typeof auth?.getUser !== 'function' ||
      typeof validateView !== 'function' || typeof fetchImpl !== 'function') throw failure('REVERSO_SUBSCRIPTION_CLIENT_REQUIRED');
  const intents = new Map();
  if (pendingIntent) {const intent = acceptedIntent(pendingIntent); intents.set(intent.requestKey, intent.offer);}
  const capability = raw => {
    const view = validateView(raw, {subject, now: now()}), c = view.capabilities;
    if (view.mode !== 'demo' || c?.candidateActionsAllowed !== true || c.realBillingAllowed !== false ||
        c.realDebitAuthorized !== false || c.actualExecutionAuthorized !== false) throw failure('REVERSO_SUBSCRIPTION_DEMO_REQUIRED');
    return view;
  };
  async function request({query = '', body, source, signal, expectedOrderId, expectedInterval, expectedKind} = {}) {
    const mutation = body !== undefined;
    if (mutation) capability(source);
    const sessionResult = await auth.getSession(), session = sessionResult?.data?.session;
    if (sessionResult?.error || session?.user?.id !== subject || session.user.is_anonymous || !session.access_token) throw failure('REVERSO_SUBSCRIPTION_SESSION_CHANGED');
    if (mutation) capability(source);
    const headers = {Authorization: 'Bearer ' + session.access_token};
    if (mutation) Object.assign(headers, {'Content-Type': 'application/json', 'X-Jenios-Reverso-Intent': 'subscription'});
    let response;
    try {
      response = await fetchImpl(endpoint + query, {method: mutation ? 'POST' : 'GET', cache: 'no-store',
        credentials: 'same-origin', redirect: 'error', headers, signal, ...(mutation ? {body: JSON.stringify(body)} : {})});
    } catch (error) {
      if (error?.name === 'AbortError') throw error;
      throw failure('REVERSO_SUBSCRIPTION_RESPONSE_UNAVAILABLE', {uncertain: mutation});
    }
    if (!response.ok) throw failure('REVERSO_SUBSCRIPTION_RESPONSE_UNAVAILABLE', {status: response.status, uncertain: mutation && response.status >= 500});
    let raw;
    try { raw = await response.json(); }
    catch { throw failure('REVERSO_SUBSCRIPTION_RESPONSE_INVALID', {uncertain: mutation}); }
    const current = await auth.getUser();
    if (current?.error || current?.data?.user?.id !== subject || current.data.user.is_anonymous) throw failure('REVERSO_SUBSCRIPTION_SESSION_CHANGED');
    let view;
    try { view = capability(raw); }
    catch { throw failure('REVERSO_SUBSCRIPTION_RESPONSE_INVALID', {uncertain: mutation}); }
    if (expectedOrderId && view.order?.id !== expectedOrderId || expectedInterval && (view.kind !== 'quote' || view.offer?.interval !== expectedInterval) || expectedKind && view.kind !== expectedKind) throw failure('REVERSO_SUBSCRIPTION_RESPONSE_SCOPE', {uncertain: mutation});
    return view;
  }
  const orderAction = action => (orderId, source, {signal} = {}) => {
    if (!uuid(orderId)) throw failure('REVERSO_SUBSCRIPTION_ORDER_REQUIRED');
    return request({body: {action, orderId}, source, signal, expectedOrderId: orderId});
  };
  return Object.freeze({
    status: ({signal} = {}) => request({signal}),
    quote(interval, {signal} = {}) {
      if (!['month', 'year'].includes(interval)) throw failure('REVERSO_SUBSCRIPTION_INTERVAL_REQUIRED');
      return request({query: '?interval=' + interval, signal, expectedInterval: interval});
    },
    read(orderId, {signal} = {}) {
      if (!uuid(orderId)) throw failure('REVERSO_SUBSCRIPTION_ORDER_REQUIRED');
      return request({query: '?orderId=' + encodeURIComponent(orderId), signal, expectedOrderId: orderId});
    },
    lookup(requestKey, {signal} = {}) {
      if (!uuid(requestKey)) throw failure('REVERSO_SUBSCRIPTION_REQUEST_KEY_REQUIRED');
      return request({query: '?requestKey=' + encodeURIComponent(requestKey), signal});
    },
    prepare({requestKey, offer, accept}, source, {signal} = {}) {
      const view = capability(source), previous = intents.get(requestKey);
      validateReversoSubscriptionOfferV2(offer);
      if (!uuid(requestKey) || accept !== true || !offer || (previous ? JSON.stringify(previous) !== JSON.stringify(offer)
        : view.kind !== 'quote' || JSON.stringify(view.offer) !== JSON.stringify(offer))) throw failure('REVERSO_SUBSCRIPTION_ACCEPTED_OFFER_REQUIRED');
      if (!previous) intents.set(requestKey, structuredClone(offer));
      return request({body: {action: 'prepare', requestKey, offer: structuredClone(offer), accept: true}, source, signal, expectedKind: 'order'});
    },
    refresh: orderAction('refresh'), cancel: orderAction('cancel'), voidUnsent: orderAction('void_unsent'),
  });
}
