'use client';
import { useState, useEffect } from 'react';
import NewTokenRadar from '../components/NewTokenRadar';
import terminal from '../components/platform/Terminal.module.css';
import { observePlatformDiagnostic, loadAccountDiagnostic, readSessionMode, writeSessionMode } from '../../lib/platform/diagnostic-client.mjs';
import { supabase } from '../../lib/supabase';

export default function DashboardPage() {
  const [modoReversoAtivo, setModoReversoAtivo] = useState(false);
  const [diagnosticoConcluido, setDiagnosticoConcluido] = useState(false);
  const [diagnosticoBackend, setDiagnosticoBackend] = useState('Verificando');
  const [operadorId, setOperadorId] = useState(null);
  const [bloqueiosSimulados, setBloqueiosSimulados] = useState(0);
  const [intencoesFicticias, setIntencoesFicticias] = useState([]);
  const [antifuriaAcionado, setAntifuriaAcionado] = useState(false);
  const [statusMensagem, setStatusMensagem] = useState('Área de simulação · ordens reais indisponíveis nesta interface');
  
  // Estados de Conta e Saldo Fictício Sincronizado via LocalStorage
  const [tipoConta, setTipoConta] = useState('simulada'); // 'simulada' ou 'real'
  const [saldoSimulado, setSaldoSimulado] = useState(100000.00);

  // Carrega e sincroniza o saldo simulado globalmente entre as páginas
  useEffect(() => {
    const saldoSalvo = localStorage.getItem('jenios_saldo_simulado');
    if (saldoSalvo && Number.isFinite(Number(saldoSalvo)) && Number(saldoSalvo) >= 0 && Number(saldoSalvo) <= 100000000) {
      setSaldoSimulado(Number(saldoSalvo));
    }
  }, []);

  useEffect(() => observePlatformDiagnostic(supabase,status=>{
    setOperadorId(status.userId);
    setDiagnosticoConcluido(status.verified===true);
    setDiagnosticoBackend(status.reason==='checking'?'Verificando':
      status.verified?'Validado no servidor':
      status.reason==='auth_required'?'Conta não autenticada':'Aguardando validação no servidor');
    const chosen=status.reason==='checking'?null:readSessionMode(window.sessionStorage,status.userId);
    setModoReversoAtivo((chosen || (status.verified?status.mode:'manual'))==='reversa');
  },loadAccountDiagnostic),[]);

  const solicitarContaReal = () => {
    if (!diagnosticoConcluido) {
      alert('Para iniciar a conta real é necessário concluir o Diagnóstico Comportamental, disponível nesta Dashboard. Você pode continuar no simulador.');
      return;
    }
    alert('Diagnóstico inicial registrado. A conta real ainda requer validação no servidor, corretora homologada e autorização de execução. Nenhuma ordem real foi habilitada.');
  };

  const atualizarSaldoSimulado = (novoValor) => {
    const num=Number(novoValor);
    if (!Number.isFinite(num) || num<0 || num>100000000) return;
    setSaldoSimulado(num);
    localStorage.setItem('jenios_saldo_simulado', String(num));
  };

  // A assinatura não pode ser alterada por seleção local; consulte o backend em Meus pagamentos.

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

  const baleias = [];
  const [marketMessage, setMarketMessage] = useState('Consultando tendências de busca…');

  useEffect(() => {
    let active = true, busy = false;
    const controller = new AbortController();
    async function buscarDadosReaisDashboard() {
      if (busy || document.visibilityState !== 'visible') return;
      busy = true;
      try {
        const res = await fetch('/api/tendencias', { cache: 'no-store', signal: controller.signal });
        const payload = await res.json();
        if (!res.ok) throw Error('Fonte indisponível');
        if (!active) return;
        const dados = Array.isArray(payload.tokens) && (payload.disponivel || payload.stale) ? payload.tokens : [];
        const label = payload.stale ? 'Última leitura, fonte não confirmada agora' : 'Tendência de pesquisa';
        setMegatendencias(dados.slice(0, 5).map(coin => ({ ativo: `${coin.nome} (${coin.simbolo})`, tendencia: label, cor: payload.stale ? '#92400e' : '#6d28d9' })));
        setMarketMessage(dados.length ? 'Fonte: CoinGecko Search Trending. Não é fluxo institucional, lançamento ou recomendação.' : 'Tendências temporariamente indisponíveis.');
      } catch (e) {
        if (active) { setMegatendencias([]); setMarketMessage('Não foi possível confirmar uma leitura atual da fonte.'); }
      } finally { busy = false; }
    }

    buscarDadosReaisDashboard();
    const intervalDashboard = setInterval(buscarDadosReaisDashboard, 60000);
    document.addEventListener('visibilitychange', buscarDadosReaisDashboard);
    return () => { active = false; controller.abort(); clearInterval(intervalDashboard); document.removeEventListener('visibilitychange', buscarDadosReaisDashboard); };
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
    if (!['b3','cripto','global'].includes(categoria)) return;
    setMercadoCategoria(categoria); // navegação de estudo, nunca permissão financeira
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
    const novoModo = !modoReversoAtivo ? 'reversa' : 'manual';
    writeSessionMode(window.sessionStorage,operadorId,novoModo);
    setStatusMensagem(novoModo === 'reversa' ? 'Modo reverso selecionado para simulação.' : 'Modo manual selecionado para simulação.');
  };

  const acionarAntifuria = () => {
    setAntifuriaAcionado(current=>!current);
    setStatusMensagem(antifuriaAcionado ? 'Simulação retomada manualmente.' : 'Simulação pausada. Novas intenções fictícias serão bloqueadas.');
  };

  const acionarTravaManual = () => {
    setAntifuriaAcionado(true);
    alert('Novos cliques bloqueados nesta simulação. O sistema não enviou pedido de encerramento a nenhuma corretora.');
  };

  const executarOrdem = (direcao) => {
    if (tipoConta !== 'simulada') { alert('Execução real bloqueada: autorização no servidor indisponível.'); return; }
    if (antifuriaAcionado) {
      setBloqueiosSimulados(n => n + 1);
      alert('Tentativa fictícia bloqueada pelo Botão Antifúria. Não é possível calcular uma perda evitada com base nesse bloqueio.');
      return;
    }

    if (!Number.isFinite(Number(capitalAlocado)) || Number(capitalAlocado)<=0 || Number(capitalAlocado)>saldoSimulado || !Number.isInteger(Number(lotes)) || Number(lotes)<1) {
      alert('Revise o capital fictício e a quantidade de lotes antes de registrar a intenção.');
      return;
    }

    setIntencoesFicticias(current=>[{id:Date.now()+'-'+direcao,ativo:nomeAtivoExibicao,direcao,modo:modoReversoAtivo?'reversa':'manual',capital:Number(capitalAlocado),hora:new Date().toLocaleTimeString('pt-BR')},...current].slice(0,6));
    setStatusMensagem('Intenção de negociação fictícia registrada. Nenhuma ordem transmitida.');
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
                  onClick={solicitarContaReal} 
                  style={{ backgroundColor: tipoConta === 'real' ? '#059669' : 'transparent', color: tipoConta === 'real' ? '#fff' : '#475569', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  Real (validar)
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

            <a href="/dashboard-logado" style={{display:'inline-block',padding:'10px 12px',fontSize:11,color:'#6d28d9',background:'#f5f3ff',borderRadius:10,textDecoration:'none',fontWeight:800}}>Minha assinatura ↗</a>

            {/* Links Rápidos */}
            <div style={{ display: 'flex', gap: '6px' }}>
              <a href="/mesa-operacoes" style={{ backgroundColor: '#7c3aed', color: '#fff', textDecoration: 'none', fontWeight: 'bold', fontSize: '11px', padding: '10px 14px', borderRadius: '10px', boxShadow: '0 2px 8px rgba(124, 58, 237, 0.3)' }}>⚡ Mesa</a>
              <a href="/social" style={{ backgroundColor: '#ffffff', color: '#0f172a', textDecoration: 'none', fontWeight: 'bold', fontSize: '11px', padding: '10px 14px', borderRadius: '10px', border: '1px solid #cbd5e1' }}>🌐 Social</a>
            </div>

          </div>
        </div>

        <section style={{background:'#ffffff',border:'1px solid #ddd6fe',borderRadius:14,padding:18,marginBottom:22}}>
          <h2 style={{margin:'0 0 6px',fontSize:16,color:'#4c1d95'}}>Diagnóstico Comportamental</h2>
          <p style={{fontSize:12,color:'#334155',margin:'0 0 12px'}}>
            {diagnosticoConcluido ? 'Laudo inicial confirmado pelo servidor. Você pode continuar no modo indicado ou mudar depois.' : 'Você pode explorar o simulador sem diagnóstico. Para iniciar o processo de conta real, o laudo precisa ser validado pelo servidor.'}
          </p>
          <a href="/diagnostico" style={{display:'inline-block',padding:'10px 14px',background:'#7c3aed',color:'#fff',textDecoration:'none',fontSize:12,borderRadius:9,fontWeight:800}}>
            {diagnosticoConcluido ? 'Consultar diagnóstico' : 'Fazer diagnóstico'}
          </a>
          <p style={{fontSize:11,color:'#64748b',margin:'10px 0 0'}}>A autorização real também depende de autenticação, confirmação da conta e integração de corretora validada no servidor. Situação: {diagnosticoBackend}.</p>
        </section>

        <section className={terminal.banner} aria-label="Estado da negociação">
          <div><strong>JENIOS · Mesa de estudos e simulação</strong>
            <p>Navegue pelos ativos e registre decisões fictícias. O diagnóstico será necessário apenas para solicitar acesso à conta real, sujeito a autorização adicional.</p></div>
          <nav className={terminal.bannerActions}><a href="/dashboard-logado">Área do cliente</a><a href="/mesa-operacoes">Mesa completa</a><a href="/diagnostico">Diagnóstico</a></nav>
        </section>

        {/* 4 Cartões Principais do Topo */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px', marginBottom: '30px' }}>
          
          <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '22px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
            <div>
              <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 'bold', fontFamily: 'monospace', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>MODO DE RETIFICAÇÃO</span>
              <h3 style={{ fontSize: '15px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 8px 0' }}>Modo Reverso Automático</h3>
              <p style={{ fontSize: '12px', color: '#64748b', lineHeight: '1.5', margin: '0 0 16px 0' }}>
                Modo reverso disponível para estudo no simulador. Latência e roteamento real não certificados.
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
                Pausa novas tentativas nesta sessão de simulação.
              </p>
            </div>
            <button onClick={acionarAntifuria} style={{ backgroundColor: antifuriaAcionado ? '#991b1b' : '#dc2626', color: '#fff', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: '900', fontSize: '11px', cursor: 'pointer', textTransform: 'uppercase', width: '100%' }}>
              {antifuriaAcionado ? '▶ Retomar simulação' : '🚨 Acionar Antifúria'}
            </button>
          </div>

          <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '22px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
            <div>
              <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 'bold', fontFamily: 'monospace', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>ESTATÍSTICAS</span>
              <h3 style={{ fontSize: '15px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 4px 0' }}>Losses evitados · eventos verificáveis</h3>
              <div style={{ fontSize: '22px', fontWeight: '900', color: '#059669', marginBottom: '4px' }}>—</div>
              <p style={{ fontSize: '11px', color: '#64748b', margin: 0 }}>
                {bloqueiosSimulados} bloqueio(s) fictício(s) nesta sessão. Ainda sem valor de perda evitada auditado.
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
                Bloqueia novas tentativas nesta simulação; não fecha posições na corretora.
              </p>
            </div>
            <button onClick={acionarTravaManual} style={{ backgroundColor: '#e11d48', color: '#fff', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: '900', fontSize: '11px', cursor: 'pointer', textTransform: 'uppercase', width: '100%', boxShadow: '0 4px 6px -1px rgba(225, 29, 72, 0.2)' }}>
              🔒 PAUSAR SIMULADOR
            </button>
          </div>

        </div>

        {/* LAYOUT PRINCIPAL DO TERMINAL */}
        <div className={terminal.workspace}>
          
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
                    Cripto
                  </button>
                  <button 
                    onClick={() => mudarMercado('global')}
                    style={{ backgroundColor: mercadoCategoria === 'global' ? '#7c3aed' : 'transparent', color: mercadoCategoria === 'global' ? '#fff' : '#334155', border: 'none', padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    Global / Forex
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
                  <span style={{ fontSize: '11px', color: '#34d399', fontFamily: 'monospace' }}>● {nomeAtivoExibicao} • Widget externo (verifique a cotação)</span>
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

              <div className={terminal.actionButtons}>
                <button onClick={() => executarOrdem('COMPRA (BUY)')} style={{ backgroundColor: '#059669', color: '#fff', border: 'none', padding: '16px', borderRadius: '12px', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(5, 150, 105, 0.2)' }}>
                  🟢 SIMULAR COMPRA (Lotes: {lotes})
                </button>
                <button onClick={() => executarOrdem('VENDA (SELL)')} style={{ backgroundColor: '#dc2626', color: '#fff', border: 'none', padding: '16px', borderRadius: '12px', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(220, 38, 38, 0.2)' }}>
                  🔴 SIMULAR VENDA (Lotes: {lotes})
                </button>
              </div>

              <div className={terminal.history} aria-live="polite">
                <strong>Diário de intenções fictícias</strong>
                {intencoesFicticias.length===0 ? <p className={terminal.note}>Nenhuma intenção registrada nesta sessão.</p> : (
                  <ol>{intencoesFicticias.map(item=><li key={item.id}>
                    <span>{item.hora} · {item.direcao} · {item.ativo}</span>
                    <span>R$ {item.capital.toLocaleString('pt-BR')} · {item.modo}</span>
                  </li>)}</ol>
                )}
                <p className={terminal.note}>Registro de cliques para estudo: não representa execução nem lucro ou perda financeira.</p>
              </div>
            </div>

          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Megatendências Reais */}
            <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
              <span style={{ fontSize: '10px', color: '#7c3aed', fontWeight: 'bold', fontFamily: 'monospace', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>PESQUISAS NO COINGECKO</span>
              <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '12px', color: '#0f172a' }}>Ativos pesquisados</h3>
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
              <p style={{ fontSize: 12, color: '#92400e' }}>Fonte institucional não conectada. Volume agregado de 24h não comprova movimentação de baleias.</p>
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

            <NewTokenRadar />

          </div>

        </div>

      </div>
    </main>
  );
}
