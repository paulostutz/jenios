import Link from 'next/link';

export default function DashboardLogado() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#070a12', color: '#fff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      
      {/* Sidebar / Menu Lateral */}
      <aside style={{ width: '260px', backgroundColor: '#0b0f19', borderRight: '1px solid #1e293b', display: 'flex', flexDirection: 'column', padding: '24px 16px' }}>
        
        {/* Topo da Sidebar */}
        <div style={{ marginBottom: '30px', textAlign: 'center' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#fff', margin: '0 0 4px 0', letterSpacing: '0.5px' }}>
            JENIOS HFT
          </h2>
          <span style={{ fontSize: '11px', color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Área Logada Oficial
          </span>
        </div>

        {/* Links de Navegação (Todas as suas ferramentas) */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
          <Link href="/dashboard-logado" style={{ padding: '10px 14px', borderRadius: '8px', backgroundColor: '#1e293b', color: '#fff', textDecoration: 'none', fontSize: '14px', fontWeight: '600' }}>
            📊 Visão Geral
          </Link>
          <Link href="/mesa-operacao" style={{ padding: '10px 14px', borderRadius: '8px', color: '#94a3b8', textDecoration: 'none', fontSize: '14px' }}>
            ⚡ Mesa de Operação
          </Link>
          <Link href="/brocker" style={{ padding: '10px 14px', borderRadius: '8px', color: '#94a3b8', textDecoration: 'none', fontSize: '14px' }}>
            🏛️ Brocker & Conexões
          </Link>
          <Link href="/integracoes" style={{ padding: '10px 14px', borderRadius: '8px', color: '#94a3b8', textDecoration: 'none', fontSize: '14px' }}>
            🔌 APIs & Integrações
          </Link>
          <Link href="/copiar-mestre" style={{ padding: '10px 14px', borderRadius: '8px', color: '#94a3b8', textDecoration: 'none', fontSize: '14px' }}>
            📋 Copiar Mestre (Copy)
          </Link>
          <Link href="/risco" style={{ padding: '10px 14px', borderRadius: '8px', color: '#94a3b8', textDecoration: 'none', fontSize: '14px' }}>
            🛡️ Risco & Blindagem
          </Link>
          <Link href="/social" style={{ padding: '10px 14px', borderRadius: '8px', color: '#94a3b8', textDecoration: 'none', fontSize: '14px' }}>
            🌐 Comunidade Social
          </Link>
          <Link href="/billing" style={{ padding: '10px 14px', borderRadius: '8px', color: '#94a3b8', textDecoration: 'none', fontSize: '14px' }}>
            💳 Planos & Billing
          </Link>
        </nav>

        {/* Rodapé da Sidebar */}
        <div style={{ borderTop: '1px solid #1e293b', paddingTop: '16px' }}>
          <Link href="/" style={{ color: '#f43f5e', fontSize: '13px', textDecoration: 'none', fontWeight: '600' }}>
            &larr; Terminar Sessão / Sair
          </Link>
        </div>

      </aside>

      {/* Conteúdo Principal */}
      <main style={{ flex: 1, padding: '40px', overflowY: 'auto' }}>
        <header style={{ marginBottom: '30px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: '700', margin: '0 0 8px 0' }}>
            Painel de Controlo HFT
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>
            Selecione uma ferramenta no menu lateral esquerdo para gerir as suas operações, APIs e configurações.
          </p>
        </header>

        {/* Cards de Atalho Rápido */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
          
          <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '24px' }}>
            <h3 style={{ fontSize: '16px', color: '#fff', margin: '0 0 8px 0' }}>⚡ Mesa de Operação</h3>
            <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 16px 0' }}>Executar ordens em tempo real via motor de alta frequência.</p>
            <Link href="/mesa-operacao" style={{ color: '#34d399', fontSize: '13px', fontWeight: '600', textDecoration: 'none' }}>Aceder &rarr;</Link>
          </div>

          <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '24px' }}>
            <h3 style={{ fontSize: '16px', color: '#fff', margin: '0 0 8px 0' }}>🔌 APIs & Conexões</h3>
            <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 16px 0' }}>Configurar credenciais de corretoras e endpoints AsaaS.</p>
            <Link href="/integracoes" style={{ color: '#34d399', fontSize: '13px', fontWeight: '600', textDecoration: 'none' }}>Aceder &rarr;</Link>
          </div>

          <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '24px' }}>
            <h3 style={{ fontSize: '16px', color: '#fff', margin: '0 0 8px 0' }}>🛡️ Gestão de Risco</h3>
            <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 16px 0' }}>Ajustar parâmetros de retificação comportamental e limites.</p>
            <Link href="/risco" style={{ color: '#34d399', fontSize: '13px', fontWeight: '600', textDecoration: 'none' }}>Aceder &rarr;</Link>
          </div>

        </div>
      </main>

    </div>
  );
}