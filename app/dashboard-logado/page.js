'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function DashboardLogado() {
  const [diagnosticoFeito, setDiagnosticoFeito] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState('geral');

  // Dados financeiros e de gestão
  const [dadosFinanceiros] = useState({
    plano: 'Plano Pro HFT (Anual)',
    statusAssinatura: 'Ativa (Renovação em 18/11/2026)',
    valorFatura: 'R$ 297,00',
    faturaPaga: false,
    asaasApiKey: 'live_asaas_sec_889347192847192',
    saldoDisponivel: 'R$ 14.820,00',
    ganhosAfiliados: 'R$ 3.450,00',
    indicacoesAtivas: 12,
    ganhosCopyTrading: 'R$ 2.180,00',
    estrategiasCopiadasCount: 3
  });

  useEffect(() => {
    const status = localStorage.getItem('jenios_diagnostico_realizado');
    if (status === 'true') {
      setDiagnosticoFeito(true);
    }
  }, []);

  const abrirMesaOperacao = () => {
    // Verifica obrigatoriedade do diagnóstico antes de operar
    const jaFez = localStorage.getItem('jenios_diagnostico_realizado') === 'true';
    if (!jaFez && !diagnosticoFeito) {
      alert('⚠️ Protocolo Obrigatório: Você precisa concluir o Diagnóstico Comportamental de 6 perguntas antes de realizar sua primeira operação na Mesa.');
      window.location.href = '/diagnostico';
      return;
    }
    window.location.href = '/mesa-operacao';
  };

  const pagarFaturaAtual = () => {
    alert('💳 Fatura de R$ 297,00 processada via AsaaS Gateway com sucesso! Assinatura mantida por mais 30 dias.');
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f1f5f9', color: '#0f172a', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      
      {/* Sidebar */}
      <aside style={{ width: '260px', backgroundColor: '#ffffff', borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', padding: '24px 16px' }}>
        <div style={{ marginBottom: '30px', textAlign: 'center' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', margin: '0 0 4px 0' }}>JENIOS HFT</h2>
          <span style={{ fontSize: '11px', color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '700' }}>SALA DE CONTROLE OFICIAL</span>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
          <button onClick={() => setAbaAtiva('geral')} style={{ textAlign: 'left', background: abaAtiva === 'geral' ? '#f3e8ff' : 'none', border: 'none', padding: '10px 14px', borderRadius: '8px', color: abaAtiva === 'geral' ? '#7c3aed' : '#334155', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}>
            📊 Visão Geral
          </button>
          <button onClick={abrirMesaOperacao} style={{ textAlign: 'left', background: 'none', border: 'none', padding: '10px 14px', borderRadius: '8px', color: '#334155', fontSize: '14px', cursor: 'pointer', fontWeight: '600' }}>
            ⚡ Mesa de Operação
          </button>
          <Link href="/diagnostico" style={{ padding: '10px 14px', borderRadius: '8px', color: '#0284c7', textDecoration: 'none', fontSize: '14px', fontWeight: 'bold' }}>
            🧠 Diagnóstico Comportamental
          </Link>
          <Link href="/tendencias" style={{ padding: '10px 14px', borderRadius: '8px', color: '#059669', textDecoration: 'none', fontSize: '14px', fontWeight: '700' }}>
            🚀 Hub de Tendências
          </Link>
          <Link href="/social" style={{ padding: '10px 14px', borderRadius: '8px', color: '#334155', textDecoration: 'none', fontSize: '14px', fontWeight: '600' }}>
            🌐 Jenios Social
          </Link>
          <button onClick={() => setAbaAtiva('financeiro')} style={{ textAlign: 'left', background: abaAtiva === 'financeiro' ? '#f3e8ff' : 'none', border: 'none', padding: '10px 14px', borderRadius: '8px', color: abaAtiva === 'financeiro' ? '#7c3aed' : '#334155', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}>
            💳 Assinaturas & Faturas
          </button>
          <button onClick={() => setAbaAtiva('afiliados')} style={{ textAlign: 'left', background: abaAtiva === 'afiliados' ? '#f3e8ff' : 'none', border: 'none', padding: '10px 14px', borderRadius: '8px', color: abaAtiva === 'afiliados' ? '#7c3aed' : '#334155', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}>
            🤝 Gestão de Afiliados
          </button>
          <button onClick={() => setAbaAtiva('copytrading')} style={{ textAlign: 'left', background: abaAtiva === 'copytrading' ? '#f3e8ff' : 'none', border: 'none', padding: '10px 14px', borderRadius: '8px', color: abaAtiva === 'copytrading' ? '#7c3aed' : '#334155', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}>
            📊 Copy Trading & Ganhos
          </button>
          <button onClick={() => setAbaAtiva('apis')} style={{ textAlign: 'left', background: abaAtiva === 'apis' ? '#f3e8ff' : 'none', border: 'none', padding: '10px 14px', borderRadius: '8px', color: abaAtiva === 'apis' ? '#7c3aed' : '#334155', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}>
            🔌 Conexão de APIs (AsaaS)
          </button>
        </nav>

        <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
          <Link href="/" style={{ backgroundColor: '#f1f5f9', color: '#0f172a', padding: '10px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', textDecoration: 'none', textAlign: 'center', display: 'block', border: '1px solid #cbd5e1' }}>
            🏠 Voltar ao Início
          </Link>
        </div>
      </aside>

      {/* Conteúdo Principal */}
      <main style={{ flex: 1, padding: '40px', overflowY: 'auto' }}>
        
        {/* Topo do Usuário */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '24px 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', boxShadow: '0 4px 12px rgba(0,0,0,0.03)', flexWrap: 'wrap', gap: '15px' }}>
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
            <button onClick={abrirMesaOperacao} style={{ backgroundColor: '#7c3aed', color: '#fff', border: 'none', fontSize: '12px', fontWeight: 'bold', padding: '10px 18px', borderRadius: '8px', cursor: 'pointer', boxShadow: '0 4px 15px rgba(124, 58, 237, 0.3)' }}>
              ⚡ Mesa de Operações
            </button>
          </div>
        </div>

        {/* ABA: VISÃO GERAL */}
        {abaAtiva === 'geral' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '30px' }}>
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
              <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px' }}>
                <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>Ganhos Totais Afiliados & Copy</span>
                <h3 style={{ fontSize: '24px', fontWeight: 'bold', color: '#059669', margin: '0 0 4px 0' }}>R$ 5.630,00</h3>
                <span style={{ fontSize: '11px', color: '#64748b' }}>Disponível para saque imediato</span>
              </div>
            </div>
          </div>
        )}

        {/* ABA: ASSINATURAS & FATURAS */}
        {abaAtiva === 'financeiro' && (
          <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '30px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#0f172a', marginBottom: '10px' }}>Gestão de Assinatura & Faturas</h2>
            <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '25px' }}>Acompanhe o estado da sua assinatura profissional e realize pagamentos de faturas pendentes via AsaaS.</p>
            
            <div style={{ backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
              <div>
                <b style={{ fontSize: '16px', color: '#0f172a', display: 'block' }}>{dadosFinanceiros.plano}</b>
                <span style={{ fontSize: '12px', color: '#059669', fontWeight: 'bold' }}>{dadosFinanceiros.statusAssinatura}</span>
                <p style={{ fontSize: '12px', color: '#475569', marginTop: '6px', margin: 0 }}>Valor da próxima fatura: <b>{dadosFinanceiros.valorFatura}</b></p>
              </div>
              <button onClick={pagarFaturaAtual} style={{ backgroundColor: '#10b981', color: '#fff', border: 'none', padding: '12px 20px', borderRadius: '8px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}>
                💳 Pagar Fatura / Renovar
              </button>
            </div>
          </div>
        )}

        {/* ABA: GESTÃO DE AFILIADOS */}
        {abaAtiva === 'afiliados' && (
          <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '30px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#0f172a', marginBottom: '10px' }}>Programa de Afiliados & Comissões</h2>
            <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '25px' }}>Monitore os seus ganhos em cima de indicações e assinaturas de novos operadores.</p>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '25px' }}>
              <div style={{ backgroundColor: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold' }}>COMISSÕES TOTAIS GANHAS</span>
                <h3 style={{ fontSize: '22px', color: '#059669', margin: '6px 0 0 0' }}>{dadosFinanceiros.ganhosAfiliados}</h3>
              </div>
              <div style={{ backgroundColor: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold' }}>INDICAÇÕES ATIVAS</span>
                <h3 style={{ fontSize: '22px', color: '#7c3aed', margin: '6px 0 0 0' }}>{dadosFinanceiros.indicacoesAtivas} operadores</h3>
              </div>
            </div>

            <div style={{ backgroundColor: '#f1f5f9', padding: '16px', borderRadius: '10px', border: '1px solid #cbd5e1' }}>
              <span style={{ fontSize: '12px', color: '#334155', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>O seu link exclusivo de afiliado:</span>
              <input type="text" readOnly value="https://jenios.com.br/convite/paulo-stutz-hft" style={{ width: '100%', padding: '10px', backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px', color: '#0f172a' }} />
            </div>
          </div>
        )}

        {/* ABA: COPY TRADING & GANHOS */}
        {abaAtiva === 'copytrading' && (
          <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '30px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#0f172a', marginBottom: '10px' }}>Copy Trading & Ganhos de Estratégias</h2>
            <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '25px' }}>Verifique os ganhos gerados pelas estratégias que você disponibilizou para cópia e as assinaturas ativas.</p>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '25px' }}>
              <div style={{ backgroundColor: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold' }}>LUCROS COM CÓPIAS DE ESTRATÉGIAS</span>
                <h3 style={{ fontSize: '22px', color: '#059669', margin: '6px 0 0 0' }}>{dadosFinanceiros.ganhosCopyTrading}</h3>
              </div>
              <div style={{ backgroundColor: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold' }}>ESTRATÉGIAS COPIADAS ATIVAS</span>
                <h3 style={{ fontSize: '22px', color: '#0284c7', margin: '6px 0 0 0' }}>{dadosFinanceiros.estrategiasCopiadasCount} ativas</h3>
              </div>
            </div>
          </div>
        )}

        {/* ABA: CONEXÃO DE APIS */}
        {abaAtiva === 'apis' && (
          <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '30px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#0f172a', marginBottom: '10px' }}>Conexão com APIs & Gateway de Pagamentos (AsaaS)</h2>
            <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '25px' }}>Gerencie chaves de API, webhooks e subcontas para emissão automatizada de cobranças e notificações.</p>
            
            <div style={{ backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '20px' }}>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>CHAVE DE API ASAAS (PRODUÇÃO)</span>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input type="text" readOnly value={dadosFinanceiros.asaasApiKey} style={{ flex: 1, padding: '10px', backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px', fontFamily: 'monospace', color: '#0f172a' }} />
                <button onClick={() => alert('Chave de API copiada!')} style={{ backgroundColor: '#7c3aed', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>Copiar</button>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}