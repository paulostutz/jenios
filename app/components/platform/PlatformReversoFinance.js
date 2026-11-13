'use client';

import {useCallback, useEffect, useRef, useState} from 'react';
import Link from 'next/link';
import {platformSupabase} from '../../../lib/platform/supabase-client';
import {validateReversoState} from '../../../lib/platform/reverso/state-contract.mjs';
import {formatFinancialAmount} from '../../../lib/platform/ultra/client/reporting.mjs';
import {BrandLockup, BrandFooter} from '../brand/BrandSignature';
import PlatformReversoSubscription from './PlatformReversoSubscription';
import css from './PlatformReversoFinance.module.css';

const amount = (value, currency) => value === null || value === undefined ? 'Pendente' : formatFinancialAmount(value, currency);
const minorMoney = (value, currency = 'BRL') => value === null || value === undefined ? 'Pendente'
  : new Intl.NumberFormat('pt-BR', {style: 'currency', currency}).format(value / 100);
const date = value => value && Number.isFinite(Date.parse(value))
  ? new Date(value).toLocaleString('pt-BR', {timeZone: 'America/Bahia', dateStyle: 'short', timeStyle: 'short'}) : 'Pendente';
const month = value => /^\d{4}-\d{2}$/.test(value || '') ? value.slice(5) + '/' + value.slice(0, 4) : 'Competência pendente';
const rate = value => value === 10 || value === 20 ? value + '%' : 'Pendente';
const modality = value => ({month: 'Mensal', year: 'Pagamento único por 12 meses', contract: 'Contrato anterior'}[value] || 'Pendente');
const labels = {
  active: 'Ativo', pending: 'Pendente', uncertain: 'Aguardando conciliação', unavailable: 'Indisponível',
  expired: 'Vencido', revoked: 'Revogado', cancelled: 'Cancelado', scheduled: 'Vigência futura',
  blocked: 'Aguardando liberação', not_started: 'Não iniciado', confirmed: 'Confirmado', refunded: 'Estornado',
  assessed: 'Apurada', monthly_assessed: 'Apurada', prepared: 'Preparada', awaiting_payment: 'Aguardando pagamento',
  paid: 'Registro de pagamento', unknown: 'Aguardando conciliação', pending_costs: 'Custos pendentes',
  pending_policy: 'Política pendente', open: 'Aberta', closed: 'Encerrada', partially_closed: 'Fechamento parcial',
  paused: 'Pausado', ended: 'Encerrado', ready: 'Disponível', finalized: 'Finalizada',
  approved: 'Aprovada', ready_in_test: 'Apuração demonstrativa', no_performance_due_in_test: 'Sem participação na demonstração',
  no_performance_due: 'Sem participação devida',
};
const label = value => labels[value] || 'Aguardando confirmação';
const environment = value => value === 'demo' ? 'Demonstração' : value === 'live' ? 'Real' : 'Ambiente pendente';
const provider = value => ({binance: 'Binance', profit: 'Profit', mt5: 'MT5', multiple: 'Múltiplas corretoras'}[value] || value || 'Corretora pendente');
const pendingReason = code => ({
  PRIOR_LOSS_POLICY_PENDING: 'O tratamento das perdas de meses anteriores aguarda confirmação.',
  OBSERVED_PRIOR_LOSS_PENDING: 'Há perdas anteriores no histórico; sua compensação precisa ser confirmada.',
  COSTS_PENDING: 'Há operações com custos incompletos.',
  PLATFORM_COST_TREATMENT_PENDING: 'Os custos elegíveis da plataforma aguardam confirmação.',
  ROUNDING_POLICY_PENDING: 'O valor depende de uma regra de arredondamento aprovada.',
  CURRENCY_CONVERSION_PENDING: 'A conversão de moeda para cobrança aguarda definição.',
  MONTHLY_SETTLEMENT_SCOPE_UNCONFIRMED: 'O conjunto completo de contas do período aguarda conciliação.',
  PLAN_ELIGIBILITY_PENDING: 'O plano e o percentual aplicável aguardam confirmação.',
}[code] || 'Uma fonte ou condição desta apuração ainda precisa ser confirmada.');

function stateDeadline(state) {
  const deadlines = [Date.parse(state.generatedAt) + 60000];
  for (const section of Object.values(state.sections)) {
    if (section.status === 'available') deadlines.push(Date.parse(section.observedAt) + 60000);
  }
  const entitlement = state.sections.entitlement;
  if (entitlement.status === 'available') {
    if (entitlement.data.sourceValidUntil) deadlines.push(Date.parse(entitlement.data.sourceValidUntil));
    if (entitlement.data.status === 'active' && entitlement.data.periodEnd) deadlines.push(Date.parse(entitlement.data.periodEnd));
  }
  return Math.min(...deadlines);
}

function Values({rows}) {
  return <dl className={css.values}>{rows.map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl>;
}

function Section({title, section, children, wide = false}) {
  return <section className={wide ? css.panel : css.card}>
    {wide ? <h2>{title}</h2> : <h3>{title}</h3>}
    {section?.status === 'available' ? <>
      <p className={css.meta}>{section.mode === 'demo' ? 'Demonstração · dados fictícios' : 'Dados confirmados pela fonte'} · {date(section.observedAt)}</p>
      {children(section.data)}
    </> : <p className={css.unavailable}>{section?.reason || 'Fonte autorizada indisponível.'}</p>}
  </section>;
}

export function ReversoPlanOffers({onChoose, selectedInterval = null, disabled = false} = {}) {
  return <section className={css.panel} aria-labelledby="reverso-plans-title">
    <span className={css.eyebrow}>PLANO AVULSO</span>
    <h2 id="reverso-plans-title">Reverso</h2>
    <div className={css.offers}>
      <article className={css.offer}><span>Mensal</span><strong>R$ 19,90</strong><p>Por mês</p>{onChoose && <button type="button" disabled={disabled} aria-pressed={selectedInterval === 'month'} onClick={() => onChoose('month')}>Selecionar mensal</button>}</article>
      <article className={css.offer}><span>Anual</span><strong>R$ 199,00</strong><p>Pagamento único por 12 meses</p>{onChoose && <button type="button" disabled={disabled} aria-pressed={selectedInterval === 'year'} onClick={() => onChoose('year')}>Selecionar anual</button>}</article>
    </div>
    <p className={css.muted}>A vigência começa na confirmação do pagamento. A assinatura é exclusiva do Reverso; não concede Ultra ou outros produtos. Direitos já contratados são preservados.</p>
    <p className={css.muted}>Participação de 20% no plano de entrada, inclusive no avulso anual, e 10% somente com elegibilidade Reverso aprovada e comprovada.</p>
  </section>;
}

export function ReversoCommercialConditions() {
  return <section className={css.panel} aria-labelledby="reverso-costs-title">
    <h2 id="reverso-costs-title">Cobranças do Reverso</h2>
    <div className={css.grid}>
      <article className={css.card}><h3>Taxa de uso · R$ 5,00</h3>
        <p>Cobrança indisponível. O evento que gera a taxa e as condições de falha, retomada e estorno aguardam confirmação.</p>
        <p className={css.muted}>Sinais, simulações e tentativas não comprovam uma operação cobrável. A taxa é separada da assinatura e da participação.</p>
      </article>
      <article className={css.card}><h3>Participação · fechamento mensal</h3>
        <p>20% no plano de entrada, inclusive no Reverso avulso. 10% somente com elegibilidade aprovada e comprovada.</p>
        <p className={css.muted}>Somente resultados realizados, atribuídos e conciliados ao Reverso. A cobrança permanece indisponível até a confirmação das regras de perdas, custos, contas e moedas.</p>
      </article>
    </div>
    <p className={css.muted}>Valores apurados ou pendentes não significam cobrança emitida ou pagamento recebido. Dados indisponíveis não são saldo zero.</p>
  </section>;
}

export function ReversoFinanceView({state, period = 'all', onPeriodChange = () => {}}) {
  const s = state.sections;
  const months = s.performance?.status === 'available'
    ? [...new Set(s.performance.data.periods.map(p => p.month))].sort().reverse() : [];
  return <>
    <div className={css.grid}>
      <Section title="Plano e acesso" section={s.entitlement}>{d => <>
        <p><strong>{d.planName || 'Plano não confirmado'}</strong></p>
        <Values rows={[
          ['Plano', label(d.status)],
          ['Valor contratado', d.currency ? minorMoney(d.amountCents, d.currency) : 'Pendente'],
          ['Modalidade', modality(d.interval)],
          ['Pagamento da assinatura', d.paymentStatus === 'paid' ? 'Confirmado' : label(d.paymentStatus)],
          ['Acesso ao Reverso', d.accessGranted === true && s.entitlement.mode === 'live' ? 'Liberado' : s.entitlement.mode === 'demo' && (d.accessObserved === true || d.status === 'active') ? 'Demonstrativo' : 'Não liberado'],
          ['Início da vigência', date(d.periodStart)], ['Fim da vigência', date(d.periodEnd)],
          ['Encerramento ao fim da vigência', d.cancelAtPeriodEnd ? 'Previsto; período pago preservado' : 'Sem indicação na fonte'],
          ['Participação aplicável', rate(d.performanceRate)],
        ]}/>
      </>}</Section>
      <Section title="Carteira de taxas" section={s.wallet}>{d => <>
        <Values rows={[
          ['Saldo confirmado', minorMoney(d.balanceMinor, d.currency)],
          ['Valores pendentes', minorMoney(d.pendingMinor, d.currency)],
          ['Reservado', minorMoney(d.reservedMinor, d.currency)],
          ['Disponível', minorMoney(d.availableMinor, d.currency)],
        ]}/>
        <p className={css.muted}>Carteira da plataforma. O capital mantido na corretora é acompanhado separadamente.</p>
      </>}</Section>
    </div>
    <Section title="Resultados por competência" section={s.performance} wide>{d => <>
      {s.performance.mode === 'demo' && <p className={css.muted}>Demonstração com dados fictícios. A simulação mensal não valida a política comercial do Reverso. O fechamento é mensal; a base de cálculo, os custos e o tratamento de perdas ainda dependem de regra aprovada.</p>}
      <div className={css.heading}><p className={css.muted}>Resultados atribuídos ao Reverso. A participação apurada e o pagamento recebido aparecem separadamente.</p>
        <label>Competência<select value={period} onChange={event => onPeriodChange(event.target.value)}>
          <option value="all">Todas as competências</option>{months.map(m => <option key={m} value={m}>{month(m)}</option>)}
        </select></label>
      </div>
      <div className={css.grid}>{d.periods.filter(p => period === 'all' || p.month === period).map((p, index) => <article className={css.card} key={[p.month, p.accountId || p.accountIds?.join(','), p.environment, p.currency, index].join(':')}>
        <h3>{month(p.month)} · {p.currency}</h3>
        <p className={css.meta}>{provider(p.provider)} · {environment(p.environment)}</p>
        <p className={css.meta}>Conta{p.accountIds?.length > 1 ? 's' : ''}: {p.accountId || p.accountIds?.join(', ') || 'Vínculo pendente'}</p>
        <Values rows={[
          ['Ganhos realizados', amount(p.gains, p.currency)], ['Perdas realizadas', amount(p.losses, p.currency)],
          ['Taxas da corretora', amount(p.fees, p.currency)], ['Financiamento', amount(p.financing, p.currency)],
          ['Custos elegíveis da plataforma', amount(p.eligiblePlatformCosts, p.currency)],
          ['Custos totais considerados', amount(p.costs, p.currency)], ['Resultado líquido', amount(p.net, p.currency)],
          ['Lucro elegível', amount(p.eligibleNet, p.currency)], ['Percentual', rate(p.performanceRate)],
          ['Participação apurada', amount(p.participation, p.currency)], ['Apuração', label(p.status)],
        ]}/>
        {!!p.pendingReasons?.length && <ul className={css.muted}>{[...new Set(p.pendingReasons.map(pendingReason))].map(reason => <li key={reason}>{reason}</li>)}</ul>}
      </article>)}</div>
      {!d.periods.some(p => period === 'all' || p.month === period) && <p className={css.muted}>Nenhuma apuração disponível nesta competência.</p>}
    </>}</Section>
    <Section title="Relatório por operação" section={s.operations} wide>{d => {
      const rows = d.rows.filter(o => period === 'all' || o.month === period);
      const pending = period === 'all' ? d.costsPending : rows.filter(o => o.state === 'unknown' || o.state === 'closed' && !o.costsComplete).length;
      return <>
        {pending > 0 && <p className={css.muted}>{pending} operações aguardam custos ou confirmação.</p>}
        {rows.length ? <div className={css.scroll} role="region" aria-label="Operações do Reverso" tabIndex={0}><table>
          <thead><tr><th>Conta / corretora</th><th>Operação</th><th>Competência</th><th>Estado</th><th>Bruto</th><th>Taxas</th><th>Financiamento</th><th>Líquido realizado</th></tr></thead>
          <tbody>{rows.map(o => <tr key={JSON.stringify([o.month, o.provider, o.accountId, o.connectionId, o.environment, o.id])}>
            <td>{o.accountId || o.connectionId}<small>{provider(o.provider)} · {environment(o.environment)}</small></td>
            <td>{o.symbol}<small>{o.id}</small></td><td>{month(o.month)}</td><td>{label(o.state)}</td>
            <td>{amount(o.gross, o.currency)}</td><td>{amount(o.fees, o.currency)}</td><td>{amount(o.financing, o.currency)}</td>
            <td>{o.state !== 'closed' ? 'Realização pendente' : o.costsComplete === true ? amount(o.net, o.currency) : 'Custos pendentes'}</td>
          </tr>)}</tbody>
        </table></div> : <p className={css.muted}>{d.hasMore ? 'Nenhuma operação desta competência está presente no recorte carregado.' : period === 'all' ? 'Nenhuma operação registrada.' : 'Nenhuma operação vinculada a esta competência.'}</p>}
        {d.hasMore && <p className={css.muted}>Este recorte mostra as operações mais recentes. Há mais operações no relatório do executor.</p>}
      </>;
    }}</Section>
    <Section title="Obrigações e pagamentos" section={s.obligations} wide>{rows => rows.some(o => period === 'all' || o.month === period) ? <div className={css.scroll} role="region" aria-label="Obrigações do Reverso" tabIndex={0}><table>
      <thead><tr><th>Competência</th><th>Participação</th><th>Obrigação</th><th>Pagamento</th><th>Recebimento confirmado</th></tr></thead>
      <tbody>{rows.filter(o => period === 'all' || o.month === period).map(o => <tr key={o.id}>
        <td>{month(o.month)}</td><td>{minorMoney(o.amountMinor, o.currency)}</td><td>{label(o.status)}</td>
        <td>{o.paymentConfirmed === true && o.paymentStatus === 'paid' ? s.obligations.mode === 'demo' ? 'Recebimento demonstrativo' : 'Pagamento recebido' : o.paymentStatus === 'uncertain' ? 'Aguardando conciliação' : 'Não confirmado'}</td>
        <td>{o.paymentConfirmed === true && o.paymentStatus === 'paid' ? date(o.paidAt) : 'Pendente'}</td>
      </tr>)}</tbody>
    </table></div> : <p className={css.muted}>{period === 'all' ? 'Nenhuma obrigação registrada.' : 'Nenhuma obrigação nesta competência.'}</p>}</Section>
    <Section title="Ciclos" section={s.cycles} wide>{rows => rows.length ? <ul className={css.list}>{rows.map(c => <li key={c.id}>
      <strong>{label(c.phase)}</strong> · {date(c.startedAt)}<br/><span className={css.muted}>Encerramento confirmado: {date(c.endedAt)}</span>
    </li>)}</ul> : <p className={css.muted}>Nenhum ciclo registrado.</p>}</Section>
    <Section title="Política aplicada" section={s.policy} wide>{d => <>
      <p><strong>{label(d.status)}</strong></p>
      {d.reason && <p className={css.muted}>{d.reason}</p>}
      <p className={css.muted}>O percentual e a elegibilidade seguem o contrato confirmado e a política aprovada para o Reverso.</p>
    </>}</Section>
  </>;
}

export function ReversoFinancePanel({subject, load, refreshVersion = 0}) {
  const [state, setState] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [revision, setRevision] = useState(0), [period, setPeriod] = useState('all');
  const epoch = useRef(0);
  useEffect(() => {
    let active = true, controller, expiryTimer;
    const clearExpiry = () => { window.clearTimeout(expiryTimer); expiryTimer = undefined; };
    const refresh = async () => {
      const ticket = ++epoch.current;
      clearExpiry();
      controller?.abort();
      controller = new AbortController();
      setState(null); setError('');
      if (!subject) { setBusy(false); return; }
      setBusy(true);
      try {
        const result = validateReversoState(await load(controller.signal), {subject, now: Date.now()});
        if (active && ticket === epoch.current) {
          const remaining = stateDeadline(result) - Date.now();
          if (remaining <= 0) throw Error('REVERSO_STATE_EXPIRED');
          setState(result);
          expiryTimer = window.setTimeout(() => { expiryTimer = undefined; void refresh(); }, remaining);
        }
      } catch (e) {
        if (active && ticket === epoch.current && e?.name !== 'AbortError') setError('Não foi possível confirmar os dados desta conta. Atualize para tentar novamente.');
      } finally {
        if (active && ticket === epoch.current) setBusy(false);
      }
    };
    const restore = () => { void refresh(); };
    void refresh();
    window.addEventListener('focus', restore);
    window.addEventListener('pageshow', restore);
    return () => { active = false; epoch.current++; clearExpiry(); controller?.abort(); window.removeEventListener('focus', restore); window.removeEventListener('pageshow', restore); };
  }, [subject, load, revision, refreshVersion]);
  const current = state?.owner?.subject === subject && stateDeadline(state) > Date.now() ? state : null;
  return <section aria-label="Acompanhamento financeiro do Reverso">
    <div className={css.heading}><h2>Acompanhamento da conta</h2><button type="button" disabled={busy || !subject} onClick={() => setRevision(v => v + 1)}>{busy ? 'Consultando…' : 'Atualizar dados'}</button></div>
    {error && <p role="alert" className={css.error}>{error}</p>}
    {busy && <p role="status" className={css.muted}>Consultando os dados autorizados…</p>}
    {!subject && <p className={css.muted}>Selecione uma conta autorizada para consultar.</p>}
    {current && !busy && <ReversoFinanceView state={current} period={period} onPeriodChange={setPeriod}/>}
  </section>;
}

export default function PlatformReversoFinance({admin = false}) {
  const [identity, setIdentity] = useState(null), [target, setTarget] = useState(null), [draft, setDraft] = useState('');
  const [selectionError, setSelectionError] = useState('');
  const [financeRevision, setFinanceRevision] = useState(0);
  const subscriptionChanged = useCallback(() => setFinanceRevision(value => value + 1), []);
  const identityRef = useRef(null);
  useEffect(() => {
    let active = true, revision = 0;
    const initial = revision;
    platformSupabase?.auth?.getSession().then(({data}) => {
      if (active && revision === initial) {
        identityRef.current = data?.session?.user?.is_anonymous ? null : data?.session?.user?.id || null;
        setIdentity(identityRef.current);
      }
    }).catch(() => {});
    const subscription = platformSupabase?.auth?.onAuthStateChange((_event, session) => {
      revision++;
      const next = session?.user?.is_anonymous ? null : session?.user?.id || null;
      if (active) {
        const changed = identityRef.current !== next;
        identityRef.current = next; setIdentity(next);
        if (changed) { setTarget(null); setDraft(''); setSelectionError(''); }
      }
    });
    return () => { active = false; revision++; subscription?.data?.subscription?.unsubscribe?.(); };
  }, []);
  const subject = admin ? target : identity;
  const load = useCallback(async signal => {
    const {data, error} = await platformSupabase.auth.getSession(), session = data?.session;
    if (error || !identity || session?.user?.id !== identity || session.user.is_anonymous) throw Error('SESSION_CHANGED');
    const endpoint = admin ? '/api/platform/admin/robots/reverso?subject=' + encodeURIComponent(subject) : '/api/platform/reverso/state';
    const response = await fetch(endpoint, {signal, cache: 'no-store', credentials: 'same-origin', redirect: 'error', headers: {Authorization: 'Bearer ' + session.access_token}});
    if (!response.ok) throw Error('REVERSO_STATE_UNAVAILABLE');
    const result = await response.json();
    const check = await platformSupabase.auth.getUser();
    if (check.error || check.data?.user?.id !== identity || check.data?.user?.is_anonymous) throw Error('SESSION_CHANGED');
    return result;
  }, [identity, subject, admin]);
  function select(event) {
    event.preventDefault();
    const value = draft.trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
      setSelectionError('Informe o identificador válido do cliente.'); setTarget(null); return;
    }
    setSelectionError(''); setTarget(value);
  }
  return <main className={css.page}><div className={css.wrap}>
    <header className={css.top}><Link href="/dashboard-logado"><BrandLockup tone="light" context="Platform" compact/></Link><Link href={admin ? '/platform/admin/robos' : '/dashboard-logado'}>{admin ? 'Voltar à administração' : 'Voltar à Platform'}</Link></header>
    <section className={css.hero}><span className={css.eyebrow}>JENIOS REVERSO</span><h1>{admin ? 'Gestão do Reverso' : 'Seu Reverso, em detalhes.'}</h1><p>Plano, vigência, resultados e participação nos ganhos em um só lugar.</p></section>
    {admin ? <ReversoPlanOffers/> : <PlatformReversoSubscription key={identity || 'signed-out'} subject={identity}
      renderOffers={props => <ReversoPlanOffers {...props}/>} onChanged={subscriptionChanged}/>}
    <ReversoCommercialConditions/>
    {admin && <section className={css.panel}><h2>Consultar cliente</h2><form className={css.adminForm} onSubmit={select}>
      <label>Identificador do cliente<input autoComplete="off" spellCheck={false} value={draft} onChange={event => setDraft(event.target.value)} placeholder="Identificador da conta Platform" required maxLength={36}/></label>
      <button type="submit" className={css.primary} disabled={!identity}>Consultar</button>
    </form>{!identity && <p role="status" className={css.muted}>Esta consulta requer uma sessão administrativa exclusiva da Platform. <Link href="/platform/entrar?dedicated=1&next=%2Fplatform%2Fadmin%2Frobos%2Freverso">Entrar na Platform</Link></p>}
      {selectionError && <p role="alert" className={css.error}>{selectionError}</p>}</section>}
    <ReversoFinancePanel key={[identity || 'signed-out', subject || 'unselected', admin].join(':')} subject={subject} load={load} refreshVersion={financeRevision}/>
    <BrandFooter tone="light" scope="Reverso"/>
  </div></main>;
}
