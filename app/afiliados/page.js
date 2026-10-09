'use client';
import { useState } from 'react';

export default function SocialPage() {
  const [abaAtiva, setAbaAtiva] = useState('feed');
  const [novoTexto, setNovoTexto] = useState('');
  const [imagemInput, setImagemInput] = useState('');
  const [tickerSelecionado, setTickerSelecionado] = useState(null);

  // Lista de informativos macro
  const tickerMacro = [
    { 
      id: 1, 
      tipo: '📊 MEGAPULSE', 
      titulo: 'Ibovespa (IBOV): ▲ Alta Institucional (+1.2%)', 
      detalhes: 'O fluxo de ordens institucionais nas últimas 2 horas indica forte acumulação nos principais papéis do setor financeiro e de commodities. O motor HFT detetou entrada de capital estrangeiro de R$ 1.2B.' 
    },
    { 
      id: 2, 
      tipo: '🐋 BALEIA B3', 
      titulo: 'Aporte detetado em VALE3 (+R$ 45M em lotes)', 
      detalhes: 'Grande player posicionado no suporte de curto prazo. Movimento típico de repachinagem de carteira institucional com foco em dividendos e proteção de alpha.' 
    },
    { 
      id: 3, 
      tipo: '🚀 TOKEN', 
      titulo: '$LTR-Prop: Volume +450% | Influxo Institucional', 
      detalhes: 'Pools de liquidez na rede Solana registaram alta volatilidade com execução automática de contratos inteligentes. Contrato validado e seguro.' 
    }
  ];

  // Duplicamos os itens para garantir o efeito de carrossel infinito perfeito sem saltos
  const tickerDuplicado = [...tickerMacro, ...tickerMacro];

  const [posts, setPosts] = useState([
    { 
      id: 1, 
      autor: 'Carlos Trader', 
      cargo: 'Estrategista HFT', 
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
      texto: 'O fluxo institucional nas blue chips da B3 está a indicar alta forte. Fiquem atentos ao painel de baleias e rompimentos de máxima!', 
      imagem: 'https://images.unsplash.com/photo-1642543492481-44e81e3914a7?w=800',
      tempo: 'Há 15 mins', 
      likes: 12, 
      curtido: false,
      patrocinado: false 
    }
  ]);

  const [rankingOperadores] = useState([
    { pos: 1, nome: 'Paulo Stutz (CEO)', rentabilidade: '+68.4%', status: '🏆 1º Lugar • Mensalidade Abonada + Destaque Master' },
    { pos: 2, nome: 'Mariana Silva', rentabilidade: '+54.1%', status: '🥈 2º Lugar • Mensalidade Abonada' },
    { pos: 3, nome: 'Carlos HFT', rentabilidade: '+45.8%', status: '🥉 3º Lugar • Mensalidade Abonada' }
  ]);

  const publicarPost = (e) => {
    e.preventDefault();
    if (!novoTexto.trim() && !imagemInput.trim()) return;
    setPosts([{ 
      id: Date.now(), 
      autor: 'Paulo Stutz (CEO)', 
      cargo: 'Administrador', 
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      texto: novoTexto, 
      imagem: imagemInput,
      tempo: 'Agora mesmo', 
      likes: 1, 
      curtido: false,
      patrocinado: false 
    }, ...posts]);
    setNovoTexto('');
    setImagemInput('');
  };

  const curtirPost = (id) => {
    setPosts(posts.map(p => p.id === id ? { ...p, likes: p.curtido ? p.likes - 1 : p.likes + 1, curtido: !p.curtido } : p));
  };

  const patrocinarPost = (id) => {
    setPosts(posts.map(p => {
      if (p.id === id) {
        const novoPatr = !p.patrocinado;
        alert(novoPatr ? '🚀 Post impulsionado com sucesso!' : 'Impulsionamento pausado.');
        return { ...p, patrocinado: novoPatr };
      }
      return p;
    }));
  };

  return (
    <main style={{ backgroundColor: '#0f172a', color: '#f8fafc', minHeight: '100vh', paddingBottom: '60px', fontFamily: 'Arial, sans-serif', boxSizing: 'border-box', width: '100%', position: 'relative' }}>
      
      {/* 🌟 ESTILOS DO CARROSSEL CONTÍNUO (MARQUEE) */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes marquee {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-50%); }
        }
        .ticker-container {
          overflow: hidden;
          white-space: nowrap;
          width: 100%;
        }
        .ticker-track {
          display: inline-flex;
          animation: marquee 25s linear infinite;
        }
        .ticker-track:hover {
          animation-play-state: paused;
        }
      ` }} />

      {/* 🌟 BARRA DE MONITORAMENTO MACRO EM CARROSSEL */}
      <div style={{ position: 'sticky', top: 0, zIndex: 9999, backgroundColor: '#020617', borderBottom: '1px solid #1e293b', padding: '10px 0', width: '100%', boxSizing: 'border-box' }} className="ticker-container">
        <div className="ticker-track">
          {tickerDuplicado.map((item, index) => (
            <div 
              key={index} 
              onClick={() => setTickerSelecionado(item)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer', padding: '0 30px', whiteSpace: 'nowrap' }}
            >
              <span style={{ color: '#10b981', fontWeight: 'bold', fontFamily: 'monospace' }}>{item.tipo}:</span>
              <span style={{ color: '#e2e8f0' }}>{item.titulo}</span>
              <span style={{ fontSize: '10px', color: '#a855f7', marginLeft: '6px' }}>[Ver Detalhes 🔍]</span>
            </div>
          ))}
        </div>
      </div>

      {/* MODAL DE DETALHES DO TICKER */}
      {tickerSelecionado && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.75)', zIndex: 10000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
          <div style={{ backgroundColor: '#131b2e', border: '1px solid #334155', borderRadius: '16px', maxWidth: '500px', width: '100%', padding: '25px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: '1px solid #1e293b', paddingBottom: '10px' }}>
              <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#10b981', fontFamily: 'monospace' }}>{tickerSelecionado.tipo}</span>
              <button onClick={() => setTickerSelecionado(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '18px', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
            </div>
            <h3 style={{ fontSize: '16px', color: '#fff', marginBottom: '12px' }}>{tickerSelecionado.titulo}</h3>
            <p style={{ fontSize: '14px', color: '#cbd5e1', lineHeight: '1.6', marginBottom: '20px' }}>{tickerSelecionado.detalhes}</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setTickerSelecionado(null)} style={{ backgroundColor: '#7c3aed', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
                Fechar Relatório
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '30px 20px 0 20px' }}>
        
        {/* Cabeçalho */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', borderBottom: '1px solid #334155', paddingBottom: '20px' }}>
          <div>
            <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#7c3aed', fontFamily: 'monospace', letterSpacing: '2px', textTransform: 'uppercase' }}>
              ⚡ JENIOS SOCIAL • COMUNIDADE & DISCOVERY
            </span>
            <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#ffffff', margin: '4px 0 0 0' }}>Comunidade Global & Estrategistas</h1>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <a href="/afiliados" style={{ backgroundColor: '#059669', color: '#fff', textDecoration: 'none', fontWeight: 'bold', fontSize: '12px', padding: '8px 16px', borderRadius: '8px' }}>
              Tráfego Pago →
            </a>
            <a href="/" style={{ backgroundColor: '#334155', color: '#fff', textDecoration: 'none', fontWeight: 'bold', fontSize: '12px', padding: '8px 16px', borderRadius: '8px' }}>
              ← Início
            </a>
          </div>
        </div>

        {/* Abas */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '25px' }}>
          <button onClick={() => setAbaAtiva('feed')} style={{ padding: '8px 16px', borderRadius: '8px', border: abaAtiva === 'feed' ? '2px solid #7c3aed' : '1px solid #334155', backgroundColor: abaAtiva === 'feed' ? '#1e293b' : '#131b2e', color: '#fff', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}>
            📱 Feed Contínuo
          </button>
          <button onClick={() => setAbaAtiva('ranking')} style={{ padding: '8px 16px', borderRadius: '8px', border: abaAtiva === 'ranking' ? '2px solid #f59e0b' : '1px solid #334155', backgroundColor: abaAtiva === 'ranking' ? '#1e293b' : '#131b2e', color: '#fff', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}>
            🏆 Ranking Top 10
          </button>
        </div>

        {abaAtiva === 'feed' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
            
            {/* Caixa de Criação */}
            <div style={{ backgroundColor: '#131b2e', border: '1px solid #1e293b', borderRadius: '16px', padding: '20px' }}>
              <form onSubmit={publicarPost}>
                <textarea 
                  value={novoTexto} 
                  onChange={(e) => setNovoTexto(e.target.value)} 
                  placeholder="O que está a ver no mercado agora? Partilhe com a rede..." 
                  style={{ width: '100%', height: '80px', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '10px', color: '#fff', padding: '12px', fontSize: '14px', outline: 'none', boxSizing: 'border-box', resize: 'none', marginBottom: '12px' }} 
                />
                <input 
                  type="text" 
                  value={imagemInput} 
                  onChange={(e) => setImagemInput(e.target.value)} 
                  placeholder="Link de imagem ou gráfico (opcional)..." 
                  style={{ width: '100%', backgroundColor: '#0f172a', color: '#fff', border: '1px solid #334155', padding: '10px 14px', borderRadius: '8px', fontSize: '12px', outline: 'none', marginBottom: '15px', boxSizing: 'border-box' }} 
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button type="submit" style={{ backgroundColor: '#7c3aed', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}>
                    Publicar no Feed 🚀
                  </button>
                </div>
              </form>
            </div>

            {/* Feed de Posts */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {posts.map((p) => (
                <div key={p.id} style={{ backgroundColor: '#131b2e', border: p.patrocinado ? '2px solid #10b981' : '1px solid #1e293b', borderRadius: '16px', overflow: 'hidden' }}>
                  <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid #1e293b' }}>
                    <img src={p.avatar} alt="Avatar" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #7c3aed' }} />
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <b style={{ color: '#fff', fontSize: '14px' }}>{p.autor}</b>
                        <span style={{ fontSize: '10px', color: '#a855f7', backgroundColor: '#2e1065', padding: '2px 6px', borderRadius: '4px' }}>{p.cargo}</span>
                        {p.patrocinado && <span style={{ fontSize: '10px', color: '#10b981', backgroundColor: '#064e3b', padding: '2px 6px', borderRadius: '4px' }}>PATROCINADO 🚀</span>}
                      </div>
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>{p.tempo}</span>
                    </div>
                  </div>

                  <div style={{ padding: '20px' }}>
                    <p style={{ fontSize: '14px', color: '#cbd5e1', lineHeight: '1.5', margin: 0 }}>{p.texto}</p>
                  </div>

                  {p.imagem && (
                    <div style={{ width: '100%', maxHeight: '400px', backgroundColor: '#000', overflow: 'hidden' }}>
                      <img src={p.imagem} alt="Mídia" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    </div>
                  )}

                  <div style={{ padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0f172a', borderTop: '1px solid #1e293b', fontSize: '12px' }}>
                    <button onClick={() => curtirPost(p.id)} style={{ background: 'none', border: 'none', color: p.curtido ? '#ef4444' : '#94a3b8', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>
                      {p.curtido ? '❤️' : '🤍'} {p.likes} Curtidas
                    </button>
                    
                    <button onClick={() => patrocinarPost(p.id)} style={{ backgroundColor: p.patrocinado ? '#064e3b' : '#1e293b', color: p.patrocinado ? '#34d399' : '#38bdf8', border: '1px solid #334155', padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>
                      {p.patrocinado ? '🚀 Impulsionado' : '🚀 Impulsionar Post'}
                    </button>
                  </div>
                </div>
              ))}
            </div>

          </div>
        ) : (
          <div style={{ backgroundColor: '#131b2e', border: '1px solid #1e293b', borderRadius: '16px', padding: '25px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#fff', marginBottom: '15px' }}>Top 10 Melhores Operadores</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {rankingOperadores.map((op) => (
                <div key={op.pos} style={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '10px', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <b style={{ fontSize: '14px', color: '#fff' }}>#{op.pos} - {op.nome}</b>
                    <span style={{ fontSize: '11px', color: '#c084fc', display: 'block' }}>{op.status}</span>
                  </div>
                  <span style={{ fontSize: '15px', fontWeight: 'bold', color: '#10b981' }}>{op.rentabilidade}</span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </main>
  );
}