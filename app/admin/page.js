'use client';
import Link from 'next/link';
import AdminAccess from '../components/AdminAccess';
import { supabase } from '../../lib/supabase';
import styles from './page.module.css';
import {BrandLockup,BrandFooter} from '../components/brand/BrandSignature';

const OPTIONS = [
  {
    id:'reports',permission:'reports.run',href:'/admin/consultas',
    emoji:'📑',title:'Relatórios e consultas',
    summary:'Acesse os laudos administrativos e consultas permitidas pela sua função. Informações exibidas por fontes autenticadas.',
    action:'Abrir consultas'
  },
  {
    id:'finance',permission:'finance.manage',href:'/admin/cobrancas',
    emoji:'💳',title:'Cobranças e produtos',
    summary:'Gerencie preços e cobranças pela interface da JENIOS PAY. Valores e liquidações dependem da confirmação das APIs.',
    action:'Gerenciar cobranças'
  },
  {
    id:'permissions',permission:'permissions.manage',href:'/admin/plataforma/permissoes',
    emoji:'🔐',title:'Permissões e auditoria',
    summary:'Gerencie permissões com verificação do servidor e registro de auditoria, sem criar administradores fictícios.',
    action:'Ver gestão de acesso'
  }
];

function AdminHome({permissions}) {
  const cards = OPTIONS.filter(opt=>permissions.includes(opt.permission));
  const signOut = async () => {
    try { await supabase?.auth.signOut(); }
    finally { window.location.assign('/admin/login'); }
  };

  return (
    <main className={styles.page}>
      <div className={styles.wrap}>
        <header className={styles.top}>
          <Link className={styles.logo} href="/admin">
            <BrandLockup tone="dark" context="Admin" compact/>
          </Link>
          <div className={styles.topActions}>
            <Link className={styles.ghost} href="/dashboard-logado">Sala de controle</Link>
            <button type="button" className={styles.ghost} onClick={()=>window.location.reload()}>Atualizar acesso</button>
            <button type="button" className={styles.ghost} onClick={signOut}>Sair</button>
          </div>
        </header>

        <section className={styles.hero}>
          <span className={styles.eyebrow}>Painel administrativo · Acesso autorizado</span>
          <h1>Central de administração</h1>
          <p>Ferramentas administrativas reunidas em um único lugar. Os módulos só são exibidos após validação de permissões pelo servidor. Nenhum faturamento, saldo ou usuário de demonstração será apresentado como dado real.</p>
          <div className={styles.pills}>
            <span className={styles.pill}>Identidade verificada</span>
            <span className={styles.pill}>{permissions.length} permissão(ões) recebida(s)</span>
            <span className={styles.pill}>Operações financeiras pelo backend</span>
          </div>
        </section>

        <div className={styles.section}>
          <h2>Módulos disponíveis</h2><p>Conforme as permissões atribuídas à sua conta</p>
        </div>
        <div className={styles.grid}>
          {cards.map(card=>(
            <article className={styles.card} key={card.id}>
              <span className={styles.icon} aria-hidden="true">{card.emoji}</span>
              <h3>{card.title}</h3>
              <p>{card.summary}</p>
              <Link className={styles.cta} href={card.href}>{card.action} →</Link>
            </article>
          ))}
          <article className={styles.card}>
            <span className={styles.icon} aria-hidden="true">📊</span>
            <h3>Área de negociações</h3>
            <p>Visualização do simulador e diagnóstico, com operações reais sujeitas às liberações específicas do servidor e da corretora.</p>
            <Link className={`${styles.cta} ${styles.secondary}`} href="/dashboard">Abrir Dashboard →</Link>
          </article>
          <article className={styles.card}>
            <span className={styles.icon} aria-hidden="true">🛡️</span>
            <h3>Controles de risco</h3>
            <p>Acompanhe o estado das funcionalidades do simulador. Nenhuma ordem real é autorizada por este painel administrativo.</p>
            <Link className={`${styles.cta} ${styles.secondary}`} href="/mesa-operacoes">Abrir Mesa →</Link>
          </article>
        </div>

        <aside className={styles.note}>
          <strong>Integridade e transparência dos dados.</strong> Este painel não calcula métricas financeiras com valores estáticos, não redefine senhas localmente e não cria contas de clientes fictícias. As ferramentas financeiras e de autorização preservam suas verificações de backend. A liberação de negociação real continua bloqueada sem homologação específica.
        </aside>
        <nav className={styles.footer} aria-label="Outras áreas">
          <Link href="/admin/moderacao">Moderação existente</Link>
          <Link href="/dashboard-logado">Voltar ao ambiente do cliente</Link>
        </nav>
        <BrandFooter tone="dark" scope="Admin"/>
      </div>
    </main>
  );
}

export default function AdminPage() {
  return (
    <AdminAccess permission={['reports.run','finance.manage','permissions.manage']} loginRedirect="/admin/login">
      {permissions => <AdminHome permissions={permissions}/>}
    </AdminAccess>
  );
}
