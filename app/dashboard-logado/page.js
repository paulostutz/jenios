'use client';
import { useState } from 'react';
import Link from 'next/link';

export default function DashboardLogado() {
  // Simulação de status do usuário (false = não assinou plano ainda / true = assinado)
  const [usuarioAssinado, setUsuarioAssinado] = useState(false);
  // Simulação de status do diagnóstico obrigatório
  const [diagnosticoRealizado, setDiagnosticoRealizado] = useState(false);

  // Função para validar o acesso às operações e APIs
  const validarAcessoOperacional = (acao) => {
    if (!usuarioAssinado) {
      const assinar = confirm(`⚡ Para ${acao}, é necessário assinar um dos planos profissionais (com 7 dias de teste grátis).\n\nDeseja ir para a página de planos agora?`);
      if (assinar) {
        window.location.href = '/planos';
      }
      return;
    }

    if (!diagnosticoRealizado) {
      const fazerDiag = confirm(`⚠️ Atenção: O protocolo de engenharia reversa exige a conclusão do Diagnóstico Comportamental de 15 operações antes de operar.\n\nIr para o Diagnóstico agora?`);
      if (fazerDiag) {
        window.location.href = '/diagnostico';
      }
      return;
    }

    alert(`⚡ Acesso liberado para: ${acao}! Redirecionando para o motor HFT...`);
  };

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
            Sala de Controle Oficial
          </span>
        </div>

        {/* Links de Navegação */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
          <Link href="/dashboard-logado" style={{ padding: '10px 14px', borderRadius: '8px', backgroundColor: '#1e293b', color: '#fff', textDecoration: 'none', fontSize: '14px', fontWeight: '600' }}>
            📊 Visão Geral
          </Link>
          <a onClick={() => validarAcessoOperacional('abrir a Mesa de Operação')} style={{ padding: '10px 14px', borderRadius: '8px', color: '#94a3b8', textDecoration: 'none', fontSize: '14px', cursor: 'pointer' }}>
            ⚡ Mesa de Operação
          </a>
          <Link href="/diagnostico" style={{ padding: '10px 14px', borderRadius: '8px', color: '#38bdf8', textDecoration: 'none', fontSize: '14px', fontWeight: 'bold' }}>
            🧠 Diagnóstico Obrigatório
          </Link>
          <a onClick={() => validarAcessoOperacional('configurar conexões e APIs')} style={{ padding: '10px 14px', borderRadius: '8px', color: '#94a3b8', textDecoration: 'none', fontSize: '14px', cursor: 'pointer' }}>
            🔌 APIs & Conexões
          </a>
          <Link href="/copiar-mestre" style={{ padding: '10px 14px', borderRadius: '8px', color: '#94a3b8', textDecoration: 'none', fontSize: '14px' }}>
            📋 Copiar Mestre (Copy)
          </Link>
          <Link href="/risco" style={{ padding: '10px 14px', borderRadius: '8px', color: '#94a3b8', textDecoration: 'none', fontSize: '14px' }}>
            🛡️ Risco & Blindagem
          </Link>
          <Link href="/social" style={{ padding: '10px 14px', borderRadius: '8px', color: '#94a3b8', textDecoration: 'none', fontSize: '14px' }}>
            🌐 Jenios Social
          </Link>
          <Link href="/planos" style={{ padding: '10px 14px', borderRadius: '8px', color: '#10b981', textDecoration: 'none', fontSize: '14px', fontWeight: 'bold' }}>
            💳 Planos (7 Dias Grátis)
          </Link>
        </nav>

        {/* Rodapé da Sidebar */}
        <div style={{ borderTop: '1px solid #1e293b', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button 
            onClick={() => setUsuarioAssinado(!usuarioAssinado)} 
            style={{ backgroundColor: usuarioAssinado ? '#059669' : '#334155', color: '#fff', border: 'none', padding: '8px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            {usuarioAssinado ? 'Status: Plano Ativo ✓' : 'Simular Assinatura (Testar)'}
          </button>
          <Link href="/" style={{ color: '#f43f5e', fontSize: '13px', textDecoration: 'none', fontWeight: '600', textAlign: 'center' }}>
            &larr; Sair da Conta
          </Link>
        </div>

      </aside>

      {/* Conteúdo Principal */}
      <main style={{ flex: 1, padding: '40px', overflowY: 'auto' }}>
        <header style={{ marginBottom: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: '700', margin: '0 0 8px 0' }}>
              Painel de Controlo HFT
            </h1>
            <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>
              Gerencie suas conexões, execute ordens de alta frequência e monitore sua retificação comportamental.
            </p>
          </div>
          <div>
            <span style={{ backgroundColor: usuarioAssinado ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: usuarioAssinado ? '#34d399' : '#f87171', padding: '8px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', border: `1px solid ${usuarioAssinado ? '#059669' : '#991b1b'}` }}>
              {usuarioAssinado ? '🚀 Conta Ativa (Teste Grátis)' : '🔒 Conta Gratuita (Requer Plano)'}
            </span>
          </div>
        </header>

        {/* Cards de Atalho Rápido */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '30px' }}>
          
          <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '24px' }}>
            <h3 style={{ fontSize: '16px', color: '#fff', margin: '0 0 8px 0' }}>⚡ Mesa de Operação</h3>
            <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 16px 0' }}>Executar ordens em tempo real via motor de alta frequência.</p>
            <button onClick={() => validarAcessoOperacional('aceder à Mesa de Operação')} style={{ background: 'none', border: 'none', color: '#34d399', fontSize: '13px', fontWeight: '600', cursor: 'pointer', padding: 0 }}>Aceder &rarr;</button>
          </div>

          <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '24px' }}>
            <h3 style={{ fontSize: '16px', color: '#fff', margin: '0 0 8px 0' }}>🧠 Diagnóstico Comportamental</h3>
            <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 16px 0' }}>Mapeie seu tempo de reação e calibre o robô HFT.</p>
            <Link href="/diagnostico" style={{ color: '#38bdf8', fontSize: '13px', fontWeight: '600', textDecoration: 'none' }}>Fazer Diagnóstico &rarr;</Link>
          </div>

          <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '24px' }}>
            <h3 style={{ fontSize: '16px', color: '#fff', margin: '0 0 8px 0' }}>🔌 APIs & Conexões</h3>
            <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 16px 0' }}>Configurar credenciais de corretoras e endpoints AsaaS.</p>
            <button onClick={() => validarAcessoOperacional('configurar as APIs')} style={{ background: 'none', border: 'none', color: '#34d399', fontSize: '13px', fontWeight: '600', cursor: 'pointer', padding: 0 }}>Aceder &rarr;</button>
          </div>

        </div>

      </main>

    </div>
  );
}