'use client';
import { useState } from 'react';

export default function ExtratoFinanceiroPage() {
  const baixarExtratoPDF = () => {
    alert('A gerar ficheiro PDF oficial do extrato financeiro e operacional da JENIOS...\nO download começará em instantes.');
  };

  const baixarExtratoCSV = () => {
    alert('A compilar dados em formato CSV (compatível com Excel / Google Sheets)...\nO download começará em instantes.');
  };

  return (
    <main style={{ backgroundColor: '#0f172a', color: '#f8fafc', minHeight: '100vh', paddingBottom: '60px', fontFamily: 'Arial, sans-serif', boxSizing: 'border-box', width: '100%' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '30px 20px 0 20px' }}>
        
        {/* Cabeçalho */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', borderBottom: '1px solid #334155', paddingBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
          <div>
            <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#7c3aed', fontFamily: 'monospace', letterSpacing: '2px', textTransform: 'uppercase' }}>
              JENIOS FINANCE • Auditoria e Histórico
            </span>
            <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#ffffff', margin: '4px 0 0 0' }}>Extrato Financeiro & Operacional</h1>
          </div>
          
          {/* Botões de Exportação */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            <button onClick={baixarExtratoPDF} style={{ backgroundColor: '#1e293b', color: '#e2e8f0', border: '1px solid #334155', padding: '10px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
              📄 Baixar PDF
            </button>
            <button onClick={baixarExtratoCSV} style={{ backgroundColor: '#1e293b', color: '#e2e8f0', border: '1px solid #334155', padding: '10px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
              📊 Exportar CSV
            </button>
            <a href="/social" style={{ backgroundColor: '#7c3aed', color: '#fff', textDecoration: 'none', fontWeight: 'bold', fontSize: '12px', padding: '10px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center' }}>
              ← Voltar para Social
            </a>
          </div>
        </div>

        {/* Grid de Colunas (Pagamentos vs Ganhos) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '25px' }}>
          
          {/* Coluna 1: Pagamentos e Assinaturas */}
          <div style={{ backgroundColor: '#131b2e', border: '1px solid #1e293b', borderRadius: '16px', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(124, 58, 237, 0.1)', border: '1px solid rgba(124, 58, 237, 0.3)', borderRadius: '10px', padding: '12px', marginBottom: '15px' }}>
              <h2 style={{ fontSize: '13px', fontWeight: 'bold', color: '#fff', margin: 0, textTransform: 'uppercase' }}>💳 Pagamentos e Assinaturas</h2>
              <span style={{ fontSize: '11px', color: '#c084fc', fontFamily: 'monospace', fontWeight: 'bold' }}>Outubro / 2026</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
              <div style={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '10px', padding: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <b style={{ color: '#fff', display: 'block' }}>Plano Base Pro (SaaS)</b>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>Renovação Mensal • Cartão Final 4210</span>
                </div>
                <span style={{ fontWeight: 'black', color: '#f87171' }}>- R$ 149,90</span>
              </div>

              <div style={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '10px', padding: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <b style={{ color: '#fff', display: 'block' }}>Cópia Mestre: Carlos Quant</b>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>Split Automático (30% JENIOS / 70% Mestre)</span>
                </div>
                <span style={{ fontWeight: 'black', color: '#f87171' }}>- R$ 49,90</span>
              </div>

              <div style={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '10px', padding: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <b style={{ color: '#fff', display: 'block' }}>JENIOS Ads (Tráfego Pago)</b>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>Impulsionamento de Post • Pix Pago</span>
                </div>
                <span style={{ fontWeight: 'black', color: '#f87171' }}>- R$ 100,00</span>
              </div>
            </div>
          </div>

          {/* Coluna 2: Extrato Operacional & Ganhos */}
          <div style={{ backgroundColor: '#131b2e', border: '1px solid #1e293b', borderRadius: '16px', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '10px', padding: '12px', marginBottom: '15px' }}>
              <h2 style={{ fontSize: '13px', fontWeight: 'bold', color: '#fff', margin: 0, textTransform: 'uppercase' }}>📈 Extrato Operacional & Ganhos</h2>
              <span style={{ fontSize: '11px', color: '#34d399', fontFamily: 'monospace', fontWeight: 'bold' }}>B3 / Mini-Índice</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
              <div style={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '10px', padding: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <b style={{ color: '#fff', display: 'block' }}>Resultado Mesa HFT (Day Trade)</b>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>Operações autónomas com robô protetor</span>
                </div>
                <span style={{ fontWeight: 'black', color: '#34d399' }}>+ R$ 1.840,00</span>
              </div>

              <div style={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '10px', padding: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <b style={{ color: '#fff', display: 'block' }}>Repasse Recebido (Como Mestre)</b>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>70% de 4 seguidores copiando a conta</span>
                </div>
                <span style={{ fontWeight: 'black', color: '#34d399' }}>+ R$ 139,72</span>
              </div>

              <div style={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '10px', padding: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <b style={{ color: '#fff', display: 'block' }}>Abono de Mensalidade (Top 3)</b>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>Prémio de eficiência do mês anterior</span>
                </div>
                <span style={{ fontWeight: 'black', color: '#34d399' }}>Isento (R$ 0,00)</span>
              </div>
            </div>
          </div>

        </div>

        {/* Resumo Consolidado */}
        <div style={{ backgroundColor: '#0b0f19', border: '1px solid #334155', borderRadius: '16px', padding: '20px 25px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
          <div>
            <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#c084fc', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Balanço Líquido Consolidado (Outubro)</span>
            <span style={{ fontSize: '13px', color: '#94a3b8' }}>Total de Entradas vs. Saídas e Custos Operacionais</span>
          </div>
          <div style={{ textAlign: 'right' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 'black', color: '#34d399', margin: 0 }}>+ R$ 1.680,82</h2>
            <span style={{ fontSize: '11px', color: '#64748b' }}>Saldo Líquido Disponível</span>
          </div>
        </div>

      </div>
    </main>
  );
}