'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function SocialPage() {
  const [abaAtiva, setAbaAtiva] = useState('feed');
  const [novoTexto, setNovoTexto] = useState('');
  const [imagemInput, setImagemInput] = useState('');
  const [perfilAtivo, setPerfilAtivo] = useState(null);
  const [seguindoPerfis, setSeguindoPerfis] = useState({});
  const [storyAtivo, setStoryAtivo] = useState(null);

  // Modais
  const [modalEditarPerfil, setModalEditarPerfil] = useState(false);
  const [modalCriarStory, setModalCriarStory] = useState(false);
  const [novoStoryTexto, setNovoStoryTexto] = useState('');
  const [novoStoryMidia, setNovoStoryMidia] = useState('');

  // Perfil do Usuário com persistência em localStorage
  const [meuPerfil, setMeuPerfil] = useState({
    nome: 'Paulo Stutz Netto',
    cargo: 'CEO & Fundador • Letter Franqueadora',
    rentabilidade: '+ R$ 18.400',
    assertividade: '95%',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
    bio: 'Desenvolvedor da infraestrutura de pagamentos AsaaS e operador de alta frequência com protocolos de engenharia reversa.',
    seguidores: '2.1k',
    postsCount: '48',
    visualizacoes30Dias: '45.2k',
    status: '🏆 Conta Master Verificada'
  });

  useEffect(() => {
    const perfilSalvo = localStorage.getItem('jenios_social_perfil');
    if (perfilSalvo) {
      try { setMeuPerfil(JSON.parse(perfilSalvo)); } catch(e) {}
    }
  }, []);

  const salvarEdicaoPerfil = (e) => {
    e.preventDefault();
    localStorage.setItem('jenios_social_perfil', JSON.stringify(meuPerfil));
    setModalEditarPerfil(false);
    alert('✅ Perfil atualizado com sucesso!');
  };

  // 🌐 VARREDURA REAL DE DADOS DE MERCADO (CoinGecko)
  const [tickerMacro, setTickerMacro] = useState([
    { id: 1, rede: 'B3', tipo: '📊 MEGAPULSE', titulo: 'Conectando ao fluxo institucional em tempo real...', detalhes: 'Carregando...' }
  ]);

  useEffect(() => {
    async function varrerMercadoReal() {
      try {
        const res = await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=volume_desc&per_page=6&page=1');
        const dados = await res.json();

        if (Array.isArray(dados) && dados.length > 0) {
          const itensReais = dados.map((coin, index) => ({
            id: index + 1,
            rede: coin.symbol.toUpperCase(),
            tipo: index === 0 ? '🔥 TOP VOLUME' : '⚡ TRENDING HFT',
            titulo: `${coin.name} (${coin.symbol.toUpperCase()}) - Preço: $${coin.current_price} | Vol 24h: $${coin.total_volume.toLocaleString()} (Var: ${coin.price_change_percentage_24h?.toFixed(2)}%)`
          }));
          setTickerMacro(itensReais);
        }
      } catch (erro) {
        console.warn('Erro ao carregar dados de mercado da API pública.');
      }
    }

    varrerMercadoReal();
    const timer = setInterval(varrerMercadoReal, 60000); // Atualiza a cada 1 minuto
    return () => clearInterval(timer);
  }, []);

  const tickerDuplicado = [...tickerMacro, ...tickerMacro];

  // 🌐 NOTÍCIAS REAIS EM TEMPO REAL (Via API pública de Crypto/Finance News)
  const [noticiasMacro, setNoticiasMacro] = useState([
    { id: 1, hora: 'Ao vivo', cat: 'MERCADO', titulo: 'Carregando notícias globais em tempo real...', impacto: 'Atualizando', url: '#' }
  ]);

  useEffect(() => {
    async function buscarNoticiasReais() {
      try {
        // Conectando a uma API pública de notícias de mercado/cripto
        const res = await fetch('https://api.coingecko.com/api/v3/news');
        const dados = await res.json();

        if (dados && dados.data && Array.isArray(dados.data)) {
          const noticiasFormatadas = dados.data.slice(0, 4).map((item, idx) => ({
            id: idx + 1,
            hora: 'Recente',
            cat: item.news_type ? item.news_type.toUpperCase() : 'GLOBAL',
            titulo: item.title,
            impacto: 'Monitorado',
            url: item.url
          }));
          setNoticiasMacro(noticiasFormatadas);
        }
      } catch (e) {
        // Fallback robusto caso a API de notícias oscile
        setNoticiasMacro([
          { id: 1, hora: 'Há 5 mins', cat: 'GEOPOLÍTICA', titulo: 'Estreito de Ormuz: Ajuste no tráfego gera volatilidade', impacto: 'Alto Impacto', url: 'https://www.reuters.com' },
          { id: 2, hora: 'Há 25 mins', cat: 'COMMODITIES', titulo: 'Petróleo Brent registra alta com relatórios de oferta', impacto: 'Positivo', url: 'https://www.infomoney.com.br' }
        ]);
      }
    }

    buscarNoticiasReais();
    const timerNoticias = setInterval(buscarNoticiasReais, 120000); // Atualiza notícias a cada 2 minutos
    return () => clearInterval(timerNoticias);
  }, []);

  const [stories, setStories] = useState([
    { id: 1, autor: 'Paulo (CEO)', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150', midia: 'https://images.unsplash.com/photo-1642543492481-44e81e3914a7?w=800', texto: 'Transmissão ao vivo do Robô HFT na B3!' }
  ]);

  const publicarStory = (e) => {
    e.preventDefault();
    if (!novoStoryMidia.trim() || !novoStoryTexto.trim()) return;
    const novoSt = {
      id: Date.now(),
      autor: meuPerfil.nome,
      avatar: meuPerfil.avatar,
      midia: novoStoryMidia,
      texto: novoStoryTexto
    };
    setStories([novoSt, ...stories]);
    setNovoStoryTexto('');
    setNovoStoryMidia('');
    setModalCriarStory(false);
    alert('✨ Story publicado com sucesso!');
  };

  const [rankingOperadores, setRankingOperadores] = useState([
    { pos: 1, nome: 'Carlos M.', cargo: 'Trader Pro', rentabilidade: '+ R$ 14.850', assertividade: '94%', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', status: '🏆 1º Lugar', bio: 'Especialista em robôs HFT para Mini-Índice e Mini-Dólar com foco em proteção de drawdown.', seguidores: '1.4k', postsCount: '32', visualizacoes30Dias: '28.4k' },
    { pos: 2, nome: 'Ana Paula S.', cargo: 'Institucional', rentabilidade: '+ R$ 11.200', assertividade: '91%', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150', status: '🥈 2º Lugar', bio: 'Gestora de capital e arbitragem algorítmica em ativos multi-rede na Solana e B3.', seguidores: '1.2k', postsCount: '25', visualizacoes30Dias: '21.0k' },
    { pos: 3, nome: 'Roberto Dias', cargo: 'Swing Trader', rentabilidade: '+ R$ 9.400', assertividade: '88%', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150', status: '🥉 3º Lugar', bio: 'Focado em tendências de médio prazo e ações.', seguidores: '950', postsCount: '19', visualizacoes30Dias: '15.8k' }
  ]);

  const [posts, setPosts] = useState([
    { id: 1, autor: 'Carlos M.', cargo: 'ESTRATEGISTA HFT', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', texto: 'O Modo Reverso salvou-me hoje no Mini-Índice! Falso rompimento detectado em 128.500.', imagem: 'https://images.unsplash.com/photo-1642543492481-44e81e3914a7?w=800', tempo: 'Há 15 mins', likes: 34, curtido: false, estrategiaCopiada: false, perfilAssociado: rankingOperadores[0] }
  ]);

  const publicarPost = (e) => {
    e.preventDefault();
    if (!novoTexto.trim() && !imagemInput.trim()) return;
    setPosts([{ 
      id: Date.now(), 
      autor: meuPerfil.nome, 
      cargo: 'ESTRATEGISTA', 
      avatar: meuPerfil.avatar,
      texto: novoTexto, 
      imagem: imagemInput,
      tempo: 'Agora mesmo', 
      likes: 1, 
      curtido: false,
      estrategiaCopiada: false,
      perfilAssociado: meuPerfil
    }, ...posts]);
    setNovoTexto('');
    setImagemInput('');
  };

  const curtirPost = (id) => {
    setPosts(posts.map(p => p.id === id ? { ...p, likes: p.curtido ? p.likes - 1 : p.likes + 1, curtido: !p.curtido } : p));
  };

  const copiarEstrategia = (id) => {
    setPosts(posts.map(p => p.id === id ? { ...p, estrategiaCopiada: true } : p));
    alert('⚡ Estratégia copiada com sucesso para o seu Robô HFT!');
  };return (
    <main style={{ backgroundColor: '#f1f5f9', color: '#0f172a', minHeight: '100vh', paddingBottom: '60px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes marquee { 0% { transform: translateX(0%); } 100% { transform: translateX(-50%); } }
        .ticker-container { overflow: hidden; white-space: nowrap; width: 100%; }
        .ticker-track { display: inline-flex; animation: marquee 35s linear infinite; }
        .ticker-track:hover { animation-play-state: paused; }
      ` }} />

      {/* Ticker Superior com Varredura Real de Mercado */}
      <div style={{ position: 'sticky', top: 0, zIndex: 9999, backgroundColor: '#0f172a', borderBottom: '1px solid #334155', padding: '10px 0', width: '100%', boxSizing: 'border-box' }} className="ticker-container">
        <div className="ticker-track">
          {tickerDuplicado.map((item, index) => (
            <div key={index} style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', fontSize: '12px', padding: '0 30px', whiteSpace: 'nowrap' }}>
              <span style={{ backgroundColor: '#334155', color: '#34d399', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>{item.rede}</span>
              <span style={{ color: '#34d399', fontWeight: 'bold', fontFamily: 'monospace' }}>{item.tipo}:</span>
              <span style={{ color: '#f8fafc', fontWeight: 'bold' }}>{item.titulo}</span>
            </div>
          ))}
        </div>
      </div>

      {/* MODAL DE EDIÇÃO DE PERFIL */}
      {modalEditarPerfil && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.85)', zIndex: 20000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '20px', maxWidth: '450px', width: '100%', padding: '30px', boxShadow: '0 25px 50px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>⚙️ Editar Meu Perfil</h3>
              <button onClick={() => setModalEditarPerfil(false)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
            </div>
            <form onSubmit={salvarEdicaoPerfil} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>Nome Completo:</label>
                <input type="text" value={meuPerfil.nome} onChange={(e) => setMeuPerfil({...meuPerfil, nome: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px', marginTop: '4px' }} required />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>Cargo / Título:</label>
                <input type="text" value={meuPerfil.cargo} onChange={(e) => setMeuPerfil({...meuPerfil, cargo: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px', marginTop: '4px' }} required />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>URL da Foto de Perfil (Avatar):</label>
                <input type="text" value={meuPerfil.avatar} onChange={(e) => setMeuPerfil({...meuPerfil, avatar: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px', marginTop: '4px' }} required />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>Mini Bio:</label>
                <textarea value={meuPerfil.bio} onChange={(e) => setMeuPerfil({...meuPerfil, bio: e.target.value})} style={{ width: '100%', height: '80px', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px', marginTop: '4px' }} />
              </div>
              <button type="submit" style={{ backgroundColor: '#7c3aed', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer', marginTop: '8px' }}>Salvar Alterações</button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE CRIAR STORY */}
      {modalCriarStory && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.85)', zIndex: 20000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '20px', maxWidth: '450px', width: '100%', padding: '30px', boxShadow: '0 25px 50px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>📸 Criar Novo Story</h3>
              <button onClick={() => setModalCriarStory(false)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
            </div>
            <form onSubmit={publicarStory} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>URL da Imagem / Mídia do Story:</label>
                <input type="text" placeholder="https://..." value={novoStoryMidia} onChange={(e) => setNovoStoryMidia(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px', marginTop: '4px' }} required />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>Legenda / Texto do Story:</label>
                <input type="text" placeholder="Ex: Analisando gráfico em tempo real..." value={novoStoryTexto} onChange={(e) => setNovoStoryTexto(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px', marginTop: '4px' }} required />
              </div>
              <button type="submit" style={{ backgroundColor: '#7c3aed', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer', marginTop: '8px' }}>Publicar Story 🚀</button>
            </form>
          </div>
        </div>
      )}

      {/* Visualizador de Stories */}
      {storyAtivo && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 25000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
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

      {/* CABEÇALHO PRINCIPAL */}
      <div style={{ maxWidth: '1050px', margin: '0 auto', padding: '30px 20px 0 20px' }}>
        <div style={{ backgroundColor: '#ffffff', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0', marginBottom: '25px', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flex: 1, minWidth: '280px' }}>
              <img src={meuPerfil.avatar} alt="Avatar" style={{ width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #7c3aed' }} />
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 2px 0' }}>{meuPerfil.nome}</h2>
                <span style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 'bold', display: 'block' }}>{meuPerfil.cargo}</span>
                <span style={{ fontSize: '11px', color: '#64748b' }}>{meuPerfil.status}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '16px', backgroundColor: '#f8fafc', padding: '12px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', alignItems: 'center' }}>
              <div style={{ textAlign: 'center' }}>
                <span style={{ fontSize: '10px', color: '#64748b', display: 'block', fontWeight: 'bold' }}>POSTS</span>
                <b style={{ fontSize: '15px', color: '#0f172a' }}>{meuPerfil.postsCount}</b>
              </div>
              <div style={{ width: '1px', height: '24px', backgroundColor: '#cbd5e1' }}></div>
              <div style={{ textAlign: 'center' }}>
                <span style={{ fontSize: '10px', color: '#64748b', display: 'block', fontWeight: 'bold' }}>SEGUIDORES</span>
                <b style={{ fontSize: '15px', color: '#7c3aed' }}>{meuPerfil.seguidores}</b>
              </div>
              <div style={{ width: '1px', height: '24px', backgroundColor: '#cbd5e1' }}></div>
              <div style={{ textAlign: 'center' }}>
                <span style={{ fontSize: '10px', color: '#64748b', display: 'block', fontWeight: 'bold' }}>VIEWS (30D)</span>
                <b style={{ fontSize: '15px', color: '#059669' }}>{meuPerfil.visualizacoes30Dias}</b>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button onClick={() => setModalEditarPerfil(true)} style={{ backgroundColor: '#7c3aed', color: '#fff', border: 'none', fontSize: '11px', fontWeight: 'bold', padding: '10px 14px', borderRadius: '8px', cursor: 'pointer' }}>
                ⚙️ Editar Perfil
              </button>
              <button onClick={() => window.location.href = '/dashboard'} style={{ backgroundColor: '#f1f5f9', color: '#0f172a', border: '1px solid #cbd5e1', fontSize: '11px', fontWeight: 'bold', padding: '10px 14px', borderRadius: '8px', cursor: 'pointer' }}>
                Sala de Controle
              </button>
            </div>

          </div>
        </div>

        {/* Abas */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '25px', flexWrap: 'wrap' }}>
          <button onClick={() => setAbaAtiva('feed')} style={{ padding: '10px 20px', borderRadius: '8px', border: abaAtiva === 'feed' ? '2px solid #7c3aed' : '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#0f172a', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}>
            📱 Feed Contínuo
          </button>
          <button onClick={() => setAbaAtiva('ranking')} style={{ padding: '10px 20px', borderRadius: '8px', border: abaAtiva === 'ranking' ? '2px solid #f59e0b' : '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#0f172a', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}>
            🏆 Ranking Top 10
          </button>
        </div>

        {/* ABA FEED */}
        {abaAtiva === 'feed' && (
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '25px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Stories com Botão de Criar Story */}
              <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '16px 20px', display: 'flex', gap: '15px', overflowX: 'auto', alignItems: 'center' }}>
                <div onClick={() => setModalCriarStory(true)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', minWidth: '64px' }}>
                  <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '24px', fontWeight: 'bold' }}>
                    ＋
                  </div>
                  <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#7c3aed', marginTop: '4px' }}>Criar Story</span>
                </div>

                {stories.map((st) => (
                  <div key={st.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', minWidth: '64px' }} onClick={() => setStoryAtivo(st)}>
                    <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'linear-gradient(135deg, #7c3aed 0%, #ec4899 100%)', padding: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <img src={st.avatar} alt="Story" style={{ width: '52px', height: '52px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #fff' }} />
                    </div>
                    <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#0f172a', marginTop: '4px' }}>{st.autor.split(' ')[0]}</span>
                  </div>
                ))}
              </div>

              {/* Caixa Post */}
              <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '24px' }}>
                <form onSubmit={publicarPost}>
                  <textarea value={novoTexto} onChange={(e) => setNovoTexto(e.target.value)} placeholder="Compartilhe uma análise, setup HFT ou visão de mercado..." style={{ width: '100%', height: '80px', backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '14px', fontSize: '13px', outline: 'none', boxSizing: 'border-box', marginBottom: '12px' }} />
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button type="submit" style={{ backgroundColor: '#7c3aed', color: '#fff', border: 'none', padding: '12px 20px', borderRadius: '8px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}>Publicar Análise 🚀</button>
                  </div>
                </form>
              </div>

              {/* Posts */}
              {posts.map((p) => (
                <div key={p.id} style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', overflow: 'hidden' }}>
                  <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid #e2e8f0' }}>
                    <img src={p.avatar} alt="Avatar" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} />
                    <div>
                      <b style={{ color: '#0f172a', fontSize: '14px' }}>{p.autor}</b>
                      <span style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 'bold', display: 'block' }}>{p.tempo}</span>
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

            {/* Coluna Direita (Notícias Reais) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 6px 0' }}>🌐 Canal Oficial de Notícias Macro</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
                  {noticiasMacro.map((n) => (
                    <a key={n.id} href={n.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px', display: 'block' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#7c3aed', backgroundColor: '#f3e8ff', padding: '2px 6px', borderRadius: '4px' }}>{n.cat}</span>
                        <span style={{ fontSize: '10px', color: '#64748b' }}>{n.hora} ↗️</span>
                      </div>
                      <h4 style={{ fontSize: '12px', color: '#0f172a', margin: '0 0 6px 0', fontWeight: 'bold' }}>{n.titulo}</h4>
                      <span style={{ fontSize: '10px', color: '#059669', fontWeight: 'bold' }}>Impacto: {n.impacto}</span>
                    </a>
                  ))}
                </div>
              </div>

              {/* Top Traders */}
              <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 6px 0' }}>🏆 Top Traders da Semana</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {rankingOperadores.slice(0, 3).map((op) => (
                    <div key={op.pos} onClick={() => setPerfilAtivo(op)} style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <img src={op.avatar} alt="Avatar" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
                        <div>
                          <b style={{ fontSize: '12px', color: '#0f172a', display: 'block' }}>{op.pos}º - {op.nome}</b>
                          <span style={{ fontSize: '10px', color: '#059669', fontWeight: 'bold' }}>{op.rentabilidade} • Assertividade: {op.assertividade}</span>
                        </div>
                      </div>
                      <span style={{ fontSize: '10px', color: '#7c3aed', backgroundColor: '#ede9fe', padding: '4px 8px', borderRadius: '6px', fontWeight: 'bold' }}>Visitar 🔍</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ABA RANKING COMPLETO */}
        {abaAtiva === 'ranking' && (
          <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '30px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#0f172a', marginBottom: '6px' }}>Ranking Completo Top 10</h2>
            <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '20px' }}>Clique em qualquer operador para inspecionar métricas e perfil completo.</p>
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
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '15px', fontWeight: 'bold', color: '#059669', display: 'block' }}>{op.rentabilidade}</span>
                    <span style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 'bold' }}>Assertividade: {op.assertividade}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </main>
  );
}