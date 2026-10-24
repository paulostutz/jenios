'use client';
import Link from 'next/link';
import PlatformAdminAccess from '../../components/platform/PlatformAdminAccess';
import PlatformAdminOverview from '../../components/platform/PlatformAdminOverview';
import PlatformResearchReadiness from '../../components/platform/PlatformResearchReadiness';
import {BrandLockup,BrandFooter} from '../../components/brand/BrandSignature';

export default function PlatformAdminHome(){
 return <PlatformAdminAccess permission="platform.admin">{permissions=>
  <main style={{minHeight:'100vh',padding:'clamp(20px,4vw,45px)',background:'#f2f4fa',color:'#14213b',fontFamily:'system-ui'}}>
   <div style={{maxWidth:1060,margin:'0 auto',display:'grid',gap:22}}>
    <nav style={{display:'flex',gap:12,flexWrap:'wrap'}}>
     <Link href="/dashboard-logado" style={{color:'#6d28d9',fontSize:13}}>← Sala de controle</Link>
     <Link href="/dashboard" style={{color:'#6d28d9',fontSize:13}}>Dashboard</Link>
    </nav>
    <header style={{padding:'clamp(20px,4vw,36px)',borderRadius:20,background:'linear-gradient(120deg,#181739,#473184)',color:'#fff'}}>
     <BrandLockup tone="dark" context="Admin"/>
     <span style={{fontSize:11,letterSpacing:1.8,color:'#c4b5fd',fontWeight:800}}>JENIOS PLATFORM · ADMINISTRATIVO EXCLUSIVO</span>
     <h1 style={{fontSize:'clamp(25px,4vw,36px)',margin:'12px 0'}}>Painel de homologação</h1>
     <p style={{maxWidth:750,lineHeight:1.6,fontSize:13,color:'#e2e8f0'}}>
      Permissões verificadas no banco exclusivo da Platform. Não compartilha contas administrativas, cobranças, laudos ou chaves com a JENIOS Social.
     </p>
     <span style={{fontSize:12}}>Permissões confirmadas pelo servidor: {permissions.join(', ')}</span>
    </header>
    <PlatformAdminOverview/>
    <PlatformResearchReadiness/>
    <section style={{background:'#fff',border:'1px solid #ddd6fe',borderRadius:15,padding:22}} aria-labelledby="platform-robot-admin-title">
     <h2 id="platform-robot-admin-title" style={{fontSize:19,margin:'0 0 10px'}}>Administração dos robôs</h2>
     <p style={{color:'#64748b',lineHeight:1.6,fontSize:14,margin:'0 0 14px'}}>Consulte o banco definitivo, os registros de homologação e a conexão do motor privado com seu acesso administrativo da Platform.</p>
     <Link href="/platform/admin/robos" style={{color:'#6d28d9',fontWeight:750}}>Abrir painel dos robôs →</Link>
    </section>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(250px,1fr))',gap:14}}>
     {[
      ['Diagnóstico comportamental','Persistência por conta, classificação inicial e bloqueio de conta real sem autorização.'],
      ['Histórico de risco','Bloqueios auditáveis são distintos de perdas evitadas em dinheiro. Sem valores não comprovados.'],
      ['Segurança de acesso','Permissões administrativas vinculadas somente ao Auth exclusivo da Platform.']
     ].map(([title,description])=><article key={title} style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:15,padding:22}}>
       <h2 style={{fontSize:17,margin:'0 0 12px'}}>{title}</h2><p style={{color:'#64748b',lineHeight:1.6,fontSize:13}}>{description}</p>
      </article>)}
    </div>
    <p role="note" style={{fontSize:12,color:'#475569',lineHeight:1.7}}>A área administrativa não cria ordens, ativa corretoras ou certifica rentabilidade. Não concede direitos automaticamente a usuários da Social.</p>
    <BrandFooter tone="light" scope="Platform Admin"/>
   </div>
  </main>
 }</PlatformAdminAccess>;
}
