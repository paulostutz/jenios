'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import { readReceipt } from '../../lib/pay/browser-receipts.mjs';

export default function PaymentStatement({ embedded = false }) {
  const Container = embedded ? 'section' : 'main';
  const Heading = embedded ? 'h2' : 'h1';
  const labels = {pending:'Pendente',awaiting_payment:'Aguardando pagamento',paid:'Pago',failed:'Falhou',cancelled:'Cancelado',expired:'Expirado',refunded:'Reembolsado'};
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
  return <Container style={{ background:'#fff', padding:embedded ? 20 : 24, borderRadius:16, fontFamily:'system-ui', color:'#172033' }}>
    <div style={{ maxWidth:1000, margin:'auto' }}>
      {!embedded && <Link href="/dashboard-logado">← Minha dashboard</Link>}
      <Heading>Meus pagamentos</Heading>
      <p>Extrato dos 50 pedidos mais recentes. Confirmação e baixa automáticas pela JENIOS PAY.</p>
      <button disabled={busy} onClick={load}>{busy ? 'Consultando…' : 'Atualizar extrato'}</button>
      {message && <p role="alert">{message}</p>}
      <div style={{overflowX:'auto',marginTop:16}}><table style={{width:'100%',borderCollapse:'collapse',textAlign:'left'}}>
        <thead><tr>{['Data','Serviço','Valor','Status','Acesso'].map(label=><th key={label} style={{padding:10}}>{label}</th>)}</tr></thead>
        <tbody>{orders.map(o=><tr key={o.id} style={{borderTop:'1px solid #e2e8f0'}}>
          <td style={{padding:10}}>{new Date(o.created_at).toLocaleString('pt-BR')}</td>
          <td style={{padding:10}}>{o.productName}<small style={{display:'block'}}>Pedido {o.id.slice(0,8)}</small></td>
          <td style={{padding:10,whiteSpace:'nowrap'}}>{(o.amount_cents/100).toLocaleString('pt-BR',{style:'currency',currency:o.currency||'BRL'})}</td>
          <td style={{padding:10}}>{labels[o.status]||o.status}</td>
          <td style={{padding:10}}>
            {o.status==='paid' && o.productCode==='social-crypto-validator' && <Link href={'/social/consulta-detalhada?pedido='+encodeURIComponent(o.id)}>Consulta e PDF</Link>}
            {o.status==='paid' && o.productCode==='social-bankscore-report' && <Link href={'/bankscore/detalhado?pedido='+encodeURIComponent(o.id)}>Laudo e PDF</Link>}
            {o.productCode==='social-specialist-offer' && <Link href="/especialistas/atendimentos">Atendimento</Link>}
            {o.productCode==='social-boost' && <Link href="/impulsionar/campanhas">Campanha</Link>}
            {o.status==='paid' && <div><button onClick={()=>verify(o.id)}>Verificar acesso</button></div>}
            {['pending','awaiting_payment'].includes(o.status) && <small>Aguardando confirmação da cobrança original.</small>}
            {access[o.id] && <p role="status">{access[o.id]}</p>}
          </td>
        </tr>)}</tbody>
      </table></div>
      {!busy&&!message&&!orders.length&&<p>Nenhum pagamento registrado.</p>}
      <p><Link href="/checkout">Planos da Platform — checkout separado</Link></p>
    </div>
  </Container>;
}
