'use client';
import { useState, useEffect } from 'react';

export default function MesaOperacoesPage() {
  const [modalBrokerAberto, setModalBrokerAberto] = useState(false);
  const [modalRiscoAberto, setModalRiscoAberto] = useState(false);
  
  // Estados de Conta e Modo
  const [tipoConta, setTipoConta] = useState('simulada'); // 'simulada' ou 'real'
  const [modoOperacao, setModoOperacao] = useState('reversa'); // 'manual' ou 'reversa'
  const [bancaTotalConta] = useState(100000.00); // Exemplo de banca total do usuário para o cálculo de 5%

  // Estados de Ativos e Busca
  const [categoria, setCategoria] = useState('b3');
  const [buscaAtiva, setBuscaAtiva] = useState('');
  const [ativoSelecionado, setAtivoSelecionado] = useState('WINZ26 (B3 - Mini-Índice Futuro)');

  // Gestão de Risco e Alocação
  const [capitalAlocar, setCapitalAlocar] = useState(10000);
  const [contratos, setContratos] = useState(5);
  
  // Limite máximo de 5% da banca total
  const limiteMaximoRiscoPermitido = bancaTotalConta * 0.05;

  // Listas de Ativos por Categoria com Busca
  const ativosDisponiveis = {
    b3: [
      { id: 'WINZ26', nome: 'WINZ26 (B3 - Mini-Índice Futuro)', simboloTV: 'BMFBOVESPA:WIN1!' },
      { id: 'WDOF26', nome: 'WDOF26 (B3 - Mini-Dólar Futuro)', simboloTV: 'BMFBOVESPA:WDO1!' },
      { id: 'PETR4', nome: 'PETR4 (B3 - Ações A Vista)', simboloTV: 'BMFBOVESPA:PETR4' },
      { id: 'VALE3', nome: 'VALE3 (B3 - Ações A Vista)', simboloTV: 'BMFBOVESPA:VALE3' },
      { id: 'ITUB4', nome: 'ITUB4 (B3 - Ações A Vista)', simboloTV: 'BMFBOVESPA:ITUB4' }
    ],
    cripto: [
      { id: 'BTCUSD', nome: 'BTCUSD (Cripto - Bitcoin Perpétuo)', simboloTV: 'BINANCE:BTCUSDT' },
      { id: 'ETHUSD', nome: 'ETHUSD (Cripto - Ethereum Perpétuo)', simboloTV: 'BINANCE:ETHUSDT' },
      { id: 'SOLUSDT', nome: 'SOLUSDT (Cripto - Solana)', simboloTV: 'BINANCE:SOLUSDT' }
    ],
    forex: [
      { id: 'EURUSD', nome: 'EURUSD (Global - Forex Major)', simboloTV: 'FX:EURUSD' },
      { id: 'GBPUSD', nome: 'GBPUSD (Global - Forex Major)', simboloTV: 'FX:GBPUSD' },
      { id: 'XAUUSD', nome: 'XAUUSD (Global - Ouro Spot)', simboloTV: 'OANDA:XAUUSD' }
    ]
  };

  const listaFiltrada = (ativosDisponiveis[categoria] || []).filter(item => 
    item.nome.toLowerCase().includes(buscaAtiva.toLowerCase())
  );

  // Mapeia o ativo selecionado para o símbolo exato do TradingView
  const obterSimboloTradingView = () => {
    const listaCompleta = [...ativosDisponiveis.b3, ...ativosDisponiveis.cripto, ...ativosDisponiveis.forex];
    const encontrado = listaCompleta.find(item => item.nome === ativoSelecionado);
    return encontrado ? encontrado.simboloTV : 'BMFBOVESPA:WIN1!';
  };

  // ⚡ UseEffect para carregar e atualizar dinamicamente o Gráfico Real do TradingView na Mesa de Operações
  useEffect(() => {
    const carregarGrafico = () => {
      const container = document.getElementById('tradingview_mesa_container');
      if (container) container.innerHTML = '';

      if (window.TradingView) {
        new window.TradingView.widget({
          "autosize": true,
          "symbol": obterSimboloTradingView(),
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
    if (capitalAlocar > limiteMaximoRiscoPermitido) {
      alert(`⚠️ TRAVA DE SEGURANÇA ATIVADA: O capital alocado (R$ ${capitalAlocar}) ultrapassa o limite de 5% da sua banca recomendada (R$ ${limiteMaximoRiscoPermitido.toFixed(2)}). Reduza o valor para operar.`);
      return;
    }

    const riscoCalculado = capitalAlocar * 0.02; 
    const alvoCalculado = riscoCalculado * 1.5; 

    alert(`🚀 Ordem de ${direcao} executada com sucesso!\n• Conta: ${tipoConta.toUpperCase()}\n• Ativo: ${ativoSelecionado}\n• Modo: ${modoOperacao === 'reversa' ? 'Engenharia Reversa Adaptativa' : 'Manual Puro'}\n• Capital Alocado: R$ ${capitalAlocar}\n• Risco Controlado: R$ ${riscoCalculado.toFixed(2)}\n• Alvo Automático (1.5x): R$ ${alvoCalculado.toFixed(2)}`);
  };

  return (
    <main style={{ backgroundColor: '#0f172a', color: '#f8fafc', minHeight: '100vh', padding: '20px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', boxSizing: 'border-box', width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      {/* BARRA SUPERIOR DE CONTROLE */}
      <div style={{ backgroundColor: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: '16px', padding: '16px 24px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', boxSizing: 'border-box' }}>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
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
              onClick={() => setTipoConta('real')} 
              style={{ backgroundColor: tipoConta === 'real' ? '#059669' : 'transparent', color: tipoConta === 'real' ? '#fff' : '#475569', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              Conta Real
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '16px', fontSize: '12px', fontFamily: 'monospace' }}>
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
            <span style={{ fontWeight: '900', color: '#059669', marginLeft: '6px' }}>+ R$ 940,00</span>
          </div>
          <button 
            onClick={() => setModalRiscoAberto(true)}
            style={{ backgroundColor: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', padding: '10px 14px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            ⚙️ Risco & Alvo (1.5x)
          </button>
        </div>
      </div>

      {/* ÁREA PRINCIPAL: SELETOR DE ATIVOS + GRÁFICO + PAINEL */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px', flex: 1 }}>
        
        {/* COLUNA ESQUERDA: SELETOR DE ATIVOS + GRÁFICO REAL TRADINGVIEW */}
        <div style={{ backgroundColor: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: '16px', padding: '20px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.2)', gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '16px', boxSizing: 'border-box' }}>
          
          {/* SELETOR DE ATIVOS */}
          <div style={{ backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={() => setCategoria('b3')} style={{ backgroundColor: categoria === 'b3' ? '#7c3aed' : '#e2e8f0', color: categoria === 'b3' ? '#fff' : '#334155', border: 'none', padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>B3 (Brasil)</button>
                <button onClick={() => setCategoria('cripto')} style={{ backgroundColor: categoria === 'cripto' ? '#7c3aed' : '#e2e8f0', color: categoria === 'cripto' ? '#fff' : '#334155', border: 'none', padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>Criptoativos</button>
                <button onClick={() => setCategoria('forex')} style={{ backgroundColor: categoria === 'forex' ? '#7c3aed' : '#e2e8f0', color: categoria === 'forex' ? '#e2e8f0' : '#334155', border: 'none', padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>Global / Forex</button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '4px 10px', width: '220px' }}>
                <span style={{ fontSize: '12px', marginRight: '6px' }}>🔍</span>
                <input 
                  type="text" 
                  placeholder="Pesquisar ativo..." 
                  value={buscaAtiva}
                  onChange={(e) => setBuscaAtiva(e.target.value)}
                  style={{ border: 'none', outline: 'none', fontSize: '11px', width: '100%', background: 'transparent' }}
                />
              </div>
            </div>

            <select 
              value={ativoSelecionado}
              onChange={(e) => setAtivoSelecionado(e.target.value)}
              style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '10px', fontSize: '12px', fontWeight: 'bold', color: '#0f172a', outline: 'none', width: '100%' }}
            >
              {listaFiltrada.length > 0 ? (
                listaFiltrada.map(item => (
                  <option key={item.id} value={item.nome}>{item.nome}</option>
                ))
              ) : (
                <option disabled>Nenhum ativo encontrado</option>
              )}
            </select>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', color: '#334155' }}>Gráfico em Tempo Real ({ativoSelecionado})</span>
            <span style={{ fontSize: '10px', color: '#059669', fontFamily: 'monospace', fontWeight: 'bold' }}>● Conectado ao TradingView</span>
          </div>
          
          {/* CONTAINER DO GRÁFICO REAL TRADINGVIEW */}
          <div style={{ flex: 1, minHeight: '420px', backgroundColor: '#0b0f19', borderRadius: '12px', overflow: 'hidden', border: '1px solid #334155', position: 'relative' }}>
            <div id="tradingview_mesa_container" style={{ width: '100%', height: '100%' }}></div>
          </div>
        </div>

        {/* PAINEL LATERAL DE EXECUÇÃO HFT */}
        <div style={{ backgroundColor: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: '16px', padding: '20px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.2)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
              <h2 style={{ fontSize: '12px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1px', color: '#0f172a', margin: '0 0 4px 0' }}>Mesa de Execução HFT</h2>
              <span style={{ fontSize: '10px', color: '#059669', fontWeight: 'bold' }}>● Proteção Algorítmica Ativa</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', color: '#334155', fontFamily: 'monospace' }}>Modo Operacional</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                <button 
                  onClick={() => setModoOperacao('manual')}
                  style={{ backgroundColor: modoOperacao === 'manual' ? '#334155' : '#f1f5f9', color: modoOperacao === 'manual' ? '#fff' : '#334155', border: 'none', padding: '8px', borderRadius: '8px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  Manual Puro
                </button>
                <button 
                  onClick={() => setModoOperacao('reversa')}
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
                onChange={(e) => setCapitalAlocar(Number(e.target.value))} 
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
                📉 Vender
              </button>
              <button onClick={() => executarOrdem('COMPRA (BUY)')} style={{ backgroundColor: '#059669', color: '#fff', border: 'none', padding: '12px', borderRadius: '10px', fontWeight: '900', fontSize: '11px', cursor: 'pointer', textTransform: 'uppercase' }}>
                📈 Comprar
              </button>
            </div>

            <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', padding: '12px', fontSize: '10px', color: '#78350f', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <b>🛡️ Motor Adaptativo de Tendência:</b> 
              <span>Se o ativo estiver em forte tendência e você entrar a favor dela, o robô respeita o fluxo e <b>não faz reversão</b>. A engenharia só atua em falsos rompimentos e exaustões.</span>
            </div>
          </div>

          <div style={{ backgroundColor: '#f3e8ff', border: '1px solid #e9d5ff', borderRadius: '10px', padding: '10px', fontSize: '10px', color: '#581c87', marginTop: '16px' }}>
            <b>Estratégia Aplicada:</b> Perder de colherinha (stop matemático curto) e ganhar de balde (alvo configurado automaticamente a 1.5x do risco).
          </div>
        </div>

      </div>

      {/* MODAL DE CONFIGURAÇÃO DE RISCO & ALVO */}
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
              <span>🛡️ <b>Trava de Capital (5%):</b> Máximo permitido por sessão: <b>R$ {limiteMaximoRiscoPermitido.toFixed(2)}</b>.</span>
              <span>🎯 <b>Relação Risco/Retorno:</b> Alvo travado automaticamente em <b>1.5x</b> o valor do risco estipulado.</span>
            </div>

            <button 
              onClick={() => setModalRiscoAberto(false)}
              style={{ backgroundColor: '#7c3aed', color: '#fff', border: 'none', padding: '12px', borderRadius: '10px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer', textTransform: 'uppercase' }}
            >
              Salvar Parâmetros e Fechar
            </button>
          </div>
        </div>
      )}

      {/* MODAL DE CONEXÃO COM CORRETORA */}
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
            <input type="password" placeholder="Token de segurança da API..." style={{ backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '12px', fontSize: '12px', fontFamily: 'monospace' }} />
            <button 
              onClick={() => { alert('Conta real conectada com sucesso!'); setModalBrokerAberto(false); }}
              style={{ backgroundColor: '#059669', color: '#fff', border: 'none', padding: '12px', borderRadius: '10px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer', textTransform: 'uppercase' }}
            >
              Conectar e Sincronizar
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

    </main>
  );
}