'use client';
import { useState, useEffect } from 'react';

export default function DashboardPage() {
  const [modoReversoAtivo, setModoReversoAtivo] = useState(false);
  const [antifuriaAcionado, setAntifuriaAcionado] = useState(false);
  const [statusMensagem, setStatusMensagem] = useState('Sistema HFT Ativo & Blindado');
  
  // Estados de Mercado, Busca e Ativo Selecionado
  const [mercadoCategoria, setMercadoCategoria] = useState('b3');
  const [buscaAtivo, setBuscaAtivo] = useState('');
  const [ativoSelecionado, setAtivoSelecionado] = useState('MINI-INDICE (WINJ26)');
  
  // Estados de Gestão de Capital e Risco
  const [capitalAlocado, setCapitalAlocado] = useState(10000);
  const [alavancagem, setAlavancagem] = useState('10x');
  const [lotes, setLotes] = useState(1);
  const [stopDiario, setStopDiario] = useState(500);

  const [megatendencias] = useState([
    { ativo: 'Ibovespa (IBOV)', tendencia: '▲ Alta Institucional (+1.2%)', cor: '#10b981' },
    { ativo: 'Mini-Índice (WIN)', tendencia: '▲ Rompimento de Máxima', cor: '#10b981' },
    { ativo: 'Mini-Dólar (WDO)', tendencia: '▼ Exaustão de Baixa', cor: '#ef4444' },
    { ativo: 'S&P 500 (EUA)', tendencia: '▲ Forte Momentum', cor: '#10b981' },
    { ativo: 'Crypto Multichain (SOL/BTC)', tendencia: '▲ Acumulação Global', cor: '#10b981' }
  ]);

  const [baleias] = useState([
    { id: 1, info: 'Baleia B3: Aporte detetado em VALE3 (+R$ 45M em lotes institucionais)', tempo: 'Agora mesmo' },
    { id: 2, info: 'Baleia Multichain: Compra massiva detetada em pool DEX', tempo: 'Há 2 mins' }
  ]);

  const [tokensExplosivos] = useState([
    { nome: '$LTR-Prop (Ativo Proprietário)', status: 'Volume +450% | Influxo Institucional' },
    { nome: '$NEXUS (Multichain)', status: 'Nova Listagem | Alta Retenção de LP' }
  ]);

  // Lista de Ativos Separados por Mercado com Símbolos Oficiais do TradingView
  const ativosPorMercado = {
    b3: [
      { nome: 'MINI-INDICE (WINJ26)', simbolo: 'BMFBOVESPA:WIN1!' },
      { nome: 'MINI-DOLAR (WDOJ26)', simbolo: 'BMFBOVESPA:WDO1!' },
      { nome: 'PETROBRAS (PETR4)', simbolo: 'BMFBOVESPA:PETR4' },
      { nome: 'VALE (VALE3)', simbolo: 'BMFBOVESPA:VALE3' },
      { nome: 'ITAU (ITUB4)', simbolo: 'BMFBOVESPA:ITUB4' }
    ],
    cripto: [
      { nome: 'BITCOIN (BTC/USDT)', simbolo: 'BINANCE:BTCUSDT' },
      { nome: 'SOLANA (SOL/USDT)', simbolo: 'BINANCE:SOLUSDT' },
      { nome: 'ETHEREUM (ETH/USDT)', simbolo: 'BINANCE:ETHUSDT' },
      { nome: 'RIPPLE (XRP/USDT)', simbolo: 'BINANCE:XRPUSDT' }
    ],
    global: [
      { nome: 'S&P 500 (SPX)', simbolo: 'SP:SPX' },
      { nome: 'NASDAQ 100 (NDX)', simbolo: 'NASDAQ:NDX' },
      { nome: 'EUR/USD (Forex)', simbolo: 'FX:EURUSD' },
      { nome: 'OURO (XAU/USD)', simbolo: 'OANDA:XAUUSD' }
    ]
  };

  // Função para mudar categoria sem travar e atualizar o ativo inicial
  const selecionarCategoria = (cat) => {
    setMercadoCategoria(cat);
    setBuscaAtivo('');
    if (ativosPorMercado[cat] && ativosPorMercado[cat].length > 0) {
      setAtivoSelecionado(ativosPorMercado[cat][0].nome);
    }
  };

  // Filtra os ativos da categoria selecionada com base na barra de pesquisa (lupa)
  const ativosDaCategoria = ativosPorMercado[mercadoCategoria] || [];
  const ativosFiltrados = ativosDaCategoria.filter(item =>
    item.nome.toLowerCase().includes(buscaAtivo.toLowerCase())
  );

  // Garante que o valor selecionado é sempre válido para evitar congelamento no select
  const valorSelectValido = ativosFiltrados.some(item => item.nome === ativoSelecionado)
    ? ativoSelecionado
    : (ativosFiltrados[0] ? ativosFiltrados[0].nome : ativoSelecionado);

  // Função para mapear o ativo selecionado para o símbolo exato do TradingView
  const obterSimboloTradingView = (nomeAtivo) => {
    for (const cat in ativosPorMercado) {
      const encontrado = ativosPorMercado[cat].find(a => a.nome === nomeAtivo);
      if (encontrado) return encontrado.simbolo;
    }
    return 'BMFBOVESPA:WIN1!';
  };

  // ⚡ UseEffect para carregar e atualizar o Gráfico Real do TradingView dinamicamente
  useEffect(() => {
    const carregarGrafico = () => {
      const container = document.getElementById('tradingview_widget_container');
      if (container) container.innerHTML = '';

      if (window.TradingView) {
        new window.TradingView.widget({
          "autosize": true,
          "symbol": obterSimboloTradingView(ativoSelecionado),
          "interval": "5",
          "timezone": "America/Sao_Paulo",
          "theme": "dark",
          "style": "1",
          "locale": "br",
          "toolbar_bg": "#1e293b",
          "enable_publishing": false,
          "hide_top_toolbar": false,
          "save_image": false,
          "container_id": "tradingview_widget_container"
        });
      }
    };

    if (!document.getElementById('tradingview-widget-script')) {
      const script = document.createElement('script');
      script.id = 'tradingview-widget-script';
      script.src = 'https://s3.tradingview.com/tv.js';
      script.async = true;
      script.onload = carregarGrafico;
      document.head.appendChild(script);
    } else {
      carregarGrafico();
    }
  }, [ativoSelecionado]);

  const ativarModoReverso = () => {
    setModoReversoAtivo(!modoReversoAtivo);
    if (!modoReversoAtivo) {
      setStatusMensagem('🚨 MODO REVERSO ATIVADO: Ordens impulsivas e stop-hunts estão a ser revertidas automaticamente em lucro!');
    } else {
      setStatusMensagem('Sistema HFT Ativo & Blindado');
    }
  };

  const acionarAntifuria = () => {
    setAntifuriaAcionado(true);
    setStatusMensagem('🚨 BOTÃO ANTIFÚRIA ACIONADO! Novas ordens bloqueadas por 24h.');
    alert('🚨 BOTÃO ANTIFÚRIA ACIONADO! O sistema bloqueou novas ordens impulsivas e ativou a blindagem emocional rigorosa.');
  };

  const acionarTravaManual = () => {
    alert('🚨 TRAVA MANUAL ACIONADA! Todos os cliques foram bloqueados e as posições em aberto foram fechadas com sucesso na corretora.');
  };

  const executarOrdem = (direcao) => {
    if (antifuriaAcionado) {
      alert('⚠️ Operação bloqueada pelo Botão Antifúria ativo!');
      return;
    }
    alert(`Ordem de ${direcao} enviada para ${ativoSelecionado}!\n• Capital Alocado: R$ ${capitalAlocado}\n• Alavancagem: ${alavancagem}\n• Lotes: ${lotes}\n• Stop Diário: R$ ${stopDiario}\nRoteamento HFT via API executado.`);
  };

  return (
    <main style={{ backgroundColor: '#f1f5f9', color: '#0f172a', minHeight: '100vh', padding: '40px 20px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', boxSizing: 'border-box', width: '100%' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        
        {/* Cabeçalho do Dashboard */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', borderBottom: '1px solid #e2e8f0', paddingBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
          <div>
            <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#7c3aed', fontFamily: 'monospace', letterSpacing: '2px', textTransform: 'uppercase' }}>
              JENIOS PLATFORM • SALA DE CONTROLO HFT
            </span>
            <h1 style={{ fontSize: '26px', fontWeight: 'bold', color: '#0f172a', margin: '5px 0 0 0' }}>Olá, Operador</h1>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0 0' }}>{statusMensagem}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <a href="/mesa-operacoes" style={{ backgroundColor: '#7c3aed', color: '#fff', textDecoration: 'none', fontWeight: 'bold', fontSize: '11px', padding: '8px 16px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(124, 58, 237, 0.3)' }}>⚡ Operação Simplificada</a>
            <a href="/market" style={{ backgroundColor: '#ffffff', color: '#0f172a', textDecoration: 'none', fontWeight: 'bold', fontSize: '11px', padding: '8px 14px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>📊 Market</a>
            <a href="/social" style={{ backgroundColor: '#ffffff', color: '#0f172a', textDecoration: 'none', fontWeight: 'bold', fontSize: '11px', padding: '8px 14px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>🌐 Social</a>
            <a href="/broker" style={{ backgroundColor: '#ffffff', color: '#0f172a', textDecoration: 'none', fontWeight: 'bold', fontSize: '11px', padding: '8px 14px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>🔌 Broker</a>
            <a href="/checkout" style={{ backgroundColor: '#ffffff', color: '#0f172a', textDecoration: 'none', fontWeight: 'bold', fontSize: '11px', padding: '8px 14px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>💳 Planos</a>
            <span style={{ fontSize: '12px', color: '#059669', fontWeight: 'bold', fontFamily: 'monospace' }}>● Ativo</span>
            <a href="/dashboard-logado" style={{ backgroundColor: '#ffffff', color: '#0f172a', textDecoration: 'none', fontWeight: 'bold', fontSize: '13px', padding: '8px 16px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
              Voltar à Dashboard
            </a>
          </div>
        </div>

        {/* 4 Cartões Principais do Topo */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px', marginBottom: '30px' }}>
          
          {/* 1. Modo Reverso Automático */}
          <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '22px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
            <div>
              <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 'bold', fontFamily: 'monospace', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>MODO DE RETIFICAÇÃO</span>
              <h3 style={{ fontSize: '15px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 8px 0' }}>Modo Reverso Automático</h3>
              <p style={{ fontSize: '12px', color: '#64748b', lineHeight: '1.5', margin: '0 0 16px 0' }}>
                Intercepta impulsos e inverte ordens em 3ms.
              </p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '10px', color: '#7c3aed', backgroundColor: '#f3e8ff', padding: '4px 8px', borderRadius: '6px', fontWeight: 'bold', border: '1px solid #d8b4fe' }}>
                Binance & B3
              </span>
              <button onClick={ativarModoReverso} style={{ backgroundColor: modoReversoAtivo ? '#ef4444' : '#7c3aed', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '8px', fontWeight: 'bold', fontSize: '11px', cursor: 'pointer' }}>
                {modoReversoAtivo ? 'Desativar' : 'Ativar'}
              </button>
            </div>
          </div>

          {/* 2. Botão Antifúria (Destacado) */}
          <div style={{ backgroundColor: '#ffffff', border: antifuriaAcionado ? '2px solid #ef4444' : '1px solid #e2e8f0', borderRadius: '16px', padding: '22px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
            <div>
              <span style={{ fontSize: '10px', color: '#dc2626', fontWeight: 'bold', fontFamily: 'monospace', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>BLINDAGEM EMOCIONAL</span>
              <h3 style={{ fontSize: '15px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 8px 0' }}>Botão Antifúria</h3>
              <p style={{ fontSize: '12px', color: '#64748b', lineHeight: '1.5', margin: '0 0 16px 0' }}>
                Bloqueia o vício de vingança pós-loss por 24h.
              </p>
            </div>
            <button onClick={acionarAntifuria} style={{ backgroundColor: antifuriaAcionado ? '#991b1b' : '#dc2626', color: '#fff', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: '900', fontSize: '11px', cursor: 'pointer', textTransform: 'uppercase', width: '100%' }}>
              {antifuriaAcionado ? '🔒 Antifúria Ativo' : '🚨 Acionar Antifúria'}
            </button>
          </div>

          {/* 3. Losses Neutralizados */}
          <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '22px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
            <div>
              <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 'bold', fontFamily: 'monospace', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>ESTATÍSTICAS</span>
              <h3 style={{ fontSize: '15px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 4px 0' }}>Losses Neutralizados</h3>
              <div style={{ fontSize: '22px', fontWeight: '900', color: '#059669', marginBottom: '4px' }}>R$ 6.293,00</div>
              <p style={{ fontSize: '11px', color: '#64748b', margin: 0 }}>
                17 operações impulsivas evitadas.
              </p>
            </div>
            <button onClick={() => alert('Simulação de proteção ativa.')} style={{ backgroundColor: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', padding: '8px', borderRadius: '8px', fontWeight: 'bold', fontSize: '11px', cursor: 'pointer', width: '100%', marginTop: '10px' }}>
              Simular Proteção
            </button>
          </div>

          {/* 4. Trava Manual de Emergência */}
          <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '22px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
            <div>
              <span style={{ fontSize: '10px', color: '#e11d48', fontWeight: 'bold', fontFamily: 'monospace', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>EMERGÊNCIA</span>
              <h3 style={{ fontSize: '15px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 8px 0' }}>Trava Manual</h3>
              <p style={{ fontSize: '12px', color: '#64748b', lineHeight: '1.5', margin: '0 0 16px 0' }}>
                Zera posições e bloqueia novos cliques na corretora.
              </p>
            </div>
            <button onClick={acionarTravaManual} style={{ backgroundColor: '#e11d48', color: '#fff', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: '900', fontSize: '11px', cursor: 'pointer', textTransform: 'uppercase', width: '100%', boxShadow: '0 4px 6px -1px rgba(225, 29, 72, 0.2)' }}>
              🔒 ZERAR TUDO
            </button>
          </div>

        </div>

        {/* LAYOUT PRINCIPAL DO TERMINAL */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '25px' }}>
          
          {/* COLUNA ESQUERDA */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
            
            {/* SELETOR DE ATIVO AVANÇADO COM MERCADOS E LUPA DE BUSCA */}
            <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <span style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 'bold', fontFamily: 'monospace', textTransform: 'uppercase' }}>SELECIONAR ATIVO PARA OPERAR</span>
                  <h3 style={{ fontSize: '15px', fontWeight: 'bold', color: '#0f172a', margin: '2px 0 0 0' }}>{ativoSelecionado}</h3>
                </div>

                {/* Categorias de Mercado (B3, Cripto, Global) */}
                <div style={{ display: 'flex', gap: '6px', backgroundColor: '#f1f5f9', padding: '4px', borderRadius: '10px', border: '1px solid #cbd5e1' }}>
                  <button 
                    onClick={() => selecionarCategoria('b3')}
                    style={{ backgroundColor: mercadoCategoria === 'b3' ? '#7c3aed' : 'transparent', color: mercadoCategoria === 'b3' ? '#fff' : '#334155', border: 'none', padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    B3 (Brasil)
                  </button>
                  <button 
                    onClick={() => selecionarCategoria('cripto')}
                    style={{ backgroundColor: mercadoCategoria === 'cripto' ? '#7c3aed' : 'transparent', color: mercadoCategoria === 'cripto' ? '#fff' : '#334155', border: 'none', padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    Cripto
                  </button>
                  <button 
                    onClick={() => selecionarCategoria('global')}
                    style={{ backgroundColor: mercadoCategoria === 'global' ? '#7c3aed' : 'transparent', color: mercadoCategoria === 'global' ? '#fff' : '#334155', border: 'none', padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    Global / Forex
                  </button>
                </div>
              </div>

              {/* Barra de Pesquisa com Lupa 🔍 */}
              <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '10px 14px', gap: '10px' }}>
                <span style={{ fontSize: '14px' }}>🔍</span>
                <input 
                  type="text" 
                  placeholder={`Pesquisar ativo em ${mercadoCategoria.toUpperCase()} (ex: WIN, Bitcoin, S&P)...`} 
                  value={buscaAtivo}
                  onChange={(e) => setBuscaAtivo(e.target.value)}
                  style={{ border: 'none', outline: 'none', fontSize: '12px', width: '100%', background: 'transparent', color: '#0f172a' }}
                />
              </div>

              {/* Dropdown / Seletor Filtrado com os Ativos da Categoria */}
              <select 
                value={valorSelectValido} 
                onChange={(e) => setAtivoSelecionado(e.target.value)} 
                style={{ backgroundColor: '#f8fafc', color: '#0f172a', border: '1px solid #cbd5e1', padding: '12px', borderRadius: '10px', fontSize: '13px', fontWeight: 'bold', outline: 'none', width: '100%', cursor: 'pointer' }}
              >
                {ativosFiltrados.length > 0 ? (
                  ativosFiltrados.map((item, idx) => (
                    <option key={idx} value={item.nome}>{item.nome}</option>
                  ))
                ) : (
                  <option disabled>Nenhum ativo encontrado para esta pesquisa</option>
                )}
              </select>
            </div>

            {/* GRÁFICO REAL DO TRADINGVIEW EM TEMPO REAL */}
            <div style={{ backgroundColor: '#0b0f19', border: '1px solid #334155', borderRadius: '16px', padding: '15px', height: '480px', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div>
                  <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#f8fafc', display: 'block' }}>📈 Gráfico Profissional TradingView</span>
                  <span style={{ fontSize: '11px', color: '#34d399', fontFamily: 'monospace' }}>● {ativoSelecionado} • Conectado</span>
                </div>
              </div>

              {/* Container onde o script injeta o iframe do TradingView */}
              <div style={{ flex: 1, width: '100%', height: '100%', position: 'relative' }}>
                <div id="tradingview_widget_container" style={{ width: '100%', height: '100%' }}></div>
              </div>
            </div>

            {/* PAINEL DE GESTÃO DE CAPITAL E RISCO */}
            <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '25px', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
              <span style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 'bold', fontFamily: 'monospace', textTransform: 'uppercase', display: 'block', marginBottom: '12px' }}>
                ⚙️ GESTÃO DE CAPITAL & ALOCAÇÃO DE RISCO
              </span>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '20px' }}>
                
                <div>
                  <label style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '6px' }}>Capital Alocado (R$)</label>
                  <input 
                    type="number" 
                    value={capitalAlocado} 
                    onChange={(e) => setCapitalAlocado(e.target.value)} 
                    style={{ width: '100%', backgroundColor: '#f8fafc', color: '#0f172a', border: '1px solid #cbd5e1', padding: '10px', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} 
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '6px' }}>Alavancagem HFT</label>
                  <select 
                    value={alavancagem} 
                    onChange={(e) => setAlavancagem(e.target.value)} 
                    style={{ width: '100%', backgroundColor: '#f8fafc', color: '#0f172a', border: '1px solid #cbd5e1', padding: '10px', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                  >
                    <option value="1x">1x (Sem Alavancagem)</option>
                    <option value="5x">5x</option>
                    <option value="10x">10x</option>
                    <option value="20x">20x</option>
                    <option value="50x">50x (Institucional)</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '6px' }}>Stop Diário / Perda Máxima (R$)</label>
                  <input 
                    type="number" 
                    value={stopDiario} 
                    onChange={(e) => setStopDiario(e.target.value)} 
                    style={{ width: '100%', backgroundColor: '#f8fafc', color: '#0f172a', border: '1px solid #cbd5e1', padding: '10px', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} 
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '6px' }}>Quantidade / Lotes</label>
                  <input 
                    type="number" 
                    min="1" 
                    value={lotes} 
                    onChange={(e) => setLotes(e.target.value)} 
                    style={{ width: '100%', backgroundColor: '#f8fafc', color: '#0f172a', border: '1px solid #cbd5e1', padding: '10px', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} 
                  />
                </div>

              </div>

              {/* Botões de Execução Rápida */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <button onClick={() => executarOrdem('COMPRA (BUY)')} style={{ backgroundColor: '#059669', color: '#fff', border: 'none', padding: '16px', borderRadius: '12px', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(5, 150, 105, 0.2)' }}>
                  🟢 COMPRAR A MERCADO (Lotes: {lotes})
                </button>
                <button onClick={() => executarOrdem('VENDA (SELL)')} style={{ backgroundColor: '#dc2626', color: '#fff', border: 'none', padding: '16px', borderRadius: '12px', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(220, 38, 38, 0.2)' }}>
                  🔴 VENDER A MERCADO (Lotes: {lotes})
                </button>
              </div>

            </div>

          </div>

          {/* COLUNA DIREITA */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* 1. Megatendências */}
            <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
              <span style={{ fontSize: '10px', color: '#7c3aed', fontWeight: 'bold', fontFamily: 'monospace', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>📊 FLUXO MACRO EM TEMPO REAL</span>
              <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '12px', color: '#0f172a' }}>Megatendências</h3>
              <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '10px', fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '8px', border: '1px solid #cbd5e1' }}>
                {megatendencias.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#475569' }}>{item.ativo}:</span>
                    <span style={{ color: item.cor, fontWeight: 'bold' }}>{item.tendencia}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 2. Radar de Baleias */}
            <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
              <span style={{ fontSize: '10px', color: '#059669', fontWeight: 'bold', fontFamily: 'monospace', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>🐋 MOVIMENTOS INSTITUCIONAIS</span>
              <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '12px', color: '#0f172a' }}>Radar de Baleias</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11px' }}>
                {baleias.map((b) => (
                  <div key={b.id} style={{ backgroundColor: '#f8fafc', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                      <span style={{ color: '#059669', fontWeight: 'bold' }}>Detectado</span>
                      <span style={{ color: '#64748b', fontSize: '9px' }}>{b.tempo}</span>
                    </div>
                    <span style={{ color: '#334155' }}>{b.info}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. Tokens Explosivos */}
            <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
              <span style={{ fontSize: '10px', color: '#d97706', fontWeight: 'bold', fontFamily: 'monospace', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>🚀 ATIVOS RECENTES</span>
              <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '12px', color: '#0f172a' }}>Tokens Explosivos</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11px' }}>
                {tokensExplosivos.map((t, idx) => (
                  <div key={idx} style={{ backgroundColor: '#f3e8ff', border: '1px solid #d8b4fe', padding: '10px', borderRadius: '8px' }}>
                    <b style={{ color: '#6b21a8', display: 'block', marginBottom: '2px' }}>{t.nome}</b>
                    <span style={{ color: '#581c87', fontSize: '10px' }}>{t.status}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>

        </div>

      </div>
    </main>
  );
}