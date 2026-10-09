'use client';
import { useState } from 'react';

export default function EngenhariaReversaPage() {
  const [simulando, setSimulando] = useState(false);
  const [logs, setLogs] = useState([
    { id: 1, hora: '20:45:12', evento: 'Detecção de clique impulsivo pós-loss (WIN)', acao: 'Inversão para Short Institucional', status: 'Lucro Registrado' },
    { id: 2, hora: '19:30:50', evento: 'Tentativa de preço médio contra a tendência', acao: 'Bloqueio de Proteção Antifúria', status: 'Capital Preservado' }
  ]);

  const dispararSimulacao = () => {
    setSimulando(true);
    setTimeout(() => {
      const novoLog = {
        id: Date.now(),
        hora: new Date().toLocaleTimeString(),
        evento: 'Simulação de Pânico / Over-leveraging',
        acao: 'Modo Reverso Ativado Instantaneamente',
        status: '+R$ 210,00 Retificados'
      };
      setLogs([novoLog, ...logs]);
      setSimulando(false);
    }, 1200);
  };

  return (
    <main style={{ backgroundColor: '#0f172a', color: '#1e293b', minHeight: '100vh', padding: '30px 20px', fontFamily: 'Arial, sans-serif', boxSizing: 'border-box', width: '100%' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        
        {/* Cabeçalho */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', backgroundColor: '#ffffff', padding: '20px 25px', borderRadius: '16px', border: '1px solid #cbd5e1', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', boxSizing: 'border-box' }}>
          <div>
            <span style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 'bold', fontFamily: 'monospace', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>
              JENIOS PLATFORM • TECNOLOGIA PROPRIETÁRIA
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
            Transformando Erros Psicológicos em Vantagem Estatística
          </h2>
          <p style={{ fontSize: '13px', color: '#334155', lineHeight: '1.5', marginBottom: '20px' }}>
            O motor adaptativo da JENIOS analisa latências de clique e padrões de fúria no mini-índice e mini-dólar. Quando o operador entra em viés emocional, o algoritmo assume o controlo operacional e executa o sentido matematicamente oposto.
          </p>
          
          <button
            onClick={dispararSimulacao}
            disabled={simulando}
            style={{ backgroundColor: '#7c3aed', color: '#fff', border: 'none', padding: '12px 20px', borderRadius: '10px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', opacity: simulando ? 0.7 : 1 }}
          >
            {simulando ? 'A processar simulação HFT...' : '⚡ Simular Padrão de Fúria em Tempo Real'}
          </button>
        </div>

        {/* Registo de Interceções */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '16px', padding: '25px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
          <span style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 'bold', fontFamily: 'monospace', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>
            🔍 LOG DE INTERCEÇÕES DO MOTOR
          </span>
          <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#0f172a', marginBottom: '15px' }}>
            Histórico de Correções Automáticas
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {logs.map((log) => (
              <div key={log.id} style={{ padding: '15px', borderRadius: '12px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <span style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace', display: 'block', marginBottom: '2px' }}>{log.hora}</span>
                  <b style={{ fontSize: '13px', color: '#0f172a', display: 'block', marginBottom: '2px' }}>{log.evento}</b>
                  <span style={{ fontSize: '12px', color: '#7c3aed' }}>{log.acao}</span>
                </div>
                <div style={{ backgroundColor: '#d1fae5', color: '#065f46', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold' }}>
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
