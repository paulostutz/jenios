'use client';
import { useState } from 'react';
import Link from 'next/link';

export default function TendenciasPage() {
  const [categoriaAtiva, setCategoriaAtiva] = useState('tokens'); // 'tokens', 'baleias', 'megapulse'
  const [itemSelecionado, setItemSelecionado] = useState(null);

  // Simulação de autenticação/assinatura
  const [usuarioLogado, setUsuarioLogado] = useState(true);
  const [usuarioAssinado, setUsuarioAssinado] = useState(true);

  const validarAcessoOperacional = (acaoNome) => {
    if (!usuarioLogado) {
      alert('🔒 É necessário criar uma conta ou fazer login para operar.');
      window.location.href = '/login';
      return false;
    }
    if (!usuarioAssinado) {
      const confirmar = confirm(`⚡ Para ${acaoNome}, você precisa ativar um dos planos profissionais (com 7 dias de teste grátis).\n\nDeseja ir para a página de planos?`);
      if (confirmar) {
        window.location.href = '/planos';
      }
      return false;
    }
    window.location.href = '/mesa-operacao';
  };

  // Lista detalhada de Tokens / Ativos em Tendência
  const tokensLista = [
    { id: 1, nome: '$LTR-Prop', rede: 'Solana', variacao: '+450.2%', volume: 'R$ 45M', desc: 'Pools de liquidez com execução automática de contratos inteligentes e alta volatilidade controlada.' },
    { id: 2, nome: '$SOL-HFT', rede: 'Solana', variacao: '+185.6%', volume: 'R$ 120M', desc: 'Fluxo forte de acumulação institucional nas últimas 4 horas com rompimento de máximas.' },
    { id: 3, nome: '$ETH-Alpha', rede: 'Ethereum', variacao: '+92.4%', volume: 'R$ 340M', desc: 'Smart contracts de custódia indicando rebalanceamento de grandes portfólios.' },
    { id: 4, nome: '$TRX-Grid', rede: 'TRON', variacao: '+78.1%', volume: 'R$ 89M', desc: 'Arbitragem otimizada entre DEXs globais com taxas reduzidas.' },
    { id: 5, nome: '$VALE3', rede: 'B3', variacao: '+45.3%', volume: 'R$ 850M', desc: 'Entrada de capital estrangeiro em lotes expressivos no suporte de curto prazo.' }
  ];

  // Lista detalhada de Movimentos de Baleias
  const baleiasLista = [
    { id: 1, player: '🐋 Baleia B3 (Institucional Alpha)', ativo: 'VALE3', volume: '+R$ 45M em lotes', desc: 'Grande player posicionado no suporte com foco em proteção de alpha e dividendos.' },
    { id: 2, player: '🐋 Baleia Solana (Whale #48)', ativo: '$SOL', volume: '125,000 SOL', desc: 'Transferência expressiva de carteira fria para pool de alta liquidez.' },
    { id: 3, player: '🐋 Baleia Ethereum (Fund Global)', ativo: 'ETH', volume: '15,000 ETH', desc: 'Acumulação pesada com alocação voltada a protocolos de staking institucional.' }
  ];

  // Lista detalhada de Megapulse (Macro & Setorial)
  const megapulseLista = [
    { id: 1, mercado: 'Ibovespa (IBOV)', movimento: '▲ Alta Institucional (+1.2%)', desc: 'O fluxo de ordens institucionais indica forte acumulação nos principais papéis do setor financeiro e de commodities.' },
    { id: 2, mercado: 'Mini-Índice (WIN)', movimento: '⚡ Volatilidade Extrema', desc: 'Robôs HFT detetaram falso rompimento em 128.500 com reversão automática de ordens.' },
    { id: 3, mercado: 'Mercado de Câmbio (Dólar Futuro)', movimento: '📉 Pressão Vendedora', desc: 'Ajuste de contratos por parte de players corporativos na ponta curta.' }
  ];

  return (
    <main style={{ backgroundColor: '#f1f5f9', color: '#0f172a', minHeight: '100vh', paddingBottom: '60px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', boxSizing: 'border-box' }}>
      
      {/* Cabeçalho */}
      <div style={{ backgroundColor: '#ffffff', borderBottom: '1px solid #e2e8f0', padding: '20px 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)', color: '#fff', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            J
          </div>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0, color: '#0f172a' }}>HUB DE TENDÊNCIAS HFT</h1>
            <span style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 'bold' }}>MONITORAMENTO INSTITUCIONAL EM TEMPO REAL</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <Link href="/social" style={{ backgroundColor: '#f1f5f9', color: '#0f172a', padding: '10px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', textDecoration: 'none', border: '1px solid #cbd5e1' }}>
            🌐 Voltar à Social
          </Link>
          <Link href="/dashboard-logado" style={{ backgroundColor: '#7c3aed', color: '#fff', padding: '10px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', textDecoration: 'none' }}>
            📊 Sala de Controle
          </Link>
        </div>
      </div>

      <div style={{ maxWidth: '1000px', margin: '30px auto 0 auto', padding: '0 20px' }}>
        
        {/* Seletor de Categorias */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '30px', flexWrap: 'wrap' }}>
          <button 
            onClick={() => setCategoriaAtiva('tokens')}
            style={{ padding: '12px 24px', borderRadius: '10px', border: categoriaAtiva === 'tokens' ? '2px solid #7c3aed' : '1px solid #cbd5e1', backgroundColor: categoriaAtiva === 'tokens' ? '#ffffff' : '#f8fafc', color: '#0f172a', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}
          >
            🚀 Tokens & Ativos em Tendência
          </button>
          <button 
            onClick={() => setCategoriaAtiva('baleias')}
            style={{ padding: '12px 24px', borderRadius: '10px', border: categoriaAtiva === 'baleias' ? '2px solid #059669' : '1px solid #cbd5e1', backgroundColor: categoriaAtiva === 'baleias' ? '#ffffff' : '#f8fafc', color: '#0f172a', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}
          >
            🐋 Movimentos de Baleias
          </button>
          <button 
            onClick={() => setCategoriaAtiva('megapulse')}
            style={{ padding: '12px 24px', borderRadius: '10px', border: categoriaAtiva === 'megapulse' ? '2px solid #0284c7' : '1px solid #cbd5e1', backgroundColor: categoriaAtiva === 'megapulse' ? '#ffffff' : '#f8fafc', color: '#0f172a', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}
          >
            📊 Megapulse Macro
          </button>
        </div>

        {/* CATEGORIA: TOKENS */}
        {categoriaAtiva === 'tokens' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>Ativos e Tokens com Maior Fluxo HFT</h2>
            {tokensLista.map((t) => (
              <div key={t.id} style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 15px rgba(0,0,0,0.04)', flexWrap: 'wrap', gap: '15px' }}>
                <div style={{ maxWidth: '600px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                    <b style={{ fontSize: '16px', color: '#0f172a' }}>{t.nome}</b>
                    <span style={{ backgroundColor: '#f1f5f9', color: '#334155', fontSize: '10px', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>{t.rede}</span>
                    <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#059669' }}>{t.variacao}</span>
                  </div>
                  <p style={{ fontSize: '13px', color: '#475569', margin: '0 0 8px 0', lineHeight: '1.5' }}>{t.desc}</p>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>Volume 24h: <b>{t.volume}</b></span>
                </div>
                <div>
                  <button 
                    onClick={() => validarAcessoOperacional(`operar o ativo ${t.nome}`)}
                    style={{ backgroundColor: '#7c3aed', color: '#fff', border: 'none', padding: '12px 20px', borderRadius: '10px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)' }}
                  >
                    ⚡ Operar este Sinal
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* CATEGORIA: BALEIAS */}
        {categoriaAtiva === 'baleias' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>Rastreamento de Grandes Players e Institucionais</h2>
            {baleiasLista.map((b) => (
              <div key={b.id} style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 15px rgba(0,0,0,0.04)', flexWrap: 'wrap', gap: '15px' }}>
                <div style={{ maxWidth: '600px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                    <b style={{ fontSize: '15px', color: '#0f172a' }}>{b.player}</b>
                    <span style={{ backgroundColor: '#d1fae5', color: '#065f46', fontSize: '10px', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>{b.ativo}</span>
                  </div>
                  <p style={{ fontSize: '13px', color: '#475569', margin: '0 0 8px 0', lineHeight: '1.5' }}>{b.desc}</p>
                  <span style={{ fontSize: '11px', color: '#059669', fontWeight: 'bold' }}>Aporte Identificado: {b.volume}</span>
                </div>
                <div>
                  <button 
                    onClick={() => validarAcessoOperacional(`copiar movimento de baleia em ${b.ativo}`)}
                    style={{ backgroundColor: '#059669', color: '#fff', border: 'none', padding: '12px 20px', borderRadius: '10px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 12px rgba(5, 150, 105, 0.3)' }}
                  >
                    ⚡ Operar este Sinal
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* CATEGORIA: MEGAPULSE */}
        {categoriaAtiva === 'megapulse' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#0f172a', margin: 0 }, color: '#0f172a'}>Pulso Macro e Setorial em Tempo Real</h2>
            {megapulseLista.map((m) => (
              <div key={m.id} style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 15px rgba(0,0,0,0.04)', flexWrap: 'wrap', gap: '15px' }}>
                <div style={{ maxWidth: '600px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                    <b style={{ fontSize: '15px', color: '#0f172a' }}>{m.mercado}</b>
                    <span style={{ backgroundColor: '#e0f2fe', color: '#0369a1', fontSize: '10px', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>{m.movimento}</span>
                  </div>
                  <p style={{ fontSize: '13px', color: '#475569', margin: 0, lineHeight: '1.5' }}>{m.desc}</p>
                </div>
                <div>
                  <button 
                    onClick={() => validarAcessoOperacional(`operar pulso de ${m.mercado}`)}
                    style={{ backgroundColor: '#0284c7', color: '#fff', border: 'none', padding: '12px 20px', borderRadius: '10px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)' }}
                  >
                    ⚡ Operar este Sinal
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </main>
  );
}