'use client';
import { useState } from 'react';
import Link from 'next/link';

export default function TendenciasPage() {
  const [abaAtiva, setAbaAtiva] = useState('tokens');
  const [ativoSelecionado, setAtivoSelecionado] = useState(null);

  // Tokens com dados ricos e métricas de HFT
  const tokensTendencia = [
    { id: 1, nome: '$LTR-Prop', rede: 'Solana', volume: '+450%', preco: 'R$ 4,80', liquidez: 'R$ 14.2M', scoreWhale: '98/100', status: 'Alta Influxo Institucional', institucao: 'Solana Ventures & Private Pools' },
    { id: 2, nome: '$SOL-HFT', rede: 'Solana', volume: '+180%', preco: 'R$ 12,50', liquidez: 'R$ 8.9M', scoreWhale: '92/100', status: 'Acumulação de Smart Money', institucaison: 'Jump Crypto Desk' },
    { id: 3, nome: '$USDT-Pool', rede: 'Multi-rede', volume: '+290%', preco: 'R$ 5,02', liquidez: 'R$ 45.0M', scoreWhale: '95/100', status: 'Arbitragem Cruzada Ativa', institucao: 'Wintermute Trading' }
  ];

  // Baleias com nomes institucionais reais
  const baleias = [
    { id: 1, ativo: 'Ethereum (ETH)', instituicao: 'BlackRock Crypto Trust', volumeMovimentado: '15.000 ETH (≈ US$ 38M)', rede: 'Ethereum', fluxo: 'Inflow Institucional Longo Prazo', hash: '0x8f9c...3b12' },
    { id: 2, ativo: 'USDT', instituicao: 'JP Morgan Digital Assets Desk', volumeMovimentado: 'US$ 85.000.000', rede: 'TRON / Solana', fluxo: 'Liquidez para DEX de Alta Frequência', hash: '0x4a11...9e88' },
    { id: 3, ativo: 'Bitcoin (BTC)', instituicao: 'Fidelity Wise Custody', volumeMovimentado: '1.250 BTC (≈ US$ 78M)', rede: 'Lightning / Mainnet', fluxo: 'Acumulação em Carteira Fria', hash: '0x1c2d...5f6a' },
    { id: 4, ativo: 'SOL', instituicao: 'Citadel Securities Alpha', volumeMovimentado: '320.000 SOL (≈ US$ 48M)', rede: 'Solana', fluxo: 'Posicionamento em Derivativos', hash: 'SolanaTx998...abc' }
  ];

  // Megapulse B3 e Global com dados de livro de ofertas
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
    <main style={{ backgroundColor: '#0f172a', color: '#f8fafc', minHeight: '100vh', padding: '30px 20px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        
        {/* Cabeçalho do Terminal */}
        <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', padding: '24px 30px', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', boxShadow: '0 10px 25px rgba(0,0,0,0.3)', flexWrap: 'wrap', gap: '15px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{ width: '8px', height: '8px', backgroundColor: '#10b981', borderRadius: '50%', display: 'inline-block', boxShadow: '0 0 8px #10b981' }}></span>
              <span style={{ fontSize: '11px', color: '#34d399', fontWeight: 'bold', letterSpacing: '1.5px', textTransform: 'uppercase' }}>TERMINAL HFT EM TEMPO REAL</span>
            </div>
            <h1 style={{ fontSize: '22px', fontWeight: 'bold', color: '#ffffff', margin: 0 }}>Hub de Tendências & Inteligência Institucional</h1>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <Link href="/dashboard-logado" style={{ backgroundColor: '#334155', color: '#f8fafc', padding: '10px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', textDecoration: 'none', border: '1px solid #475569' }}>
              ← Sala de Controle
            </Link>
            <Link href="/social" style={{ backgroundColor: '#7c3aed', color: '#fff', padding: '10px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', textDecoration: 'none', boxShadow: '0 4px 15px rgba(124,58,237,0.4)' }}>
              Jenios Social
            </Link>
          </div>
        </div>

        {/* Barra de Indicadores Globais */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '25px' }}>
          <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '16px 20px' }}>
            <span style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>Volume Institucional (24h)</span>
            <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#34d399' }}>US$ 4.2 Bilhões</span>
            <span style={{ fontSize: '11px', color: '#34d399', display: 'block', marginTop: '4px' }}>▲ +18.4% vs média diária</span>
          </div>
          <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '16px 20px' }}>
            <span style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>Sentimento de Mercado</span>
            <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#38bdf8' }}>Ganância Extrema (84/100)</span>
            <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginTop: '4px' }}>Filtro de Reversão Ativo</span>
          </div>
          <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '16px 20px' }}>
            <span style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>Smart Money Inflow</span>
            <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#c084fc' }}>R$ 840 Milhões</span>
            <span style={{ fontSize: '11px', color: '#34d399', display: 'block', marginTop: '4px' }}>Foco em Solana e Mini-Índice</span>
          </div>
        </div>

        {/* Abas Dinâmicas */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <button onClick={() => setAbaAtiva('tokens')} style={{ padding: '12px 22px', borderRadius: '10px', backgroundColor: abaAtiva === 'tokens' ? '#7c3aed' : '#1e293b', color: '#fff', border: '1px solid #334155', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s' }}>
            🚀 Tokens em Alta (Solana / HFT)
          </button>
          <button onClick={() => setAbaAtiva('baleias')} style={{ padding: '12px 22px', borderRadius: '10px', backgroundColor: abaAtiva === 'baleias' ? '#7c3aed' : '#1e293b', color: '#fff', border: '1px solid #334155', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s' }}>
            🐋 Movimentação de Baleias & Fundos
          </button>
          <button onClick={() => setAbaAtiva('megapulse')} style={{ padding: '12px 22px', borderRadius: '10px', backgroundColor: abaAtiva === 'megapulse' ? '#7c3aed' : '#1e293b', color: '#fff', border: '1px solid #334155', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s' }}>
            📊 Megapulse B3 & Futuros
          </button>
        </div>

        {/* Painel de Conteúdo */}
        <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '16px', padding: '25px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
          
          {abaAtiva === 'tokens' && (
            <div>
              <div style={{ marginBottom: '20px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#fff', margin: '0 0 6px 0' }}>Tokens Destacados com Influxo HFT</h2>
                <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>Ativos detetados pelos nossos algoritmos com alta liquidez em pools descentralizados.</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {tokensTendencia.map(t => (
                  <div key={t.id} style={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px', padding: '18px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#fff' }}>{t.nome}</span>
                        <span style={{ fontSize: '10px', backgroundColor: '#334155', color: '#38bdf8', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>{t.rede}</span>
                        <span style={{ fontSize: '10px', backgroundColor: '#064e3b', color: '#34d399', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>{t.status}</span>
                      </div>
                      <span style={{ fontSize: '12px', color: '#94a3b8' }}>Instituição Patrocinadora / Pool: <b style={{ color: '#cbd5e1' }}>{t.institucao}</b></span>
                      <div style={{ display: 'flex', gap: '15px', marginTop: '6px', fontSize: '11px', color: '#64748b' }}>
                        <span>Preço: <strong style={{ color: '#fff' }}>{t.preco}</strong></span>
                        <span>Volume 24h: <strong style={{ color: '#34d399' }}>{t.volume}</strong></span>
                        <span>Liquidez: <strong style={{ color: '#fff' }}>{t.liquidez}</strong></span>
                        <span>Score Whale: <strong style={{ color: '#c084fc' }}>{t.scoreWhale}</strong></span>
                      </div>
                    </div>
                    <button onClick={() => abrirPainelOperacional(t.nome)} style={{ backgroundColor: '#10b981', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 12px rgba(16,185,129,0.3)' }}>
                      ⚡ Operar Sinal HFT
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {abaAtiva === 'baleias' && (
            <div>
              <div style={{ marginBottom: '20px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#fff', margin: '0 0 6px 0' }}>Monitoramento de Baleias & Grandes Fundos</h2>
                <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>Transações institucionais de alto volume monitoradas em tempo real na blockchain e balcões OTC.</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {baleias.map(b => (
                  <div key={b.id} style={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px', padding: '18px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#fff' }}>{b.instituicao}</span>
                        <span style={{ fontSize: '10px', backgroundColor: '#334155', color: '#c084fc', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>{b.ativo}</span>
                      </div>
                      <span style={{ fontSize: '12px', color: '#34d399', fontWeight: 'bold' }}>Volume: {b.volumeMovimentado} • {b.fluxo}</span>
                      <span style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>Rede: {b.rede} | Hash ID: {b.hash}</span>
                    </div>
                    <button onClick={() => abrirPainelOperacional(b.instituicao)} style={{ backgroundColor: '#7c3aed', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 12px rgba(124,58,237,0.3)' }}>
                      ⚡ Copiar Fluxo da Baleia
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {abaAtiva === 'megapulse' && (
            <div>
              <div style={{ marginBottom: '20px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#fff', margin: '0 0 6px 0' }}>Megapulse Institucional (B3 & Futuros Globais)</h2>
                <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>Análise de livro de ofertas e desequilíbrio de fluxo (Order Book Imbalance) para o Mini-Índice, Mini-Dólar e Ações.</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {megapulse.map(m => (
                  <div key={m.id} style={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px', padding: '18px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#fff' }}>{m.ativo}</span>
                        <span style={{ fontSize: '10px', backgroundColor: '#334155', color: '#38bdf8', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>{m.instituicao}</span>
                      </div>
                      <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#34d399' }}>{m.direcao}</span>
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>{m.detalhe} • <strong style={{ color: '#c084fc' }}>{m.imbalance}</strong></span>
                    </div>
                    <button onClick={() => abrirPainelOperacional(m.ativo)} style={{ backgroundColor: '#10b981', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 12px rgba(16,185,129,0.3)' }}>
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