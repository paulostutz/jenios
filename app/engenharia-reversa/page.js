'use client';
import { useState } from 'react';

export default function EngenhariaReversaPage() {
  const [simulando, setSimulando] = useState(false);
  const [logs, setLogs] = useState([
    { id: 1, hora: 'Exemplo inicial', evento: 'Cenário fictício: clique impulsivo após perda', acao: 'Resposta ilustrativa: revisar o plano da operação', status: 'Sem execução real' },
    { id: 2, hora: 'Exemplo inicial', evento: 'Cenário fictício: aumento de exposição', acao: 'Resposta ilustrativa: avaliar os limites de risco', status: 'Resultado não calculado' }
  ]);

  const dispararSimulacao = () => {
    if (simulando) return;
    setSimulando(true);
    setTimeout(() => {
      setLogs(anteriores => [{
        id: Math.max(0, ...anteriores.map(log => log.id)) + 1,
        hora: `Gerado nesta tela: ${new Date().toLocaleTimeString()}`,
        evento: 'Cenário fictício: impulso de aumentar a exposição',
        acao: 'Exemplo local, sem análise de mercado ou envio de ordens',
        status: 'Resultado não calculado'
      }, ...anteriores]);
      setSimulando(false);
    }, 1200);
  };

  return (
    <main style={{ backgroundColor: '#0f172a', color: '#1e293b', minHeight: '100vh', padding: '30px 20px', fontFamily: 'Arial, sans-serif', boxSizing: 'border-box', width: '100%' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        
        {/* Cabeçalho */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', backgroundColor: '#ffffff', padding: '20px 25px', borderRadius: '16px', border: '1px solid #cbd5e1', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', boxSizing: 'border-box', flexWrap: 'wrap', gap: '15px' }}>
          <div>
            <span style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 'bold', fontFamily: 'monospace', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>
              JENIOS PLATFORM • DEMONSTRAÇÃO DE INTERFACE
            </span>
            <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>
              Engenharia Reversa Comportamental
            </h1>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <a href="/dashboard" style={{ backgroundColor: '#f1f5f9', color: '#475569', padding: '8px 14px', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold', fontSize: '12px', border: '1px solid #cbd5e1' }}>
              ← Voltar à Mesa de Operações
            </a>
          </div>
        </div>

        {/* Caixa Explicativa */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '16px', padding: '25px', marginBottom: '25px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#0f172a', marginBottom: '10px' }}>
            Cenários comportamentais de exemplo
          </h2>
          <p style={{ fontSize: '13px', color: '#334155', lineHeight: '1.5', marginBottom: '20px' }}>
            Demonstração local: os registros abaixo são fictícios. Esta página não analisa cliques ou mercado, não assume o controle da conta e não executa ou inverte ordens. Resultados financeiros e proteção de capital não são calculados. Os exemplos são descartados ao recarregar a página.
          </p>
          
          <button
            onClick={dispararSimulacao}
            disabled={simulando}
            style={{ backgroundColor: '#7c3aed', color: '#fff', border: 'none', padding: '12px 20px', borderRadius: '10px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', opacity: simulando ? 0.7 : 1 }}
          >
            {simulando ? 'Preparando exemplo local...' : '⚡ Adicionar cenário de exemplo'}
          </button>
        </div>

        {/* Registo de Interceções */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '16px', padding: '25px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
          <span style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 'bold', fontFamily: 'monospace', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>
            🔍 REGISTROS DE DEMONSTRAÇÃO
          </span>
          <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#0f172a', marginBottom: '15px' }}>
            Exemplos de cenários e respostas
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {logs.map((log) => (
              <div key={log.id} style={{ padding: '15px', borderRadius: '12px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <span style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace', display: 'block', marginBottom: '2px' }}>{log.hora}</span>
                  <b style={{ fontSize: '13px', color: '#0f172a', display: 'block', marginBottom: '2px' }}>{log.evento}</b>
                  <span style={{ fontSize: '12px', color: '#7c3aed' }}>{log.acao}</span>
                </div>
                <div style={{ backgroundColor: '#e2e8f0', color: '#475569', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold' }}>
                  {log.status}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </main>
  );
}
