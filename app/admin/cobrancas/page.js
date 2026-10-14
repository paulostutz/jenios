'use client';
import { useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase';
import { moneyToCents } from '../../../lib/pay/catalog.mjs';

const field = { padding: 12, border: '1px solid #cbd5e1', borderRadius: 9, width: '100%', boxSizing: 'border-box' };
const money = n => (n / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export default function AdminCharges() {
  const [data, setData] = useState(null), [drafts, setDrafts] = useState({}), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  const [email, setEmail] = useState(''), [password, setPassword] = useState('');
  async function api(method = 'GET', body) {
    if (!supabase) throw new Error('Supabase não configurado.');
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session) throw new Error('Entre com sua conta de administrador.');
    const response = await fetch('/api/jenios-pay/admin', { method, cache: 'no-store', headers: { authorization: 'Bearer ' + session.session.access_token, 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const result = await response.json(); if (!response.ok) throw new Error(result.error); return result;
  }
  async function load() {
    setBusy(true); setMessage(''); setData(null);
    try { const result = await api(); setData(result); setDrafts(Object.fromEntries(result.products.map(p => [p.code, { price: (p.price_cents / 100).toFixed(2), active: p.active }]))); } catch (error) { setMessage(error.message); } finally { setBusy(false); }
  }
  async function login(event) {
    event.preventDefault(); setMessage(''); setData(null);
    try { if (!supabase) throw new Error('Supabase não configurado.'); const { error } = await supabase.auth.signInWithPassword({ email, password }); if (error) throw new Error('Não foi possível entrar com essas credenciais.'); setPassword(''); await load(); } catch (error) { setMessage(error.message); }
  }
  async function save(product) {
    setBusy(true); setMessage('');
    try {
      const draft = drafts[product.code];
      const result = await api('PATCH', { code: product.code, price_cents: moneyToCents(draft.price), active: draft.active, updated_at: product.updated_at || null });
      setData(old => ({ ...old, products: old.products.map(p => p.code === product.code ? { ...p, ...result.product } : p) })); setMessage('Preço e disponibilidade salvos. Pedidos anteriores mantêm seu valor original.');
    } catch (error) { setMessage(error.message); } finally { setBusy(false); }
  }
  function edit(code, update) { setDrafts(old => ({ ...old, [code]: { ...old[code], ...update } })); }
  return <main style={{ minHeight: '100vh', background: '#f4f3fa', color: '#172033', padding: '32px 16px', fontFamily: 'system-ui' }}><div style={{ maxWidth: 1120, margin: 'auto' }}><Link href="/admin">← Administração</Link><h1>Preços e cobranças</h1><p>JENIOS PAY · catálogo de serviços Social e planos Platform separados.</p>
    {!data && <section style={{ maxWidth: 440, background: 'white', padding: 24, borderRadius: 16 }}><h2>Acesso financeiro</h2><form onSubmit={login} style={{ display: 'grid', gap: 12 }}><label>E-mail<input type="email" required value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" style={field}/></label><label>Senha<input type="password" required value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" style={field}/></label><button disabled={busy}>Entrar e carregar gestão</button></form><button disabled={busy} onClick={load} style={{ marginTop: 14 }}>Usar minha sessão atual</button><p>Somente contas com permissão financeira validada pelo servidor.</p></section>}
    {message && <p role="status" style={{ padding: 14, background: '#fff7ed', borderRadius: 10 }}>{message}</p>}
    {data && <><button onClick={load} disabled={busy}>Atualizar cobranças</button><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,310px),1fr))', gap: 16, marginTop: 20 }}>{data.products.map(p => <section key={p.code} style={{ background: 'white', padding: 22, borderRadius: 16, border: '1px solid #e2e8f0' }}><small>{p.category === 'platform' ? 'PLATFORM · CHECKOUT SEPARADO' : 'SOCIAL'}</small><h2 style={{ fontSize: 19 }}>{p.name}</h2><p>{p.id ? 'Cadastrado' : 'Valor inicial aprovado · salvar para cadastrar'}</p>{p.variable_amount ? <p>Orçamento escolhido pelo cliente. Sem preço fixo.</p> : <label>Preço em reais{p.billing_type === 'monthly' ? ' / mês' : ' / consulta'}<input type="number" min="0.01" step="0.01" value={drafts[p.code]?.price || ''} onChange={e => edit(p.code, { price: e.target.value })} style={field}/></label>}<p><label><input type="checkbox" checked={drafts[p.code]?.active || false} onChange={e => edit(p.code, { active: e.target.checked })}/> Disponível para contratação</label></p><button disabled={busy} onClick={() => save(p)}>Salvar produto</button></section>)}</div>
    <section style={{ background: 'white', padding: 22, borderRadius: 16, marginTop: 20 }}><h2>Especialistas</h2><p>Comissão JENIOS: {data.specialistCommissionBps / 100}% sobre cada venda. Não há mensalidade fixa definida.</p></section>
    <section style={{ background: 'white', padding: 22, borderRadius: 16, marginTop: 20 }}><h2>Últimas cobranças</h2><p>Até {data.orderLimit} pedidos mais recentes. Estados reais da JENIOS PAY; esta tela não confirma pagamentos manualmente.</p><div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}><thead><tr>{['Pedido', 'Serviço', 'Valor', 'Estado', 'Data'].map(x => <th key={x} style={{ padding: 10 }}>{x}</th>)}</tr></thead><tbody>{data.orders.map(o => <tr key={o.id}><td style={{ padding: 10 }}>{o.id.slice(0, 8)}</td><td>{data.products.find(p => p.id === o.product_id)?.name || 'Produto legado'}</td><td>{money(o.amount_cents)}</td><td>{o.status}</td><td>{new Date(o.created_at).toLocaleString('pt-BR')}</td></tr>)}</tbody></table>{!data.orders.length && <p>Nenhuma cobrança registrada.</p>}</div></section></>}
  </div></main>;
}
