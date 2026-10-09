'use client';
import { useState } from 'react';

export default function CarteiraPage() {
  const [limiteHft, setLimiteHft] = useState(45820);
  const [atualizado, setAtualizado] = useState(false);

  const salvarLimite = () => {
    setAtualizado(true);
    alert(`Limite de capital autorizado para o espelhamento HFT atualizado para R$ ${Number(limiteHft).toLocaleString('pt-PT')} com sucesso!`);
    setTimeout(() => setAtualizado(false), 3000);
  };

  return (
    <main style={{ backgroundColor: '#0f172a', color: '#f8fafc', minHeight: '100vh', padding: '30px 20px', fontFamily: 'Arial, sans-serif', boxSizing: 'border-box', width: '100%' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Cabeçalho */}
        <div style={{ backgroundColor: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: '16px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', boxSizing: 'border-box' }}>
          <div>
            <span style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 'bold', fontFamily: 'monospace', letterSpacing: '2px', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
              JENIOS FINANCE • Assinaturas & Alocação HFT
            </span>
            <h1 style={{ fontSize: '20px', fontWeight: '900', color: '#0f172a', margin: 0 }}>Painel de Custos & Gestão de Risco</h1>
          </div>
          <a href="/dashboard" style={{ backgroundColor: '#f1f5f9', color: '#334155', textDecoration: 'none', fontWeight: 'bold', fontSize: '12px', padding: '10px 16px', borderRadius: '10px', border: '1px solid #cbd5e1' }}>
            ← Voltar ao Dashboard
          </a>
        </div>

        {/* Grelha de Visão Geral */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
          
          <div style={{ backgroundColor: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: '16px', padding: '20px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.2)', display: 'flex', flexDirection: 'column', gap: '8px', boxSizing: 'border-box' }}>
            <span style={{ fontSize: '10px', fontWeight: 'bold', fontFamily: 'monospace', color: '#64748b', textTransform: 'uppercase' }}>Plano Base & Mestres Ativos</span>
            <div style={{ fontSize: '20px', fontWeight: '900', color: '#7c3aed' }}>Pro + 2 Mestres</div>
            <div style={{ fontSize: '10px', color: '#64748b' }}>Renovação automática mensal</div>
          </div>

          <div style={{ backgroundColor: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: '16px', padding: '20px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.2)', display: 'flex', flexDirection: 'column', gap: '8px', boxSizing: 'border-box' }}>
            <span style={{ fontSize: '10px', fontWeight: 'bold', fontFamily: 'monospace', color: '#64748b', textTransform: 'uppercase' }}>Proteção de Drawdown (HFT)</span>
            <div style={{ fontSize: '20px', fontWeight: '900', color: '#059669' }}>Ativo (Máx: 3%)</div>
            <div style={{ fontSize: '10px', color: '#64748b' }}>Gestão de risco automatizada</div>
          </div>

        </div>

        {/* Secções de Configuração: Alocação de Risco e Assinaturas */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '24px' }}>
          
          {/* Controlo de Capital Alocado para Cópia */}
          <div style={{ backgroundColor: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: '16px', padding: '24px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.2)', display: 'flex', flexDirection: 'column', gap: '16px', boxSizing: 'border-box' }}>
            <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
              <h2 style={{ fontSize: '14px', fontWeight: '900', textTransform: 'uppercase', color: '#0f172a', margin: '0 0 4px 0' }}>🛡️ Limite de Capital para Espelhamento</h2>
              <span style={{ fontSize: '11px', color: '#64748b' }}>Define o teto de risco operado pelos robôs na sua corretora</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', color: '#334155' }}>Teto Autorizado (R$)</label>
              <input 
                type="number" 
                value={limiteHft} 
                onChange={(e) => setLimiteHft(e.target.value)} 
                style={{ backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '12px', fontSize: '14px', fontWeight: 'bold', color: '#0f172a', outline: 'none', boxSizing: 'border-box' }} 
              />
            </div>

            <button 
              onClick={salvarLimite}
              style={{ backgroundColor: '#7c3aed', color: '#fff', border: 'none', padding: '14px', borderRadius: '12px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '1px', boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)' }}
            >
              Atualizar Limite de Risco
            </button>

            {atualizado && (
              <span style={{ fontSize: '11px', color: '#059669', fontWeight: 'bold', textAlign: 'center' }}>
                ✓ Configurações de risco sincronizadas com a API da corretora.
              </span>
            )}
          </div>

          {/* Resumo de Assinaturas e Mestres */}
          <div style={{ backgroundColor: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: '16px', padding: '24px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.2)', display: 'flex', flexDirection: 'column', gap: '16px', boxSizing: 'border-box' }}>
            <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
              <h2 style={{ fontSize: '14px', fontWeight: '900', textTransform: 'uppercase', color: '#0f172a', margin: '0 0 4px 0' }}>📋 Subscrições Ativas</h2>
              <span style={{ fontSize: '11px', color: '#64748b' }}>Plano base e traders mestres vinculados</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 style={{ fontSize: '12px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 2px 0' }}>JENIOS Plano Pro</h4>
                  <span style={{ fontSize: '10px', color: '#64748b' }}>Plano Base • Renova em 12/11</span>
                </div>
                <span style={{ fontSize: '12px', fontWeight: '900', color: '#0f172a' }}>R$ 149,90 / mês</span>
              </div>

              <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 style={{ fontSize: '12px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 2px 0' }}>Carlos Quant</h4>
                  <span style={{ fontSize: '10px', color: '#64748b' }}>Cópia de Estratégia</span>
                </div>
                <span style={{ fontSize: '12px', fontWeight: '900', color: '#0f172a' }}>R$ 49,90 / mês</span>
              </div>

              <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 style={{ fontSize: '12px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 2px 0' }}>Ana Trader</h4>
                  <span style={{ fontSize: '10px', color: '#64748b' }}>Cópia de Estratégia</span>
                </div>
                <span style={{ fontSize: '12px', fontWeight: '900', color: '#0f172a' }}>R$ 49,90 / mês</span>
              </div>
            </div>
          </div>

        </div>

        {/* Histórico de Faturas / Faturamento */}
        <div style={{ backgroundColor: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: '16px', padding: '24px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.2)', display: 'flex', flexDirection: 'column', gap: '16px', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
            <h2 style={{ fontSize: '12px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1px', color: '#0f172a', margin: 0 }}>Histórico de Faturas & Recibos</h2>
            <span style={{ fontSize: '10px', color: '#64748b', fontFamily: 'monospace' }}>Plataforma JENIOS</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h4 style={{ fontSize: '12px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 2px 0' }}>Fatura Mensal • Outubro/2026</h4>
                <span style={{ fontSize: '10px', color: '#64748b' }}>Inclui Plano Pro + 2 Mestres</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '12px', fontWeight: '900', color: '#0f172a', display: 'block' }}>R$ 249,70</span>
                <span style={{ fontSize: '10px', backgroundColor: '#d1fae5', color: '#065f46', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>Pago</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </main>
  );
}