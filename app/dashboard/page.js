'use client';
import { useState } from 'react';

export default function DashboardPage() {
  const [modoReversoAtivo, setModoReversoAtivo] = useState(false);
  const [antifuriaAcionado, setAntifuriaAcionado] = useState(false);
  const [statusMensagem, setStatusMensagem] = useState('Sistema HFT Ativo & Blindado');
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
    <main style={{ backgroundColor: '#0f172a', color: '#f8fafc', minHeight: '100vh', padding: '40px 20px', fontFamily: 'Arial, sans-serif', boxSizing: 'border-box', width: '100%' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        
        {/* Cabeçalho do Dashboard */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', borderBottom: '1px solid #334155', paddingBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
          <div>
            <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#7c3aed', fontFamily: 'monospace', letterSpacing: '2px', textTransform: 'uppercase' }}>
              JENIOS PLATFORM • SALA DE CONTROLO HFT
            </span>
            <h1 style={{ fontSize: '26px', fontWeight: 'bold', color: '#ffffff', margin: '5px 0 0 0' }}>Olá, Operador</h1>
            <p style={{ fontSize: '12px', color: '#94a3b8', margin: '4px 0 0 0' }}>{statusMensagem}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
            <a href="/market" style={{ backgroundColor: '#1e293b', color: '#fff', textDecoration: 'none', fontWeight: 'bold', fontSize: '11px', padding: '8px 14px', borderRadius: '8px', border: '1px solid #334155' }}>📊 Market</a>
            <a href="/social" style={{ backgroundColor: '#1e293b', color: '#fff', textDecoration: 'none', fontWeight: 'bold', fontSize: '11px', padding: '8px 14px', borderRadius: '8px', border: '1px solid #334155' }}>🌐 Social</a>
            <a href="/broker" style={{ backgroundColor: '#1e293b', color: '#fff', textDecoration: 'none', fontWeight: 'bold', fontSize: '11px', padding: '8px 14px', borderRadius: '8px', border: '1px solid #334155' }}>🔌 Broker</a>
            <a href="/checkout" style={{ backgroundColor: '#1e293b', color: '#fff', textDecoration: 'none', fontWeight: 'bold', fontSize: '11px', padding: '8px 14px', borderRadius: '8px', border: '1px solid #334155' }}>💳 Planos</a>
            <span style={{ fontSize: '12px', color: '#10b981', fontWeight: 'bold', fontFamily: 'monospace' }}>● Ativo</span>
            <a href="/" style={{ backgroundColor: '#1e293b', color: '#fff', textDecoration: 'none', fontWeight: 'bold', fontSize: '13px', padding: '8px 16px', borderRadius: '8px', border: '1px solid #334155' }}>
              Sair
            </a>
          </div>
        </div>

        {/* 4 Cartões Principais do Topo (Modo Reverso, Botão Antifúria, Losses Neutralizados, Trava Manual) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px', marginBottom: '30px' }}>
          
          {/* 1. Modo Reverso Automático */}
          <div style={{ backgroundColor: '#131b2e', border: '1px solid #1e293b', borderRadius: '16px', padding: '22px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)' }}>
            <div>
              <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 'bold', fontFamily: 'monospace', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>MODO DE RETIFICAÇÃO</span>
              <h3 style={{ fontSize: '15px', fontWeight: 'bold', color: '#fff', margin: '0 0 8px 0' }}>Modo Reverso Automático</h3>
              <p style={{ fontSize: '12px', color: '#94a3b8', lineHeight: '1.5', margin: '0 0 16px 0' }}>
                Intercepta impulsos e inverte ordens em 3ms.
              </p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '10px', color: '#c084fc', backgroundColor: '#2e1065', padding: '4px 8px', borderRadius: '6px', fontWeight: 'bold' }}>
                Binance & B3
              </span>
              <button onClick={ativarModoReverso} style={{ backgroundColor: modoReversoAtivo ? '#ef4444' : '#7c3aed', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '8px', fontWeight: 'bold', fontSize: '11px', cursor: 'pointer' }}>
                {modoReversoAtivo ? 'Desativar' : 'Ativar'}
              </button>
            </div>
          </div>

          {/* 2. Botão Antifúria (Destacado) */}
          <div style={{ backgroundColor: '#131b2e', border: antifuriaAcionado ? '2px solid #ef4444' : '1px solid #1e293b', borderRadius: '16px', padding: '22px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)' }}>
            <div>
              <span style={{ fontSize: '10px', color: '#ef4444', fontWeight: 'bold', fontFamily: 'monospace', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>BLINDAGEM EMOCIONAL</span>
              <h3 style={{ fontSize: '15px', fontWeight: 'bold', color: '#fff', margin: '0 0 8px 0' }}>Botão Antifúria</h3>
              <p style={{ fontSize: '12px', color: '#94a3b8', lineHeight: '1.5', margin: '0 0 16px 0' }}>
                Bloqueia o vício de vingança pós-loss por 24h.
              </p>
            </div>
            <button onClick={acionarAntifuria} style={{ backgroundColor: antifuriaAcionado ? '#991b1b' : '#dc2626', color: '#fff', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: '900', fontSize: '11px', cursor: 'pointer', textTransform: 'uppercase', width: '100%' }}>
              {antifuriaAcionado ? '🔒 Antifúria Ativo' : '🚨 Acionar Antifúria'}
            </button>
          </div>

          {/* 3. Losses Neutralizados */}
          <div style={{ backgroundColor: '#131b2e', border: '1px solid #1e293b', borderRadius: '16px', padding: '22px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)' }}>
            <div>
              <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 'bold', fontFamily: 'monospace', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>ESTATÍSTICAS</span>
              <h3 style={{ fontSize: '15px', fontWeight: 'bold', color: '#fff', margin: '0 0 4px 0' }}>Losses Neutralizados</h3>
              <div style={{ fontSize: '22px', fontWeight: '900', color: '#10b981', marginBottom: '4px' }}>R$ 6.293,00</div>
              <p style={{ fontSize: '11px', color: '#94a3b8', margin: 0 }}>
                17 operações impulsivas evitadas.
              </p>
            </div>
            <button onClick={() => alert('Simulação de proteção ativa.')} style={{ backgroundColor: '#1e293b', color: '#cbd5e1', border: '1px solid #334155', padding: '8px', borderRadius: '8px', fontWeight: 'bold', fontSize: '11px', cursor: 'pointer', width: '100%', marginTop: '10px' }}>
              Simular Proteção
            </button>
          </div>

          {/* 4. Trava Manual de Emergência */}
          <div style={{ backgroundColor: '#131b2e', border: '1px solid #1e293b', borderRadius: '16px', padding: '22px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)' }}>
            <div>
              <span style={{ fontSize: '10px', color: '#ef4444', fontWeight: 'bold', fontFamily: 'monospace', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>EMERGÊNCIA</span>
              <h3 style={{ fontSize: '15px', fontWeight: 'bold', color: '#fff', margin: '0 0 8px 0' }}>Trava Manual</h3>
              <p style={{ fontSize: '12px', color: '#94a3b8', lineHeight: '1.5', margin: '0 0 16px 0' }}>
                Zera posições e bloqueia novos cliques na corretora.
              </p>
            </div>
            <button onClick={acionarTravaManual} style={{ backgroundColor: '#e11d48', color: '#fff', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: '900', fontSize: '11px', cursor: 'pointer', textTransform: 'uppercase', width: '100%', boxShadow: '0 4px 6px -1px rgba(225, 29, 72, 0.4)' }}>
              🔒 ZERAR TUDO
            </button>
          </div>

        </div>

        {/* LAYOUT PRINCIPAL DO TERMINAL */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '25px' }}>
          
          {/* COLUNA ESQUERDA */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
            
            {/* Seletor de Ativo */}
            <div style={{ backgroundColor: '#131b2e', border: '1px solid #1e293b', borderRadius: '16px', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 'bold', fontFamily: 'monospace' }}>ATIVO EM OPERAÇÃO</span>
                <select value={ativoSelecionado} onChange={(e) => setAtivoSelecionado(e.target.value)} style={{ display: 'block', marginTop: '6px', backgroundColor: '#0f172a', color: '#fff', border: '1px solid #334155', padding: '8px 12px', borderRadius: '8px', fontSize: '13px', outline: 'none' }}>
                  <option value="MINI-INDICE (WINJ26)">Mini-Índice (WINJ26)</option>
                  <option value="MINI-DOLAR (WDOJ26)">Mini-Dólar (WDOJ26)</option>
                  <option value="SOLANA (SOL/USDT)">Solana (SOL/USDT)</option>
                  <option value="BITCOIN (BTC/USDT)">Bitcoin (BTC/USDT)</option>
                </select>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block' }}>Cotação Atual</span>
                <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#10b981' }}>128.450,00 pts</span>
              </div>
            </div>

            {/* Gráfico de Área Suave */}
            <div style={{ backgroundColor: '#131b2e', border: '1px solid #1e293b', borderRadius: '16px', padding: '20px', height: '350px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#fff', display: 'block' }}>📈 Fluxo de Cotação em Tempo Real</span>
                  <span style={{ fontSize: '11px', color: '#10b981', fontFamily: 'monospace' }}>● {ativoSelecionado} • Servidor HFT Conectado</span>
                </div>
                <div style={{ display: 'flex', gap: '8px', fontSize: '11px', color: '#94a3b8' }}>
                  <span style={{ backgroundColor: '#1e293b', padding: '4px 10px', borderRadius: '6px' }}>1M</span>
                  <span style={{ backgroundColor: '#7c3aed', color: '#fff', padding: '4px 10px', borderRadius: '6px', fontWeight: 'bold' }}>5M</span>
                  <span style={{ backgroundColor: '#1e293b', padding: '4px 10px', borderRadius: '6px' }}>15M</span>
                  <span style={{ backgroundColor: '#1e293b', padding: '4px 10px', borderRadius: '6px' }}>1H</span>
                </div>
              </div>

              <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', padding: '10px 0' }}>
                <svg viewBox="0 0 600 160" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                  <defs>
                    <linearGradient id="gradLinha" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
                      <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  <line x1="0" y1="30" x2="600" y2="30" stroke="#1e293b" strokeDasharray="3" />
                  <line x1="0" y1="80" x2="600" y2="80" stroke="#1e293b" strokeDasharray="3" />
                  <line x1="0" y1="130" x2="600" y2="130" stroke="#1e293b" strokeDasharray="3" />
                  <path d="M 0,110 Q 75,70 150,90 T 300,50 T 450,40 T 600,20 L 600,160 L 0,160 Z" fill="url(#gradLinha)" />
                  <path d="M 0,110 Q 75,70 150,90 T 300,50 T 450,40 T 600,20" fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" />
                  <circle cx="600" cy="20" r="5" fill="#10b981" />
                  <circle cx="600" cy="20" r="10" fill="#10b981" opacity="0.3" />
                </svg>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b', borderTop: '1px solid #1e293b', paddingTop: '10px' }}>
                <span>Mínima: 127.890</span>
                <span>Vol: R$ 4.2B</span>
                <span style={{ color: '#10b981' }}>Máxima: 128.920</span>
              </div>
            </div>

            {/* PAINEL DE GESTÃO DE CAPITAL E RISCO */}
            <div style={{ backgroundColor: '#131b2e', border: '1px solid #1e293b', borderRadius: '16px', padding: '25px' }}>
              <span style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 'bold', fontFamily: 'monospace', textTransform: 'uppercase', display: 'block', marginBottom: '12px' }}>
                ⚙️ GESTÃO DE CAPITAL & ALOCAÇÃO DE RISCO
              </span>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '20px' }}>
                
                <div>
                  <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>Capital Alocado (R$)</label>
                  <input 
                    type="number" 
                    value={capitalAlocado} 
                    onChange={(e) => setCapitalAlocado(e.target.value)} 
                    style={{ width: '100%', backgroundColor: '#0f172a', color: '#fff', border: '1px solid #334155', padding: '10px', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} 
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>Alavancagem HFT</label>
                  <select 
                    value={alavancagem} 
                    onChange={(e) => setAlavancagem(e.target.value)} 
                    style={{ width: '100%', backgroundColor: '#0f172a', color: '#fff', border: '1px solid #334155', padding: '10px', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                  >
                    <option value="1x">1x (Sem Alavancagem)</option>
                    <option value="5x">5x</option>
                    <option value="10x">10x</option>
                    <option value="20x">20x</option>
                    <option value="50x">50x (Institucional)</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>Stop Diário / Perda Máxima (R$)</label>
                  <input 
                    type="number" 
                    value={stopDiario} 
                    onChange={(e) => setStopDiario(e.target.value)} 
                    style={{ width: '100%', backgroundColor: '#0f172a', color: '#fff', border: '1px solid #334155', padding: '10px', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} 
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>Quantidade / Lotes</label>
                  <input 
                    type="number" 
                    min="1" 
                    value={lotes} 
                    onChange={(e) => setLotes(e.target.value)} 
                    style={{ width: '100%', backgroundColor: '#0f172a', color: '#fff', border: '1px solid #334155', padding: '10px', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} 
                  />
                </div>

              </div>

              {/* Botões de Execução Rápida */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <button onClick={() => executarOrdem('COMPRA (BUY)')} style={{ backgroundColor: '#10b981', color: '#fff', border: 'none', padding: '16px', borderRadius: '12px', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.2)' }}>
                  🟢 COMPRAR A MERCADO (Lotes: {lotes})
                </button>
                <button onClick={() => executarOrdem('VENDA (SELL)')} style={{ backgroundColor: '#ef4444', color: '#fff', border: 'none', padding: '16px', borderRadius: '12px', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(239, 68, 68, 0.2)' }}>
                  🔴 VENDER A MERCADO (Lotes: {lotes})
                </button>
              </div>

            </div>

          </div>

          {/* COLUNA DIREITA */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* 1. Megatendências */}
            <div style={{ backgroundColor: '#131b2e', border: '1px solid #1e293b', borderRadius: '16px', padding: '20px' }}>
              <span style={{ fontSize: '10px', color: '#a855f7', fontWeight: 'bold', fontFamily: 'monospace', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>📊 FLUXO MACRO EM TEMPO REAL</span>
              <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '12px', color: '#fff' }}>Megatendências</h3>
              <div style={{ backgroundColor: '#060814', padding: '12px', borderRadius: '10px', fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {megatendencias.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#94a3b8' }}>{item.ativo}:</span>
                    <span style={{ color: item.cor, fontWeight: 'bold' }}>{item.tendencia}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 2. Radar de Baleias */}
            <div style={{ backgroundColor: '#131b2e', border: '1px solid #1e293b', borderRadius: '16px', padding: '20px' }}>
              <span style={{ fontSize: '10px', color: '#059669', fontWeight: 'bold', fontFamily: 'monospace', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>🐋 MOVIMENTOS INSTITUCIONAIS</span>
              <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '12px', color: '#fff' }}>Radar de Baleias</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11px' }}>
                {baleias.map((b) => (
                  <div key={b.id} style={{ backgroundColor: '#1e293b', padding: '10px', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                      <span style={{ color: '#059669', fontWeight: 'bold' }}>Detectado</span>
                      <span style={{ color: '#64748b', fontSize: '9px' }}>{b.tempo}</span>
                    </div>
                    <span style={{ color: '#cbd5e1' }}>{b.info}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. Tokens Explosivos */}
            <div style={{ backgroundColor: '#131b2e', border: '1px solid #1e293b', borderRadius: '16px', padding: '20px' }}>
              <span style={{ fontSize: '10px', color: '#f59e0b', fontWeight: 'bold', fontFamily: 'monospace', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>🚀 ATIVOS RECENTES</span>
              <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '12px', color: '#fff' }}>Tokens Explosivos</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11px' }}>
                {tokensExplosivos.map((t, idx) => (
                  <div key={idx} style={{ backgroundColor: '#2e1065', border: '1px solid #7c3aed', padding: '10px', borderRadius: '8px' }}>
                    <b style={{ color: '#f3e8ff', display: 'block', marginBottom: '2px' }}>{t.nome}</b>
                    <span style={{ color: '#d8b4fe', fontSize: '10px' }}>{t.status}</span>
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