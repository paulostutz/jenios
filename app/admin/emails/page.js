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
 JENIOS_B305_PRIVATE_EMAIL_RUNNER_ENABLED:'Runner privado',
 JENIOS_RESEND_WEBHOOK_ENABLED:'Webhook Resend'
};
const READINESS_STATE={ready:'PRONTO',pending:'PENDENTE',blocker:'BLOQUEADOR'};
const CREDENTIAL_LABELS={
 resendApiKeyConfigured:'API do Resend',
 supabaseServerKeyConfigured:'Acesso server-side ao Supabase',
 cronSecretConfigured:'Segredo das rotas internas',
 financeSenderConfigured:'Remetente Financeiro',
 resendDomainVerified:'Domínio JENIOS verificado',
 webhookSecretConfigured:'Signing secret do webhook'
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
    <section style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:14,padding:20,margin:'20px 0'}}>
     <div style={{display:'flex',justifyContent:'space-between',gap:16,alignItems:'baseline',flexWrap:'wrap'}}>
      <div><small>PRONTIDÃO</small><h2 style={{margin:'4px 0 0'}}>Liberação de e-mails</h2></div>
      <strong>{data.readiness.activationEligible?'PRONTO PARA ATIVAÇÃO CONTROLADA':data.readiness.blockers?'BLOQUEADO':'PENDÊNCIAS RESTANTES'}</strong>
     </div>
     <p style={{color:'#64748b'}}>Prontos: {data.readiness.ready} · Pendentes: {data.readiness.pending} · Bloqueadores: {data.readiness.blockers}</p>
     <div style={{display:'grid',gap:7}}>{data.readiness.checks.map(item=><div key={item.id} style={{display:'flex',justifyContent:'space-between',gap:16,borderTop:'1px solid #f1f5f9',paddingTop:7}}>
      <span>{item.label}</span><strong>{READINESS_STATE[item.state]||item.state}</strong>
     </div>)}</div>
    </section>
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
      <h2 style={{fontSize:18}}>Bounce e complaint</h2>
      {Object.entries({Total:data.webhookEvents.total,'Complaints':data.webhookEvents.complaints,'Hard bounces':data.webhookEvents.hardBounces,'Bounces transitórios':data.webhookEvents.transient,'Usuários não localizados':data.webhookEvents.unknownUsers}).map(([label,value])=><p key={label} style={{display:'flex',justifyContent:'space-between'}}><span>{label}</span><strong>{value}</strong></p>)}
     </article>
     <article style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:14,padding:18}}>
      <h2 style={{fontSize:18}}>Prontidão de configuração</h2>
      {Object.entries(data.credentials).map(([key,configured])=><p key={key} style={{display:'flex',justifyContent:'space-between',gap:12}}>
       <span>{CREDENTIAL_LABELS[key]||key}</span><strong>{configured?'CONFIGURADO':'PENDENTE'}</strong></p>)}
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
