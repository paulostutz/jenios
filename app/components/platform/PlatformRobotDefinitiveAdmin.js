'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { platformSupabase } from '../../../lib/platform/supabase-client';

const ENDPOINT = '/api/platform/admin/robots/status';
const LOGIN = '/platform/entrar?dedicated=1&next=/platform/admin/robos';
const card = { border: '1px solid #dce3ef', borderRadius: 16, padding: 'clamp(18px,3vw,24px)', background: '#fff', minWidth: 0 };
const muted = { color: '#475569', lineHeight: 1.7, fontSize: 14 };
const count = value => Number.isSafeInteger(value) && value >= 0;
const optionalCount = value => value === null || count(value);
const activityFields = ['qaReceipts', 'qaCycles', 'privateCaptures', 'privateObservations', 'privateRevisions'];

function inspectStatus(body) {
  const db = body?.database, boundary = body?.boundaries;
  if (body?.schema !== 'JENIOS_R73_ROBOT_ADMIN_STATUS_V1' ||
      typeof body.checkedAt !== 'string' || !Number.isFinite(Date.parse(body.checkedAt)) ||
      body.release?.version !== 'R73' || typeof body.release.environment !== 'string' ||
      !(body.release.commitSha === null || /^[a-f0-9]{40}$/.test(body.release.commitSha || '')) ||
      !['READY', 'INCOMPLETE', 'UNAVAILABLE'].includes(db?.status) ||
      db.projectId !== 'xaicvhagftzjkqphnbgx' || db.expectedTables !== 16 ||
      !count(db.availableTables) || db.availableTables > 16 ||
      !Array.isArray(db.tables) || db.tables.length !== 16 ||
      db.tables.some(row => !row || typeof row.name !== 'string' || typeof row.label !== 'string' ||
        typeof row.available !== 'boolean' || !optionalCount(row.rowCount)) ||
      ![true, false, null].includes(db.generationEnabled) || ![true, false, null].includes(db.pricingApproved) ||
      !['CONFIGURED', 'NOT_CONFIGURED'].includes(body.source?.configuration) || body.source.connection !== 'NOT_VERIFIED' ||
      body.worker?.status !== 'WAITING_FOR_SOURCE' || body.worker.scheduled !== false ||
      activityFields.some(key => !optionalCount(body.activity?.[key])) ||
      body.certification?.code !== 'R71' || body.certification.database !== 'R72' || body.certification.financialPerformanceCertified !== false ||
      !boundary || ['realOrdersEnabled', 'externalPaperEnabled', 'paidRobotProviderEnabled', 'customerMonitoringActive']
        .some(key => boundary[key] !== false) ||
      ['actualBrokerPnl', 'actualLossesAvoided', 'realTradeAccuracy'].some(key => boundary[key] !== null)) {
    throw Error('Não foi possível confirmar o estado dos robôs. Atualize a consulta.');
  }
  return body;
}

function Quantity({ label, value }) {
  return <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 20, padding: '12px 0', borderBottom: '1px solid #e8edf5' }}>
    <dt style={{ color: '#475569', fontSize: 14 }}>{label}</dt>
    <dd style={{ margin: 0, color: '#14213b', fontWeight: 750, textAlign: 'right', fontSize: value === null ? 13 : 19 }}>
      {value === null ? 'Não confirmado' : value.toLocaleString('pt-BR')}
    </dd>
  </div>;
}

function RobotStatusReport({ report }) {
  const db = report.database;
  const databaseTitle = db.status === 'READY' ? 'Banco disponível' : db.status === 'INCOMPLETE'
    ? 'Instalação incompleta' : 'Verificação indisponível';
  const checkedAt = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'medium', timeZone: 'America/Sao_Paulo' })
    .format(new Date(report.checkedAt));
  return <div style={{ display: 'grid', gap: 20, minWidth: 0 }}>
    <p style={{ ...muted, margin: 0 }}>
      Consulta ao servidor: <time dateTime={report.checkedAt}>{checkedAt}</time> · horário de Brasília.
    </p>
    <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,280px),1fr))' }}>
      <section style={card} aria-labelledby="robot-database-title">
        <p style={{ color: '#64748b', fontSize: 12, fontWeight: 800, margin: '0 0 10px' }}>BANCO DEFINITIVO</p>
        <h2 id="robot-database-title" style={{ fontSize: 22, margin: '0 0 12px', color: db.status === 'READY' ? '#166534' : '#92400e' }}>{databaseTitle}</h2>
        <p style={{ ...muted, margin: 0 }}>
          {db.status === 'READY' ? 'As 16 estruturas de armazenamento dos robôs responderam à consulta.' :
            db.status === 'INCOMPLETE' ? `${db.availableTables} de 16 estruturas responderam. A integração precisa ser conferida.` :
              'A consulta não confirmou o banco neste momento. Atualize para tentar novamente.'}
        </p>
      </section>
      <section style={card} aria-labelledby="robot-source-title">
        <p style={{ color: '#64748b', fontSize: 12, fontWeight: 800, margin: '0 0 10px' }}>MOTOR PRIVADO</p>
        <h2 id="robot-source-title" style={{ fontSize: 22, margin: '0 0 12px', color: '#92400e' }}>Aguardando conexão</h2>
        <p style={{ ...muted, margin: 0 }}>
          {report.source.configuration === 'CONFIGURED'
            ? 'A configuração da fonte está presente. A conexão com o motor privado ainda não foi verificada.'
            : 'A fonte do motor privado ainda precisa ser configurada e conectada ao aplicativo.'}
        </p>
      </section>
      <section style={card} aria-labelledby="robot-worker-title">
        <p style={{ color: '#64748b', fontSize: 12, fontWeight: 800, margin: '0 0 10px' }}>ACOMPANHAMENTO AUTOMÁTICO</p>
        <h2 id="robot-worker-title" style={{ fontSize: 22, margin: '0 0 12px', color: '#475569' }}>Aguardando a fonte</h2>
        <p style={{ ...muted, margin: 0 }}>O processamento periódico ainda não foi agendado. O monitoramento de clientes está inativo.</p>
      </section>
    </div>
    <section style={card} aria-labelledby="robot-records-title">
      <h2 id="robot-records-title" style={{ fontSize: 21, margin: '0 0 10px' }}>Registros de homologação</h2>
      <p style={{ ...muted, margin: '0 0 12px' }}>
        Contagens consultadas no banco definitivo. Estes registros pertencem às trilhas de homologação e não representam operações reais ou rentabilidade.
      </p>
      <dl style={{ margin: 0 }}>
        <Quantity label="Observações assinadas de QA" value={report.activity.qaReceipts}/>
        <Quantity label="Ciclos de QA" value={report.activity.qaCycles}/>
        <Quantity label="Capturas do motor privado em QA" value={report.activity.privateCaptures}/>
        <Quantity label="Observações privadas contextualizadas em QA" value={report.activity.privateObservations}/>
        <Quantity label="Revisões privadas registradas" value={report.activity.privateRevisions}/>
      </dl>
    </section>
    <section style={{ ...card, background: '#f8faff' }} aria-labelledby="robot-operation-title">
      <h2 id="robot-operation-title" style={{ fontSize: 21, margin: '0 0 10px' }}>Estado da operação</h2>
      <p style={{ ...muted, margin: 0 }}>Ordens reais, Paper externo e geração paga dos robôs estão desativados. Não há resultados financeiros reais certificados.</p>
      <p style={{ ...muted, margin: '10px 0 0' }}>O código certificado R71 e a instalação do banco R72 são a base deste painel. A conexão operacional permanece pendente.</p>
    </section>
    <details style={card}>
      <summary style={{ cursor: 'pointer', fontWeight: 750 }}>Detalhes da verificação do banco</summary>
      <ul style={{ paddingLeft: 20, margin: '16px 0 0', display: 'grid', gap: 9 }}>
        {db.tables.map(row => <li key={row.name} style={{ ...muted, overflowWrap: 'anywhere' }}>
          {row.label}: <strong>{row.available ? 'disponível' : 'não confirmada'}</strong>
        </li>)}
      </ul>
    </details>
  </div>;
}

export default function PlatformRobotDefinitiveAdmin() {
  const [view, setView] = useState({ phase: 'loading', report: null, message: '' });
  const [busy, setBusy] = useState(false);
  const alive = useRef(false), revision = useRef(0), pending = useRef(null), identity = useRef(undefined);
  const authTimer = useRef(null);

  const refresh = useCallback(async () => {
    if (!alive.current || pending.current) return;
    const current = ++revision.current, controller = new AbortController();
    pending.current = { current, controller };
    const active = () => alive.current && current === revision.current;
    setBusy(true);
    try {
      const auth = await platformSupabase?.auth?.getSession(), session = auth?.data?.session;
      if (!active()) return;
      if (auth?.error || !session?.access_token || !session.user?.id || session.user.is_anonymous) {
        setView({ phase: 'access', report: null, message: 'Entre com sua conta administrativa exclusiva da Platform.' });
        return;
      }
      const userId = session.user.id;
      identity.current = userId;
      const response = await fetch(ENDPOINT, { cache: 'no-store', redirect: 'error', signal: controller.signal,
        headers: { Authorization: 'Bearer ' + session.access_token } });
      if (!active()) return;
      if ([401, 403].includes(response.status)) {
        setView({ phase: 'access', report: null, message: response.status === 403
          ? 'Esta conta não possui permissão para administrar os robôs da Platform.'
          : 'Sua sessão da Platform precisa ser confirmada novamente.' });
        return;
      }
      if (!response.ok) throw Error('Não foi possível consultar o estado dos robôs. Tente atualizar novamente.');
      const report = inspectStatus(await response.json());
      if (!active()) return;
      // Recheck identity after the network response; a previous account's feed
      // must never survive a logout or a session switch during this request.
      const latest = await platformSupabase.auth.getSession();
      if (!active()) return;
      if (latest.error || !latest.data?.session?.access_token || latest.data?.session?.user?.id !== userId || latest.data?.session?.user?.is_anonymous || identity.current !== userId) {
        setView({ phase: 'access', report: null, message: 'A sessão mudou. Confirme seu acesso da Platform.' });
        return;
      }
      setView({ phase: 'ready', report, message: '' });
    } catch (error) {
      if (active() && error.name !== 'AbortError') {
        setView({ phase: 'error', report: null, message: 'Não foi possível confirmar o estado dos robôs. Atualize a consulta.' });
      }
    } finally {
      if (pending.current?.current === current) {
        pending.current = null;
        if (alive.current) setBusy(false);
      }
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    const sub = platformSupabase?.auth?.onAuthStateChange((event, session) => {
      const next = session?.user?.is_anonymous ? null : session?.user?.id ?? null;
      const changed = event === 'SIGNED_OUT' || (identity.current !== undefined && identity.current !== next);
      identity.current = next;
      if (!changed && event !== 'SIGNED_IN') return;
      revision.current++;
      pending.current?.controller.abort();
      pending.current = null;
      setBusy(false);
      setView({ phase: next ? 'loading' : 'access', report: null,
        message: next ? '' : 'Entre com sua conta administrativa exclusiva da Platform.' });
      clearTimeout(authTimer.current);
      // Supabase auth callbacks remain synchronous; fetching happens after its
      // auth event has released the session lock.
      if (next) authTimer.current = setTimeout(() => { void refresh(); }, 0);
    });
    void refresh();
    return () => {
      alive.current = false;
      revision.current++;
      pending.current?.controller.abort();
      pending.current = null;
      clearTimeout(authTimer.current);
      sub?.data?.subscription?.unsubscribe?.();
    };
  }, [refresh]);

  return <section aria-label="Estado administrativo dos robôs" style={{ display: 'grid', gap: 20, minWidth: 0 }}>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
      <button type="button" disabled={busy} onClick={() => void refresh()}
        style={{ padding: '11px 18px', border: '1px solid #6d28d9', borderRadius: 10, background: '#6d28d9', color: '#fff', cursor: busy ? 'wait' : 'pointer', fontWeight: 750, fontSize: 14, opacity: busy ? 0.65 : 1 }}>
        {busy ? 'Consultando…' : 'Atualizar estado'}
      </button>
      <span style={{ color: '#64748b', fontSize: 13 }}>Consulta sem alteração dos robôs.</span>
    </div>
    {view.phase === 'loading' ? <p role="status" style={muted}>Verificando sua sessão e consultando o estado dos robôs…</p> : null}
    {view.phase === 'access' ? <section style={card} aria-label="Acesso administrativo da Platform">
      <p role="status" style={{ ...muted, margin: '0 0 14px' }}>{view.message}</p>
      <Link href={LOGIN} style={{ color: '#6d28d9', fontWeight: 750 }}>Entrar com acesso exclusivo da Platform</Link>
    </section> : null}
    {view.phase === 'error' ? <p role="alert" style={{ ...card, color: '#991b1b' }}>{view.message}</p> : null}
    {view.report ? <RobotStatusReport report={view.report}/> : null}
  </section>;
}
