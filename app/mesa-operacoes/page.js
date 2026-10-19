'use client';
import { useState, useEffect } from 'react';
import { adaptiveModeSuggestion } from '../../lib/platform/diagnostic-routing.mjs';
import PlatformStrategyLab from '../components/platform/PlatformStrategyLab';
import { observePlatformDiagnostic, loadAccountDiagnostic, readSessionMode, writeSessionMode } from '../../lib/platform/diagnostic-client.mjs';
import { platformSupabase as supabase } from '../../lib/platform/supabase-client';
import {loadUnifiedSimulationDiagnostic} from '../../lib/platform/unified-entry.mjs';
import {readSimJournal,appendSimIntention,clearSimJournal} from '../../lib/platform/simulation-journal.mjs';
import {loadAccountRisk,NO_EVIDENCE} from '../../lib/platform/risk-client.mjs';
import {readSimulatedBalance,writeSimulatedBalance,readSimulationPaused,writeSimulationPaused} from '../../lib/platform/simulation-account.mjs';
import terminal from '../components/platform/Terminal.module.css';

export default function MesaOperacoesPage() {
  const [modalBrokerAberto, setModalBrokerAberto] = useState(false);
  const [modalRiscoAberto, setModalRiscoAberto] = useState(false);
  
  // Estados de Plano e Assinatura
  // Selecionar mercado de estudo não altera plano ou direitos financeiros.

  // Estados de Conta e Saldo Sincronizado
  const [tipoConta, setTipoConta] = useState('simulada'); // 'simulada' ou 'real'
  const [modoOperacao, setModoOperacao] = useState('manual'); // laudo define o modo inicial
  const [diagnosticoConcluido, setDiagnosticoConcluido] = useState(false);
  const [operadorId, setOperadorId] = useState(null);
  const [diagnosticoBackend, setDiagnosticoBackend] = useState('Verificando');
  const [saldoSimulado, setSaldoSimulado] = useState(100000.00);
  const [intencoes, setIntencoes] = useState([]);
  const [riskEvidence,setRiskEvidence]=useState(NO_EVIDENCE);
  const [pausaManual, setPausaManual] = useState(false);
  const [bloqueiosDeRisco, setBloqueiosDeRisco] = useState(0);

  const atualizarSaldoSimulado = (novoValor) => {
    if(!writeSimulatedBalance(window.sessionStorage,operadorId,novoValor))return;
    setSaldoSimulado(Number(novoValor));
  };

  useEffect(() => observePlatformDiagnostic(supabase,status=>{
    setOperadorId(status.userId);
    setIntencoes(readSimJournal(window.sessionStorage,status.userId));
    setSaldoSimulado(readSimulatedBalance(window.sessionStorage,status.userId));
    setPausaManual(readSimulationPaused(window.sessionStorage,status.userId));
    setBloqueiosDeRisco(0);
    setDiagnosticoConcluido(status.verified===true);
    setDiagnosticoBackend(status.reason==='checking'?'Verificando':
      status.verified?'Validado no servidor':
      status.reason==='auth_required'?'Conta não autenticada':'Aguardando validação no servidor');
    const chosen=status.reason==='checking'?null:readSessionMode(window.sessionStorage,status.userId);
    setModoOperacao(chosen || (status.verified?status.mode:'manual'));
  },client=>loadUnifiedSimulationDiagnostic(client,loadAccountDiagnostic)),[]);

  useEffect(() => observePlatformDiagnostic(supabase,status=>{
    setRiskEvidence(status.evidenceStatus?status:NO_EVIDENCE);
  },()=>loadAccountRisk(supabase)),[]);

  const alterarModo = (mode) => {
    if (!['manual', 'reversa'].includes(mode)) return;
    setModoOperacao(mode);
    writeSessionMode(window.sessionStorage,operadorId,mode);
  };
  const solicitarContaReal = () => {
    if (!diagnosticoConcluido) {
      alert('Para iniciar operações reais é obrigatório concluir o Diagnóstico Comportamental disponível na Dashboard. O simulador continua acessível.');
    } else {
      alert('Seu diagnóstico inicial foi registrado. A execução real aguarda validação no servidor e conexão homologada da corretora. O navegador não autoriza ordens reais.');
    }
  };

  // Sem histórico validado não há motivo para sugerir uma troca de modo.
  const sugestaoAdaptativa = adaptiveModeSuggestion(riskEvidence.verifiedTrades, modoOperacao);

  // Estados de Ativos e Categoria
  const [categoria, setCategoria] = useState('b3');
  const [ativoSelecionado, setAtivoSelecionado] = useState('BMFBOVESPA:WIN1!');
  const [nomeAtivoExibicao, setNomeAtivoExibicao] = useState('Mini-Índice (WIN1!)');
  
  // Input de busca personalizada
  const [inputBuscaCustomizada, setInputBuscaCustomizada] = useState('');

  // Gestão de Risco e Alocação (Baseada no Saldo Simulado Sincronizado)
  const [capitalAlocar, setCapitalAlocar] = useState(1000);
  const [contratos, setContratos] = useState(5);
  
  const limiteMaximoRiscoPermitido = saldoSimulado * 0.05;

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
      { nome: 'Ethereum (ETH/USDT)', simbolo: 'BINANCE:ETHUSDT' },
      { nome: 'Solana (SOL/USDT)', simbolo: 'BINANCE:SOLUSDT' }
    ],
    forex: [
      { nome: 'EUR/USD (Forex)', simbolo: 'FX:EURUSD' },
      { nome: 'GBP/USD (Forex)', simbolo: 'FX:GBPUSD' },
      { nome: 'Ouro (XAU/USD)', simbolo: 'OANDA:XAUUSD' }
    ]
  };

  const mudarCategoria = (cat) => {
    if (!['b3','cripto','forex'].includes(cat)) return;
    setCategoria(cat);
    if (atalhosPorMercado[cat] && atalhosPorMercado[cat].length > 0) {
      setAtivoSelecionado(atalhosPorMercado[cat][0].simbolo);
      setNomeAtivoExibicao(atalhosPorMercado[cat][0].nome);
    }
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
      const container = document.getElementById('tradingview_mesa_container');
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
          "container_id": "tradingview_mesa_container"
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

  const executarOrdem = (direcao) => {
    if (tipoConta !== 'simulada') { alert('Ordens reais não autorizadas nesta interface.'); return; }
    if (readSimulationPaused(window.sessionStorage,operadorId)) { setBloqueiosDeRisco(n=>n+1); return; }
    const valor=Number(capitalAlocar),quantidade=Number(contratos);
    if (!Number.isFinite(valor)||valor<=0||valor>limiteMaximoRiscoPermitido||!Number.isInteger(quantidade)||quantidade<1) {
      setBloqueiosDeRisco(n=>n+1);
      alert('Intenção fictícia bloqueada: revise o limite máximo de 5% e a quantidade de contratos.');
      return;
    }
    const recorded=appendSimIntention(window.sessionStorage,operadorId,
      {ativo:nomeAtivoExibicao,direcao,modo:modoOperacao,valor});
    if(!recorded.ok){alert('Não foi possível salvar o diário de simulação. Nenhuma ordem foi enviada.');return;}
    setIntencoes(recorded.events);
  };return (
    <main style={{ backgroundColor: '#0f172a', color: '#f8fafc', minHeight: '100vh', padding: '20px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', boxSizing: 'border-box', width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      <section style={{background:'#ffffff',color:'#0f172a',borderRadius:12,padding:16,border:'1px solid #ddd6fe'}}>
        <strong>Modo operacional: {modoOperacao === 'reversa' ? 'Reversão Adaptativa' : 'Manual'}</strong>
        <p style={{fontSize:12,color:'#475569',margin:'6px 0 10px'}}>
          {diagnosticoConcluido ? 'Laudo confirmado no servidor. Você pode alterar o modo abaixo a qualquer momento.' : 'Acesso à simulação liberado; o diagnóstico precisa ser validado no servidor antes de solicitar a conta real.'}
        </p>
        {!diagnosticoConcluido && <a href="/diagnostico" style={{display:'inline-block',background:'#7c3aed',color:'#fff',padding:'9px 12px',borderRadius:8,textDecoration:'none',fontSize:12,fontWeight:700}}>Fazer diagnóstico</a>}
        <p style={{fontSize:11,color:'#64748b',margin:'10px 0 0'}}>{sugestaoAdaptativa || 'Leitura adaptativa: aguardando histórico de operações verificadas. Não há recomendação baseada em perdas neste momento.'}</p>
        <p style={{fontSize:11,color:'#64748b',margin:'6px 0 0'}}>Bloqueios confirmados: {riskEvidence.verifiedBlocks===null?'fonte indisponível':riskEvidence.verifiedBlocks}.
          Losses evitados em R$: não calculáveis sem contrafactual auditado; bloqueios não equivalem a prejuízo evitado.</p>
        <p role="status" style={{fontSize:11,color:'#64748b'}}>Diagnóstico: {diagnosticoBackend}</p>
      </section>

      <nav className={terminal.bannerActions} aria-label="Atalhos"><a href="/dashboard-logado">Sala de controle</a><a href="/dashboard">Dashboard</a><a href="/diagnostico">Diagnóstico</a></nav>
            {/* BARRA SUPERIOR DE CONTROLE */}
      <div style={{ backgroundColor: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: '16px', padding: '16px 24px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', boxSizing: 'border-box' }}>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <a href="/dashboard" style={{ backgroundColor: '#f1f5f9', color: '#334155', textDecoration: 'none', border: '1px solid #cbd5e1', padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold' }}>
            ← Voltar
          </a>

          <span style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 'bold', fontFamily: 'monospace', letterSpacing: '2px', textTransform: 'uppercase' }}>
            JENIOS DESK •
          </span>

          <div style={{ display: 'flex', backgroundColor: '#f1f5f9', padding: '3px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
            <button 
              onClick={() => setTipoConta('simulada')} 
              style={{ backgroundColor: tipoConta === 'simulada' ? '#7c3aed' : 'transparent', color: tipoConta === 'simulada' ? '#fff' : '#475569', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              Simulador (Demo)
            </button>
            <button 
              onClick={solicitarContaReal} 
              style={{ backgroundColor: tipoConta === 'real' ? '#059669' : 'transparent', color: tipoConta === 'real' ? '#fff' : '#475569', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              Conta Real
            </button>
          </div>

          {tipoConta === 'simulada' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#f8fafc', padding: '4px 10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
              <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#475569' }}>Saldo Fictício (R$):</span>
              <input 
                type="number" 
                value={saldoSimulado} 
                min="0" max="100000000" onChange={(e) => atualizarSaldoSimulado(e.target.value)}
                style={{ width: '110px', backgroundColor: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1', padding: '4px 6px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', outline: 'none' }}
              />
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '16px', fontSize: '12px', fontFamily: 'monospace' }}>
          
          <a href="/dashboard-logado" style={{background:'#f5f3ff',borderRadius:9,color:'#6d28d9',padding:'10px 12px',fontSize:11,fontWeight:800,textDecoration:'none'}}>Conferir assinatura ↗</a>

          {tipoConta === 'real' && (
            <button 
              onClick={() => setModalBrokerAberto(true)}
              style={{ backgroundColor: '#059669', color: '#ffffff', border: 'none', padding: '10px 16px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              🔗 Conectar Corretora
            </button>
          )}
          <div>
            <span style={{ color: '#64748b' }}>Resultado ({tipoConta.toUpperCase()}):</span>
            <span style={{ fontWeight: '900', color: '#059669', marginLeft: '6px' }}>Sem operações verificadas</span>
          </div>
          <button 
            onClick={() => setModalRiscoAberto(true)}
            style={{ backgroundColor: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', padding: '10px 14px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            ⚙️ Risco & Alvo (1.5x)
          </button>
        </div>
      </div>

      <div className={terminal.workspace}>
        
        <div style={{ backgroundColor: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: '16px', padding: '20px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.2)', display: 'flex', flexDirection: 'column', gap: '16px', boxSizing: 'border-box' }}>
          
          <div style={{ backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={() => mudarCategoria('b3')} style={{ backgroundColor: categoria === 'b3' ? '#7c3aed' : '#e2e8f0', color: categoria === 'b3' ? '#fff' : '#334155', border: 'none', padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>B3 (Brasil)</button>
                <button onClick={() => mudarCategoria('cripto')} style={{ backgroundColor: categoria === 'cripto' ? '#7c3aed' : '#e2e8f0', color: categoria === 'cripto' ? '#fff' : '#334155', border: 'none', padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>Criptoativos </button>
                <button onClick={() => mudarCategoria('forex')} style={{ backgroundColor: categoria === 'forex' ? '#7c3aed' : '#e2e8f0', color: categoria === 'forex' ? '#fff' : '#334155', border: 'none', padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>Global / Forex </button>
              </div>
            </div>

            <form onSubmit={handleBuscaCustomizada} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '8px 12px', flex: 1, gap: '8px' }}>
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

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 'bold' }}>⚡ Atalhos Principais:</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {(atalhosPorMercado[categoria] || []).map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setAtivoSelecionado(item.simbolo);
                      setNomeAtivoExibicao(item.nome);
                    }}
                    style={{
                      backgroundColor: ativoSelecionado === item.simbolo ? '#7c3aed' : '#ffffff',
                      color: ativoSelecionado === item.simbolo ? '#ffffff' : '#334155',
                      border: '1px solid #cbd5e1',
                      padding: '6px 12px',
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

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', color: '#334155' }}>Gráfico para estudo ({nomeAtivoExibicao})</span>
            <span style={{ fontSize: '10px', color: '#059669', fontFamily: 'monospace', fontWeight: 'bold' }}>Widget externo · confira a fonte</span>
          </div>
          
          <div style={{ flex: 1, minHeight: '420px', backgroundColor: '#0b0f19', borderRadius: '12px', overflow: 'hidden', border: '1px solid #334155', position: 'relative' }}>
            <div id="tradingview_mesa_container" style={{ width: '100%', height: '100%' }}></div>
          </div>
        </div>

        <div style={{ backgroundColor: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: '16px', padding: '20px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.2)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
              <h2 style={{ fontSize: '12px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1px', color: '#0f172a', margin: '0 0 4px 0' }}>Mesa de estudo e simulação</h2>
              <span style={{ fontSize: '10px', color: '#059669', fontWeight: 'bold' }}>Simulação • Controles disponíveis</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', color: '#334155', fontFamily: 'monospace' }}>Modo Operacional</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                <button 
                  onClick={() => alterarModo('manual')}
                  style={{ backgroundColor: modoOperacao === 'manual' ? '#334155' : '#f1f5f9', color: modoOperacao === 'manual' ? '#fff' : '#334155', border: 'none', padding: '8px', borderRadius: '8px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  Manual Puro
                </button>
                <button 
                  onClick={() => alterarModo('reversa')}
                  style={{ backgroundColor: modoOperacao === 'reversa' ? '#7c3aed' : '#f1f5f9', color: modoOperacao === 'reversa' ? '#fff' : '#334155', border: 'none', padding: '8px', borderRadius: '8px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  Engenharia Reversa
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', color: '#334155', fontFamily: 'monospace' }}>Capital a Operar (R$)</label>
              <input 
                type="number" 
                value={capitalAlocar} 
                min="0" max={limiteMaximoRiscoPermitido} onChange={(e) => setCapitalAlocar(e.target.value)} 
                style={{ backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '10px', fontSize: '12px', color: '#0f172a', fontFamily: 'monospace', outline: 'none' }} 
              />
              <span style={{ fontSize: '9px', color: '#64748b' }}>Trava de segurança: Máx 5% (R$ {limiteMaximoRiscoPermitido.toFixed(2)})</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', color: '#64748b', fontFamily: 'monospace' }}>Contratos / Lotes</label>
              <input 
                type="number" 
                value={contratos} 
                onChange={(e) => setContratos(Number(e.target.value))} 
                min="1" 
                style={{ backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '10px', fontSize: '12px', color: '#0f172a', fontFamily: 'monospace', outline: 'none' }} 
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button onClick={() => executarOrdem('VENDA (SELL)')} style={{ backgroundColor: '#dc2626', color: '#fff', border: 'none', padding: '12px', borderRadius: '10px', fontWeight: '900', fontSize: '11px', cursor: 'pointer', textTransform: 'uppercase' }}>
                📉 Simular venda
              </button>
              <button onClick={() => executarOrdem('COMPRA (BUY)')} style={{ backgroundColor: '#059669', color: '#fff', border: 'none', padding: '12px', borderRadius: '10px', fontWeight: '900', fontSize: '11px', cursor: 'pointer', textTransform: 'uppercase' }}>
                📈 Simular compra
              </button>
            </div>

            <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', padding: '12px', fontSize: '10px', color: '#78350f', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <b>🛡️ Motor Adaptativo de Tendência:</b> 
              <span>Em simulações, a política pode preservar a direção em uma tendência confirmada, sempre sujeita aos limites de risco. Esta tela não valida tendências nem transmite ordens.</span>
            </div>
          </div>

          <section className={terminal.history} aria-live="polite">
            <strong>Histórico de intenções fictícias</strong>
            <p className={terminal.note}>Intenções: {intencoes.length}. Bloqueios simulados: {bloqueiosDeRisco}. Valor de prejuízo evitado não apurado.</p>
            {intencoes.length===0 ? <p className={terminal.note}>Ainda não há decisões fictícias registradas nesta sessão.</p> :
              <ol>{intencoes.map(entry=><li key={entry.id}><span>{entry.hora} · {entry.ativo} · {entry.direcao}</span><span>R$ {entry.valor.toLocaleString('pt-BR')} · {entry.modo}</span></li>)}</ol>}
            <div style={{display:'flex',gap:8,marginTop:12,flexWrap:'wrap'}}>
              <button type="button" onClick={()=>{
                const paused=!pausaManual;
                if(!writeSimulationPaused(window.sessionStorage,operadorId,paused))return;
                setPausaManual(paused);
              }} style={{background:pausaManual?'#059669':'#7c3aed',color:'#fff',padding:'9px 12px',border:0,borderRadius:8,cursor:'pointer',fontWeight:800}}>{pausaManual?'Retomar sessão':'Pausar sessão'}</button>
              <button type="button" onClick={()=>{clearSimJournal(window.sessionStorage,operadorId);setIntencoes([]);}} disabled={intencoes.length===0} style={{background:'#e2e8f0',color:'#334155',padding:'9px 12px',border:0,borderRadius:8,cursor:'pointer'}}>Limpar diário</button>
            </div>
          </section>
                    <div style={{ backgroundColor: '#f3e8ff', border: '1px solid #e9d5ff', borderRadius: '10px', padding: '10px', fontSize: '10px', color: '#581c87', marginTop: '16px' }}>
            <b>Estratégia Aplicada:</b> Perder de colherinha (stop matemático curto) e ganhar de balde (alvo configurado automaticamente a 1.5x do risco).
          </div>
        </div>

      </div>

      {modalRiscoAberto && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', zIndex: 50 }}>
          <div style={{ backgroundColor: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: '16px', padding: '30px', maxWidth: '420px', width: '100%', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <span style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 'bold', fontFamily: 'monospace', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>
                GESTÃO INSTITUCIONAL • Configuração de Risco
              </span>
              <h2 style={{ fontSize: '18px', fontWeight: '900', color: '#0f172a', margin: '0 0 4px 0' }}>Parâmetros de Proteção</h2>
              <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>
                Defina os limites de alocação e o multiplicador de ganho assimétrico.
              </p>
            </div>

            <div style={{ backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '12px', fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span>🛡️ <b>Trava de Capital (5%):</b> Máximo permitido com base no saldo simulado atual: <b>R$ {limiteMaximoRiscoPermitido.toFixed(2)}</b>.</span>
              <span>🎯 <b>Relação Risco/Retorno:</b> Alvo ilustrativo de <b>1.5x</b> o valor do risco estipulado.</span>
            </div>

            <button 
              onClick={() => setModalRiscoAberto(false)}
              style={{ backgroundColor: '#7c3aed', color: '#fff', border: 'none', padding: '12px', borderRadius: '10px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer', textTransform: 'uppercase' }}
            >
              Fechar parâmetros ilustrativos
            </button>
          </div>
        </div>
      )}

      {modalBrokerAberto && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', zIndex: 50 }}>
          <div style={{ backgroundColor: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: '16px', padding: '30px', maxWidth: '420px', width: '100%', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <span style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 'bold', fontFamily: 'monospace', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>
                JENIOS BROKER GATEWAY • Conexão Segura
              </span>
              <h2 style={{ fontSize: '18px', fontWeight: '900', color: '#0f172a', margin: '0 0 4px 0' }}>Vincular Conta Real</h2>
            </div>
            <select style={{ backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '12px', fontSize: '12px', color: '#0f172a' }}>
              <option>XP Investimentos (B3 / Futuros)</option>
              <option>Clear Corretora (B3 / Mini-Índice & Dólar)</option>
              <option>Binance (Cripto Derivativos)</option>
            </select>
            <p style={{fontSize:12,color:'#92400e',lineHeight:1.6}}>As integrações de conta real ainda exigem homologação do gateway. Não informe senhas ou tokens nesta página. Nenhuma corretora será conectada aqui.</p>
            <button disabled style={{ backgroundColor: '#94a3b8', color: '#fff', border: 'none', padding: '12px', borderRadius: '10px', fontWeight: 'bold', fontSize: '12px', cursor: 'not-allowed', textTransform: 'uppercase' }}>
              Aguardando integração validada
            </button>
            <button 
              onClick={() => setModalBrokerAberto(false)}
              style={{ backgroundColor: '#f1f5f9', color: '#334155', border: 'none', padding: '10px', borderRadius: '10px', fontWeight: 'bold', fontSize: '11px', cursor: 'pointer' }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <PlatformStrategyLab userId={operadorId} balance={saldoSimulado}/>
    </main>
  );
}