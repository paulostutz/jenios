'use client';
import { useState } from 'react';
import Link from 'next/link';

export default function TendenciasPage() {
  const [abaAtiva, setAbaAtiva] = useState('tokens');

  const tokensTendencia = [
    { id: 1, nome: '$LTR-Prop', rede: 'Solana', volume: '+450%', preco: 'R$ 4,80', liquidez: 'R$ 14.2M', scoreWhale: '98/100', status: 'Alta Influxo Institucional', institucao: 'Solana Ventures & Private Pools' },
    { id: 2, nome: '$SOL-HFT', rede: 'Solana', volume: '+180%', preco: 'R$ 12,50', liquidez: 'R$ 8.9M', scoreWhale: '92/100', status: 'Acumulação de Smart Money', institucao: 'Jump Crypto Desk' },
    { id: 3, nome: '$USDT-Pool', rede: 'Multi-rede', volume: '+290%', preco: 'R$ 5,02', liquidez: 'R$ 45.0M', scoreWhale: '95/100', status: 'Arbitragem Cruzada Ativa', institucao: 'Wintermute Trading' }
  ];

  const baleias = [
    { id: 1, ativo: 'Ethereum (ETH)', instituicao: 'BlackRock Crypto Trust', volumeMovimentado: '15.000 ETH (≈ US$ 38M)', rede: 'Ethereum', fluxo: 'Inflow Institucional Longo Prazo', hash: '0x8f9c...3b12' },
    { id: 2, ativo: 'USDT', instituicao: 'JP Morgan Digital Assets Desk', volumeMovimentado: 'US$ 85.000.000', rede: 'TRON / Solana', fluxo: 'Liquidez para DEX de Alta Frequência', hash: '0x4a11...9e88' },
    { id: 3, ativo: 'Bitcoin (BTC)', instituicao: 'Fidelity Wise Custody', volumeMovimentado: '1.250 BTC (≈ US$ 78M)', rede: 'Lightning / Mainnet', fluxo: 'Acumulação em Carteira Fria', hash: '0x1c2d...5f6a' },
    { id: 4, ativo: 'SOL', instituicao: 'Citadel Securities Alpha', volumeMovimentado: '320.000 SOL (≈ US$ 48M)', rede: 'Solana', fluxo: 'Posicionamento em Derivativos', hash: 'SolanaTx998...abc' }
  ];

  const megapulse = [
    { id: 1, ativo: 'Ibovespa Futuro (WIN)', instituicao: 'B3 Market Maker Desk', direcao: '▲ Alta Institucional (+1.25%)', spread: '0.5 pontos', imbalance: '+78% Compras', detalhe: 'Forte absorção de venda no suporte de 128.200 pts.' },
    { id: 2, ativo: 'Mini-Dólar (WDO)', instituicao: 'Tesouraria Bancária Internacional', direcao: '▼ Pressão Vendedora (-0.85%)', spread: '0.5 pontos', imbalance: '+65% Vendas', detalhe: 'Desova de contratos cheios por exportadores.' },
    { id: 3, ativo: 'Petrobras (PETR4)', instituicao: 'Vanguard & BlackRock Emerging Markets', direcao: '▲ Fluxo Estrangeiro Intenso (+2.10%)', spread: 'R$ 0,02', imbalance: '+82% Compras', detalhe: 'Alocação por dividendos extraordinários.' }
  ];

  const abrirPainelOperacional = (nomeAtivo) => {
    const confirmar = confirm(`⚡ Deseja enviar o ativo [${nomeAtivo}] para a Mesa de Operações com proteção do Modo Reverso Adaptativo?`);
    if (confirmar) {
      window.location.href = '/mesa-operacao';
    }
  };

  return (
    <main style={{ backgroundColor: '#f1f5f9', color: '#0f172a', minHeight: '100vh', padding: '30px 20px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        
        {/* Cabeçalho do Terminal (Padrão Sala de Controle) */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', padding: '24px 30px', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', boxShadow: '0 4px 12px rgba(0,0,0,0.03)', flexWrap: 'wrap', gap: '15px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{ width: '8px', height: '8px', backgroundColor: '#10b981', borderRadius: '50%', display: 'inline-block' }}></span>
              <span style={{ fontSize: '11px', color: '#059669', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>TERMINAL HFT EM TEMPO REAL</span>
            </div>
            <h1 style={{ fontSize: '22px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>Hub de Tendências & Inteligência Institucional</h1>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <Link href="/dashboard-logado" style={{ backgroundColor: '#f1f5f9', color: '#0f172a', padding: '10px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', textDecoration: 'none', border: '1px solid #cbd5e1' }}>
              ← Sala de Controle
            </Link>
            <Link href="/social" style={{ backgroundColor: '#7c3aed', color: '#fff', padding: '10px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', textDecoration: 'none', boxShadow: '0 4px 15px rgba(124,58,237,0.3)' }}>
              Jenios Social
            </Link>
          </div>
        </div>

        {/* Indicadores Globais */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '25px' }}>
          <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '18px 20px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
            <span style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>Volume Institucional (24h)</span>
            <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#059669' }}>US$ 4.2 Bilhões</span>
            <span style={{ fontSize: '11px', color: '#059669', display: 'block', marginTop: '4px' }}>▲ +18.4% vs média diária</span>
          </div>
          <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '18px 20px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
            <span style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>Sentimento de Mercado</span>
            <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#0284c7' }}>Ganância Extrema (84/100)</span>
            <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginTop: '4px' }}>Filtro de Reversão Ativo</span>
          </div>
          <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '18px 20px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
            <span style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>Smart Money Inflow</span>
            <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#7c3aed' }}>R$ 840 Milhões</span>
            <span style={{ fontSize: '11px', color: '#059669', display: 'block', marginTop: '4px' }}>Foco em Solana e Mini-Índice</span>
          </div>
        </div>

        {/* Abas */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <button onClick={() => setAbaAtiva('tokens')} style={{ padding: '12px 22px', borderRadius: '10px', backgroundColor: abaAtiva === 'tokens' ? '#7c3aed' : '#ffffff', color: abaAtiva === 'tokens' ? '#fff' : '#0f172a', border: '1px solid #cbd5e1', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}>
            🚀 Tokens em Alta (Solana / HFT)
          </button>
          <button onClick={() => setAbaAtiva('baleias')} style={{ padding: '12px 22px', borderRadius: '10px', backgroundColor: abaAtiva === 'baleias' ? '#7c3aed' : '#ffffff', color: abaAtiva === 'baleias' ? '#fff' : '#0f172a', border: '1px solid #cbd5e1', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}>
            🐋 Movimentação de Baleias & Fundos
          </button>
          <button onClick={() => setAbaAtiva('megapulse')} style={{ padding: '12px 22px', borderRadius: '10px', backgroundColor: abaAtiva === 'megapulse' ? '#7c3aed' : '#ffffff', color: abaAtiva === 'megapulse' ? '#fff' : '#0f172a', border: '1px solid #cbd5e1', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}>
            📊 Megapulse B3 & Futuros
          </button>
        </div>

        {/* Conteúdo */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '25px', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
          
          {abaAtiva === 'tokens' && (
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 6px 0' }}>Tokens Destacados com Influxo HFT</h2>
              <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '20px' }}>Ativos detetados pelos nossos algoritmos com alta liquidez em pools descentralizados.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {tokensTendencia.map(t => (
                  <div key={t.id} style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '18px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#0f172a' }}>{t.nome}</span>
                        <span style={{ fontSize: '10px', backgroundColor: '#e2e8f0', color: '#0284c7', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>{t.rede}</span>
                        <span style={{ fontSize: '10px', backgroundColor: '#dcfce7', color: '#16a34a', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>{t.status}</span>
                      </div>
                      <span style={{ fontSize: '12px', color: '#475569' }}>Instituição Patrocinadora / Pool: <b style={{ color: '#0f172a' }}>{t.institucao}</b></span>
                      <div style={{ display: 'flex', gap: '15px', marginTop: '6px', fontSize: '11px', color: '#64748b' }}>
                        <span>Preço: <strong style={{ color: '#0f172a' }}>{t.preco}</strong></span>
                        <span>Volume 24h: <strong style={{ color: '#16a34a' }}>{t.volume}</strong></span>
                        <span>Liquidez: <strong style={{ color: '#0f172a' }}>{t.liquidez}</strong></span>
                        <span>Score Whale: <strong style={{ color: '#7c3aed' }}>{t.scoreWhale}</strong></span>
                      </div>
                    </div>
                    <button onClick={() => abrirPainelOperacional(t.nome)} style={{ backgroundColor: '#10b981', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
                      ⚡ Operar Sinal HFT
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {abaAtiva === 'baleias' && (
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 6px 0' }}>Monitoramento de Baleias & Grandes Fundos</h2>
              <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '20px' }}>Transações institucionais de alto volume monitoradas em tempo real na blockchain e balcões OTC.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {baleias.map(b => (
                  <div key={b.id} style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '18px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#0f172a' }}>{b.instituicao}</span>
                        <span style={{ fontSize: '10px', backgroundColor: '#e2e8f0', color: '#7c3aed', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>{b.ativo}</span>
                      </div>
                      <span style={{ fontSize: '12px', color: '#16a34a', fontWeight: 'bold' }}>Volume: {b.volumeMovimentado} • {b.fluxo}</span>
                      <span style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>Rede: {b.rede} | Hash ID: {b.hash}</span>
                    </div>
                    <button onClick={() => abrirPainelOperacional(b.instituicao)} style={{ backgroundColor: '#7c3aed', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
                      ⚡ Copiar Fluxo da Baleia
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {abaAtiva === 'megapulse' && (
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 6px 0' }}>Megapulse Institucional (B3 & Futuros Globais)</h2>
              <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '20px' }}>Análise de livro de ofertas e desequilíbrio de fluxo (Order Book Imbalance) para o Mini-Índice, Mini-Dólar e Ações.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {megapulse.map(m => (
                  <div key={m.id} style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '18px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#0f172a' }}>{m.ativo}</span>
                        <span style={{ fontSize: '10px', backgroundColor: '#e2e8f0', color: '#0284c7', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>{m.instituicao}</span>
                      </div>
                      <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#16a34a' }}>{m.direcao}</span>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>{m.detalhe} • <strong style={{ color: '#7c3aed' }}>{m.imbalance}</strong></span>
                    </div>
                    <button onClick={() => abrirPainelOperacional(m.ativo)} style={{ backgroundColor: '#10b981', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
                      ⚡ Operar com Robô B3
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