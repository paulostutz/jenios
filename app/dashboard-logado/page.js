'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import PlatformBillingStatus from '../components/platform/PlatformBillingStatus';
import PlatformAdminShortcut from '../components/platform/PlatformAdminShortcut';
import PlatformSimulationSummary from '../components/platform/PlatformSimulationSummary';
import PlatformBehaviorReview from '../components/platform/PlatformBehaviorReview';
import PlatformIdentityInspection from '../components/platform/PlatformIdentityInspection';
import {usePlatformPortalEntry} from '../components/platform/PlatformAuthGuard';
import { platformSupabase as supabase } from '../../lib/platform/supabase-client';
import { observePlatformDiagnostic, loadAccountDiagnostic, currentPlatformSession } from '../../lib/platform/diagnostic-client.mjs';
import { signOutPlatform } from '../../lib/platform/account-access.mjs';
import styles from './control.module.css';

export default function DashboardLogado() {
  const portal=usePlatformPortalEntry();
  const socialSession=portal?.source==='social';
  const socialSimulationId=socialSession?portal.userId:null;
  const [tab,setTab] = useState('geral');
  const [userLabel,setUserLabel] = useState('Operador');
  const [diagnostic,setDiagnostic] = useState(null);
  const [platformUserId,setPlatformUserId] = useState(null);
  const [loggingOut,setLoggingOut]=useState(false);
  const [logoutError,setLogoutError]=useState('');
  async function logout(){
    if(loggingOut)return;
    if(socialSession){window.location.assign('/social');return;}
    setLoggingOut(true);setLogoutError('');
    try{
      const session=await currentPlatformSession(supabase);
      await signOutPlatform(supabase?.auth,window.sessionStorage,session?.user?.id);
      window.location.replace('/platform/entrar');
    }catch{
      setLogoutError('Não foi possível encerrar a sessão. Tente novamente.');
      setLoggingOut(false);
    }
  }

  useEffect(()=>{
    if(socialSession){
      setDiagnostic(null);setPlatformUserId(null);
      setUserLabel(portal?.label||'Operador');
      return;
    }
    let live=true,revision=0;
    const stop=observePlatformDiagnostic(supabase,status=>{
      if(!live)return;
      const rev=++revision;
      setDiagnostic(status.verified?status:null);
      setPlatformUserId(status.userId||null);
      setUserLabel('Operador');
      if(!status.userId || !supabase?.auth) return;
      supabase.auth.getUser().then(({data})=>{
        if(!live || rev!==revision || data?.user?.id!==status.userId)return;
        const u=data.user;
        setUserLabel(String(u.user_metadata?.full_name||u.user_metadata?.name||u.email?.split('@')[0]||'Operador').slice(0,80));
      }).catch(()=>{});
    },loadAccountDiagnostic);
    return()=>{live=false;revision++;stop();};
  },[socialSession,portal?.userId,portal?.label]);

  const buttons=[
    ['geral','◈ Visão geral'],
    ['pagamentos','▤ Minha assinatura'],
    ['integracoes','◎ Conexões'],
    ['apoio','? Como começar']
  ];
  return (
    <div className={styles.page}>
      <aside className={styles.sidebar}>
        <Link href="/dashboard-logado" className={styles.brand}>
          <span className={styles.mark}>J</span><span>JENIOS PLATFORM<small>Sala de controle</small></span>
        </Link>
        <nav className={styles.nav} aria-label="Navegação da conta">
          {buttons.map(([key,label])=>(
            <button type="button" key={key} aria-current={tab===key?'page':undefined}
              className={`${styles.navButton} ${tab===key?styles.active:''}`}
              onClick={()=>setTab(key)}>{label}</button>
          ))}
          <Link href="/dashboard" className={styles.navButton}>⚡ Área de negociação</Link>
          <Link href="/mesa-operacoes" className={styles.navButton}>▥ Mesa e gráficos</Link>
          <Link href="/tendencias" className={styles.navButton}>↗ Hub de tendências</Link>
          <Link href="/social" className={styles.navButton}>◉ JENIOS Social (externo)</Link>
          {!socialSession && <PlatformAdminShortcut className={styles.navButton}/>}
        </nav>
        <div className={styles.sidebarBottom}>Acesso à simulação independente do diagnóstico. Ordens reais exigem aprovação e validação próprias.</div>
      </aside>
      <main className={styles.main}>
        <header className={styles.header}>
          <div><span className={styles.kicker}>JENIOS · Área autenticada</span>
            <h1>Olá, {userLabel}</h1>
            <p className={styles.muted}>Gerencie seu acesso e explore os recursos de negociação da JENIOS.</p>
          </div>
          <div className={styles.actions}>
            <Link className={`${styles.button} ${styles.secondary}`} href="/dashboard">Ir para Dashboard</Link>
            <Link className={styles.button} href="/mesa-operacoes">Abrir Mesa →</Link>
            {socialSession ? <Link className={`${styles.button} ${styles.secondary}`} href="/social">Voltar à Social</Link> : <button type="button" disabled={loggingOut} className={`${styles.button} ${styles.secondary}`} onClick={logout}>{loggingOut?'Saindo…':'Sair da Platform'}</button>}
          </div>
        </header>

        {logoutError&&<p role="alert" className={styles.notice}>{logoutError}</p>}

        {tab==='geral' && <>
          <section className={styles.hero}>
            <span style={{fontSize:11,fontWeight:800,letterSpacing:'.12em',color:'#c4b5fd'}}>AMBIENTE DE NEGOCIAÇÃO</span>
            <h2>Seu centro de controle, em um só lugar.</h2>
            <p>Acompanhe seu diagnóstico, estude ativos e abra a mesa de negociação. Você não precisa concluir o diagnóstico para navegar ou utilizar a conta fictícia.</p>
            <div className={styles.heroActions}>
              <Link className={styles.heroLink} href="/dashboard">Entrar na negociação</Link>
              {!socialSession && <Link className={`${styles.heroLink} ${styles.heroGhost}`} href="/diagnostico">{diagnostic?'Consultar diagnóstico':'Iniciar diagnóstico'}</Link>}
            </div>
          </section>
          <section className={styles.panel} aria-label="Simulação da conta">
            {socialSession ? <PlatformSimulationSummary userId={socialSimulationId}/> : <PlatformSimulationSummary userId={platformUserId}/>}
          </section>
          <PlatformBehaviorReview userId={socialSession?socialSimulationId:platformUserId}
             diagnostic={socialSession?null:diagnostic}/>
          {socialSession && <p className={styles.notice} role="status">Você entrou usando sua conta verificada da Social, sem outro login. A sala e o simulador são educacionais. Laudos privados e permissões administrativas da Platform continuam protegidos no banco exclusivo até o vínculo seguro das contas.</p>}
          <PlatformIdentityInspection/>
          <div className={styles.grid}>
            <article className={styles.card}><span className={styles.cardLabel}>Diagnóstico</span>
              <strong className={styles.cardValue}>{diagnostic?'Laudo inicial registrado':'Ainda não realizado'}</strong>
              <p>{diagnostic?'O laudo inicial está associado à sua conta da Platform. Isso não autoriza negociação real.':'Disponível na Dashboard. Não é requisito de acesso à simulação.'}</p>
              {socialSession ? <span>Diagnóstico vinculado à Platform ainda não habilitado para a conta da Social.</span> : <Link href="/diagnostico">{diagnostic?'Ver status':'Fazer diagnóstico'} →</Link>}</article>
            <article className={styles.card}><span className={styles.cardLabel}>Modo operacional</span>
              <strong className={styles.cardValue}>{diagnostic?diagnostic.mode==='reversa'?'Reverso inicial':'Manual inicial':'Definido após o diagnóstico'}</strong>
              <p>O usuário pode mudar o modo na mesa. O status inicial é confirmado por laudo associado à sua conta.</p>
              <Link href="/mesa-operacoes">Abrir controle →</Link></article>
            <article className={styles.card}><span className={styles.cardLabel}>Conta e assinatura</span>
              <strong className={styles.cardValue}>Consulte os registros</strong>
              <p>Pagamentos, planos e saldo não são preenchidos com valores fictícios nesta visão.</p>
              <button type="button" className={styles.button} onClick={()=>setTab('pagamentos')}>Ver pagamentos →</button></article>
          </div>
          <section className={styles.panel}><h2>Próximos passos</h2>
            <ol className={styles.tips}>
              <li>Entre na Dashboard e escolha um ativo para estudar.</li>
              <li>Treine na conta fictícia, respeitando as travas de risco.</li>
              <li>Para solicitar uma conta real futuramente, o diagnóstico deverá ser associado à identidade autenticada da Platform e validado no servidor.</li>
              <li>A liberação real depende também da validação no servidor, corretora e demais requisitos de segurança.</li>
            </ol></section>
        </>}
        {tab==='pagamentos' && <section className={styles.panel}>
          <h2>Pagamentos e histórico</h2>
          <p>O vínculo entre esta conta da Platform e a conta pagadora da JENIOS PAY ainda não foi homologado. Nenhum pedido da Social será apresentado como assinatura da Platform.</p>
          {!socialSession && <PlatformBillingStatus />}
          {socialSession && <p role="status">Sem vínculo de assinatura da Platform confirmado. O acesso com a Social não concede planos nem cobranças da Platform.</p>}
        </section>}
        {tab==='integracoes' && <section className={styles.panel}>
          <h2>Conexões com corretoras</h2>
          <p>O cadastro de corretoras só deverá aceitar tokens quando houver integração homologada, armazenamento seguro no servidor e autorização explícita. Não envie chaves aqui.</p>
          <p className={styles.notice} role="status">Não há conexão de corretora verificada por esta tela. Nenhuma credencial é solicitada ou armazenada no navegador.</p>
          <Link className={styles.button} href="/dashboard">Voltar à simulação →</Link>
        </section>}
        {tab==='apoio' && <section className={styles.panel}>
          <h2>Como usar a JENIOS Platform</h2>
          <p>A Dashboard é sua sala de negociação, a Mesa concentra gráficos e controles, e o Diagnóstico ajuda a definir um modo inicial para estudo.</p>
          <ol className={styles.tips}>
            <li>Acesse normalmente a Dashboard após entrar com sua conta.</li>
            <li>O simulador continua disponível antes do diagnóstico.</li>
            <li>Depois do laudo, a mesa seleciona inicialmente manual ou reverso.</li>
            <li>Você pode pausar a reversão ou trocar de modo posteriormente.</li>
            <li>Informações de losses evitados só devem considerar registros e comparações auditáveis.</li>
          </ol><p className={styles.notice}>Negociar envolve riscos. Simulações e análises não garantem resultado financeiro.</p>
        </section>}
      </main>
    </div>
  );
}
