"use client";
import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { saveReceipt } from '../../lib/pay/browser-receipts.mjs';
import { isPrelaunchReport, prelaunchReportHref } from '../../lib/reports/prelaunch.mjs';

export default function SocialChargeButton(props) {
  if (isPrelaunchReport(props.productCode, props.scope || 'social')) return <div style={{ display: 'grid', gap: 7 }}><a href={prelaunchReportHref(props.productCode, props.target)} style={{ padding: '12px 16px', borderRadius: 10, background: '#6d28d9', color: 'white', fontWeight: 800, textAlign: 'center', textDecoration: 'none' }}>Acessar relatório completo grátis</a><small>Pré-lançamento: visualização e PDF gratuitos para contas da Social.</small></div>;
  return <PaidSocialChargeButton {...props}/>;
}
function PaidSocialChargeButton({ productCode, label, target = {}, scope = 'social' }) {
  const [catalog, setCatalog] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [orderId, setOrderId] = useState('');
  const attempt = useRef({ fingerprint: '', key: '' });
  useEffect(() => {
    let active = true;
    fetch('/api/jenios-pay/products?scope=' + scope, { cache: 'no-store' }).then(r => r.json()).then(data => { if (active) setCatalog(data); }).catch(() => { if (active) setMessage('Catálogo indisponível. Tente novamente.'); });
    return () => { active = false; };
  }, [scope]);
  const product = catalog?.products?.find(p => p.code === productCode);
  const amount = product && !product.variable_amount ? (product.price_cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : null;
  async function charge() {
    setBusy(true); setMessage('');
    try {
      const sessionResult = await supabase?.auth.getSession();
      if(sessionResult?.error)throw Error('Não foi possível verificar sua conta. Tente novamente.');
      const data=sessionResult?.data, session=data?.session;
      const guest=!session?.access_token;
      if(guest){
        if(scope!=='social'||!['social-bankscore-report','social-crypto-validator'].includes(productCode))throw Error('Entre na sua conta antes de contratar.');
        const prepared=await fetch('/api/jenios-pay/guest-session',{method:'POST'});
        if(!prepared.ok){const info=await prepared.json();throw Error(info.error||'Compra sem cadastro indisponível.');}
      }
      const body = { productCode, target };
      const fingerprint = JSON.stringify({ userId: session?.user?.id||'guest', ...body });
      if (attempt.current.fingerprint !== fingerprint) attempt.current = { fingerprint, key: crypto.randomUUID() };
      const response = await fetch(scope === 'platform' ? '/api/platform/checkout' : '/api/jenios-pay/checkout', {
        method: 'POST', headers: { 'content-type': 'application/json', ...(session?.access_token?{authorization:'Bearer '+session.access_token}:{}), 'idempotency-key': attempt.current.key }, body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Não foi possível gerar a cobrança.');
      setOrderId(result.orderId);
      if (scope === 'social') saveReceipt(window.sessionStorage, session?.user?.id||'guest', result.orderId, body);
      if (result.status === 'paid') { setMessage('Pagamento confirmado na JENIOS PAY.'); return; }
      if (!result.checkoutUrl) throw new Error('A JENIOS PAY não retornou o checkout.');
      window.location.assign(result.checkoutUrl);
    } catch (error) { setMessage(error.message); } finally { setBusy(false); }
  }
  return <div style={{ display: 'grid', gap: 7 }}>
    <button type="button" onClick={charge} disabled={busy || !product || product.active === false || product.serviceReady === false} style={{ padding: '12px 16px', border: 0, borderRadius: 10, background: '#6d28d9', color: 'white', fontWeight: 800, cursor: busy ? 'wait' : 'pointer', opacity: busy || product?.active === false ? .6 : 1 }}>{busy ? 'Preparando cobrança…' : (product?.serviceReady === false ? 'Serviço ainda indisponível' : label) + (amount ? ' · ' + amount : '')}</button>
    {product?.unavailableReason && <small role="status">{product.unavailableReason}</small>}
    {message && <small role="status" style={{ color: '#92400e', lineHeight: 1.5 }}>{message}</small>}
    {orderId && <small>Pedido: {orderId} · <a href="/social/cobrancas">Minhas cobranças</a></small>}
    {orderId && productCode === 'social-crypto-validator' && <a href={'/social/consulta-detalhada?pedido=' + encodeURIComponent(orderId)}>Abrir consulta detalhada após a confirmação</a>}
    {orderId && productCode === 'social-bankscore-report' && <a href={'/bankscore/detalhado?pedido=' + encodeURIComponent(orderId)}>Abrir laudo e PDF após a confirmação</a>}
    {orderId && productCode === 'social-specialist-offer' && <a href="/especialistas/atendimentos">Acompanhar atendimento após a confirmação</a>}
    {orderId && productCode === 'social-boost' && <a href="/impulsionar/campanhas">Acompanhar e ativar campanha após a confirmação</a>}
  </div>;
}
