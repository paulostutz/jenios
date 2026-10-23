'use client';
import { useState } from 'react';

export default function RelatoriosPage() {
  const [periodo, setPeriodo] = useState('mes');
  const [exportando, setExportando] = useState(false);

  const extrato = [
    { id: 1, data: '07/10/2026', ativo: 'WIN (Mini-Índice)', tipo: 'HFT / Automático', pnl: '+R$ 420,00', status: 'Lucro' },
    { id: 2, data: '06/10/2026', ativo: 'WDO (Dólar)', tipo: 'Modo Reverso', pnl: '+R$ 310,00', status: 'Lucro' },
    { id: 3, data: '05/10/2026', ativo: 'WIN (Mini-Índice)', tipo: 'Manual / Proteção', pnl: '-R$ 85,00', status: 'Loss (Retificado)' },
    { id: 4, data: '04/10/2026', ativo: 'BTC (Cripto / Solana)', tipo: 'Copy Trading', pnl: '+R$ 750,00', status: 'Lucro' }
  ];

  const exportarRelatorio = () => {
    setExportando(true);
    setTimeout(() => {
      setExportando(false);
      alert('Relatório PDF exportado com sucesso para a sua máquina!');
    }, 1500);
  };

  return (
    <main style={{ backgroundColor: '#0f172a', color: '#1e293b', minHeight: '100vh', padding: '30px 20px', fontFamily: 'Arial, sans-serif', boxSizing: 'border-box', width: '100%' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        
        {/* Cabeçalho */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', backgroundColor: '#ffffff', padding: '20px 25px', borderRadius: '16px', border: '1px solid #cbd5e1', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', boxSizing: 'border-box', flexWrap: 'wrap', gap: '15px' }}>
          <div>
            <span style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 'bold', fontFamily: 'monospace', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>
              JENIOS PLATFORM • AUDITORIA E RELATÓRIOS
            </span>
            <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>
              Histórico Financeiro e Performance
            </h1>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={exportarRelatorio}
              disabled={exportando}
              style={{ backgroundColor: '#7c3aed', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: '8px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer', opacity: exportando ? 0.7 : 1 }}
            >
              {exportando ? 'A gerar PDF...' : '📥 Exportar Extrato PDF'}
            </button>
            <a href="/dashboard" style={{ backgroundColor: '#f1f5f9', color: '#475569', padding: '9px 14px', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold', fontSize: '12px', border: '1px solid #cbd5e1' }}>
              ← Mesa de Operações
            </a>
          </div>
        </div>

        {/* Resumo de Indicadores */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px', marginBottom: '25px' }}>
          <div style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '16px', padding: '20px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>RESULTADO LÍQUIDO (MTD)</span>
            <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#059669' }}>+R$ 1.395,00</div>
          </div>
          <div style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '16px', padding: '20px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>EFICIÊNCIA DO ALGORITMO</span>
            <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#7c3aed' }}>86.5% de Acerto</div>
          </div>
          <div style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '16px', padding: '20px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>FATOR DE LUCRO (PROFIT FACTOR)</span>
            <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#0f172a' }}>2.84</div>
          </div>
        </div>

        {/* Tabela de Histórico Detalhado */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '16px', padding: '25px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>
              Registo Consolidado de Sessões
            </h2>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setPeriodo('semana')}
                style={{ background: periodo === 'semana' ? '#7c3aed' : '#f1f5f9', color: periodo === 'semana' ? '#fff' : '#475569', border: '1px solid #cbd5e1', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Esta Semana
              </button>
              <button
                onClick={() => setPeriodo('mes')}
                style={{ background: periodo === 'mes' ? '#7c3aed' : '#f1f5f9', color: periodo === 'mes' ? '#fff' : '#475569', border: '1px solid #cbd5e1', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Este Mês
              </button>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#64748b', fontSize: '11px', textTransform: 'uppercase', fontFamily: 'monospace' }}>
                  <th style={{ padding: '10px' }}>Data</th>
                  <th style={{ padding: '10px' }}>Ativo / Mercado</th>
                  <th style={{ padding: '10px' }}>Modo de Execução</th>
                  <th style={{ padding: '10px' }}>PnL Registado</th>
                  <th style={{ padding: '10px' }}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {extrato.map((item) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px', fontFamily: 'monospace', color: '#64748b' }}>{item.data}</td>
                    <td style={{ padding: '12px', fontWeight: 'bold', color: '#0f172a' }}>{item.ativo}</td>
                    <td style={{ padding: '12px', color: '#7c3aed' }}>{item.tipo}</td>
                    <td style={{ padding: '12px', fontWeight: 'bold', color: item.pnl.startsWith('+') ? '#059669' : '#dc2626' }}>
                      {item.pnl}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span style={{ fontSize: '11px', backgroundColor: item.status.includes('Lucro') ? '#d1fae5' : '#fee2e2', color: item.status.includes('Lucro') ? '#065f46' : '#991b1b', fontWeight: 'bold', padding: '3px 8px', borderRadius: '6px' }}>
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </main>
  );
}
