'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function DashboardLogado() {
  const [usuarioAssinado, setUsuarioAssinado] = useState(true);
  const [diagnosticoRealizado, setDiagnosticoRealizado] = useState(false);

  useEffect(() => {
    // Verifica se o diagnóstico já foi concluído anteriormente
    const statusDiagnostico = localStorage.getItem('jenios_diagnostico_realizado');
    if (statusDiagnostico === 'true') {
      setDiagnosticoRealizado(true);
    }
  }, []);

  const validarAcessoOperacional = (acao) => {
    if (!usuarioAssinado) {
      const assinar = confirm(`⚡ Para ${acao}, é necessário assinar um dos planos profissionais (com 7 dias de teste grátis).\n\nDeseja ir para a página de planos agora?`);
      if (assinar) window.location.href = '/planos';
      return;
    }

    // Reconfere no localStorage no momento do clique
    const jaFezDiagnostico = localStorage.getItem('jenios_diagnostico_realizado') === 'true';

    if (!jaFezDiagnostico && !diagnosticoRealizado) {
      const fazerDiag = confirm(`⚠️ Protocolo de Engenharia Reversa: O Diagnóstico Comportamental de perfil (6 perguntas) deve ser concluído antes da primeira execução na Mesa.\n\nIr para o Diagnóstico agora?`);
      if (fazerDiag) {
        window.location.href = '/diagnostico';
      }
      return;
    }

    // Se já fez o diagnóstico, entra direto na Mesa de Operações!
    window.location.href = '/mesa-operacao';
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f1f5f9', color: '#0f172a', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      
      {/* Sidebar */}
      <aside style={{ width: '260px', backgroundColor: '#ffffff', borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', padding: '24px 16px' }}>
        <div style={{ marginBottom: '30px', textAlign: 'center' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', margin: '0 0 4px 0' }}>JENIOS HFT</h2>
          <span style={{ fontSize: '11px', color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '700' }}>SALA DE CONTROLO OFICIAL</span>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
          <Link href="/dashboard-logado" style={{ padding: '10px 14px', borderRadius: '8px', backgroundColor: '#f3e8ff', color: '#7c3aed', textDecoration: 'none', fontSize: '14px', fontWeight: '700' }}>
            📊 Visão Geral
          </Link>
          <button onClick={() => validarAcessoOperacional('abrir a Mesa de Operação')} style={{ textAlign: 'left', background: 'none', border: 'none', padding: '10px 14px', borderRadius: '8px', color: '#334155', fontSize: '14px', cursor: 'pointer', fontWeight: '600' }}>
            ⚡ Mesa de Operação
          </button>
          <Link href="/diagnostico" style={{ padding: '10px 14px', borderRadius: '8px', color: '#0284c7', textDecoration: 'none', fontSize: '14px', fontWeight: 'bold' }}>
            🧠 Diagnóstico (6 Perguntas)
          </Link>
          <Link href="/tendencias" style={{ padding: '10px 14px', borderRadius: '8px', color: '#059669', textDecoration: 'none', fontSize: '14px', fontWeight: '700' }}>
            🚀 Hub de Tendências
          </Link>
          <Link href="/social" style={{ padding: '10px 14px', borderRadius: '8px', color: '#334155', textDecoration: 'none', fontSize: '14px', fontWeight: '600' }}>
            🌐 Jenios Social
          </Link>
        </nav>

        <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <Link href="/" style={{ backgroundColor: '#f1f5f9', color: '#0f172a', padding: '10px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', textDecoration: 'none', textAlign: 'center', border: '1px solid #cbd5e1' }}>
            🏠 Voltar ao Início / Portal
          </Link>
        </div>
      </aside>

      {/* Conteúdo Principal */}
      <main style={{ flex: 1, padding: '40px', overflowY: 'auto' }}>
        
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '24px 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', flexWrap: 'wrap', gap: '15px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'linear-gradient(135deg, #7c3aed 0%, #4c1d95 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '18px', color: '#fff' }}>
              PS
            </div>
            <div>
              <span style={{ fontSize: '10px', color: '#7c3aed', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', display: 'block' }}>JENIOS ID • PLANO PRO ATIVO</span>
              <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>Olá, Paulo Stutz Netto</h2>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <Link href="/social" style={{ backgroundColor: '#f1f5f9', color: '#0f172a', textDecoration: 'none', fontSize: '12px', fontWeight: 'bold', padding: '10px 16px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
              Feed Social
            </Link>
            <Link href="/tendencias" style={{ backgroundColor: '#f3e8ff', color: '#7c3aed', textDecoration: 'none', fontSize: '12px', fontWeight: 'bold', padding: '10px 16px', borderRadius: '8px', border: '1px solid #d8b4fe' }}>
              🚀 Hub de Tendências
            </Link>
            <button onClick={() => validarAcessoOperacional('abrir a mesa de operações')} style={{ backgroundColor: '#7c3aed', color: '#fff', border: 'none', fontSize: '12px', fontWeight: 'bold', padding: '10px 18px', borderRadius: '8px', cursor: 'pointer', boxShadow: '0 4px 15px rgba(124, 58, 237, 0.3)' }}>
              ⚡ Mesa de Operações
            </button>
          </div>
        </div>

        {/* Resumo com Indicadores Adaptativos */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '30px' }}>
          <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px' }}>
            <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>Capital Protegido</span>
            <h3 style={{ fontSize: '24px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 4px 0' }}>R$ 45.820,00</h3>
            <span style={{ fontSize: '11px', color: '#059669', fontWeight: 'bold' }}>● Modo Reverso Adaptativo Ativo</span>
          </div>

          <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px' }}>
            <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>Monitoramento (15 Ops)</span>
            <h3 style={{ fontSize: '24px', fontWeight: 'bold', color: '#0284c7', margin: '0 0 4px 0' }}>Ativo (Ciclo 3/15)</h3>
            <span style={{ fontSize: '11px', color: '#64748b' }}>Proteção contra 3 acertos em sequência</span>
          </div>
        </div>

      </main>
    </div>
  );
}