'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import AdminAccess,{adminFetch} from '../components/AdminAccess';
import {supabase} from '../../lib/supabase';
import {BrandLockup,BrandFooter} from '../components/brand/BrandSignature';
import styles from './page.module.css';

const SECTIONS=[
 ['geral','◈ Visão geral'],['social','◉ JENIOS Social'],
 ['financeiro','▤ Financeiro'],['platform','▥ Platform'],
 ['acessos','🔐 Acessos'],['sistemas','⚙ Sistemas']
];
const LINKS={
 geral:[
  ['JENIOS Social','Publicações, perfis, denúncias e comunidade','/social','◉'],
  ['JENIOS PAY','Catálogo, preços e histórico de cobranças','/admin/cobrancas','▤'],
  ['Platform','Banco dedicado, indicadores e governança','/admin?area=platform','▥'],
  ['Consultas','BankScore e Validador autorizados','/admin/consultas','▧']
 ],
 social:[
  ['Abrir Social','Feed, Stories, comentários e moderação','/social','◉'],
  ['Moderação','Denúncias e decisões registradas no servidor','/admin/moderacao','🛡'],
  ['Hub de Tendências','MegaPulse, baleias e tokens emergentes','/tendencias','↗'],
  ['Notificações','Acompanhar alertas por módulo','/notifications','♧']
 ],
 financeiro:[
  ['Cobranças e produtos','JENIOS PAY e pagamentos confirmados','/admin/cobrancas','▤'],
  ['BankScore e Tokens','Consultas administrativas completas','/admin/consultas','▧']
 ],
 acessos:[
  ['Permissões operacionais','Concessões permitidas e auditadas','/admin/plataforma/permissoes','🔐']
 ],
 sistemas:[
  ['Dashboard','Visão geral da negociação educacional','/dashboard','▧'],
  ['Mesa e gráficos','Estudos, TradingView e controles','/mesa-operacoes','▥'],
  ['Hub','Cotações e observações atuais','/tendencias','↗']
 ]
};
function Item({data,onSection}){return <Link href={data[2]} onClick={data[2]==='/admin?area=platform'?e=>{e.preventDefault();onSection('platform');}:undefined} className={styles.card}>
 <span className={styles.icon} aria-hidden="true">{data[3]}</span>
 <strong>{data[0]}</strong><p>{data[1]}</p><small>Abrir módulo →</small>
 </Link>;}
function PlatformPanel(){
 const [state,setState]=useState({status:'loading'}),[refresh,setRefresh]=useState(0);
 useEffect(()=>{let live=true;const controller=new AbortController();
  adminFetch('/api/admin/ecosystem',{signal:controller.signal}).then(r=>r.json()).then(v=>{if(live)setState(v);})
   .catch(()=>{if(live)setState({status:'unavailable'});});
  return()=>{live=false;controller.abort();};
 },[refresh]);
 return <section className={styles.panel}>
  <div className={styles.top}><div><h2>Platform · Indicadores do banco dedicado</h2>
  <p>Consulta agregada e isolada. Nenhuma chave, conta ou operação é transferida.</p></div>
  <button type="button" onClick={()=>setRefresh(n=>n+1)} className={styles.action}>Atualizar indicadores</button></div>
  {state.status==='ready'?<div className={styles.metrics}>
    {[[state.diagnostics,'Diagnósticos'],[state.riskEvents,'Eventos de risco'],[state.adminPermissions,'Autorizações Platform']].map(([value,name])=><div key={name}><strong>{value}</strong><small>{name}</small></div>)}
  </div>:<p role="status">{state.status==='loading'?'Verificando dados…':'Indicadores indisponíveis. Não exibimos totais fictícios.'}</p>}
  <p>O painel avançado da Platform mantém sua própria autenticação até que o vínculo administrativo entre os dois projetos seja homologado. Não há concessão automática de permissões.</p>
  <div className={styles.actions}><Link className={styles.action} href="/platform/admin">Painel da Platform ↗</Link>
   <Link className={styles.action} href="/platform/assistente">Gênio / Gênia ↗</Link>
   <Link className={styles.action} href="/platform/aprender">Universidade JENIOS ↗</Link></div>
 </section>;
}
function Home(){
 const [section,setSection]=useState('geral'),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{const key=new URLSearchParams(window.location.search).get('area');if(SECTIONS.some(s=>s[0]===key))setSection(key);},[]);
 async function logout(){if(busy)return;setBusy(true);setError('');try{const r=await supabase.auth.signOut();if(r.error)throw Error('Não foi possível sair.');window.location.assign('/admin/login');}catch(e){setError(e.message);setBusy(false);}}
 return <div className={styles.page}>
  <aside className={styles.sidebar}>
   <Link href="/admin" className={styles.brand}><BrandLockup tone="light" compact context="Master"/></Link>
   <nav className={styles.nav} aria-label="Seções do escritório Master">
    {SECTIONS.map(([id,label])=><button key={id} type="button" aria-current={section===id?'page':undefined} className={styles.navItem+' '+(section===id?styles.active:'')} onClick={()=>setSection(id)}>{label}</button>)}
    <Link href="/social" className={styles.navItem}>↗ Social</Link>
   </nav>
   <p className={styles.note}>Escritório exclusivo Master. Permissões financeiras e de consulta não habilitam este acesso.</p>
  </aside>
  <main className={styles.main}>
   <header className={styles.top}><div><span className={styles.kicker}>JENIOS · CENTRAL MASTER</span><h1>Escritório Administrativo</h1><p>Gestão organizada e rápida, com módulos carregados somente quando necessários.</p></div>
   <div className={styles.actions}><Link href="/dashboard-logado" className={styles.action}>Sala de Controle</Link><button className={styles.action} type="button" disabled={busy} onClick={logout}>{busy?'Saindo…':'Sair'}</button></div></header>
   {error&&<p role="alert">{error}</p>}
   <section className={styles.hero}><small>ADMINISTRAÇÃO PRIVADA</small><h2>Seu ecossistema em um só escritório.</h2><p>Social, Platform, pagamentos, relatórios e segurança, preservando os bancos e as autorizações independentes.</p></section>
   {section==='platform'?<PlatformPanel/>:<section aria-label={SECTIONS.find(([id])=>id===section)?.[1]}>
     <h2 className={styles.heading}>{SECTIONS.find(([id])=>id===section)?.[1]}</h2>
     <div className={styles.grid}>{(LINKS[section]||[]).map(card=><Item data={card} key={card[0]} onSection={setSection}/>)}</div>
   </section>}
   <p className={styles.notice}>Esta interface não cria ordens reais nem ativa pagamentos. Todos os módulos executam seus próprios controles no servidor; a gestão avançada da Platform depende da autorização dedicada.</p>
   <BrandFooter tone="light" scope="Master"/>
  </main>
 </div>;
}
export default function AdminPage(){
 return <AdminAccess permission={['reports.run','finance.manage','permissions.manage']} loginRedirect="/admin/login"><Home/></AdminAccess>;
}