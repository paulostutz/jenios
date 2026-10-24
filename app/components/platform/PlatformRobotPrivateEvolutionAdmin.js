'use client';
import { useEffect, useRef, useState } from 'react';
import { platformSupabase } from '../../../lib/platform/supabase-client';
import { requireR71AdminFeed } from '../../../lib/platform/research/robot-r71-admin-view.mjs';
import PlatformRobotPrivateEvolutionReport from './PlatformRobotPrivateEvolutionReport';

const ENDPOINT = '/api/platform/admin/robot-private-evolution';
const button = { padding: '10px 14px', borderRadius: 9, border: '1px solid #aebee2', background: '#fff', cursor: 'pointer', maxWidth: '100%' };
export default function PlatformRobotPrivateEvolutionAdmin({ readOnly = false }) {
  const [feed, setFeed] = useState(null), [status, setStatus] = useState('loading');
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState('');
  const alive = useRef(true), epoch = useRef(0), inFlight = useRef(null), identity = useRef(undefined), retry = useRef(null);
  const pending = useRef(false); pending.current = Boolean(feed?.state?.pendingEvaluation);
  async function request(action) {
    if (inFlight.current) return;
    const controller = new AbortController(), current = ++epoch.current;
    inFlight.current = { controller, current }; setBusy(true);
    const active = () => alive.current && current === epoch.current;
    try {
      const auth = await platformSupabase?.auth?.getSession(), session = auth?.data?.session;
      if (auth?.error || !session?.access_token || session.user?.is_anonymous) {
        if (active()) { setFeed(null); setStatus('disabled'); } return;
      }
      const headers = { Authorization: 'Bearer ' + session.access_token };
      if (action) headers['Content-Type'] = 'application/json';
      const response = await fetch(ENDPOINT, { method: action ? 'POST' : 'GET', headers,
        body: action ? JSON.stringify(action) : undefined, cache: 'no-store', redirect: 'error', signal: controller.signal });
      if ([401, 403, 404].includes(response.status)) {
        if (active()) { setFeed(null); setStatus('disabled'); retry.current = null; } return;
      }
      const data = await response.json();
      if (!response.ok) throw Error(data?.error || 'O ciclo privado está indisponível.');
      if (!active()) return;
      if (action) {
        if (data.schema !== 'JENIOS_R71_ADMIN_ACTION_V1' || data.action !== action.action ||
            data.productionChanged !== false || data.customerMonitoringActive !== false) throw Error('Resposta administrativa inválida.');
        retry.current = null;
        setNotice(action.action === 'ROLLBACK' ? 'Reversão registrada. Consultando a versão persistida…' : 'Etapa do ciclo registrada. Consultando o resultado…');
        const updated = await fetch(ENDPOINT, { headers: { Authorization: 'Bearer ' + session.access_token },
          cache: 'no-store', redirect: 'error', signal: controller.signal });
        if ([401, 403, 404].includes(updated.status)) {
          if (active()) { setFeed(null); setStatus('disabled'); } return;
        }
        if (!updated.ok) throw Error('Ação registrada; atualize o relatório para confirmar o estado.');
        const next = requireR71AdminFeed(await updated.json());
        if (active()) { setFeed(next); setStatus('ready'); }
      } else {
        const next = requireR71AdminFeed(data);
        if (active()) { setFeed(next); setStatus('ready'); }
      }
    } catch (error) {
      if (active()) { setFeed(null); setStatus('error'); setNotice(error.message || 'Não foi possível confirmar o resultado. Atualize o relatório.'); }
    } finally {
      if (inFlight.current?.current === current) { inFlight.current = null; if (alive.current) setBusy(false); }
    }
  }
  function act(body) {
    if (inFlight.current) return;
    const signature = JSON.stringify(body);
    const value = retry.current?.signature === signature ? retry.current.value : body.action === 'ROLLBACK'
      ? { ...body, operationId: 'op:' + crypto.randomUUID().replaceAll('-', '') } : body;
    // Preserve the same rollback operation after an ambiguous HTTP outcome.
    retry.current = { signature, value }; void request(value);
  }
  useEffect(() => {
    alive.current = true; void request();
    let ticks = 0, authTimer;
    const refresh = () => { if (document.visibilityState === 'visible') void request(); };
    const timer = setInterval(() => { ticks++; if (pending.current || ticks % 12 === 0) refresh(); }, 5000);
    document.addEventListener('visibilitychange', refresh);
    const subscription = platformSupabase?.auth?.onAuthStateChange((event, session) => {
      const next = session?.user?.id ?? null;
      const changed = event === 'SIGNED_OUT' || (identity.current !== undefined && identity.current !== next);
      identity.current = next;
      if (!changed) return;
      epoch.current++; inFlight.current?.controller.abort(); inFlight.current = null; retry.current = null;
      setFeed(null); setNotice(''); setBusy(false); setStatus('loading');
      clearTimeout(authTimer); authTimer = setTimeout(() => { if (alive.current) void request(); }, 0);
    });
    return () => {
      alive.current = false; epoch.current++; inFlight.current?.controller.abort(); inFlight.current = null;
      clearInterval(timer); clearTimeout(authTimer); subscription?.data?.subscription?.unsubscribe();
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);
  if (status === 'disabled') return <p role="status">Entre com uma conta administrativa da Platform para consultar a evolução privada de QA.</p>;
  return <section aria-label="Administração da evolução privada" style={{ display: 'grid', gap: 16, minWidth: 0 }}>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
      <button type="button" style={button} disabled={busy} onClick={() => void request()}>Atualizar evolução privada</button>
      {!readOnly && feed ? <button type="button" style={button} disabled={busy} onClick={() => act({ action: 'TICK' })}>Avançar ciclo privado de QA</button> : null}
      {!readOnly && feed?.state?.activeVersion.forwardPositionOpen ? <button type="button" style={button} disabled={busy}
        onClick={() => act({ action: 'ROLLBACK', expectedRevision: feed.state.revision, previousDigest: feed.state.stateDigest, reason: 'OWNER_REQUEST' })}>
        Restaurar política privada de referência</button> : null}
    </div>
    {status === 'loading' ? <p role="status">Consultando o ciclo privado persistido…</p> : null}
    {notice ? <p role="status">{notice}</p> : null}
    {feed ? <PlatformRobotPrivateEvolutionReport feed={feed}/> : null}
  </section>;
}
