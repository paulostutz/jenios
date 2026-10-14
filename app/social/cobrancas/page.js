'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase';

export default function MyCharges() {
  const [orders, setOrders] = useState([]), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  async function load() {
    setBusy(true); setMessage(''); setOrders([]);
    try {
      const { data } = await supabase.auth.getSession();
      if (!data?.session) throw new Error('Entre na sua conta para consultar suas cobranças.');
      const response = await fetch('/api/jenios-pay/orders', { cache: 'no-store', headers: { authorization: 'Bearer ' + data.session.access_token } });
      const result = await response.json(); if (!response.ok) throw new Error(result.error); setOrders(result.orders);
    } catch (error) { setMessage(error.message); } finally { setBusy(false); }
  }
  useEffect(() => { load(); }, []);
  return <main style={{ minHeight: '100vh', background: '#f4f3fa', padding: 24, fontFamily: 'system-ui', color: '#172033' }}><div style={{ maxWidth: 800, margin: 'auto' }}><Link href="/social">← Social</Link><h1>Minhas cobranças</h1><p>A confirmação vem da JENIOS PAY. Nenhum pagamento é liberado apenas por clicar em um botão.</p><button disabled={busy} onClick={load}>{busy ? 'Consultando…' : 'Atualizar'}</button>{message && <p role="alert">{message}</p>}{orders.map(o => <article key={o.id} style={{ background: 'white', padding: 20, marginTop: 12, borderRadius: 12 }}><strong>{(o.amount_cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong><p>Estado: {o.status}</p><small>Pedido {o.id} · {new Date(o.created_at).toLocaleString('pt-BR')}</small></article>)}{!busy && !message && !orders.length && <p>Nenhuma cobrança encontrada.</p>}</div></main>;
}
