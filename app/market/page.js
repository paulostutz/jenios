'use client';
import { useState } from 'react';

export default function MarketPage() {
  const [filtro, setFiltro] = useState('Todos');
  const [busca, setBusca] = useState('');

  const categorias = ['Todos', 'Bolsa Brasileira (B3)', 'Criptoativos & Futuros', 'Macroeconomia'];

  return (
    <main style={{ backgroundColor: '#0f172a', color: '#f8fafc', minHeight: '100vh', padding: '30px 20px', fontFamily: 'Arial, sans-serif', boxSizing: 'border-box', width: '100%' }}>
      
      {/* Container Principal do Market */}
      <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Cabeçalho / Título */}
        <div style={{ backgroundColor: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: '16px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <span style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 'bold', fontFamily: 'monospace', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>
              JENIOS MARKET • Inteligência e Contexto de Mercado
            </span>
            <h1 style={{ fontSize: '22px', fontWeight: 'bold', color: '#0f172a', margin: '0' }}>Painel de Informações e Notícias</h1>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0 0' }}>Acompanhe os fluxos institucionais, relatórios macro e dados em tempo real.</p>
          </div>
          <div style={{ width: '100%', maxWidth: '260px' }}>
            <input 
              type="text" 
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Pesquisar ativos, notícias..." 
              style={{ width: '100%', backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '12px', fontSize: '12px', color: '#0f172a', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        {/* Filtros de Categoria */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
          {categorias.map((cat) => (
            <button
              key={cat}
              onClick={() => setFiltro(cat)}
              style={{
                backgroundColor: filtro === cat ? '#7c3aed' : '#ffffff',
                color: filtro === cat ? '#ffffff' : '#334155',
                border: '1px solid #cbd5e1',
                borderRadius: '10px',
                padding: '10px 16px',
                fontSize: '12px',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Grade de Notícias / Artigos de Contexto */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
          
          {/* Notícia 1 */}
          <div style={{ backgroundColor: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: '16px', padding: '24px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.2)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <span style={{ fontSize: '10px', fontWeight: 'bold', fontFamily: 'monospace', color: '#9333ea', textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: '8px' }}>
                Fluxo Institucional • B3
              </span>
              <h3 style={{ fontSize: '15px', fontWeight: 'bold', color: '#0f172a', marginBottom: '8px', lineHeight: '1.4' }}>
                Baleias aumentam posições vendidas no Índice Futuro após rompimento de resistência
              </h3>
              <p style={{ fontSize: '12px', color: '#64748b', lineHeight: '1.5', margin: '0 0 16px 0' }}>
                Análise de fluxo indica armadilha clássica de liquidez montada nas máximas do minicontrato. Entenda o impacto para o varejo.
              </p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: '#64748b', borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
              <span>Há 15 minutos</span>
              <button 
                onClick={() => alert('A descarregar relatório completo de contexto...')} 
                style={{ background: 'none', border: 'none', color: '#7c3aed', fontWeight: 'bold', cursor: 'pointer', padding: 0, fontSize: '11px' }}
              >
                Ler Análise →
              </button>
            </div>
          </div>

          {/* Notícia 2 */}
          <div style={{ backgroundColor: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: '16px', padding: '24px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.2)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <span style={{ fontSize: '10px', fontWeight: 'bold', fontFamily: 'monospace', color: '#9333ea', textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: '8px' }}>
                Criptomoedas • 24/7
              </span>
              <h3 style={{ fontSize: '15px', fontWeight: 'bold', color: '#0f172a', marginBottom: '8px', lineHeight: '1.4' }}>
                Volatilidade no Bitcoin testa alavancagem de traders nas principais exchanges
              </h3>
              <p style={{ fontSize: '12px', color: '#64748b', lineHeight: '1.5', margin: '0 0 16px 0' }}>
                Liquidações em massa ultrapassam patamares críticos. Robôs de alta frequência executam proteção automática em contas sincronizadas.
              </p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: '#64748b', borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
              <span>Há 42 minutos</span>
              <button 
                onClick={() => alert('A descarregar relatório completo de contexto...')} 
                style={{ background: 'none', border: 'none', color: '#7c3aed', fontWeight: 'bold', cursor: 'pointer', padding: 0, fontSize: '11px' }}
              >
                Ler Análise →
              </button>
            </div>
          </div>

          {/* Notícia 3 */}
          <div style={{ backgroundColor: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: '16px', padding: '24px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.2)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <span style={{ fontSize: '10px', fontWeight: 'bold', fontFamily: 'monospace', color: '#9333ea', textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: '8px' }}>
                Macroeconomia • Global
              </span>
              <h3 style={{ fontSize: '15px', fontWeight: 'bold', color: '#0f172a', marginBottom: '8px', lineHeight: '1.4' }}>
                Bancos centrais mantêm taxas de juros sob observação estrita de liquidez
              </h3>
              <p style={{ fontSize: '12px', color: '#64748b', lineHeight: '1.5', margin: '0 0 16px 0' }}>
                Diretrizes de inflação moldam cenários de curto prazo para commodities e moedas emergentes nas mesas de câmbio.
              </p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: '#64748b', borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
              <span>Há 2 horas</span>
              <button 
                onClick={() => alert('A descarregar relatório completo de contexto...')} 
                style={{ background: 'none', border: 'none', color: '#7c3aed', fontWeight: 'bold', cursor: 'pointer', padding: 0, fontSize: '11px' }}
              >
                Ler Análise →
              </button>
            </div>
          </div>

        </div>

      </div>
    </main>
  );
}