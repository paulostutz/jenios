'use client';
import { useState, useRef } from 'react';
import Link from 'next/link';

export default function SocialPage() {
  const [abaAtiva, setAbaAtiva] = useState('feed'); // 'feed', 'ranking'
  const [novoTexto, setNovoTexto] = useState('');
  const [imagemInput, setImagemInput] = useState('');
  const [tickerSelecionado, setTickerSelecionado] = useState(null);
  
  // Estado para abrir a Página de Perfil Completa do Operador
  const [perfilAtivo, setPerfilAtivo] = useState(null);
  const [seguindoPerfis, setSeguindoPerfis] = useState({});

  // Controle de Sessão e Conta
  const [usuarioLogado, setUsuarioLogado] = useState(true);
  const [nomeUsuario, setNomeUsuario] = useState('Paulo Stutz Netto');
  const [usuarioAssinado, setUsuarioAssinado] = useState(true);

  const verificarAcessoOperacional = (acaoNome) => {
    if (!usuarioLogado) {
      alert('🔒 É necessário criar uma conta ou fazer login para operar este sinal.');
      window.location.href = '/login';
      return false;
    }
    if (!usuarioAssinado) {
      const confirmar = confirm(`⚡ Para ${acaoNome}, você precisa ativar um dos planos profissionais (com 7 dias de teste grátis).\n\nDeseja ir para a página de planos e abrir/ativar sua conta?`);
      if (confirmar) {
        window.location.href = '/planos';
      }
      return false;
    }
    return true;
  };

  const irParaSalaDeControle = () => {
    if (!usuarioLogado) {
      alert('🔒 Acesso restrito! Por favor, faça login ou crie a sua conta para aceder à Sala de Controle.');
      window.location.href = '/login';
    } else {
      window.location.href = '/dashboard-logado';
    }
  };

  // Tickers Multichain (Solana, Ethereum, TRON, B3)
  const tickerMacro = [
    { 
      id: 1, 
      rede: 'B3',
      tipo: '📊 MEGAPULSE', 
      titulo: 'Ibovespa (IBOV): ▲ Alta Institucional (+1.2%)', 
      detalhes: 'Fluxo de ordens institucionais indica forte acumulação no setor financeiro e commodities. Entrada de capital estrangeiro de R$ 1.2B.' 
    },
    { 
      id: 2, 
      rede: 'SOLANA',
      tipo: '🚀 TOKEN HFT', 
      titulo: '$LTR-Prop: Volume +450% | Influxo Institucional', 
      detalhes: 'Pools de liquidez na rede Solana registraram alta volatilidade com execução automática de contratos inteligentes validados.' 
    },
    { 
      id: 3, 
      rede: 'ETHEREUM',
      tipo: '🐋 BALEIA ETH', 
      titulo: 'Acumulação de 15,000 ETH em carteira institucional', 
      detalhes: 'Movimento de alocação de longo prazo detetado por smart contracts de custódia institucional.' 
    },
    { 
      id: 4, 
      rede: 'TRON',
      tipo: '⚡ USDT FLOW', 
      titulo: 'Transferência maciça de US$ 85M para DEX de alta frequência', 
      detalhes: 'Elevada liquidez cruzando redes com taxas otimizadas para arbitragem.' 
    }
  ];

  const tickerDuplicado = [...tickerMacro, ...tickerMacro];

  // Canal de Notícias Macro em Tempo Real
  const [noticiasMacro] = useState([
    { id: 1, hora: 'Há 5 mins', cat: 'GEOPOLÍTICA', titulo: 'Estreito de Ormuz: Ajuste no tráfego de petroleiros gera volatilidade nas commodities', impacto: 'Alto Impacto no Petróleo' },
    { id: 2, hora: 'Há 25 mins', cat: 'COMMODITIES', titulo: 'Petróleo Brent registra alta acentuada com novos relatórios de oferta global', impacto: 'Positivo para Papéis de Energia' },
    { id: 3, hora: 'Há 50 mins', cat: 'POLÍTICA BRASIL', titulo: 'Novas diretrizes fiscais anunciadas pelo Banco Central impactam curva de juros', impacto: 'Ajuste em Renda Fixa e Ibovespa' }
  ]);

  const [posts, setPosts] = useState([
    { 
      id: 1, 
      autor: 'Carlos M. (Trader Pro)', 
      cargo: 'ESTRATEGISTA HFT', 
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
      texto: 'O Modo Reverso salvou-me hoje no Mini-Índice! Falso rompimento detectado em 128.500 e o robô inverteu o meu clique emocional gerando +R$ 820,00 protegidos.', 
      imagem: 'https://images.unsplash.com/photo-1642543492481-44e81e3914a7?w=800',
      tempo: 'Há 15 mins', 
      likes: 34, 
      curtido: false,
      estrategiaCopiada: false
    }
  ]);

  const [rankingOperadores] = useState([
    { 
      id: 1, 
      pos: 1, 
      nome: 'Carlos M.', 
      cargo: 'Trader Pro', 
      rentabilidade: '+ R$ 14.850', 
      assertividade: '94%', 
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', 
      status: '🏆 1º Lugar • Mensalidade Abonada', 
      bio: 'Especialista em robôs HFT para Mini-Índice e Mini-Dólar com foco em proteção de drawdown.', 
      seguidores: '1.4k',
      operacoesMes: 412 
    },
    { 
      id: 2, 
      pos: 2, 
      nome: 'Ana Paula S.', 
      cargo: 'Institucional', 
      rentabilidade: '+ R$ 11.200', 
      assertividade: '91%', 
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150', 
      status: '🥈 2º Lugar • Mensalidade Abonada', 
      bio: 'Gestora de capital e arbitragem algorítmica em ativos multi-rede na Solana e B3.', 
      seguidores: '1.2k',
      operacoesMes: 350 
    }
  ]);

  const publicarPost = (e) => {
    e.preventDefault();
    if (!novoTexto.trim() && !imagemInput.trim()) return;
    setPosts([{ 
      id: Date.now(), 
      autor: usuarioLogado ? nomeUsuario : 'Visitante Anônimo', 
      cargo: 'MEMBRO', 
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
      texto: novoTexto, 
      imagem: imagemInput,
      tempo: 'Agora mesmo', 
      likes: 1, 
      curtido: false,
      estrategiaCopiada: false
    }, ...posts]);
    setNovoTexto('');
    setImagemInput('');
  };

  const curtirPost = (id) => {
    setPosts(posts.map(p => p.id === id ? { ...p, likes: p.curtido ? p.likes - 1 : p.likes + 1, curtido: !p.curtido } : p));
  };

  const copiarEstrategia = (id) => {
    if (!verificarAcessoRestrito('copiar esta estratégia e automatizar no seu robô')) return;
    setPosts(posts.map(p => p.id === id ? { ...p, estrategiaCopiada: true } : p));
    alert('⚡ Estratégia de Copy Trading copiada com sucesso para o seu Robô HFT!');
  };

  return (
    <main style={{ backgroundColor: '#f1f5f9', color: '#0f172a', minHeight: '100vh', paddingBottom: '60px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', boxSizing: 'border-box', width: '100%', position: 'relative' }}>
      
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
          animation: marquee 30s linear infinite;
        }
        .ticker-track:hover {
          animation-play-state: paused;
        }
      ` }} />

      {/* Ticker Rotativo de Mercado Multichain */}
      <div style={{ position: 'sticky', top: 0, zIndex: 9999, backgroundColor: '#0f172a', borderBottom: '1px solid #334155', padding: '10px 0', width: '100%', boxSizing: 'border-box' }} className="ticker-container">
        <div className="ticker-track">
          {tickerDuplicado.map((item, index) => (
            <div 
              key={index} 
              onClick={() => setTickerSelecionado(item)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', fontSize: '12px', cursor: 'pointer', padding: '0 30px', whiteSpace: 'nowrap' }}
            >
              <span style={{ backgroundColor: '#334155', color: '#34d399', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>{item.rede}</span>
              <span style={{ color: '#34d399', fontWeight: 'bold', fontFamily: 'monospace' }}>{item.tipo}:</span>
              <span style={{ color: '#f8fafc', fontWeight: 'bold' }}>{item.titulo}</span>
              <span style={{ fontSize: '11px', color: '#c084fc', marginLeft: '6px', fontWeight: 'bold' }}>[Ver Sinal 🔍]</span>
            </div>
          ))}
        </div>
      </div>

      {/* Modal de Detalhes do Sinal / Ticker */}
      {tickerSelecionado && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.8)', zIndex: 10000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
          <div style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '16px', maxWidth: '500px', width: '100%', padding: '25px', boxShadow: '0 25px 50px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
              <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#059669', fontFamily: 'monospace' }}>{tickerSelecionado.tipo} ({tickerSelecionado.rede})</span>
              <button onClick={() => setTickerSelecionado(null)} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '18px', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
            </div>
            <h3 style={{ fontSize: '16px', color: '#0f172a', marginBottom: '12px', fontWeight: 'bold' }}>{tickerSelecionado.titulo}</h3>
            <p style={{ fontSize: '13px', color: '#475569', lineHeight: '1.6', marginBottom: '20px' }}>{tickerSelecionado.detalhes}</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button 
                onClick={() => {
                  if (verificarAcessoOperacional('operar com base neste sinal')) {
                    window.location.href = '/mesa-operacao';
                  }
                }}
                style={{ backgroundColor: '#10b981', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                ⚡ Operar este Sinal
              </button>
              <button onClick={() => setTickerSelecionado(null)} style={{ backgroundColor: '#7c3aed', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Página de Perfil Completa do Operador */}
      {perfilAtivo && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.85)', zIndex: 10000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px', boxSizing: 'border-box' }}>
          <div style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '20px', maxWidth: '650px', width: '100%', padding: '35px', boxShadow: '0 25px 50px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', gap: '20px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 'bold', fontFamily: 'monospace' }}>PERFIL OFICIAL DO ESTRATEGISTA</span>
              <button onClick={() => setPerfilAtivo(null)} style={{ backgroundColor: '#f1f5f9', color: '#0f172a', border: 'none', width: '36px', height: '36px', borderRadius: '50%', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
              <img src={perfilAtivo.avatar} alt="Avatar" style={{ width: '85px', height: '85px', borderRadius: '50%', objectFit: 'cover', border: '3px solid #7c3aed' }} />
              <div>
                <h2 style={{ fontSize: '22px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>{perfilAtivo.nome}</h2>
                <span style={{ fontSize: '13px', color: '#7c3aed', fontWeight: 'bold' }}>{perfilAtivo.cargo || perfilAtivo.status}</span>
                <p style={{ fontSize: '12px', color: '#64748b', marginTop: '6px', margin: 0 }}>{perfilAtivo.bio}</p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', backgroundColor: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
              <div>
                <span style={{ fontSize: '10px', color: '#64748b', display: 'block', fontWeight: 'bold' }}>RENTABILIDADE</span>
                <b style={{ fontSize: '16px', color: '#059669' }}>{perfilAtivo.rentabilidade}</b>
              </div>
              <div>
                <span style={{ fontSize: '10px', color: '#64748b', display: 'block', fontWeight: 'bold' }}>ASSERTIVIDADE</span>
                <b style={{ fontSize: '16px', color: '#0284c7' }}>{perfilAtivo.assertividade}</b>
              </div>
              <div>
                <span style={{ fontSize: '10px', color: '#64748b', display: 'block', fontWeight: 'bold' }}>SEGUIDORES</span>
                <b style={{ fontSize: '16px', color: '#7c3aed' }}>{perfilAtivo.seguidores}</b>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                onClick={() => setSeguindoPerfis(prev => ({ ...prev, [perfilAtivo.nome]: !prev[perfilAtivo.nome] }))}
                style={{ flex: 1, backgroundColor: seguindoPerfis[perfilAtivo.nome] ? '#64748b' : '#7c3aed', color: '#fff', border: 'none', padding: '14px', borderRadius: '10px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}
              >
                {seguindoPerfis[perfilAtivo.nome] ? 'Seguindo Estrategista ✓' : 'Seguir Estrategista'}
              </button>
              <button 
                onClick={() => {
                  if (verificarAcessoRestrito('copiar estratégia automaticamente')) {
                    alert(`Estratégia de ${perfilAtivo.nome} copiada para o seu Copy Trading automático!`);
                    setPerfilAtivo(null);
                  }
                }}
                style={{ flex: 1, backgroundColor: '#059669', color: '#fff', border: 'none', padding: '14px', borderRadius: '10px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}
              >
                ⚡ Copiar Estratégia (Copy)
              </button>
            </div>
            
            <button 
              onClick={() => setPerfilAtivo(null)} 
              style={{ backgroundColor: '#f1f5f9', color: '#0f172a', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}
            >
              ← Voltar ao Feed Principal
            </button>
          </div>
        </div>
      )}

      <div style={{ maxWidth: '1050px', margin: '0 auto', padding: '30px 20px 0 20px' }}>
        
        {/* Cabeçalho */}
        <div style={{ backgroundColor: '#ffffff', color: '#0f172a', padding: '18px 24px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 10px 25px rgba(0,0,0,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', flexWrap: 'wrap', gap: '15px' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)', color: '#fff', fontWeight: '900', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 15px rgba(124, 58, 237, 0.3)' }}>
              J
            </div>
            <div>
              <span style={{ fontSize: '13px', fontWeight: '800', letterSpacing: '0.5px', color: '#0f172a', display: 'block' }}>JENIOS SOCIAL</span>
              <span style={{ fontSize: '10.5px', color: '#7c3aed', fontWeight: '700' }}>{usuarioLogado ? `Olá, ${nomeUsuario}` : '● Comunidade & Copy Trading'}</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <Link href="/dashboard-logado" style={{ backgroundColor: '#f1f5f9', color: '#334155', textDecoration: 'none', fontSize: '11px', fontWeight: 'bold', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', whiteSpace: 'nowrap' }}>
              👤 Meu Perfil / Início
            </Link>

            <button onClick={irParaSalaDeControle} style={{ backgroundColor: '#f1f5f9', color: '#0f172a', border: '1px solid #cbd5e1', fontSize: '11px', fontWeight: 'bold', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              Sala de Controle
            </button>

            {!usuarioLogado ? (
              <Link href="/login" style={{ backgroundColor: '#7c3aed', color: '#fff', textDecoration: 'none', fontSize: '11px', fontWeight: 'bold', padding: '8px 14px', borderRadius: '8px', boxShadow: '0 4px 15px rgba(124, 58, 237, 0.3)', whiteSpace: 'nowrap' }}>
                Entrar / Criar Conta
              </Link>
            ) : (
              <button 
                onClick={() => setUsuarioAssinado(!usuarioAssinado)} 
                style={{ backgroundColor: usuarioAssinado ? '#059669' : '#10b981', color: '#fff', border: 'none', fontSize: '11px', fontWeight: 'bold', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 4px 15px rgba(5, 150, 105, 0.3)' }}
              >
                {usuarioAssinado ? 'Plano Ativo ✓' : 'Assinar Plano (7d)'}
              </button>
            )}
          </div>
        </div>

        {/* Abas Principais (Com Botão TENDÊNCIAS) */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '25px', flexWrap: 'wrap' }}>
          <button onClick={() => setAbaAtiva('feed')} style={{ padding: '10px 20px', borderRadius: '8px', border: abaAtiva === 'feed' ? '2px solid #7c3aed' : '1px solid #cbd5e1', backgroundColor: abaAtiva === 'feed' ? '#ffffff' : '#f1f5f9', color: '#0f172a', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}>
            📱 Feed Contínuo
          </button>
          
          <Link href="/tendencias" style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#059669', fontWeight: 'bold', fontSize: '12px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}>
            🚀 Hub de Tendências & Ativos
          </Link>

          <button onClick={() => setAbaAtiva('ranking')} style={{ padding: '10px 20px', borderRadius: '8px', border: abaAtiva === 'ranking' ? '2px solid #f59e0b' : '1px solid #cbd5e1', backgroundColor: abaAtiva === 'ranking' ? '#ffffff' : '#f1f5f9', color: '#0f172a', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}>
            🏆 Ranking Top 10
          </button>
        </div>

        {/* CONTEÚDO DA ABA FEED */}
        {abaAtiva === 'feed' && (
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '25px' }}>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Stories / Status (Estilo Instagram) */}
              <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '16px 20px', display: 'flex', gap: '15px', overflowX: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', minWidth: '64px' }} onClick={() => alert('Abrir Story: Transmissão ao vivo do Robô HFT em execução!')}>
                  <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'linear-gradient(135deg, #7c3aed 0%, #ec4899 100%)', padding: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <img src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150" alt="Story" style={{ width: '52px', height: '52px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #fff' }} />
                  </div>
                  <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#0f172a', marginTop: '4px' }}>Paulo (CEO)</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', minWidth: '64px' }} onClick={() => alert('Abrir Story: Análise de Rompimento Mini-Dólar')}>
                  <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'linear-gradient(135deg, #7c3aed 0%, #ec4899 100%)', padding: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150" alt="Story" style={{ width: '52px', height: '52px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #fff' }} />
                  </div>
                  <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#0f172a', marginTop: '4px' }}>Carlos M.</span>
                </div>
              </div>

              {/* Caixa de Criação de Post (Câmera, Lives, YouTube e Impulsionamento) */}
              <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '24px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)' }}>
                <form onSubmit={publicarPost}>
                  <textarea 
                    value={novoTexto} 
                    onChange={(e) => setNovoTexto(e.target.value)} 
                    placeholder="Compartilhe uma análise, setup HFT ou visão de mercado..." 
                    style={{ width: '100%', height: '80px', backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '10px', color: '#0f172a', padding: '14px', fontSize: '13px', outline: 'none', boxSizing: 'border-box', resize: 'none', marginBottom: '12px' }} 
                  />
                  
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '15px', flexWrap: 'wrap' }}>
                    <input 
                      type="text" 
                      value={imagemInput} 
                      onChange={(e) => setImagemInput(e.target.value)} 
                      placeholder="Link de imagem ou gráfico..." 
                      style={{ flex: 1, backgroundColor: '#f8fafc', color: '#0f172a', border: '1px solid #cbd5e1', padding: '10px 14px', borderRadius: '8px', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }} 
                    />
                    <button type="button" onClick={() => alert('📸 Câmera ativada: Tire uma foto diretamente do seu dispositivo para postar!')} style={{ backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', padding: '10px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
                      📷 Tirar Foto
                    </button>
                    <button type="button" onClick={() => alert('🔴 Transmissão ao vivo (Live) iniciada para a rede Jenios!')} style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', padding: '10px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
                      🔴 Iniciar Live
                    </button>
                    <button type="button" onClick={() => alert('▶️ Vídeo do YouTube anexado com sucesso!')} style={{ backgroundColor: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', padding: '10px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
                      ▶️ Subir YouTube
                    </button>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <button type="button" onClick={() => alert('🚀 Publicação enviada para o programa de Impulsionamento Master!')} style={{ backgroundColor: '#f3e8ff', color: '#7c3aed', border: 'none', padding: '10px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
                      ⭐ Impulsionar Post
                    </button>
                    <button type="submit" style={{ backgroundColor: '#7c3aed', color: '#fff', border: 'none', padding: '12px 20px', borderRadius: '8px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)' }}>
                      Publicar Análise 🚀
                    </button>
                  </div>
                </form>
              </div>

              {/* FEED */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {posts.map((p) => (
                  <div key={p.id} style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 10px 25px rgba(0,0,0,0.05)' }}>
                    
                    <div 
                      onClick={() => setPerfilAtivo(rankingOperadores[0])}
                      style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid #e2e8f0', cursor: 'pointer', backgroundColor: '#ffffff' }}
                    >
                      <img src={p.avatar} alt="Avatar" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #7c3aed' }} />
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <b style={{ color: '#0f172a', fontSize: '14px' }}>{p.autor}</b>
                          <span style={{ fontSize: '9px', color: '#7c3aed', backgroundColor: '#f3e8ff', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', fontFamily: 'monospace' }}>{p.cargo}</span>
                        </div>
                        <span style={{ fontSize: '11px', color: '#64748b' }}>{p.tempo} • Ver Perfil Completo 🔍</span>
                      </div>
                    </div>

                    <div style={{ padding: '20px' }}>
                      <p style={{ fontSize: '13px', color: '#334155', lineHeight: '1.6', margin: 0 }}>{p.texto}</p>
                    </div>

                    {p.imagem && (
                      <div style={{ width: '100%', maxHeight: '400px', backgroundColor: '#000', overflow: 'hidden' }}>
                        <img src={p.imagem} alt="Mídia" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      </div>
                    )}

                    <div style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0', fontSize: '12px' }}>
                      <button onClick={() => curtirPost(p.id)} style={{ background: 'none', border: 'none', color: p.curtido ? '#dc2626' : '#64748b', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>
                        {p.curtido ? '❤️' : '🤍'} {p.likes} Curtidas
                      </button>

                      <button 
                        onClick={() => copiarEstrategia(p.id)} 
                        style={{ backgroundColor: p.estrategiaCopiada ? '#059669' : '#7c3aed', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 10px rgba(124, 58, 237, 0.2)' }}
                      >
                        {p.estrategiaCopiada ? '⚡ Estratégia Copiada ✓' : '⚡ Copiar Estratégia'}
                      </button>
                    </div>

                  </div>
                ))}
              </div>

            </div>

            {/* Coluna Direita: Notícias Macro em Tempo Real & Top Traders */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Notícias Macro em Tempo Real */}
              <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#0f172a', margin: 0, marginBottom: '6px' }}>🌐 Canal Oficial de Notícias Macro</h3>
                <p style={{ fontSize: '11px', color: '#64748b', margin: '0 0 14px 0' }}>Atualizações em tempo real com impacto direto no mercado.</p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {noticiasMacro.map((n) => (
                    <div key={n.id} style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#7c3aed', backgroundColor: '#f3e8ff', padding: '2px 6px', borderRadius: '4px' }}>{n.cat}</span>
                        <span style={{ fontSize: '10px', color: '#64748b' }}>{n.hora}</span>
                      </div>
                      <h4 style={{ fontSize: '12px', color: '#0f172a', margin: '0 0 6px 0', fontWeight: 'bold' }}>{n.titulo}</h4>
                      <span style={{ fontSize: '10px', color: '#059669', fontWeight: 'bold' }}>Impacto: {n.impacto}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top Traders */}
              <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#0f172a', margin: 0, marginBottom: '6px' }}>🏆 Top Traders da Semana</h3>
                <p style={{ fontSize: '11px', color: '#64748b', margin: '0 0 14px 0' }}>Clique num operador para abrir o perfil oficial.</p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {rankingOperadores.map((op) => (
                    <div 
                      key={op.pos} 
                      onClick={() => setPerfilAtivo(op)}
                      style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <img src={op.avatar} alt="Avatar" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
                        <div>
                          <b style={{ fontSize: '12px', color: '#0f172a', display: 'block' }}>{op.pos}º - {op.nome}</b>
                          <span style={{ fontSize: '10px', color: '#059669', fontWeight: 'bold' }}>{op.rentabilidade}</span>
                        </div>
                      </div>
                      <span style={{ fontSize: '10px', color: '#7c3aed', backgroundColor: '#ede9fe', padding: '4px 8px', borderRadius: '6px', fontWeight: 'bold' }}>Ver →</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>

          </div>
        )}

        {/* CONTEÚDO DA ABA RANKING */}
        {abaAtiva === 'ranking' && (
          <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '30px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#0f172a', marginBottom: '6px' }}>Ranking Completo Top 10</h2>
            <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '20px' }}>Clique em qualquer operador para abrir o perfil oficial.</p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {rankingOperadores.map((op) => (
                <div 
                  key={op.pos} 
                  onClick={() => setPerfilAtivo(op)}
                  style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <img src={op.avatar} alt="Avatar" style={{ width: '42px', height: '42px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #7c3aed' }} />
                    <div>
                      <b style={{ fontSize: '14px', color: '#0f172a', display: 'block' }}>#{op.pos} - {op.nome}</b>
                      <span style={{ fontSize: '11px', color: '#7c3aed', display: 'block' }}>{op.status}</span>
                    </div>
                  </div>
                  <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#059669' }}>{op.rentabilidade}</span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </main>
  );
}