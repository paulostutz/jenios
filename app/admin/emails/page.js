'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import AdminAccess,{adminFetch} from '../../components/AdminAccess';

const LABELS={
 finance:'Confirmação de pagamento',
 transactional:'Ciclo de conta e assinatura',
 dunning:'Vencimentos e inadimplência',
 marketing:'Marketing com consentimento'
};
const STATUS_LABELS={
 pending:'Pendente',processing:'Processando',retry:'Retry',sent:'Enviado',
 blocked:'Bloqueado',uncertain:'Incerto',superseded:'Superado',planned:'Planejado',
 suppressed:'Suprimido',failed:'Falhou'
};
const GATE_LABELS={
 JENIOS_PAYMENT_EMAILS_ENABLED:'Pagamento',
 JENIOS_TRANSACTIONAL_EMAILS_ENABLED:'Transacionais',
 JENIOS_SUBSCRIPTION_DUNNING_ENABLED:'Régua de vencimento',
 JENIOS_MARKETING_PLANNER_ENABLED:'Planner de marketing',
 JENIOS_MARKETING_EMAILS_ENABLED:'Entrega de marketing',
 JENIOS_B305_TEST_SEND_APPROVED:'Envio de teste',
 JENIOS_B305_PRIVATE_EMAIL_RUNNER_ENABLED:'Runner privado'
};

function EmailHealth(){
 const [data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function load(){
  setBusy(true);setError('');
  try{
   const response=await adminFetch('/api/admin/email-health');
   setData(await response.json());
  }catch(e){setError(e.message||'Não foi possível carregar.');}
  finally{setBusy(false);}
 }
 useEffect(()=>{void load();},[]);
 return <main style={{minHeight:'100vh',background:'#f4f3fa',padding:'32px 16px',fontFamily:'system-ui',color:'#172033'}}>
  <div style={{maxWidth:1120,margin:'auto'}}>
   <Link href="/admin">← Administração</Link>
   <div style={{display:'flex',justifyContent:'space-between',gap:16,alignItems:'end',flexWrap:'wrap'}}>
    <div><small>JENIOS · OBSERVABILIDADE</small><h1 style={{marginBottom:6}}>Saúde dos e-mails</h1>
     <p style={{marginTop:0,color:'#64748b'}}>Somente leitura. Nenhum envio, cobrança ou alteração pode ser feito nesta tela.</p></div>
    <button disabled={busy} onClick={load}>{busy?'Atualizando…':'Atualizar'}</button>
   </div>
   {error&&<p role="alert" style={{padding:14,background:'#fff7ed',borderRadius:10}}>{error}</p>}
   {!data&&!error&&<p role="status">Carregando indicadores…</p>}
   {data&&<>
    <section style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(230px,1fr))',gap:14,margin:'20px 0'}}>
     {Object.entries(data.queues).map(([key,queue])=><article key={key} style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:14,padding:18}}>
      <small>{LABELS[key]||key}</small><strong style={{display:'block',fontSize:30,margin:'6px 0 12px'}}>{queue.total}</strong>
      <div style={{display:'grid',gap:6}}>{Object.entries(queue.statuses).map(([status,value])=><div key={status} style={{display:'flex',justifyContent:'space-between',fontSize:13}}>
       <span>{STATUS_LABELS[status]||status}</span><strong>{value}</strong></div>)}</div>
     </article>)}
    </section>
    <section style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))',gap:14}}>
     <article style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:14,padding:18}}>
      <h2 style={{fontSize:18}}>Consentimento de marketing</h2>
      {Object.entries({Total:data.preferences.total,'Opt-in':data.preferences.optedIn,'Opt-out':data.preferences.optedOut,'Complaints':data.preferences.complaints,'Hard bounces':data.preferences.hardBounces}).map(([label,value])=><p key={label} style={{display:'flex',justifyContent:'space-between'}}><span>{label}</span><strong>{value}</strong></p>)}
     </article>
     <article style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:14,padding:18}}>
      <h2 style={{fontSize:18}}>Radar de Mercado</h2>
      <p style={{display:'flex',justifyContent:'space-between'}}><span>Edições</span><strong>{data.newsletters.total}</strong></p>
      <p style={{display:'flex',justifyContent:'space-between'}}><span>Rascunhos</span><strong>{data.newsletters.draft}</strong></p>
      <p style={{display:'flex',justifyContent:'space-between'}}><span>Aprovadas</span><strong>{data.newsletters.approved}</strong></p>
     </article>
     <article style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:14,padding:18}}>
      <h2 style={{fontSize:18}}>Gates operacionais</h2>
      {Object.entries(data.gates).map(([key,enabled])=><p key={key} style={{display:'flex',justifyContent:'space-between',gap:12}}>
       <span>{GATE_LABELS[key]||key}</span><strong>{enabled?'ATIVO':'DESLIGADO'}</strong></p>)}
     </article>
    </section>
    <p style={{fontSize:12,color:'#64748b',marginTop:18}}>Atualizado em {new Date(data.generatedAt).toLocaleString('pt-BR')}. Este painel não exibe destinatários, chaves, IDs de provedor ou conteúdo das mensagens.</p>
   </>}
  </div>
 </main>;
}
export default function AdminEmailHealth(){
 return <AdminAccess permission="reports.run" loginRedirect="/admin/login"><EmailHealth/></AdminAccess>;
}
