'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase';
const names = { pending: 'Aguardando ativação', active: 'Ativa', paused: 'Pausada', ended: 'Período encerrado', cancelled: 'Cancelada na distribuição' };
const actions = { start: 'Ativar após pagamento', pause: 'Pausar', resume: 'Retomar', cancel: 'Cancelar distribuição' };
const money = value => (value / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export default function MyCampaigns() {
  const [campaigns, setCampaigns] = useState([]), [nextPage, setNextPage] = useState(null), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  const epoch = useRef(0);
  async function api(method, body, page = 1) {
    if (!supabase) throw new Error('Conexão não configurada.');
    const { data } = await supabase.auth.getSession(); if (!data?.session) throw new Error('Entre na conta que contratou a campanha.');
    const response = await fetch('/api/social/campaigns?page=' + page, { method, cache: 'no-store', headers: { authorization: 'Bearer ' + data.session.access_token, ...(body ? { 'content-type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const result = await response.json(); if (!response.ok) throw new Error(result.error); return result;
  }
  async function load(page = 1) {
    const version = ++epoch.current; setBusy(true); setMessage(''); if (page === 1) { setCampaigns([]); setNextPage(null); }
    try { const result = await api('GET', null, page); if (version === epoch.current) { setCampaigns(previous => page === 1 ? result.campaigns : [...previous, ...result.campaigns]); setNextPage(result.nextPage); } }
    catch (error) { if (version === epoch.current) setMessage(error.message); }
    finally { if (version === epoch.current) setBusy(false); }
  }
  useEffect(() => {
    load(); const listener = supabase?.auth.onAuthStateChange(event => { if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') return; epoch.current++; setCampaigns([]); setNextPage(null); setBusy(false); setMessage('A conta mudou. Atualize a lista.'); });
    return () => { epoch.current++; listener?.data?.subscription?.unsubscribe(); };
  }, []);
  async function act(campaign, action) {
    if (busy || (action === 'cancel' && !window.confirm('Cancelar a distribuição? Esta ação não reembolsa a cobrança automaticamente.'))) return;
    const version = ++epoch.current; setBusy(true); setMessage('');
    try { await api('PATCH', { orderId: campaign.orderId, revision: campaign.revision, action }); if (version === epoch.current) await load(); }
    catch (error) { if (version === epoch.current) setMessage(error.message); }
    finally { if (version === epoch.current) setBusy(false); }
  }
  return <main style={{ minHeight: '100vh', padding: 24, background: '#f5f3fa', color: '#241c39', fontFamily: 'system-ui' }}><div style={{ maxWidth: 900, margin: 'auto' }}><Link href="/impulsionar">← Criar impulsionamento</Link><h1>Minhas campanhas</h1><p>Distribuição interna na JENIOS Social. Ativação exige pedido pago e publicação própria disponível. Não publica anúncios em redes externas.</p><p>O período começa na ativação e continua correndo durante a pausa. Cancelar ou pausar não altera o pagamento nem executa reembolso. Não há garantia de alcance.</p><button disabled={busy} onClick={() => load()}>Atualizar</button> <Link href="/social/cobrancas">Minhas cobranças</Link>{busy && <p>Consultando…</p>}{message && <p role="status">{message}</p>}
    {campaigns.map(c => <article key={c.orderId} style={{ background: 'white', padding: 22, borderRadius: 14, marginTop: 16 }}><h2>{names[c.state]}</h2><p>Pedido {c.orderId}</p><p>Pagamento PAY: {c.paymentStatus}</p><p>Investimento contratado: {money(c.amount_cents)} · {c.target.days} dias × {money(c.target.dailyCents)}/dia</p><p>Público autodeclarado: {[c.target.country, c.target.region, c.target.city].filter(Boolean).join(' / ')} · objetivo {c.target.objective}</p>{c.startsAt && <p>Período: {new Date(c.startsAt).toLocaleString('pt-BR')} até {new Date(c.endsAt).toLocaleString('pt-BR')}</p>}<p>Registros de exibição: {c.impressions} · cliques: {c.clicks}</p><small>Contagem deduplicada por conta, campanha e dia UTC; não equivale a alcance único total, auditoria antifraude, gasto consumido ou cobrança por clique. Orçamento diário influencia a seleção de anúncios elegíveis, não garante quantidade.</small><p style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>{c.actions.map(action => <button disabled={busy} key={action} onClick={() => act(c, action)}>{actions[action]}</button>)}</p><small>Post {c.postId} · revisão {c.revision}</small></article>)}{!busy && !message && !campaigns.length && <p>Nenhuma campanha encontrada. Pedidos anteriores à ativação desta extensão não são importados automaticamente.</p>}{nextPage && <button disabled={busy} onClick={() => load(nextPage)}>Carregar mais</button>}</div></main>;
}
