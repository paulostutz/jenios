'use client';
import Link from 'next/link';
import {PLATFORM_PLAN_PREVIEW,formatPlanPreview} from '../../../lib/platform/subscription-readiness.mjs';

/**
 * Billing details require the authenticated payer/link route. This informational
 * card never treats the Social statement as the Platform subscription.
 */
export default function PlatformBillingStatus(){
 return <section role="status" style={{background:'#f8fafc',border:'1px solid #e2e8f0',padding:'18px 20px',borderRadius:12,lineHeight:1.7}}>
  <h3 style={{fontSize:16,color:'#0f172a',margin:'0 0 8px'}}>Assinatura da JENIOS Platform</h3>
  <p style={{fontSize:13,color:'#475569',margin:0}}>Consulte a mensalidade após confirmar o vínculo autenticado com a JENIOS PAY. O extrato da Social não é utilizado como extrato da Platform.</p>
  <p style={{fontSize:12,color:'#92400e',margin:'12px 0 0'}}>Nenhuma cobrança foi solicitada nesta tela. Não interpretamos ausência de dados como assinatura paga, gratuita ou cancelada.</p>
  <div aria-label="Planos mensais em preparação" style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(155px,1fr))',gap:9,marginTop:14}}>
   {PLATFORM_PLAN_PREVIEW.map(plan=><article key={plan.code}
     style={{padding:11,background:'#fff',border:'1px solid #ddd6fe',borderRadius:9}}>
    <strong style={{display:'block',fontSize:12}}>{plan.name}</strong>
    <span style={{display:'block',fontSize:16,color:'#6d28d9',fontWeight:800,marginTop:7}}>{formatPlanPreview(plan.priceCents)} / mês</span>
    <small style={{color:'#92400e'}}>Preço de referência. Confira as condições na contratação.</small>
   </article>)}
  </div>
  <p style={{fontSize:12,margin:'12px 0 0'}}><Link href="/checkout" style={{color:'#6d28d9',fontWeight:800}}>Conferir assinatura e Pix mensal →</Link></p>
 </section>;
}
