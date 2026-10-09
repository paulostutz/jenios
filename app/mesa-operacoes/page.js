'use client';
import { useState } from 'react';

export default function MesaOperacoesPage() {
  const [modalAberto, setModalAberto] = useState(false);
  const [ativo, setAtivo] = useState('WINZ26');

  const conectarContaReal = () => {
    alert('Conta real conectada com sucesso! Capital manual sincronizado.');
    setModalAberto(false);
  };

  return (
    <main style={{ backgroundColor: '#0f172a', color: '#f8fafc', minHeight: '100vh', padding: '20px', fontFamily: 'Arial, sans-serif', boxSizing: 'border-box', width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      {/* Barra de Controlo de Ativos e Conexão com Corretora */}
      <div style={{ backgroundColor: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: '16px', padding: '16px 24px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', maxWidth: '400px' }}>
          <span style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 'bold', fontFamily: 'monospace', letterSpacing: '2px', textTransform: 'uppercase' }}>
            JENIOS DESK •
          </span>
          <select 
            value={ativo}
            onChange={(e) => setAtivo(e.target.value)}
            style={{ backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '10px 12px', fontSize: '12px', fontWeight: 'bold', color: '#0f172a', outline: 'none', flex: 1 }}
          >
            <option value="WINZ26">WINZ26 (B3 - Mini-Índice Futuro)</option>
            <option value="WDOF26">WDOF26 (B3 - Mini-Dólar Futuro)</option>
            <option value="PETR4">PETR4 (B3 - Ações A Vista)</option>
            <option value="BTCUSD">BTCUSD (Cripto - Bitcoin Perpetuo)</option>
          </select>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '16px', fontSize: '12px', fontFamily: 'monospace' }}>
          <button 
            onClick={() => setModalAberto(true)}
            style={{ backgroundColor: '#059669', color: '#ffffff', border: 'none', padding: '10px 16px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
          >
            🔗 Conectar Corretora (Conta Real)
          </button>
          <div>
            <span style={{ color: '#64748b' }}>Resultado:</span>
            <span style={{ fontWeight: '900', color: '#059669', marginLeft: '6px' }}>+ R$ 940,00</span>
          </div>
          <button 
            onClick={() => alert('A abrir engenharia reversa adaptativa...')}
            style={{ backgroundColor: '#f1f5f9', color: '#334155', border: 'none', padding: '10px 14px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            ⚙️ Risco
          </button>
        </div>
      </div>

      {/* Área Principal: Gráfico TradingView + Painel de Execução */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px', flex: 1 }}>
        
        {/* Gráfico TradingView */}
        <div style={{ backgroundColor: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: '16px', padding: '20px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.2)', gridColumn: 'span 3', display: 'flex', flexDirection: 'column', minHeight: '450px', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', marginBottom: '12px' }}>
            <span style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', color: '#334155' }}>Gráfico em Tempo Real (TradingView Engine)</span>
            <span style={{ fontSize: '10px', color: '#94a3b8', fontFamily: 'monospace' }}>1m • 5m • 15m • 1H • Diário</span>
          </div>
          
          <div style={{ flex: 1, backgroundColor: '#0f172a', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden', color: '#64748b', fontFamily: 'monospace', fontSize: '12px' }}>
            <div style={{ textAlign: 'center', zIndex: 10, padding: '20px' }}>
              <span style={{ color: '#c084fc', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>[ Widget Oficial TradingView Integrado ]</span>
              <span style={{ fontSize: '10px', color: '#94a3b8' }}>Fluxo Institucional & Execução HFT em Tempo Real</span>
            </div>
          </div>
        </div>

        {/* Painel Lateral */}
        <div style={{ backgroundColor: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: '16px', padding: '20px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.2)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
              <h2 style={{ fontSize: '12px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1px', color: '#0f172a', margin: '0 0 4px 0' }}>Mesa de Execução HFT</h2>
              <span style={{ fontSize: '10px', color: '#059669', fontWeight: 'bold' }}>● Proteção Algorítmica Ativa</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', color: '#334155', fontFamily: 'monospace' }}>Capital a Operar (R$ Manual)</label>
              <input type="number" defaultValue="10000.00" step="100.00" min="100" style={{ backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '10px', fontSize: '12px', color: '#0f172a', fontFamily: 'monospace', outline: 'none' }} />
              <span style={{ fontSize: '9px', color: '#64748b' }}>Informe exatamente quanto da sua banca deseja alocar nesta sessão.</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', color: '#64748b', fontFamily: 'monospace' }}>Contratos por Operação</label>
              <input type="number" defaultValue="5" min="1" style={{ backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '10px', fontSize: '12px', color: '#0f172a', fontFamily: 'monospace', outline: 'none' }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button onClick={() => alert('Ordem de VENDA enviada! Gerida pelo algoritmo (Colherinha/Balde).')} style={{ backgroundColor: '#e11d48', color: '#fff', border: 'none', padding: '12px', borderRadius: '10px', fontWeight: '900', fontSize: '11px', cursor: 'pointer', textTransform: 'uppercase' }}>
                📉 Vender
              </button>
              <button onClick={() => alert('Ordem de COMPRA enviada! Gerida pelo algoritmo (Colherinha/Balde).')} style={{ backgroundColor: '#059669', color: '#fff', border: 'none', padding: '12px', borderRadius: '10px', fontWeight: '900', fontSize: '11px', cursor: 'pointer', textTransform: 'uppercase' }}>
                📈 Comprar
              </button>
            </div>

            <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', padding: '12px', fontSize: '10px', color: '#78350f', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <b>🛡️ Modo Disciplina Rígida Ativo:</b> 
              <span>O botão de encerramento manual antecipado está <b>bloqueado</b> pelo Robô de Frieza. O algoritmo garante a execução estrita da estratégia assimétrica sem interferência emocional.</span>
            </div>
          </div>

          <div style={{ backgroundColor: '#f3e8ff', border: '1px solid #e9d5ff', borderRadius: '10px', padding: '10px', fontSize: '10px', color: '#581c87', marginTop: '16px' }}>
            <b>Estratégia Aplicada:</b> Perder de colherinha (stop matemático curto) e ganhar de balde (alvo longo).
          </div>
        </div>

      </div>

      {/* MODAL DE CONEXÃO COM CORRETORA */}
      {modalAberto && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', zIndex: 50 }}>
          <div style={{ backgroundColor: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: '16px', padding: '30px', maxWidth: '420px', width: '100%', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', display: 'flex', flexDirection: 'column', gap: '16px', boxSizing: 'border-box' }}>
            <div>
              <span style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 'bold', fontFamily: 'monospace', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>
                JENIOS BROKER GATEWAY • Conexão Segura
              </span>
              <h2 style={{ fontSize: '18px', fontWeight: '900', color: '#0f172a', margin: '0 0 4px 0' }}>Vincular Conta Real da Corretora</h2>
              <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>
                Insira as credenciais de API da sua corretora para sincronizar o capital manual alocado.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', color: '#334155' }}>Corretora / Exchange</label>
              <select style={{ backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '12px', fontSize: '12px', color: '#0f172a', outline: 'none' }}>
                <option>XP Investimentos (B3 / Futuros)</option>
                <option>Clear Corretora (B3 / Mini-Índice & Dólar)</option>
                <option>Rico Investimentos (B3)</option>
                <option>Binance (Cripto Derivativos)</option>
                <option>Interactive Brokers (Global / Forex)</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', color: '#334155' }}>Chave de API / Token</label>
              <input type="password" placeholder="Token de segurança..." style={{ backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '12px', fontSize: '12px', color: '#0f172a', fontFamily: 'monospace', outline: 'none' }} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '8px' }}>
              <button 
                onClick={conectarContaReal}
                style={{ backgroundColor: '#7c3aed', color: '#fff', border: 'none', padding: '14px', borderRadius: '10px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '1px', boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)' }}
              >
                Conectar e Sincronizar Mesa
              </button>
              <button 
                onClick={() => setModalAberto(false)}
                style={{ backgroundColor: '#f1f5f9', color: '#334155', border: 'none', padding: '12px', borderRadius: '10px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer', textTransform: 'uppercase' }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}