'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import SocialChargeButton from '../components/SocialChargeButton';
import {projectPlatformCatalog} from '../../lib/platform/checkout-readiness.mjs';

export default function PlatformCheckout() {
  const [plans, setPlans] = useState([]);
  const [selected, setSelected] = useState('platform-global-crypto');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active=true;
    const controller=new AbortController();
    async function load(){
      try {
        const response=await fetch('/api/jenios-pay/products?scope=platform',{cache:'no-store',signal:controller.signal});
        if(!response.ok)throw Error('Não foi possível verificar o catálogo.');
        const catalog=await response.json();
        if(!active)return;
        if(catalog?.checkoutScope!=='platform')throw Error('Este catálogo não corresponde à Platform.');
        setPlans(projectPlatformCatalog(catalog));
      }catch(e){if(active&&e.name!=='AbortError')setMessage('Não foi possível conferir os planos agora. Nenhuma contratação foi iniciada.');}
      finally{if(active)setLoading(false);}
    }
    void load();
    return()=>{active=false;controller.abort();};
  },[]);

  const chosen=plans.find(p=>p.code===selected);
  return <main style={{minHeight:'100vh',background:'#f4f3fa',padding:'32px 16px',fontFamily:'system-ui',color:'#172033'}}>
    <div style={{maxWidth:1050,margin:'auto'}}>
      <Link href="/dashboard-logado">← JENIOS Platform</Link>
      <p style={{color:'#6d28d9',letterSpacing:2,fontWeight:800,marginTop:30}}>JENIOS PLATFORM</p>
      <h1>Escolha seu plano mensal</h1>
      <p>Checkout exclusivo da plataforma de negociações, separado dos serviços da Social.</p>
      {message&&<p role="alert">{message}</p>}
      {loading&&<p role="status">Verificando disponibilidade dos planos…</p>}
      {!loading&&!message&&!plans.length&&<p role="status">Os planos estão sendo preparados. Nenhuma cobrança está disponível.</p>}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,270px),1fr))',gap:18,margin:'28px 0'}}>
        {plans.map(plan=><button key={plan.code} type="button" onClick={()=>setSelected(plan.code)}
          aria-pressed={selected===plan.code} style={{padding:26,textAlign:'left',border:selected===plan.code?'2px solid #6d28d9':'1px solid #d8d2e5',borderRadius:18,background:'white',color:'#172033',cursor:'pointer'}}>
          <small>{selected===plan.code?'PLANO SELECIONADO':'ASSINATURA MENSAL'}</small>
          <h2>{plan.name}</h2>
          <strong style={{fontSize:30,color:'#6d28d9'}}>{Number.isSafeInteger(plan.price_cents)&&plan.price_cents>0?(plan.price_cents/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):'Valor em revisão'}</strong><span> / mês</span>
          <p>{plan.description}</p>
          {!plan.canCheckout&&<small style={{fontWeight:700,color:'#92400e'}}>{plan.checkoutNotice}</small>}
        </button>)}
      </div>
      {chosen&&<section style={{background:'white',padding:24,borderRadius:16}}>
        <h2>{chosen.canCheckout?'Continuar com a JENIOS PAY':'Assinaturas em preparação'}</h2>
        {chosen.canCheckout?<><p>Você será direcionado ao checkout existente. A assinatura só será confirmada após o pagamento registrado pela PAY.</p>
          <SocialChargeButton productCode={chosen.code} label="Contratar plano mensal" scope="platform"/>
        </>:<p role="status">{chosen.checkoutNotice} Você pode conhecer a plataforma, mas nenhuma cobrança será solicitada nesta etapa.</p>}
        <p style={{fontSize:13,color:'#64748b'}}>Os preços iniciais aprovados são R$ 99,90, R$ 149,90 e R$ 199,90/mês. Alterações futuras são administradas no painel de preços.</p>
      </section>}
    </div>
  </main>;
}
