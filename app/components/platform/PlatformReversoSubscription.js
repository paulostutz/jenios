'use client';

import {useCallback, useEffect, useRef, useState} from 'react';
import {platformSupabase} from '../../../lib/platform/supabase-client';
import {createReversoSubscriptionClient, createReversoSubscriptionIntentStore} from '../../../lib/platform/reverso/subscription/client-v2.mjs';
import css from './PlatformReversoSubscription.module.css';

const money = value => new Intl.NumberFormat('pt-BR', {style: 'currency', currency: 'BRL'}).format(value / 100);
const date = value => value ? new Date(value).toLocaleString('pt-BR', {timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short'}) : 'Pendente';
const terminal = order => ['closed', 'void', 'refunded', 'cancelled'].includes(order?.status);
const current = (view, subject) => !!view && typeof subject === 'string' && view.subject === subject && view.mode === 'demo' && view.capabilities?.candidateActionsAllowed === true &&
  view.capabilities.realBillingAllowed === false && view.capabilities.realDebitAuthorized === false && view.capabilities.actualExecutionAuthorized === false &&
  Date.parse(view.validUntil) > Date.now() && Date.parse(view.observedAt) + 30000 > Date.now();
const statusLabel = value => ({prepared: 'Preparado em demonstração', sending: 'Em conferência', submitted: 'Em conferência',
  uncertain: 'Resultado incerto', issued: 'Emitido em demonstração', paid: 'Registro histórico em teste',
  closed: 'Encerrado', void: 'Anulado antes do envio', refunded: 'Estorno registrado', cancelled: 'Cancelado'}[value] || 'Aguardando confirmação');
const paymentLabel = value => ({pending: 'Pendente', recorded_in_test: 'Registro em teste; sem confirmação financeira atual',
  uncertain: 'Aguardando conciliação', refunded: 'Estorno registrado', cancelled: 'Cancelado'}[value] || 'Pendente');

export function ReversoSubscriptionView({view, subject, busy, error, accepted, hasPending, lookupAbsent, recoveryReady = false,
  renderOffers, select, accept, prepare, recover, repeat, action}) {
  const fresh = current(view, subject), order = fresh ? view.order : null, offer = fresh ? view.offer : null;
  const choicesDisabled = busy || !fresh || !recoveryReady || hasPending || !!order && !terminal(order);
  return <>
    {renderOffers?.({onChoose: select, selectedInterval: offer?.interval || order?.interval || null, disabled: choicesDisabled})}
    <section className={css.panel} aria-labelledby="reverso-subscription-title">
      <div className={css.heading}><h2 id="reverso-subscription-title">Contratação do plano</h2>
        <span className={css.badge}>{fresh ? 'Demonstração' : 'Indisponível'}</span></div>
      <p className={css.notice}>{fresh
        ? 'Esta jornada é demonstrativa. Não há cobrança, débito ou liberação de acesso reais.'
        : 'A contratação e a cobrança ainda não estão disponíveis. Quando habilitada, a vigência começará somente após a confirmação do pagamento.'}</p>
      {!subject && <p role="status">Entre com sua sessão exclusiva da Platform para consultar a contratação.</p>}
      {busy && <p role="status">Consultando o pedido e as condições autorizadas…</p>}
      {!busy && !fresh && subject && <p role="status">A contratação ainda não está habilitada neste ambiente. Os preços acima permanecem disponíveis para consulta.</p>}
      {error && <p role="alert" className={css.error}>{error}</p>}
      {offer && !hasPending && <>
        <h3>{offer.interval === 'month' ? 'Plano mensal' : 'Pagamento único por 12 meses'} · {money(offer.amount_cents)}</h3>
        <p>A vigência começa na confirmação do pagamento. Preparar um pedido não confirma pagamento ou acesso.</p>
        <div role="region" aria-label="Termos da contratação demonstrativa" tabIndex={0} className={css.terms}>{offer.terms_text}</div>
        <label className={css.consent}><input type="checkbox" checked={accepted} disabled={busy} onChange={event => accept(event.target.checked)}/>
          Li e aceito os termos desta contratação demonstrativa.</label>
        <button type="button" disabled={busy || !accepted || !recoveryReady} onClick={prepare}>Confirmar contratação demonstrativa</button>
      </>}
      {hasPending && <div role="status" className={css.pending}>
        <p>Há uma tentativa ainda sem resultado confirmado. A mesma referência será preservada até a conferência.</p>
        {lookupAbsent && fresh && <><p>A consulta ainda não localizou o pedido. Isso não confirma que a tentativa anterior foi rejeitada.</p>
          <button type="button" disabled={busy} onClick={repeat}>Repetir a mesma tentativa demonstrativa</button></>}
      </div>}
      {order && <>
        <h3>Pedido demonstrativo</h3>
        <dl className={css.values}>
          <div><dt>Plano</dt><dd>{order.interval === 'month' ? 'Mensal' : 'Pagamento único por 12 meses'}</dd></div>
          <div><dt>Valor contratado</dt><dd>{money(order.amountCents)}</dd></div>
          <div><dt>Pedido</dt><dd>{statusLabel(order.status)}</dd></div>
          <div><dt>Pagamento</dt><dd>{paymentLabel(order.paymentStatus)}</dd></div>
          <div><dt>Início da vigência</dt><dd>{date(order.periodStart)}</dd></div>
          <div><dt>Fim da vigência</dt><dd>{date(order.periodEnd)}</dd></div>
          <div><dt>Encerramento ao fim da vigência</dt><dd>{order.cancelAtPeriodEnd ? 'Previsto; período pago preservado' : 'Sem indicação na fonte'}</dd></div>
        </dl>
        <div className={css.actions}>
          {!terminal(order) && <button type="button" disabled={busy} onClick={() => action('refresh')}>Atualizar pedido demonstrativo</button>}
          {!order.cancelAtPeriodEnd && !terminal(order) && <button type="button" disabled={busy} onClick={() => action('cancel')}>Registrar encerramento ao fim da vigência</button>}
          {order.status === 'prepared' && <button type="button" disabled={busy} onClick={() => action('voidUnsent')}>Anular pedido demonstrativo ainda não enviado</button>}
        </div>
      </>}
      <div className={css.actions}><button type="button" disabled={busy || !subject} onClick={recover}>
        {hasPending ? 'Consultar a mesma tentativa' : order ? 'Consultar pedido' : 'Consultar disponibilidade'}
      </button></div>
    </section>
  </>;
}

export default function PlatformReversoSubscription({subject, renderOffers, onChanged}) {
  const [view, setView] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [accepted, setAccepted] = useState(false), [hasPending, setHasPending] = useState(false), [lookupAbsent, setLookupAbsent] = useState(false);
  const [recoveryReady, setRecoveryReady] = useState(false), [recoveryError, setRecoveryError] = useState('');
  const alive = useRef(false), epoch = useRef(0), busyRef = useRef(false), controller = useRef(null);
  const client = useRef(null), viewRef = useRef(null), intent = useRef(null), orderId = useRef(null), selected = useRef(null);
  const intentStore = useRef(null);
  const changed = useRef(onChanged); changed.current = onChanged;
  const run = useCallback(async (perform, type = 'read') => {
    if (!alive.current || busyRef.current || !client.current) return;
    busyRef.current = true; setBusy(true); setError(''); setAccepted(false);
    const ticket = ++epoch.current, activeClient = client.current;
    controller.current = new AbortController();
    viewRef.current = null; setView(null);
    try {
      const result = await perform(activeClient, controller.current.signal);
      if (!alive.current || ticket !== epoch.current) return;
      viewRef.current = result; setView(result);
      if (result.kind === 'order') {
        if (intent.current) {
          try { intentStore.current.clear(); }
          catch { setRecoveryReady(false); setRecoveryError('Não foi possível encerrar a referência local. Consulte o mesmo pedido; uma nova contratação permanece bloqueada.'); }
        }
        orderId.current = result.order.id; intent.current = null; setHasPending(false); setLookupAbsent(false);
        changed.current?.();
      } else if (type === 'lookup') {
        setLookupAbsent(true);
        setError('O pedido ainda não foi localizado. Preserve a mesma tentativa para continuar a conferência.');
      } else if (result.kind === 'quote') {
        selected.current = result.offer.interval; orderId.current = null;
      }
      return result;
    } catch (caught) {
      if (!alive.current || ticket !== epoch.current || caught?.name === 'AbortError') return;
      setLookupAbsent(false);
      setError(caught?.code === 'REVERSO_SUBSCRIPTION_SESSION_CHANGED'
        ? 'Sua sessão mudou. Entre novamente na Platform para continuar.'
        : intent.current ? 'O resultado da tentativa ainda não foi confirmado. Consulte a mesma referência antes de repetir.'
          : type === 'mutation' ? 'Não foi possível confirmar o resultado. Consulte o mesmo pedido antes de continuar.'
            : 'Não foi possível consultar as condições ou o pedido deste ambiente. Tente consultar novamente.');
    } finally {
      if (alive.current && ticket === epoch.current) { busyRef.current = false; setBusy(false); }
    }
  }, []);
  const recover = useCallback(() => {
    if (intent.current) return run((api, signal) => api.lookup(intent.current.requestKey, {signal}), 'lookup');
    if (orderId.current) return run((api, signal) => api.read(orderId.current, {signal}));
    if (selected.current) return run((api, signal) => api.quote(selected.current, {signal}));
    return run((api, signal) => api.status({signal}));
  }, [run]);
  useEffect(() => {
    alive.current = true; epoch.current++; busyRef.current = false;
    viewRef.current = null; intent.current = null; orderId.current = null; selected.current = null;
    setView(null); setError(''); setAccepted(false); setHasPending(false); setLookupAbsent(false); setBusy(false);
    setRecoveryReady(false); setRecoveryError(''); intentStore.current = null;
    if (subject && platformSupabase?.auth) {
      let pendingIntent = null;
      try {
        intentStore.current = createReversoSubscriptionIntentStore({subject, storage: window.sessionStorage});
        pendingIntent = intentStore.current.read(); setRecoveryReady(true);
      } catch { setRecoveryError('Não foi possível preservar ou conferir a referência local desta aba. A consulta continua disponível, mas uma nova contratação está bloqueada.'); }
      client.current = createReversoSubscriptionClient({subject, auth: platformSupabase.auth, pendingIntent, fetchImpl: fetch, now: () => Date.now()});
      if (pendingIntent) {
        intent.current = pendingIntent; setHasPending(true);
        void run((api, signal) => api.lookup(pendingIntent.requestKey, {signal}), 'lookup');
      } else void run((api, signal) => api.status({signal}));
    } else client.current = null;
    return () => { alive.current = false; epoch.current++; busyRef.current = false; controller.current?.abort(); };
  }, [subject, run]);
  useEffect(() => {
    if (!view) return;
    const deadline = Math.min(Date.parse(view.validUntil), Date.parse(view.observedAt) + 30000), remaining = deadline - Date.now();
    if (remaining <= 0) { viewRef.current = null; setView(null); return; }
    const timer = window.setTimeout(() => { void recover(); }, remaining);
    return () => window.clearTimeout(timer);
  }, [view, recover]);
  const select = interval => {
    if (busyRef.current || !recoveryReady || intent.current || !current(viewRef.current, subject)) return;
    return run((api, signal) => api.quote(interval, {signal}));
  };
  const prepare = () => {
    const source = viewRef.current;
    if (busyRef.current || !recoveryReady || !accepted || !current(source, subject) || source.kind !== 'quote' || intent.current) return;
    const pendingIntent = {requestKey: crypto.randomUUID(), offer: structuredClone(source.offer), accept: true};
    try { intentStore.current.save(pendingIntent); }
    catch { setRecoveryReady(false); setRecoveryError('Não foi possível preservar a referência desta tentativa. O pedido não foi enviado; uma nova contratação permanece bloqueada.'); return; }
    intent.current = pendingIntent;
    setHasPending(true); setLookupAbsent(false);
    return run((api, signal) => api.prepare(intent.current, source, {signal}), 'mutation');
  };
  const repeat = () => {
    const source = viewRef.current;
    if (!intent.current || !lookupAbsent || !current(source, subject)) return;
    return run((api, signal) => api.prepare(intent.current, source, {signal}), 'mutation');
  };
  const action = name => {
    const source = viewRef.current;
    if (!['refresh', 'cancel', 'voidUnsent'].includes(name) || !current(source, subject) || !source.order) return;
    return run((api, signal) => api[name](source.order.id, source, {signal}), 'mutation');
  };
  return <ReversoSubscriptionView {...{subject, view, busy, accepted, hasPending, lookupAbsent, recoveryReady, renderOffers,
    select, prepare, recover, repeat, action}} error={recoveryError || error} accept={setAccepted}/>;
}
