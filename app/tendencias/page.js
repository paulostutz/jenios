'use client';
import { useState } from 'react';
import Link from 'next/link';

export default function TendenciasPage() {
  const [abaAtiva, setAbaAtiva] = useState('tokens');

  const tokensTendencia = [
    { id: 1, nome: '$LTR-Prop', rede: 'Solana', volume: '+450%', preco: 'R$ 4,80', status: 'Alta Influxo Institucional' },
    { id: 2, nome: '$SOL-HFT', rede: 'Solana', volume: '+180%', preco: 'R$ 12,50', status: 'Acumulação Ativa' }
  ];

  const baleias = [
    { id: 1, ativo: 'Ethereum (ETH)', rede: 'Ethereum', movimento: '15,000 ETH transferidos para custódia', impacto: 'Longo Prazo' },
    { id: 2, ativo: 'USDT', rede: 'TRON', movimento: 'US$ 85M para DEX de alta frequência', impacto: 'Arbitragem Rápida' }
  ];

  const megapulse = [
    { id: 1, ativo: 'Ibovespa (IBOV)', rede: 'B3', direcao: '▲ Alta Institucional (+1.2%)', detalhes: 'Fluxo forte no setor financeiro.' }
  ];

  const operarSinal = (nome) => {
    const confirmar = confirm(`⚡ Deseja operar o ativo ${nome} na Mesa de Operações com blindagem do Modo Reverso?`);
    if (confirmar) {
      window.location.href = '/mesa-operacao';
    }
  };

  return (
    <main style={{ backgroundColor: '#f1f5f9', color: '#0f172a', minHeight: '100vh', padding: '30px 20px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        
        {/* Cabeçalho */}
        <div style={{ backgroundColor: '#ffffff', padding: '20px 24px', borderRadius: '16px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
          <div>
            <span style={{ fontSize: '11px', color: '#059669', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>ANÁLISE DE MERCADO MULTICHAIN</span>
            <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#0f172a', margin: '2px 0 0 0' }}>Hub de Tendências & Ativos</h1>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <Link href="/dashboard-logado" style={{ backgroundColor: '#f1f5f9', color: '#0f172a', padding: '8px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', textDecoration: 'none', border: '1px solid #cbd5e1' }}>
              ← Sala de Controlo
            </Link>
            <Link href="/social" style={{ backgroundColor: '#7c3aed', color: '#fff', padding: '8px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', textDecoration: 'none' }}>
              Jenios Social
            </Link>
          </div>
        </div>

        {/* Abas */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <button onClick={() => setAbaAtiva('tokens')} style={{ padding: '10px 18px', borderRadius: '8px', backgroundColor: abaAtiva === 'tokens' ? '#059669' : '#ffffff', color: abaAtiva === 'tokens' ? '#fff' : '#0f172a', border: '1px solid #cbd5e1', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}>
            🚀 Tokens em Alta
          </button>
          <button onClick={() => setAbaAtiva('baleias')} style={{ padding: '10px 18px', borderRadius: '8px', backgroundColor: abaAtiva === 'baleias' ? '#059669' : '#ffffff', color: abaAtiva === 'baleias' ? '#fff' : '#0f172a', border: '1px solid #cbd5e1', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}>
            🐋 Movimentação de Baleias
          </button>
          <button onClick={() => setAbaAtiva('megapulse')} style={{ padding: '10px 18px', borderRadius: '8px', backgroundColor: abaAtiva === 'megapulse' ? '#059669' : '#ffffff', color: abaAtiva === 'megapulse' ? '#fff' : '#0f172a', border: '1px solid #cbd5e1', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}>
            📊 Megapulse B3/Global
          </button>
        </div>

        {/* Conteúdo das Abas */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
          {abaAtiva === 'tokens' && (
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '15px', color: '#0f172a' }}>Tokens Destacados (Solana & Multi-rede)</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {tokensTendencia.map(t => (
                  <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', padding: '14px 18px', borderRadius: '10px', border: '1px solid #e2e8f0', flexWrap: 'wrap', gap: '10px' }}>
                    <div>
                      <b style={{ fontSize: '14px', color: '#0f172a', display: 'block' }}>{t.nome} ({t.rede})</b>
                      <span style={{ fontSize: '11px', color: '#059669', fontWeight: 'bold' }}>{t.status} • Volume: {t.volume}</span>
                    </div>
                    <button onClick={() => operarSinal(t.nome)} style={{ backgroundColor: '#10b981', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>
                      ⚡ Operar este Sinal
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {abaAtiva === 'baleias' && (
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '15px', color: '#0f172a' }}>Monitor de Baleias Institucionais</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {baleias.map(b => (
                  <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', padding: '14px 18px', borderRadius: '10px', border: '1px solid #e2e8f0', flexWrap: 'wrap', gap: '10px' }}>
                    <div>
                      <b style={{ fontSize: '14px', color: '#0f172a', display: 'block' }}>{b.ativo} ({b.rede})</b>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>{b.movimento}</span>
                    </div>
                    <button onClick={() => operarSinal(b.ativo)} style={{ backgroundColor: '#10b981', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>
                      ⚡ Operar Sinal
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {abaAtiva === 'megapulse' && (
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '15px', color: '#0f172a' }}>Megapulse Institucional (B3 & Globais)</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {megapulse.map(m => (
                  <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', padding: '14px 18px', borderRadius: '10px', border: '1px solid #e2e8f0', flexWrap: 'wrap', gap: '10px' }}>
                    <div>
                      <b style={{ fontSize: '14px', color: '#0f172a', display: 'block' }}>{m.ativo} ({m.rede})</b>
                      <span style={{ fontSize: '11px', color: '#059669', fontWeight: 'bold' }}>{m.direcao} - {m.detalhes}</span>
                    </div>
                    <button onClick={() => operarSinal(m.ativo)} style={{ backgroundColor: '#10b981', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>
                      ⚡ Operar Sinal
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>
    </main>
  );
}