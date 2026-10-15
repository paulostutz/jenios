'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase';

const money = cents => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const states = { pending: 'Aguardando especialista', accepted: 'Aceito pelo especialista', scheduled: 'Agendado', delivered: 'Entrega informada pelo especialista', completed: 'Recebimento confirmado pelo cliente', declined: 'Recusado — resolução financeira pendente' };
const actions = { accept: 'Aceitar atendimento', decline: 'Recusar atendimento', schedule: 'Agendar ou reagendar', deliver: 'Informar entrega', complete: 'Confirmar recebimento' };
const field = { width: '100%', boxSizing: 'border-box', padding: 12, margin: '6px 0 14px', border: '1px solid #cbd5e1', borderRadius: 8 };
function safeLink(value) { try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; } catch { return false; } }

export default function SpecialistAppointments() {
  const [role, setRole] = useState('buyer'), [orders, setOrders] = useState([]), [nextPage, setNextPage] = useState(null);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [selection, setSelection] = useState(null);
  const [scheduledAt, setScheduledAt] = useState(''), [meetingUrl, setMeetingUrl] = useState(''), [deliveryNote, setDeliveryNote] = useState('');
  const epoch = useRef(0);
  async function api(method, body, page = 1) {
    if (!supabase) throw new Error('A conexão da conta ainda não foi configurada.');
    const { data, error } = await supabase.auth.getSession();
    if (error || !data?.session) throw new Error('Entre na sua conta para acompanhar os atendimentos.');
    const response = await fetch('/api/specialists/orders?role=' + role + '&page=' + page, { method, cache: 'no-store', headers: { authorization: 'Bearer ' + data.session.access_token, ...(body ? { 'content-type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Não foi possível concluir a operação.');
    return result;
  }
  async function load(page = 1) {
    const version = ++epoch.current;
    setBusy(true); setMessage(''); setSelection(null);
    if (page === 1) setOrders([]);
    try {
      const result = await api('GET', null, page);
      if (version === epoch.current) { setOrders(previous => page === 1 ? result.orders : [...previous, ...result.orders]); setNextPage(result.nextPage); }
    } catch (error) { if (version === epoch.current) setMessage(error.message); }
    finally { if (version === epoch.current) setBusy(false); }
  }
  useEffect(() => { load(); return () => { epoch.current++; }; }, [role]);
  useEffect(() => {
    const listener = supabase?.auth.onAuthStateChange(event => {
      if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') return;
      epoch.current++; setOrders([]); setNextPage(null); setSelection(null); setDeliveryNote(''); setMeetingUrl(''); setScheduledAt(''); setBusy(false); setMessage('A conta mudou. Atualize a lista.');
    });
    return () => { epoch.current++; listener?.data?.subscription?.unsubscribe(); };
  }, []);
  function choose(order, action) { setSelection({ orderId: order.orderId, revision: order.revision, action }); setScheduledAt(''); setMeetingUrl(''); setDeliveryNote(''); setMessage(''); }
  async function submit(event) {
    event.preventDefault(); if (!selection || busy) return;
    const version = ++epoch.current; setBusy(true); setMessage('');
    try {
      const body = { ...selection, deliveryNote, meetingUrl, ...(selection.action === 'schedule' ? { scheduledAt: new Date(scheduledAt).toISOString() } : {}) };
      const result = await api('PATCH', body);
      if (version !== epoch.current) return;
      setOrders(previous => previous.map(order => order.orderId === result.order.orderId ? result.order : order)); setSelection(null);
      setMessage('Atendimento atualizado. Nenhum pagamento, reembolso ou repasse foi executado por esta ação.');
    } catch (error) { if (version === epoch.current) setMessage(error.message); }
    finally { if (version === epoch.current) setBusy(false); }
  }
  return <main style={{ minHeight: '100vh', background: '#f5f3fa', color: '#241c39', padding: 24, fontFamily: 'system-ui' }}><div style={{ maxWidth: 950, margin: 'auto' }}>
    <Link href="/especialistas">← Especialistas</Link><h1>Meus atendimentos</h1><p>Acompanhe a oferta contratada, o agendamento e a entrega. O atendimento é liberado somente após pagamento registrado na JENIOS PAY.</p>
    <nav style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}><button disabled={busy || role === 'buyer'} aria-pressed={role === 'buyer'} onClick={() => { setOrders([]); setRole('buyer'); }}>Serviços que contratei</button><button disabled={busy || role === 'seller'} aria-pressed={role === 'seller'} onClick={() => { setOrders([]); setRole('seller'); }}>Meus clientes</button><button disabled={busy} onClick={() => load()}>Atualizar</button><Link href="/social/cobrancas">Minhas cobranças</Link></nav>
    {busy && <p role="status">Consultando…</p>}{message && <p role="status">{message}</p>}
    {orders.map(order => <article key={order.orderId} style={{ background: 'white', padding: 24, borderRadius: 14, marginTop: 18 }}>
      <h2>{order.snapshot.title}</h2><p>Especialista: {order.snapshot.sellerName}</p><p style={{ whiteSpace: 'pre-wrap' }}>{order.snapshot.description}</p><p>{money(order.amount_cents)} · {states[order.state] || order.state}</p><p>Estado financeiro informado pela PAY: {order.paymentStatus}</p>
      <small style={{ overflowWrap: 'anywhere' }}>Pedido {order.orderId} · revisão {order.revision}</small>
      {order.role === 'seller' && <p>Comissão JENIOS: {money(order.commission_cents)} (10%). Parcela prevista do especialista: {money(order.seller_amount_cents)}, antes de outros custos. Isso não indica repasse já realizado.</p>}
      {order.scheduledAt && <p>Horário: {new Date(order.scheduledAt).toLocaleString('pt-BR')} (fuso do seu navegador).</p>}
      {safeLink(order.meetingUrl) && <p><a href={order.meetingUrl} target="_blank" rel="noopener noreferrer">Abrir link informado pelo especialista ↗</a></p>}
      {order.deliveryNote && <p style={{ whiteSpace: 'pre-wrap' }}>{order.deliveryNote}</p>}
      {order.state === 'declined' && <p>A recusa não reembolsa nem cancela automaticamente a cobrança. A resolução deve ser acompanhada pela gestão financeira.</p>}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>{order.actions.map(action => <button key={action} disabled={busy} onClick={() => choose(order, action)}>{actions[action]}</button>)}</div>
      {selection?.orderId === order.orderId && <form onSubmit={submit} style={{ borderTop: '1px solid #ddd', marginTop: 16, paddingTop: 16 }}><h3>{actions[selection.action]}</h3>
        {selection.action === 'schedule' && <><label>Data e hora no fuso do seu navegador<input required disabled={busy} type="datetime-local" value={scheduledAt} onChange={event => setScheduledAt(event.target.value)} style={field} /></label><label>Link HTTPS da sessão (opcional)<input disabled={busy} type="url" value={meetingUrl} maxLength={1500} onChange={event => setMeetingUrl(event.target.value)} style={field} /></label></>}
        {['deliver', 'decline'].includes(selection.action) && <label>{selection.action === 'deliver' ? 'Descreva o serviço entregue e como acessá-lo' : 'Motivo da recusa'}<textarea required disabled={busy} minLength={10} maxLength={2000} value={deliveryNote} onChange={event => setDeliveryNote(event.target.value)} style={field} /></label>}
        {selection.action === 'complete' && <p>Confirme apenas se recebeu o serviço. Esta confirmação não executa repasse financeiro.</p>}
        <button disabled={busy} type="submit">Confirmar ação</button> <button disabled={busy} type="button" onClick={() => setSelection(null)}>Voltar</button>
      </form>}
      <details style={{ marginTop: 16 }}><summary>Histórico do atendimento</summary><ul>{order.history.map((event, index) => <li key={index}>{actions[event.action] || event.action} · {event.role === 'seller' ? 'especialista' : 'cliente'} · {new Date(event.at).toLocaleString('pt-BR')}</li>)}</ul></details>
    </article>)}
    {!busy && !message && !orders.length && <p>Nenhum atendimento encontrado. Pedidos anteriores à ativação desta área não são importados automaticamente.</p>}{nextPage && <button disabled={busy} onClick={() => load(nextPage)}>Carregar mais</button>}
  </div></main>;
}
