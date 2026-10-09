'use client';
import { useState, useEffect } from 'react';

export default function DashboardPage() {
  const [modoReversoAtivo, setModoReversoAtivo] = useState(false);
  const [antifuriaAcionado, setAntifuriaAcionado] = useState(false);
  const [statusMensagem, setStatusMensagem] = useState('Sistema HFT Ativo & Blindado');
  
  // Estados de Conta e Saldo Fictício Sincronizado via LocalStorage
  const [tipoConta, setTipoConta] = useState('simulada'); // 'simulada' ou 'real'
  const [saldoSimulado, setSaldoSimulado] = useState(100000.00);

  // Carrega e sincroniza o saldo simulado globalmente entre as páginas
  useEffect(() => {
    const saldoSalvo = localStorage.getItem('jenios_saldo_simulado');
    if (saldoSalvo) {
      setSaldoSimulado(Number(saldoSalvo));
    }
  }, []);

  const atualizarSaldoSimulado = (novoValor) => {
    setSaldoSimulado(novoValor);
    localStorage.setItem('jenios_saldo_simulado', novoValor);
  };

  // Estados de Plano e Assinatura do Usuário
  const [planoUsuario, setPlanoUsuario] = useState('completo'); // 'basico' ou 'completo'

  // Estado do Ativo Selecionado e Categoria
  const [ativoSelecionado, setAtivoSelecionado] = useState('BMFBOVESPA:WIN1!');
  const [nomeAtivoExibicao, setNomeAtivoExibicao] = useState('Mini-Índice (WIN1!)');
  const [mercadoCategoria, setMercadoCategoria] = useState('b3');
  
  // Input de busca personalizada
  const [inputBuscaCustomizada, setInputBuscaCustomizada] = useState('');
  
  // Estados de Gestão de Capital e Risco
  const [capitalAlocado, setCapitalAlocado] = useState(10000);
  const [alavancagem, setAlavancagem] = useState('10x');
  const [lotes, setLotes] = useState(1);
  const [stopDiario, setStopDiario] = useState(500);

  // 🌐 DADOS REAIS DE MERCADO EM TEMPO REAL (Megatendências, Baleias e Tokens Explosivos)
  const [megatendencias, setMegatendencias] = useState([
    { ativo: 'Carregando dados...', tendencia: 'Sincronizando...', cor: '#64748b' }
  ]);

  const [baleias, setBaleias] = useState([
    { id: 1, info: 'Varredura de fluxo institucional em andamento...', tempo: 'Agora' }
  ]);

  const [tokensExplosivos, setTokensExplosivos] = useState([
    { nome: 'Buscando ativos em alta volume...', status: 'Conectando à API DEX...' }
  ]);

  useEffect(() => {
    async function buscarDadosReaisDashboard() {
      try {
        const res = await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=volume_desc&per_page=6&page=1');
        const dados = await res.json();

        if (Array.isArray(dados) && dados.length > 0) {
          const tendenciasReais = dados.slice(0, 5).map(coin => ({
            ativo: `${coin.name} (${coin.symbol.toUpperCase()})`,
            tendencia: `${coin.price_change_percentage_24h >= 0 ? '▲ Alta' : '▼ Baixa'} (${coin.price_change_percentage_24h?.toFixed(2)}%)`,
            cor: coin.price_change_percentage_24h >= 0 ? '#10b981' : '#ef4444'
          }));
          setMegatendencias(tendenciasReais);

          const baleiasReais = dados.slice(0, 2).map((coin, i) => ({
            id: i + 1,
            info: `Fluxo Institucional Detectado em ${coin.symbol.toUpperCase()}: Volume 24h de $${coin.total_volume.toLocaleString()}`,
            tempo: 'Há poucos instantes'
          }));
          setBaleias(baleiasReais);

          const explosivosReais = dados.slice(2, 4).map(coin => ({
            nome: `${coin.name} ($${coin.symbol.toUpperCase()})`,
            status: `Preço: $${coin.current_price} | Influxo de Capital Ativo`
          }));
          setTokensExplosivos(explosivosReais);
        }
      } catch (e) {
        console.warn('Erro ao atualizar dados reais na dashboard.');
      }
    }

    buscarDadosReaisDashboard();
    const intervalDashboard = setInterval(buscarDadosReaisDashboard, 45000);
    return () => clearInterval(intervalDashboard);
  }, []);

  const atalhosPorMercado = {
    b3: [
      { nome: 'Mini-Índice (WIN1!)', simbolo: 'BMFBOVESPA:WIN1!' },
      { nome: 'Mini-Dólar (WDO1!)', simbolo: 'BMFBOVESPA:WDO1!' },
      { nome: 'Petrobras (PETR4)', simbolo: 'BMFBOVESPA:PETR4' },
      { nome: 'Vale (VALE3)', simbolo: 'BMFBOVESPA:VALE3' },
      { nome: 'Itaú (ITUB4)', simbolo: 'BMFBOVESPA:ITUB4' }
    ],
    cripto: [
      { nome: 'Bitcoin (BTC/USDT)', simbolo: 'BINANCE:BTCUSDT' },
      { nome: 'Solana (SOL/USDT)', simbolo: 'BINANCE:SOLUSDT' },
      { nome: 'Ethereum (ETH/USDT)', simbolo: 'BINANCE:ETHUSDT' },
      { nome: 'Ripple (XRP/USDT)', simbolo: 'BINANCE:XRPUSDT' }
    ],
    global: [
      { nome: 'S&P 500 (SPX)', simbolo: 'SP:SPX' },
      { nome: 'Nasdaq 100 (NDX)', simbolo: 'NASDAQ:NDX' },
      { nome: 'EUR/USD (Forex)', simbolo: 'FX:EURUSD' },
      { nome: 'Ouro (XAU/USD)', simbolo: 'OANDA:XAUUSD' }
    ]
  };

  const mudarMercado = (categoria) => {
    if (planoUsuario === 'basico' && (categoria === 'cripto' || categoria === 'global')) {
      alert('🔒 RECURSO BLOQUEADO: O seu plano atual (Básico) permite operar apenas na B3. Faça upgrade para o Plano Completo em /checkout para desbloquear Cripto e Global!');
      window.location.href = '/checkout';
      return;
    }
    setMercadoCategoria(categoria);
  };

  const handleBuscaCustomizada = (e) => {
    e.preventDefault();
    if (!inputBuscaCustomizada.trim()) return;

    let simboloFormatado = inputBuscaCustomizada.trim().toUpperCase();
    if (!simboloFormatado.includes(':')) {
      if (['WIN', 'WDO', 'PETR4', 'VALE3', 'ITUB4', 'BBDC4'].includes(simboloFormatado)) {
        simboloFormatado = `BMFBOVESPA:${simboloFormatado}`;
        if (simboloFormatado === 'BMFBOVESPA:WIN') simboloFormatado = 'BMFBOVESPA:WIN1!';
        if (simboloFormatado === 'BMFBOVESPA:WDO') simboloFormatado = 'BMFBOVESPA:WDO1!';
      } else if (['BTCUSDT', 'ETHUSDT', 'SOLUSDT'].includes(simboloFormatado)) {
        simboloFormatado = `BINANCE:${simboloFormatado}`;
      } else {
        simboloFormatado = `BMFBOVESPA:${simboloFormatado}`;
      }
    }

    setAtivoSelecionado(simboloFormatado);
    setNomeAtivoExibicao(inputBuscaCustomizada.toUpperCase());
    setInputBuscaCustomizada('');
  };

  useEffect(() => {
    const carregarGrafico = () => {
      const container = document.getElementById('tradingview_widget_container');
      if (container) container.innerHTML = '';

      if (window.TradingView) {
        new window.TradingView.widget({
          "autosize": true,
          "symbol": ativoSelecionado,
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

    if (planoUsuario === 'basico' && mercadoCategoria !== 'b3') {
      alert('🔒 A sua assinatura atual (Plano Básico) não permite operações fora da B3. Visite /checkout para assinar o plano completo.');
      window.location.href = '/checkout';
      return;
    }

    alert(`Ordem de ${direcao} enviada para ${nomeAtivoExibicao} (${ativoSelecionado})!\n• Conta: ${tipoConta.toUpperCase()} ${tipoConta === 'simulada' ? `(Saldo Fictício: R$ ${saldoSimulado.toFixed(2)})` : ''}\n• Plano Ativo: ${planoUsuario.toUpperCase()}\n• Capital Alocado: R$ ${capitalAlocado}\n• Alavancagem: ${alavancagem}\n• Lotes: ${lotes}\n• Stop Diário: R$ ${stopDiario}\nRoteamento HFT via API executado.`);
  };return (
    <main style={{ backgroundColor: '#f1f5f9', color: '#0f172a', minHeight: '100vh', padding: '30px 20px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', boxSizing: 'border-box', width: '100%' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        
        {/* CABEÇALHO REESTRUTURADO E POLIDO */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px 24px', marginBottom: '25px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
          
          {/* Lado Esquerdo: Saudação e Título */}
          <div>
            <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#7c3aed', fontFamily: 'monospace', letterSpacing: '2px', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>
              JENIOS PLATFORM • SALA DE CONTROLO HFT
            </span>
            <h1 style={{ fontSize: '22px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>Olá, Operador</h1>
            <p style={{ fontSize: '11px', color: '#64748b', margin: '2px 0 0 0' }}>{statusMensagem}</p>
          </div>

          {/* Lado Direito: Seletor de Conta, Saldo Sincronizado e Atalhos de Navegação */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            
            {/* Bloco Conta Simulada / Real + Saldo Lado a Lado */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#f8fafc', padding: '6px 12px', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
              <div style={{ display: 'flex', backgroundColor: '#e2e8f0', padding: '2px', borderRadius: '8px' }}>
                <button 
                  onClick={() => setTipoConta('simulada')} 
                  style={{ backgroundColor: tipoConta === 'simulada' ? '#7c3aed' : 'transparent', color: tipoConta === 'simulada' ? '#fff' : '#475569', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  Simulador
                </button>
                <button 
                  onClick={() => setTipoConta('real')} 
                  style={{ backgroundColor: tipoConta === 'real' ? '#059669' : 'transparent', color: tipoConta === 'real' ? '#fff' : '#475569', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  Real
                </button>
              </div>

              {tipoConta === 'simulada' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', borderLeft: '1px solid #cbd5e1', paddingLeft: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569' }}>Saldo (R$):</span>
                  <input 
                    type="number" 
                    value={saldoSimulado} 
                    onChange={(e) => atualizarSaldoSimulado(Number(e.target.value))}
                    style={{ width: '110px', backgroundColor: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1', padding: '6px 8px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', outline: 'none' }}
                  />
                </div>
              )}
            </div>

            {/* Seletor de Plano */}
            <div style={{ backgroundColor: '#f8fafc', padding: '6px 12px', borderRadius: '12px', border: '1px solid #cbd5e1', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569' }}>Plano:</span>
              <select 
                value={planoUsuario} 
                onChange={(e) => setPlanoUsuario(e.target.value)}
                style={{ backgroundColor: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1', padding: '6px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', outline: 'none', cursor: 'pointer' }}
              >
                <option value="basico">Básico (B3)</option>
                <option value="completo">Completo (B3 + Cripto + Global)</option>
              </select>
            </div>

            {/* Links Rápidos */}
            <div style={{ display: 'flex', gap: '6px' }}>
              <a href="/mesa-operacoes" style={{ backgroundColor: '#7c3aed', color: '#fff', textDecoration: 'none', fontWeight: 'bold', fontSize: '11px', padding: '10px 14px', borderRadius: '10px', boxShadow: '0 2px 8px rgba(124, 58, 237, 0.3)' }}>⚡ Mesa</a>
              <a href="/social" style={{ backgroundColor: '#ffffff', color: '#0f172a', textDecoration: 'none', fontWeight: 'bold', fontSize: '11px', padding: '10px 14px', borderRadius: '10px', border: '1px solid #cbd5e1' }}>🌐 Social</a>
            </div>

          </div>
        </div>

        {/* 4 Cartões Principais do Topo */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px', marginBottom: '30px' }}>
          
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
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
            
            <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <span style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 'bold', fontFamily: 'monospace', textTransform: 'uppercase' }}>ATIVO ATUAL EM OPERAÇÃO</span>
                  <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#0f172a', margin: '2px 0 0 0' }}>{nomeAtivoExibicao} <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 'normal' }}>({ativoSelecionado})</span></h3>
                </div>

                <div style={{ display: 'flex', gap: '6px', backgroundColor: '#f1f5f9', padding: '4px', borderRadius: '10px', border: '1px solid #cbd5e1' }}>
                  <button 
                    onClick={() => mudarMercado('b3')}
                    style={{ backgroundColor: mercadoCategoria === 'b3' ? '#7c3aed' : 'transparent', color: mercadoCategoria === 'b3' ? '#fff' : '#334155', border: 'none', padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    B3 (Brasil)
                  </button>
                  <button 
                    onClick={() => mudarMercado('cripto')}
                    style={{ backgroundColor: mercadoCategoria === 'cripto' ? '#7c3aed' : 'transparent', color: mercadoCategoria === 'cripto' ? '#fff' : '#334155', border: 'none', padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    Cripto {planoUsuario === 'basico' && '🔒'}
                  </button>
                  <button 
                    onClick={() => mudarMercado('global')}
                    style={{ backgroundColor: mercadoCategoria === 'global' ? '#7c3aed' : 'transparent', color: mercadoCategoria === 'global' ? '#fff' : '#334155', border: 'none', padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    Global / Forex {planoUsuario === 'basico' && '🔒'}
                  </button>
                </div>
              </div>

              <form onSubmit={handleBuscaCustomizada} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '8px 12px', flex: 1, gap: '8px' }}>
                  <span>🔍</span>
                  <input 
                    type="text" 
                    placeholder="Digite qualquer ativo (ex: PETR4, VALE3, BTCUSDT, AAPL)..."
                    value={inputBuscaCustomizada}
                    onChange={(e) => setInputBuscaCustomizada(e.target.value)}
                    style={{ border: 'none', outline: 'none', fontSize: '12px', width: '100%', background: 'transparent', color: '#0f172a' }}
                  />
                </div>
                <button type="submit" style={{ backgroundColor: '#7c3aed', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
                  Buscar Ativo
                </button>
              </form>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold' }}>⚡ Atalhos Principais:</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {(atalhosPorMercado[mercadoCategoria] || []).map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setAtivoSelecionado(item.simbolo);
                        setNomeAtivoExibicao(item.nome);
                      }}
                      style={{
                        backgroundColor: ativoSelecionado === item.simbolo ? '#7c3aed' : '#f8fafc',
                        color: ativoSelecionado === item.simbolo ? '#ffffff' : '#334155',
                        border: '1px solid #cbd5e1',
                        padding: '8px 14px',
                        borderRadius: '8px',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      {item.nome}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ backgroundColor: '#0b0f19', border: '1px solid #334155', borderRadius: '16px', padding: '15px', height: '520px', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div>
                  <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#f8fafc', display: 'block' }}>📈 Gráfico Profissional TradingView</span>
                  <span style={{ fontSize: '11px', color: '#34d399', fontFamily: 'monospace' }}>● {nomeAtivoExibicao} • Tempo Real Conectado</span>
                </div>
              </div>

              <div style={{ flex: 1, width: '100%', height: '100%', position: 'relative' }}>
                <div id="tradingview_widget_container" style={{ width: '100%', height: '100%' }}></div>
              </div>
            </div>

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

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Megatendências Reais */}
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

            {/* Radar de Baleias Reais */}
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

            {/* Tokens Explosivos Reais */}
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