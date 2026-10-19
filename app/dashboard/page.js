'use client';
import { useState, useEffect } from 'react';
import NewTokenRadar from '../components/NewTokenRadar';
import ResponsiveTradingViewChart from '../components/platform/ResponsiveTradingViewChart';
import {BrandLockup,BrandFooter} from '../components/brand/BrandSignature';
import PlatformStrategyLab from '../components/platform/PlatformStrategyLab';
import useTrendsData from '../components/useTrendsData';
import {dashboardHubModule} from '../../lib/platform/dashboard-trends.mjs';
import terminal from '../components/platform/Terminal.module.css';
import { observePlatformDiagnostic, loadAccountDiagnostic, readSessionMode, writeSessionMode } from '../../lib/platform/diagnostic-client.mjs';
import { platformSupabase as supabase } from '../../lib/platform/supabase-client';
import {loadUnifiedSimulationDiagnostic} from '../../lib/platform/unified-entry.mjs';
import {readSimJournal,appendSimIntention} from '../../lib/platform/simulation-journal.mjs';
import {loadAccountRisk,NO_EVIDENCE} from '../../lib/platform/risk-client.mjs';
import {readSimulatedBalance,writeSimulatedBalance,readSimulationPaused,writeSimulationPaused} from '../../lib/platform/simulation-account.mjs';

export default function DashboardPage() {
  const [modoReversoAtivo, setModoReversoAtivo] = useState(false);
  const [diagnosticoConcluido, setDiagnosticoConcluido] = useState(false);
  const [diagnosticoBackend, setDiagnosticoBackend] = useState('Verificando');
  const [operadorId, setOperadorId] = useState(null);
  const [bloqueiosSimulados, setBloqueiosSimulados] = useState(0);
  const [intencoesFicticias, setIntencoesFicticias] = useState([]);
  const [riskEvidence,setRiskEvidence]=useState(NO_EVIDENCE);
  const [antifuriaAcionado, setAntifuriaAcionado] = useState(false);
  const [statusMensagem, setStatusMensagem] = useState('Área de simulação · ordens reais indisponíveis nesta interface');
  
  // Estados de conta fictícia isolados por usuário e por sessão.
  const [tipoConta, setTipoConta] = useState('simulada'); // 'simulada' ou 'real'
  const [saldoSimulado, setSaldoSimulado] = useState(100000.00);

  useEffect(() => observePlatformDiagnostic(supabase,status=>{
    setOperadorId(status.userId);
    setIntencoesFicticias(readSimJournal(window.sessionStorage,status.userId));
    setSaldoSimulado(readSimulatedBalance(window.sessionStorage,status.userId));
    setAntifuriaAcionado(readSimulationPaused(window.sessionStorage,status.userId));
    setBloqueiosSimulados(0);
    setDiagnosticoConcluido(status.verified===true);
    setDiagnosticoBackend(status.reason==='checking'?'Verificando':
      status.verified?'Validado no servidor':
      status.reason==='auth_required'?'Conta não autenticada':'Aguardando validação no servidor');
    const chosen=status.reason==='checking'?null:readSessionMode(window.sessionStorage,status.userId);
    setModoReversoAtivo((chosen || (status.verified?status.mode:'manual'))==='reversa');
  },client=>loadUnifiedSimulationDiagnostic(client,loadAccountDiagnostic)),[]);

  useEffect(() => observePlatformDiagnostic(supabase,status=>{
    setRiskEvidence(status.evidenceStatus?status:NO_EVIDENCE);
  },()=>loadAccountRisk(supabase)),[]);

  const solicitarContaReal = () => {
    if (!diagnosticoConcluido) {
      alert('Para iniciar a conta real é necessário concluir o Diagnóstico Comportamental, disponível nesta Dashboard. Você pode continuar no simulador.');
      return;
    }
    alert('Diagnóstico inicial registrado. A conta real ainda requer validação no servidor, corretora homologada e autorização de execução. Nenhuma ordem real foi habilitada.');
  };

  const atualizarSaldoSimulado = (novoValor) => {
    const num=Number(novoValor);
    if(!writeSimulatedBalance(window.sessionStorage,operadorId,novoValor))return;
    setSaldoSimulado(num);
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

  // Single authoritative hub snapshot; shared cache also feeds the Social and /tendencias.
  const {data:hub,loading:hubLoading,error:hubError,clock:hubClock}=useTrendsData('/api/tendencias');
  const tokenPanel=dashboardHubModule('tokens',hub,hubClock);
  const megaPanel=dashboardHubModule('megapulse',hub,hubClock);
  const whalePanel=dashboardHubModule('baleias',hub,hubClock);

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



  const ativarModoReverso = () => {
    setModoReversoAtivo(!modoReversoAtivo);
    const novoModo = !modoReversoAtivo ? 'reversa' : 'manual';
    writeSessionMode(window.sessionStorage,operadorId,novoModo);
    setStatusMensagem(novoModo === 'reversa' ? 'Modo reverso selecionado para simulação.' : 'Modo manual selecionado para simulação.');
  };

  const acionarAntifuria = () => {
    const paused=!antifuriaAcionado;
    if(!writeSimulationPaused(window.sessionStorage,operadorId,paused)){
      setStatusMensagem('Não foi possível salvar a trava de simulação. Nenhuma ordem é transmitida.');
      return;
    }
    setAntifuriaAcionado(paused);
    setStatusMensagem(paused?'Simulação pausada para esta conta.':'Simulação retomada manualmente para esta conta.');
  };

  const acionarTravaManual = () => {
    if(!writeSimulationPaused(window.sessionStorage,operadorId,true)){
      alert('Pausa local indisponível. Nenhuma ordem real é transmitida por este painel.');
      return;
    }
    setAntifuriaAcionado(true);
    setStatusMensagem('Simulador pausado nesta conta. Nenhuma corretora recebeu comando.');
  };

  const executarOrdem = (direcao) => {
    if (tipoConta !== 'simulada') { alert('Execução real bloqueada: autorização no servidor indisponível.'); return; }
    if (readSimulationPaused(window.sessionStorage,operadorId)) {
      setBloqueiosSimulados(n => n + 1);
      alert('Tentativa fictícia bloqueada pelo Botão Antifúria. Não é possível calcular uma perda evitada com base nesse bloqueio.');
      return;
    }

    if (!Number.isFinite(Number(capitalAlocado)) || Number(capitalAlocado)<=0 || Number(capitalAlocado)>saldoSimulado || !Number.isInteger(Number(lotes)) || Number(lotes)<1) {
      alert('Revise o capital fictício e a quantidade de lotes antes de registrar a intenção.');
      return;
    }

    const recorded=appendSimIntention(window.sessionStorage,operadorId,
      {ativo:nomeAtivoExibicao,direcao,modo:modoReversoAtivo?'reversa':'manual',
       capital:Number(capitalAlocado)});
    if(!recorded.ok) {setStatusMensagem('Diário local indisponível; nenhuma ordem foi enviada.');return;}
    setIntencoesFicticias(recorded.events);
    setStatusMensagem('Intenção de negociação fictícia registrada. Nenhuma ordem transmitida.');
  };return (
    <main style={{ backgroundColor: '#f1f5f9', color: '#0f172a', minHeight: '100vh', padding: '30px 20px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', boxSizing: 'border-box', width: '100%' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        
        {/* CABEÇALHO REESTRUTURADO E POLIDO */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px 24px', marginBottom: '25px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
          
          {/* Lado Esquerdo: Saudação e Título */}
          <div>
            <BrandLockup tone="light" context="Platform" priority/>
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
                  <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569' }}>Saldo fictício (R$):</span>
                  <input 
                    type="number" 
                    value={saldoSimulado} 
                    min="0" max="100000000" onChange={(e) => atualizarSaldoSimulado(e.target.value)}
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
                {riskEvidence.verifiedBlocks===null?'Sem fonte de corretora verificada':
                  riskEvidence.verifiedBlocks+' bloqueio(s) confirmado(s) por registro de corretora'}.
                  {bloqueiosSimulados} bloqueio(s) fictício(s) nesta sessão. Sem valor financeiro de perda evitada comprovado.
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

            <ResponsiveTradingViewChart symbol={ativoSelecionado} label={nomeAtivoExibicao}/>

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
                <p className={terminal.note}>Diário compartilhado entre Dashboard e Mesa nesta sessão. Os cliques não representam ordens executadas nem lucros.</p>
              </div>
            </div>

          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Hub único: nunca inferir baleias por volume agregado nem perpetuar cotação antiga. */}
            <section style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:16,padding:20}}>
              <span style={{fontSize:10,color:'#7c3aed',fontWeight:800,letterSpacing:1}}>HUB JENIOS · LEITURA COMPARTILHADA</span>
              <h3 style={{fontSize:17,margin:'8px 0'}}>Tendências de busca e MegaPulse</h3>
              <a href="/tendencias" style={{fontSize:12,color:'#6d28d9'}}>Abrir Hub de Tendências ↗</a>
              {hubError&&<p role="status" style={{fontSize:12,color:'#92400e'}}>Atualização do Hub indisponível. {hubError}</p>}
              {hubLoading&&!hub&&<p role="status">Consultando a mesa do Hub…</p>}
              {[tokenPanel,megaPanel].map(panel=>(
                <div key={panel.id} style={{marginTop:16,borderTop:'1px solid #e2e8f0',paddingTop:12,fontSize:12}}>
                  <strong style={{color:'#172033'}}>{panel.label}</strong>
                  {panel.stale&&<p style={{color:'#92400e'}}>Última leitura válida, não confirmada agora.</p>}
                  {panel.rows.length?panel.rows.map(row=><div key={row.id||row.simbolo}
                    style={{padding:'8px 0',borderBottom:'1px solid #f1f5f9'}}>
                    <strong>{row.nome} · {row.simbolo}</strong>
                    <p style={{margin:'4px 0',color:'#475569'}}>{panel.describe(row)}</p>
                  </div>):<p role="status" style={{color:'#64748b'}}>{panel.message}</p>}
                </div>
              ))}
              <p style={{fontSize:11,color:'#64748b'}}>CoinGecko representa interesse de busca; MegaPulse mostra apenas cotações intradiárias recentes confirmadas. Nenhum deles constitui recomendação de investimento.</p>
            </section>

            <section style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:16,padding:20}}>
              <span style={{fontSize:10,color:'#047857',fontWeight:800}}>MOVIMENTOS BTC CONFIRMADOS</span>
              <h3 style={{fontSize:17,margin:'8px 0'}}>Radar de Baleias</h3>
              {whalePanel.historical&&<p role="status" style={{fontSize:12,color:'#92400e'}}>Últimos três registros · histórico, não movimentos atuais.</p>}
              {whalePanel.stale&&<p style={{fontSize:12,color:'#92400e'}}>Fonte não confirmada nesta atualização.</p>}
              {whalePanel.rows.length?whalePanel.rows.map(row=>(
                <div key={row.id} style={{padding:'9px 0',borderBottom:'1px solid #e2e8f0',fontSize:12}}>
                  <a href={row.url} target="_blank" rel="noopener noreferrer" style={{color:'#065f46',fontWeight:800}}>Transferência confirmada · BTC ↗</a>
                  <p style={{margin:'4px 0',color:'#475569'}}>{whalePanel.describe(row)}</p>
                </div>
              )):<p role="status" style={{fontSize:12,color:'#64748b'}}>{whalePanel.message}</p>}
              <p style={{fontSize:11,color:'#64748b'}}>Transferências verificadas na rede Bitcoin não demonstram compra, propriedade institucional ou intenção de mercado. Volume agregado de 24h não comprova movimentação de baleias.</p>
            </section>

            <NewTokenRadar />

          </div>

        </div>

        <PlatformStrategyLab userId={operadorId} balance={saldoSimulado}/>
        <BrandFooter tone="light" scope="Platform"/>
      </div>
    </main>
  );
}
