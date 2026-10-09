'use client';
import { useState, useRef } from 'react';
import Link from 'next/link';

export default function SocialPage() {
  const [abaAtiva, setAbaAtiva] = useState('feed'); // 'feed', 'ranking'
  const [novoTexto, setNovoTexto] = useState('');
  const [imagemInput, setImagemInput] = useState('');
  const [tickerSelecionado, setTickerSelecionado] = useState(null);
  
  const [perfilAtivo, setPerfilAtivo] = useState(null);
  const [seguindoPerfis, setSeguindoPerfis] = useState({});
  const [storyAtivo, setStoryAtivo] = useState(null);

  const [usuarioLogado, setUsuarioLogado] = useState(true);
  const [nomeUsuario, setNomeUsuario] = useState('Paulo Stutz Netto');
  const [usuarioAssinado, setUsuarioAssinado] = useState(true);

  const fileInputRef = useRef(null);

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
      alert('🔒 Acesso restrito! Por favor, faça login ou crie a sua conta para aceder à Sala de Controlo.');
      window.location.href = '/login';
    } else {
      window.location.href = '/dashboard-logado';
    }
  };

  const tickerMacro = [
    { id: 1, rede: 'B3', tipo: '📊 MEGAPULSE', titulo: 'Ibovespa (IBOV): ▲ Alta Institucional (+1.2%)', detalhes: 'Fluxo de ordens institucionais indica forte acumulação no setor financeiro e commodities.' },
    { id: 2, rede: 'SOLANA', tipo: '🚀 TOKEN HFT', titulo: '$LTR-Prop: Volume +450% | Influxo Institucional', detalhes: 'Pools de liquidez na rede Solana registraram alta volatilidade com execução automática.' },
    { id: 3, rede: 'ETHEREUM', tipo: '🐋 BALEIA ETH', titulo: 'Acumulação de 15,000 ETH em carteira institucional', detalhes: 'Movimento de alocação de longo prazo detetado por smart contracts de custódia.' },
    { id: 4, rede: 'TRON', tipo: '⚡ USDT FLOW', titulo: 'Transferência maciça de US$ 85M para DEX de alta frequência', detalhes: 'Elevada liquidez cruzando redes com taxas otimizadas para arbitragem.' }
  ];

  const tickerDuplicado = [...tickerMacro, ...tickerMacro];

  const [stories, setStories] = useState([
    { id: 1, autor: 'Paulo (CEO)', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150', midia: 'https://images.unsplash.com/photo-1642543492481-44e81e3914a7?w=800', texto: 'Transmissão ao vivo do Robô HFT em execução na B3!' },
    { id: 2, autor: 'Carlos M.', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', midia: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800', texto: 'Análise de rompimento bem-sucedida no Mini-Índice.' },
    { id: 3, autor: 'Ana Paula S.', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150', midia: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=800', texto: 'Monitoramento de baleias na rede Solana.' }
  ]);

  const [noticiasMacro] = useState([
    { id: 1, hora: 'Há 5 mins', cat: 'GEOPOLÍTICA', titulo: 'Estreito de Ormuz: Ajuste no tráfego de petroleiros gera volatilidade', impacto: 'Alto Impacto no Petróleo' },
    { id: 2, hora: 'Há 25 mins', cat: 'COMMODITIES', titulo: 'Petróleo Brent registra alta acentuada com novos relatórios de oferta', impacto: 'Positivo para Energia' },
    { id: 3, hora: 'Há 50 mins', cat: 'POLÍTICA BRASIL', titulo: 'Novas diretrizes fiscais anunciadas pelo Banco Central impactam juros', impacto: 'Ajuste em Renda Fixa e Ibovespa' }
  ]);

  const [rankingOperadores] = useState([
    { pos: 1, nome: 'Carlos M.', cargo: 'Trader Pro', rentabilidade: '+ R$ 14.850', assertividade: '94%', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', status: '🏆 1º Lugar • Mensalidade Abonada', bio: 'Especialista em robôs HFT para Mini-Índice e Mini-Dólar com foco em proteção de drawdown.', seguidores: '1.4k', operacoesMes: 412 },
    { pos: 2, nome: 'Ana Paula S.', cargo: 'Institucional', rentabilidade: '+ R$ 11.200', assertividade: '91%', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150', status: '🥈 2º Lugar • Mensalidade Abonada', bio: 'Gestora de capital e arbitragem algorítmica em ativos multi-rede na Solana e B3.', seguidores: '1.2k', operacoesMes: 350 },
    { pos: 3, nome: 'Roberto Dias', cargo: 'Swing Trader', rentabilidade: '+ R$ 9.400', assertividade: '88%', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150', status: '🥉 3º Lugar • Mensalidade Abonada', bio: 'Focado em tendências de médio prazo e ações.', seguidores: '950', operacoesMes: 280 },
    { pos: 4, nome: 'Beatriz Lima', cargo: '@bialima', rentabilidade: '+28.9%', assertividade: '90%', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150', status: 'Frieza: 90/100', bio: 'Especialista em controlo emocional e robôs de proteção.', seguidores: '820', operacoesMes: 210 },
    { pos: 5, nome: 'Lucas Invest', cargo: '@lucasinv', rentabilidade: '+26.2%', assertividade: '89%', avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150', status: 'Frieza: 88/100', bio: 'Foco em criptoativos e tokens multi-rede.', seguidores: '740', operacoesMes: 190 },
    { pos: 6, nome: 'Renata Tech', cargo: '@renatatech', rentabilidade: '+24.0%', assertividade: '87%', avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150', status: 'Frieza: 87/100', bio: 'Desenvolvedora de estratégias HFT.', seguidores: '690', operacoesMes: 175 },
    { pos: 7, nome: 'Gabriel B3', cargo: '@gabrielb3', rentabilidade: '+21.8%', assertividade: '86%', avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150', status: 'Frieza: 85/100', bio: 'Operador de minicontratos na B3.', seguidores: '610', operacoesMes: 160 },
    { pos: 8, nome: 'Juliana Trade', cargo: '@julianatrade', rentabilidade: '+19.5%', assertividade: '84%', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150', status: 'Frieza: 84/100', bio: 'Estrategista de fluxo institucional.', seguidores: '550', operacoesMes: 140 },
    { pos: 9, nome: 'Thiago Alpha', cargo: '@thiagoalpha', rentabilidade: '+18.0%', assertividade: '82%', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', status: 'Frieza: 82/100', bio: 'Foco em rompimentos e volatilidade.', seguidores: '480', operacoesMes: 120 },
    { pos: 10, nome: 'Patricia Momentum', cargo: '@patimomentum', rentabilidade: '+16.4%', assertividade: '80%', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150', status: 'Frieza: 80/100', bio: 'Operadora de momentum e alocação.', seguidores: '420', operacoesMes: 95 }
  ]);

  const [posts, setPosts] = useState([
    { id: 1, autor: 'Carlos M. (Trader Pro)', cargo: 'ESTRATEGISTA HFT', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', texto: 'O Modo Reverso salvou-me hoje no Mini-Índice! Falso rompimento detectado em 128.500.', imagem: 'https://images.unsplash.com/photo-1642543492481-44e81e3914a7?w=800', tempo: 'Há 15 mins', likes: 34, curtido: false, estrategiaCopiada: false }
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
    if (!verificarAcessoOperacional('copiar esta estratégia')) return;
    setPosts(posts.map(p => p.id === id ? { ...p, estrategiaCopiada: true } : p));
    alert('⚡ Estratégia copiada com sucesso para o seu Robô HFT!');
  };return (
    <main style={{ backgroundColor: '#f1f5f9', color: '#0f172a', minHeight: '100vh', paddingBottom: '60px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes marquee { 0% { transform: translateX(0%); } 100% { transform: translateX(-50%); } }
        .ticker-container { overflow: hidden; white-space: nowrap; width: 100%; }
        .ticker-track { display: inline-flex; animation: marquee 30s linear infinite; }
        .ticker-track:hover { animation-play-state: paused; }
      ` }} />

      {/* Ticker Rotativo */}
      <div style={{ position: 'sticky', top: 0, zIndex: 9999, backgroundColor: '#0f172a', borderBottom: '1px solid #334155', padding: '10px 0', width: '100%', boxSizing: 'border-box' }} className="ticker-container">
        <div className="ticker-track">
          {tickerDuplicado.map((item, index) => (
            <div key={index} onClick={() => setTickerSelecionado(item)} style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', fontSize: '12px', cursor: 'pointer', padding: '0 30px', whiteSpace: 'nowrap' }}>
              <span style={{ backgroundColor: '#334155', color: '#34d399', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>{item.rede}</span>
              <span style={{ color: '#34d399', fontWeight: 'bold', fontFamily: 'monospace' }}>{item.tipo}:</span>
              <span style={{ color: '#f8fafc', fontWeight: 'bold' }}>{item.titulo}</span>
              <span style={{ fontSize: '11px', color: '#c084fc', marginLeft: '6px', fontWeight: 'bold' }}>[Ver Sinal 🔍]</span>
            </div>
          ))}
        </div>
      </div>

      {/* Modal Ticker */}
      {tickerSelecionado && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.8)', zIndex: 10000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', maxWidth: '500px', width: '100%', padding: '25px', boxShadow: '0 25px 50px rgba(0,0,0,0.15)' }}>
            <h3 style={{ fontSize: '16px', color: '#0f172a', marginBottom: '12px', fontWeight: 'bold' }}>{tickerSelecionado.titulo}</h3>
            <p style={{ fontSize: '13px', color: '#475569', marginBottom: '20px' }}>{tickerSelecionado.detalhes}</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => { if (verificarAcessoOperacional('operar sinal')) window.location.href = '/mesa-operacao'; }} style={{ backgroundColor: '#10b981', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>⚡ Operar este Sinal</button>
              <button onClick={() => setTickerSelecionado(null)} style={{ backgroundColor: '#7c3aed', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* Visualizador de Stories (Estilo Instagram - Tela Cheia) */}
      {storyAtivo && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 20000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
          <div style={{ maxWidth: '420px', width: '100%', height: '80vh', backgroundColor: '#111827', borderRadius: '20px', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', border: '1px solid #334155' }}>
            <div style={{ padding: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 2, background: 'linear-gradient(to bottom, rgba(0,0,0,0.8), transparent)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <img src={storyAtivo.avatar} alt="Avatar" style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #7c3aed' }} />
                <b style={{ color: '#fff', fontSize: '14px' }}>{storyAtivo.autor}</b>
              </div>
              <button onClick={() => setStoryAtivo(null)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '20px', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
            </div>
            <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' }}>
              <img src={storyAtivo.midia} alt="Story Media" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <div style={{ position: 'absolute', bottom: '20px', left: '20px', right: '20px', backgroundColor: 'rgba(0,0,0,0.6)', padding: '12px', borderRadius: '10px', backdropFilter: 'blur(5px)' }}>
                <p style={{ color: '#fff', fontSize: '13px', margin: 0, textAlign: 'center' }}>{storyAtivo.texto}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Página de Perfil Completa */}
      {perfilAtivo && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.85)', zIndex: 15000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '20px', maxWidth: '650px', width: '100%', padding: '35px', boxShadow: '0 25px 50px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', gap: '20px', maxHeight: '90vh', overflowY: 'auto' }}>
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
                  if (verificarAcessoOperacional('copiar estratégia automaticamente')) {
                    alert(`Estratégia de ${perfilAtivo.nome} copiada para o seu Copy Trading automático!`);
                    setPerfilAtivo(null);
                  }
                }}
                style={{ flex: 1, backgroundColor: '#059669', color: '#fff', border: 'none', padding: '14px', borderRadius: '10px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}
              >
                ⚡ Copiar Estratégia (Copy)
              </button>
            </div>
            
            <button onClick={() => setPerfilAtivo(null)} style={{ backgroundColor: '#f1f5f9', color: '#0f172a', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}>
              ← Voltar ao Feed Principal
            </button>
          </div>
        </div>
      )}

      <div style={{ maxWidth: '1050px', margin: '0 auto', padding: '30px 20px 0 20px' }}>
        
        {/* Cabeçalho */}
        <div style={{ backgroundColor: '#ffffff', padding: '18px 24px', borderRadius: '16px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', flexWrap: 'wrap', gap: '15px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: '#7c3aed', color: '#fff', fontWeight: '900', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>J</div>
            <div>
              <span style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a', display: 'block' }}>JENIOS SOCIAL</span>
              <span style={{ fontSize: '10.5px', color: '#7c3aed', fontWeight: '700' }}>Olá, {nomeUsuario}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setAbaAtiva('feed')} style={{ backgroundColor: '#f1f5f9', color: '#334155', fontSize: '11px', fontWeight: 'bold', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', cursor: 'pointer' }}>
              🏠 Início
            </button>
            <button onClick={irParaSalaDeControle} style={{ backgroundColor: '#f1f5f9', color: '#0f172a', border: '1px solid #cbd5e1', fontSize: '11px', fontWeight: 'bold', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer' }}>
              Sala de Controlo
            </button>
          </div>
        </div>

        {/* Abas Principais */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '25px', flexWrap: 'wrap' }}>
          <button onClick={() => setAbaAtiva('feed')} style={{ padding: '10px 20px', borderRadius: '8px', border: abaAtiva === 'feed' ? '2px solid #7c3aed' : '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#0f172a', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}>
            📱 Feed Contínuo
          </button>
          <Link href="/tendencias" style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#059669', fontWeight: 'bold', fontSize: '12px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}>
            🚀 Hub de Tendências
          </Link>
          <button onClick={() => setAbaAtiva('ranking')} style={{ padding: '10px 20px', borderRadius: '8px', border: abaAtiva === 'ranking' ? '2px solid #f59e0b' : '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#0f172a', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}>
            🏆 Ranking Top 10
          </button>
        </div>

        {/* FEED */}
        {abaAtiva === 'feed' && (
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '25px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Stories / Status */}
              <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '16px 20px', display: 'flex', gap: '15px', overflowX: 'auto' }}>
                {stories.map((st) => (
                  <div key={st.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', minWidth: '64px' }} onClick={() => setStoryAtivo(st)}>
                    <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'linear-gradient(135deg, #7c3aed 0%, #ec4899 100%)', padding: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <img src={st.avatar} alt="Story" style={{ width: '52px', height: '52px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #fff' }} />
                    </div>
                    <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#0f172a', marginTop: '4px' }}>{st.autor.split(' ')[0]}</span>
                  </div>
                ))}
              </div>

              {/* Caixa de Post */}
              <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '24px' }}>
                <form onSubmit={publicarPost}>
                  <textarea value={novoTexto} onChange={(e) => setNovoTexto(e.target.value)} placeholder="Compartilhe uma análise, setup HFT ou visão de mercado..." style={{ width: '100%', height: '80px', backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '14px', fontSize: '13px', outline: 'none', boxSizing: 'border-box', marginBottom: '12px' }} />
                  
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '15px', flexWrap: 'wrap' }}>
                    <input type="text" value={imagemInput} onChange={(e) => setImagemInput(e.target.value)} placeholder="Link de imagem ou gráfico..." style={{ flex: 1, backgroundColor: '#f8fafc', color: '#0f172a', border: '1px solid #cbd5e1', padding: '10px 14px', borderRadius: '8px', fontSize: '12px', outline: 'none' }} />
                    <button type="button" onClick={() => alert('📸 Câmera ativada: Tire uma foto diretamente do seu dispositivo para postar!')} style={{ backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', padding: '10px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>📷 Tirar Foto</button>
                    <button type="button" onClick={() => alert('🔴 Transmissão ao vivo (Live) iniciada para a rede Jenios!')} style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', padding: '10px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>🔴 Iniciar Live</button>
                    <button type="button" onClick={() => alert('▶️ Vídeo do YouTube anexado com sucesso!')} style={{ backgroundColor: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', padding: '10px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>▶️ Subir YouTube</button>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <button type="button" onClick={() => alert('🚀 Publicação enviada para o programa de Impulsionamento Master!')} style={{ backgroundColor: '#f3e8ff', color: '#7c3aed', border: 'none', padding: '10px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>⭐ Impulsionar Post</button>
                    <button type="submit" style={{ backgroundColor: '#7c3aed', color: '#fff', border: 'none', padding: '12px 20px', borderRadius: '8px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}>Publicar Análise 🚀</button>
                  </div>
                </form>
              </div>

              {/* Posts */}
              {posts.map((p) => (
                <div key={p.id} style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', overflow: 'hidden' }}>
                  <div onClick={() => setPerfilAtivo(rankingOperadores[0])} style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid #e2e8f0', cursor: 'pointer' }}>
                    <img src={p.avatar} alt="Avatar" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} />
                    <div>
                      <b style={{ color: '#0f172a', fontSize: '14px' }}>{p.autor}</b>
                      <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>{p.tempo} • Ver Perfil Completo 🔍</span>
                    </div>
                  </div>
                  <div style={{ padding: '20px' }}><p style={{ fontSize: '13px', color: '#334155', margin: 0 }}>{p.texto}</p></div>
                  {p.imagem && (
                    <div style={{ width: '100%', maxHeight: '400px', backgroundColor: '#000', overflow: 'hidden' }}>
                      <img src={p.imagem} alt="Mídia" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    </div>
                  )}
                  <div style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0', fontSize: '12px' }}>
                    <button onClick={() => curtirPost(p.id)} style={{ background: 'none', border: 'none', color: p.curtido ? '#dc2626' : '#64748b', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>
                      {p.curtido ? '❤️' : '🤍'} {p.likes} Curtidas
                    </button>
                    <button onClick={() => copiarEstrategia(p.id)} style={{ backgroundColor: p.estrategiaCopiada ? '#059669' : '#7c3aed', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>
                      {p.estrategiaCopiada ? '⚡ Estratégia Copiada ✓' : '⚡ Copiar Estratégia'}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Coluna Direita (Notícias Macro & Top Traders) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Notícias Macro */}
              <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 6px 0' }}>🌐 Canal Oficial de Notícias Macro</h3>
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

              {/* Top Traders da Semana */}
              <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 6px 0' }}>🏆 Top Traders da Semana</h3>
                <p style={{ fontSize: '11px', color: '#64748b', margin: '0 0 14px 0' }}>Clique num operador para visitar o perfil e seguir.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {rankingOperadores.slice(0, 3).map((op) => (
                    <div key={op.pos} onClick={() => setPerfilAtivo(op)} style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
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

        {/* RANKING COMPLETO (Top 10) */}
        {abaAtiva === 'ranking' && (
          <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '30px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#0f172a', marginBottom: '6px' }}>Ranking Completo Top 10</h2>
            <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '20px' }}>Clique em qualquer operador para inspecionar métricas e perfil.</p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {rankingOperadores.map((op) => (
                <div key={op.pos} onClick={() => setPerfilAtivo(op)} style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <img src={op.avatar} alt="Avatar" style={{ width: '42px', height: '42px', borderRadius: '50%', objectFit: 'cover' }} />
                    <div>
                      <b style={{ fontSize: '14px', color: '#0f172a', display: 'block' }}>#{op.pos} - {op.nome} ({op.cargo})</b>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>{op.bio}</span>
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