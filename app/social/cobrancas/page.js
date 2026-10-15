'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase';
import { readReceipt } from '../../../lib/pay/browser-receipts.mjs';

export default function MyCharges() {
  const [orders, setOrders] = useState([]), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  const [access, setAccess] = useState({});
  const epoch = useRef(0);
  async function load() {
    const version = ++epoch.current;
    setBusy(true); setMessage(''); setOrders([]); setAccess({});
    try {
      if (!supabase) throw new Error('A conexão da conta ainda não foi configurada.');
      const { data } = await supabase.auth.getSession();
      if (!data?.session) throw new Error('Entre na sua conta para consultar suas cobranças.');
      const response = await fetch('/api/jenios-pay/orders', { cache: 'no-store', headers: { authorization: 'Bearer ' + data.session.access_token } });
      const result = await response.json(); if (!response.ok) throw new Error(result.error);
      if (epoch.current === version) setOrders(result.orders);
    } catch (error) { if (epoch.current === version) setMessage(error.message); } finally { if (epoch.current === version) setBusy(false); }
  }
  async function verify(orderId) {
    const version = epoch.current;
    try {
      const { data } = await supabase.auth.getSession();
      if (!data?.session) throw new Error('Entre na sua conta novamente.');
      const receipt = readReceipt(window.sessionStorage, data.session.user.id, orderId);
      if (!receipt) throw new Error('Os dados desta contratação não estão nesta sessão. Retorne à consulta original; o pedido não será liberado para outros dados.');
      const response = await fetch('/api/jenios-pay/access', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + data.session.access_token }, body: JSON.stringify({ orderId, ...receipt }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      if (version === epoch.current) setAccess(previous => ({ ...previous, [orderId]: 'Pagamento e vínculo com o serviço verificados. A execução ou entrega do serviço é uma etapa separada.' }));
    } catch (error) { if (version === epoch.current) setAccess(previous => ({ ...previous, [orderId]: error.message })); }
  }
  useEffect(() => {
    load();
    const subscription = supabase?.auth.onAuthStateChange((event) => { if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') return; epoch.current++; setOrders([]); setAccess({}); setMessage('Sessão atualizada. Clique em Atualizar para consultar sua conta.'); setBusy(false); });
    return () => { epoch.current++; subscription?.data?.subscription?.unsubscribe(); };
  }, []);
  return <main style={{ minHeight: '100vh', background: '#f4f3fa', padding: 24, fontFamily: 'system-ui', color: '#172033' }}><div style={{ maxWidth: 800, margin: 'auto' }}><Link href="/social">← Social</Link><h1>Minhas cobranças</h1><p>A confirmação vem da JENIOS PAY. Nenhum pagamento é liberado apenas por clicar em um botão.</p><button disabled={busy} onClick={load}>{busy ? 'Consultando…' : 'Atualizar'}</button>{message && <p role="alert">{message}</p>}{orders.map(o => <article key={o.id} style={{ background: 'white', padding: 20, marginTop: 12, borderRadius: 12 }}><h2>{o.productName}</h2><strong>{(o.amount_cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong><p>Estado: {o.status}</p><small>Pedido {o.id} · {new Date(o.created_at).toLocaleString('pt-BR')}</small>{o.status === 'paid' && <p><button onClick={() => verify(o.id)}>Verificar contratação</button></p>}{o.status === 'paid' && o.productCode === 'social-crypto-validator' && <p><Link href={'/social/consulta-detalhada?pedido=' + encodeURIComponent(o.id)}>Emitir consulta detalhada e PDF</Link></p>}{access[o.id] && <p role="status">{access[o.id]}</p>}</article>)}{!busy && !message && !orders.length && <p>Nenhuma cobrança encontrada.</p>}</div></main>;
}
