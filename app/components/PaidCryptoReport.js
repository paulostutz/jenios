'use client';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import WalletInventory from './WalletInventory';
import { supabase } from '../../lib/supabase';
import { readReceipt, saveReceipt } from '../../lib/pay/browser-receipts.mjs';

const networks = ['ethereum', 'bitcoin', 'bsc', 'tron', 'solana', 'polygon', 'arbitrum', 'base', 'avalanche'];
const field = { display: 'block', width: '100%', padding: 12, border: '1px solid #cbd5e1', borderRadius: 8, marginTop: 6, boxSizing: 'border-box' };
const button = { padding: '12px 18px', background: '#6d28d9', color: 'white', border: 0, borderRadius: 9, fontWeight: 700, cursor: 'pointer' };

export default function PaidCryptoReport() {
  const search = useSearchParams();
  const orderId = search.get('pedido') || '';
  const [network, setNetwork] = useState('ethereum'), [type, setType] = useState('transaction'), [identifier, setIdentifier] = useState('');
  const [report, setReport] = useState(null), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  const epoch = useRef(0), inFlight = useRef(false);
  useEffect(() => {
    const version = ++epoch.current;
    setReport(null); setMessage(''); setIdentifier(''); setNetwork('ethereum'); setType('transaction'); setBusy(false); inFlight.current = false;
    if (supabase) supabase.auth.getSession().then(({ data }) => {
      if (version !== epoch.current || !data?.session) return;
      const saved = readReceipt(window.sessionStorage, data.session.user.id, orderId);
      if (saved?.productCode === 'social-crypto-validator' && saved.target) {
        if (networks.includes(saved.target.network)) setNetwork(saved.target.network);
        if (['transaction', 'wallet', 'token'].includes(saved.target.type)) setType(saved.target.type);
        setIdentifier(String(saved.target.identifier || ''));
      }
    }).catch(() => { if (version === epoch.current) setMessage('Não foi possível consultar a sessão. Entre novamente.'); });
    const subscription = supabase?.auth.onAuthStateChange(event => {
      if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') return;
      epoch.current++; setReport(null); setIdentifier(''); setBusy(false); inFlight.current = false;
      setMessage('A conta mudou. Reabra a contratação em Minhas cobranças.');
    });
    return () => { epoch.current++; subscription?.data?.subscription?.unsubscribe(); };
  }, [orderId]);

  function reset() { epoch.current++; setReport(null); setMessage(''); }
  async function emit(format) {
    if (inFlight.current) return;
    inFlight.current = true;
    const version = ++epoch.current;
    setBusy(true); setMessage(''); if (format === 'json') setReport(null);
    try {
      if (!supabase) throw new Error('A conexão da conta ainda não foi configurada.');
      if (!orderId) throw new Error('Selecione o pedido em Minhas cobranças.');
      const { data, error } = await supabase.auth.getSession();
      if (error || !data?.session) throw new Error('Entre na conta que realizou a contratação.');
      const target = { network, type, identifier: identifier.trim() };
      const response = await fetch('/api/crypto-validator/detailed', { method: 'POST', cache: 'no-store', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + data.session.access_token }, body: JSON.stringify({ orderId, target, format }) });
      if (!response.ok) { const result = await response.json().catch(() => ({})); throw new Error(result.error || 'Não foi possível emitir o relatório.'); }
      if (version !== epoch.current) return;
      saveReceipt(window.sessionStorage, data.session.user.id, orderId, { productCode: 'social-crypto-validator', target });
      if (format === 'pdf') {
        const blob = await response.blob();
        if (version !== epoch.current) return;
        const url = URL.createObjectURL(blob), link = document.createElement('a');
        link.href = url; link.download = 'jenios-crypto-detalhado.pdf'; document.body.appendChild(link); link.click(); link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        setMessage('PDF emitido com nova leitura da rede; o estado pode diferir da consulta anterior.');
      } else { const result = await response.json(); if (version === epoch.current) setReport(result.report); }
    } catch (error) { if (version === epoch.current) setMessage(error.message); }
    finally { if (version === epoch.current) { setBusy(false); inFlight.current = false; } }
  }
  return <main style={{ minHeight: '100vh', padding: 24, background: '#f4f3fa', fontFamily: 'system-ui', color: '#172033' }}><div style={{ maxWidth: 820, margin: 'auto' }}>
    <Link href="/social/cobrancas">← Minhas cobranças</Link><h1>Consulta detalhada de criptoativos</h1>
    <p>Pedido: {orderId || 'não selecionado'}</p><p>Use a mesma rede, tipo e identificador contratados. O servidor confere o pagamento e o vínculo com esta consulta antes de emitir o relatório.</p>
    <p>Inclui interpretação, inventário dos tokens quando a fonte da rede permitir e PDF. A cobertura é informada no relatório; não é auditoria de código ou garantia contra fraude. Não solicitamos chaves privadas.</p>
    <form onSubmit={event => { event.preventDefault(); emit('json'); }} style={{ display: 'grid', gap: 16, background: 'white', borderRadius: 14, padding: 22 }}>
      <label>Rede<select disabled={busy} style={field} value={network} onChange={e => { reset(); setNetwork(e.target.value); }}>{networks.map(n => <option key={n} value={n}>{n}</option>)}</select></label>
      <label>Tipo<select disabled={busy} style={field} value={type} onChange={e => { reset(); setType(e.target.value); }}><option value="transaction">Transação / hash</option><option value="wallet">Carteira</option><option value="token">Token / contrato</option></select></label>
      <label>Identificador<textarea disabled={busy} style={field} rows={3} spellCheck={false} value={identifier} onChange={e => { reset(); setIdentifier(e.target.value); }} required maxLength={180} /></label>
      <button style={button} disabled={busy || !orderId}>{busy ? 'Verificando pedido e consultando rede…' : 'Emitir consulta detalhada'}</button>
    </form>
    {message && <p role="status">{message}</p>}
    {report && <section style={{ background: 'white', padding: 22, borderRadius: 14, marginTop: 20 }}><h2>Relatório detalhado</h2><p>{report.networkLabel} · {report.status}</p><p style={{ overflowWrap: 'anywhere' }}>{report.identifier}</p><p>Emitido em {new Date(report.checkedAt).toLocaleString('pt-BR')}</p>
      {report.detail.findings.map(item => <article key={item.code} style={{ borderTop: '1px solid #e2e8f0', paddingTop: 10 }}><h3>{item.title}</h3><small>{{ observed: 'Observado', attention: 'Atenção', inconclusive: 'Inconclusivo' }[item.level]}</small><p>{item.explanation}</p></article>)}
      <h3>Evidências da fonte</h3><dl>{Object.entries(report.evidence || {}).map(([key, value]) => <div key={key}><dt style={{ fontWeight: 700 }}>{key}</dt><dd style={{ overflowWrap: 'anywhere' }}>{value == null ? 'Não informado' : typeof value === 'object' ? JSON.stringify(value) : String(value)}</dd></div>)}</dl>
      <WalletInventory inventory={report.inventory}/>
      <h3>Limites</h3><ul>{report.detail.limitations.map(item => <li key={item}>{item}</li>)}</ul><p>{report.detail.methodology}</p>
      <button style={button} disabled={busy} onClick={() => emit('pdf')}>Baixar relatório detalhado em PDF</button>
    </section>}
  </div></main>;
}
