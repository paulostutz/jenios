'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase';
import { moneyToCents } from '../../../lib/pay/catalog.mjs';

const field = { padding: 12, border: '1px solid #cbd5e1', borderRadius: 9, width: '100%', boxSizing: 'border-box' };
const money = n => (n / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export default function AdminCharges() {
  const [data, setData] = useState(null), [drafts, setDrafts] = useState({}), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  const [email, setEmail] = useState(''), [password, setPassword] = useState('');
  const [customer,setCustomer] = useState(''), [status,setStatus] = useState('');
  const epoch = useRef(0);
  useEffect(() => {
    const subscription = supabase?.auth.onAuthStateChange(event => { if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') return; epoch.current++; setData(null); setDrafts({}); setBusy(false); });
    return () => { epoch.current++; subscription?.data?.subscription?.unsubscribe(); };
  },[]);
  async function api(method = 'GET', body) {
    if (!supabase) throw new Error('Supabase não configurado.');
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session) throw new Error('Entre com sua conta de administrador.');
    const query = method === 'GET' ? '?' + new URLSearchParams({cliente:customer,status}) : '';
    const response = await fetch('/api/jenios-pay/admin' + query, { method, cache: 'no-store', headers: { authorization: 'Bearer ' + session.session.access_token, 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const result = await response.json(); if (!response.ok) throw new Error(result.error); return result;
  }
  async function load() {
    const version = ++epoch.current;
    setBusy(true); setMessage(''); setData(null);
    try { const result = await api(); if(version !== epoch.current) return; setData(result); setDrafts(Object.fromEntries(result.products.map(p => [p.code, { price: (p.price_cents / 100).toFixed(2), active: p.active }]))); } catch (error) { if(version === epoch.current) setMessage(error.message); } finally { if(version === epoch.current) setBusy(false); }
  }
  async function login(event) {
    event.preventDefault(); setMessage(''); setData(null);
    try { if (!supabase) throw new Error('Supabase não configurado.'); const { error } = await supabase.auth.signInWithPassword({ email, password }); if (error) throw new Error('Não foi possível entrar com essas credenciais.'); setPassword(''); await load(); } catch (error) { setMessage(error.message); }
  }
  async function save(product) {
    const version = epoch.current;
    setBusy(true); setMessage('');
    try {
      const draft = drafts[product.code];
      const result = await api('PATCH', { code: product.code, price_cents: moneyToCents(draft.price), active: draft.active, updated_at: product.updated_at || null });
      if(version !== epoch.current) return;
      setData(old => ({ ...old, products: old.products.map(p => p.code === product.code ? { ...p, ...result.product } : p) })); setMessage('Preço e disponibilidade salvos. Pedidos anteriores mantêm seu valor original.');
    } catch (error) { setMessage(error.message); } finally { setBusy(false); }
  }
  function edit(code, update) { setDrafts(old => ({ ...old, [code]: { ...old[code], ...update } })); }
  return <main style={{ minHeight: '100vh', background: '#f4f3fa', color: '#172033', padding: '32px 16px', fontFamily: 'system-ui' }}><div style={{ maxWidth: 1120, margin: 'auto' }}><Link href="/admin">← Administração</Link><h1>Preços e cobranças</h1><p>JENIOS PAY · catálogo de serviços Social e planos Platform separados.</p>
    {!data && <section style={{ maxWidth: 440, background: 'white', padding: 24, borderRadius: 16 }}><h2>Acesso financeiro</h2><form onSubmit={login} style={{ display: 'grid', gap: 12 }}><label>E-mail<input type="email" required value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" style={field}/></label><label>Senha<input type="password" required value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" style={field}/></label><button disabled={busy}>Entrar e carregar gestão</button></form><button disabled={busy} onClick={load} style={{ marginTop: 14 }}>Usar minha sessão atual</button><p>Somente contas com permissão financeira validada pelo servidor.</p></section>}
    {message && <p role="status" style={{ padding: 14, background: '#fff7ed', borderRadius: 10 }}>{message}</p>}
    {data && <><button onClick={load} disabled={busy}>Atualizar cobranças</button><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,310px),1fr))', gap: 16, marginTop: 20 }}>{data.products.map(p => <section key={p.code} style={{ background: 'white', padding: 22, borderRadius: 16, border: '1px solid #e2e8f0' }}><small>{p.category === 'platform' ? 'PLATFORM · CHECKOUT SEPARADO' : 'SOCIAL'}</small><h2 style={{ fontSize: 19 }}>{p.name}</h2><p>{p.id ? 'Cadastrado' : 'Valor inicial aprovado · salvar para cadastrar'}</p>{p.variable_amount ? <p>{p.code === 'social-specialist-offer' ? 'Preço definido na oferta do especialista. Comissão JENIOS de 10%.' : 'Orçamento escolhido pelo cliente. Sem preço fixo.'}</p> : <label>Preço em reais{p.billing_type === 'monthly' ? ' / mês' : ' / consulta'}<input type="number" min="0.01" step="0.01" value={drafts[p.code]?.price || ''} onChange={e => edit(p.code, { price: e.target.value })} style={field}/></label>}<p><label><input type="checkbox" checked={drafts[p.code]?.active || false} onChange={e => edit(p.code, { active: e.target.checked })}/> Disponível para contratação</label></p><button disabled={busy} onClick={() => save(p)}>Salvar produto</button></section>)}</div>
    <section style={{ background: 'white', padding: 22, borderRadius: 16, marginTop: 20 }}><h2>Especialistas</h2><p>Comissão JENIOS: {data.specialistCommissionBps / 100}% sobre cada venda. Não há mensalidade fixa definida.</p></section>
    <section style={{ background:'white',padding:22,borderRadius:16,marginTop:20 }}>
      <h2>Pagamentos por cliente</h2>
      <form onSubmit={event=>{event.preventDefault();load();}} style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'end'}}>
        <label style={{flex:'1 1 240px'}}>Nome ou ID do cliente<input value={customer} maxLength={100} onChange={event=>setCustomer(event.target.value)} style={field} placeholder="Nome cadastrado ou UUID"/></label>
        <label>Status<select value={status} onChange={event=>setStatus(event.target.value)} style={field}>
          <option value="">Todos</option>{[['pending','Pendente'],['awaiting_payment','Aguardando pagamento'],['paid','Pago'],['failed','Falhou'],['cancelled','Cancelado'],['expired','Expirado'],['refunded','Reembolsado']].map(([value,label])=><option key={value} value={value}>{label}</option>)}
        </select></label><button disabled={busy}>Buscar pagamentos</button>
      </form>
      <p>Até {data.orderLimit} pedidos mais recentes após os filtros. Busca por nome limitada a {data.customerSearchLimit} perfis; para um cliente específico, use seu ID completo. Aprovação e baixa pela JENIOS PAY.</p>
      <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',textAlign:'left'}}>
        <thead><tr>{['Cliente','Data','Serviço','Valor','Status','Pedido'].map(label=><th key={label} style={{padding:10}}>{label}</th>)}</tr></thead>
        <tbody>{data.orders.map(order=><tr key={order.id} style={{borderTop:'1px solid #e2e8f0'}}>
          <td style={{padding:10}}>{order.customerName}<small style={{display:'block',overflowWrap:'anywhere'}}>{order.customerId}</small></td>
          <td style={{padding:10}}>{new Date(order.created_at).toLocaleString('pt-BR')}</td>
          <td style={{padding:10}}>{data.products.find(product=>product.id===order.product_id)?.name||order.productName}</td>
          <td style={{padding:10}}>{money(order.amount_cents)}</td><td style={{padding:10}}>{order.status}</td><td style={{padding:10}}>{order.id.slice(0,8)}</td>
        </tr>)}</tbody>
      </table>{!data.orders.length&&<p>Nenhum pagamento encontrado para os filtros.</p>}</div>
    </section></>}
  </div></main>;
}
