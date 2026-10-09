'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

export default function SocialPage() {
  const [abaAtiva, setAbaAtiva] = useState('feed'); // 'feed', 'ranking', 'perfil-visita'
  const [novoTexto, setNovoTexto] = useState('');
  const [tipoMidia, setTipoMidia] = useState('nenhuma');
  const [urlMidiaInput, setUrlMidiaInput] = useState('');
  const [perfilVisitado, setPerfilVisitado] = useState(null);
  const [storyAtivo, setStoryAtivo] = useState(null);

  // Modais
  const [modalEditarPerfil, setModalEditarPerfil] = useState(false);
  const [modalCriarStory, setModalCriarStory] = useState(false);
  const [modalAutenticacao, setModalAutenticacao] = useState(false);
  const [modoAuth, setModoAuth] = useState('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authSenha, setAuthSenha] = useState('');

  // Câmera
  const [modalCamera, setModalCamera] = useState(false);
  const videoRef = useRef(null);

  // Perfil do Usuário (Inicia com métricas zeradas em novas contas)
  const [meuPerfil, setMeuPerfil] = useState({
    nome: 'Paulo Stutz Netto',
    handle: '@paulostutz',
    cargo: 'CEO & Fundador • Letter Franqueadora',
    rentabilidade: 'R$ 0,00',
    assertividade: '0%',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
    bio: 'Desenvolvedor da infraestrutura AsaaS e operador HFT.',
    seguidores: 0,
    postsCount: 0,
    visualizacoes30Dias: 0,
    status: '🏆 Nova Conta Verificada',
    autenticado: true
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

  const fazerLogout = () => {
    const perfilSair = { ...meuPerfil, autenticado: false, nome: 'Visitante', handle: '@visitante' };
    setMeuPerfil(perfilSair);
    localStorage.setItem('jenios_social_perfil', JSON.stringify(perfilSair));
    alert('Sessão encerrada.');
  };

  const processarAuth = (e) => {
    e.preventDefault();
    const perfilLogado = {
      ...meuPerfil,
      nome: modoAuth === 'cadastro' ? 'Novo Trader' : 'Paulo Stutz Netto',
      handle: modoAuth === 'cadastro' ? '@novotrader' : '@paulostutz',
      autenticado: true,
      seguidores: modoAuth === 'cadastro' ? 0 : 2100,
      postsCount: modoAuth === 'cadastro' ? 0 : 48,
      visualizacoes30Dias: modoAuth === 'cadastro' ? 0 : 45200
    };
    setMeuPerfil(perfilLogado);
    localStorage.setItem('jenios_social_perfil', JSON.stringify(perfilLogado));
    setModalAutenticacao(false);
    alert(modoAuth === 'cadastro' ? '🎉 Conta criada! Métricas iniciadas em zero.' : 'Bem-vindo de volta!');
  };

  // Upload de Imagem do Avatar (Perfil) via Arquivos / Galeria
  const handleAvatarUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setMeuPerfil({ ...meuPerfil, avatar: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  // Upload de Imagem para Post via Arquivos / Galeria
  const handlePostImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setUrlMidiaInput(reader.result);
        setTipoMidia('imagem');
      };
      reader.readAsDataURL(file);
    }
  };

  // Câmera
  const iniciarCamera = async () => {
    setModalCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      alert('Erro ao acessar a câmera.');
      setModalCamera(false);
    }
  };

  const tirarFoto = () => {
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    setUrlMidiaInput(canvas.toDataURL('image/png'));
    setTipoMidia('imagem');
    const stream = videoRef.current.srcObject;
    if (stream) stream.getTracks().forEach(t => t.stop());
    setModalCamera(false);
    alert('📸 Foto capturada!');
  };

  // Ranking Semanal Top 10 Completo
  const [rankingOperadores] = useState([
    { pos: 1, nome: 'Carlos M.', handle: '@carlosm', cargo: 'Trader Pro', rentabilidade: '+ R$ 14.850', assertividade: '94%', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', bio: 'Especialista em robôs HFT para Mini-Índice.', seguidores: '1.4k', postsCount: 12, visualizacoes30Dias: '28.4k' },
    { pos: 2, nome: 'Ana Paula S.', handle: '@anapaula', cargo: 'Institucional', rentabilidade: '+ R$ 11.200', assertividade: '91%', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150', bio: 'Arbitragem algorítmica multi-rede na Solana.', seguidores: '1.2k', postsCount: 9, visualizacoes30Dias: '21.0k' },
    { pos: 3, nome: 'Roberto Dias', handle: '@robertodias', cargo: 'Swing Trader', rentabilidade: '+ R$ 9.400', assertividade: '88%', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150', bio: 'Focado em tendências de médio prazo.', seguidores: '950', postsCount: 7, visualizacoes30Dias: '15.8k' },
    { pos: 4, nome: 'Juliana Costa', handle: '@julianac', cargo: 'Scalper', rentabilidade: '+ R$ 7.800', assertividade: '86%', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150', bio: 'Operações de alta frequência no Dólar.', seguidores: '820', postsCount: 14, visualizacoes30Dias: '12.1k' },
    { pos: 5, nome: 'Marcos Vinicius', handle: '@marcosv', cargo: 'Quant Dev', rentabilidade: '+ R$ 6.500', assertividade: '85%', avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150', bio: 'Desenvolvedor de estratégias matemáticas.', seguidores: '710', postsCount: 5, visualizacoes30Dias: '9.4k' },
    { pos: 6, nome: 'Fernanda Lima', handle: '@fernandal', cargo: 'Analista Macro', rentabilidade: '+ R$ 5.200', assertividade: '82%', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150', bio: 'Foco em notícias globais e commodities.', seguidores: '640', postsCount: 8, visualizacoes30Dias: '8.2k' },
    { pos: 7, nome: 'Lucas Mendes', handle: '@lucasm', cargo: 'Crypto Trader', rentabilidade: '+ R$ 4.300', assertividade: '80%', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150', bio: 'Especialista em DEX e pools de liquidez.', seguidores: '530', postsCount: 6, visualizacoes30Dias: '6.9k' },
    { pos: 8, nome: 'Beatriz Souza', handle: '@beatrizs', cargo: 'Day Trader', rentabilidade: '+ R$ 3.800', assertividade: '78%', avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150', bio: 'Operando price action clássico.', seguidores: '480', postsCount: 4, visualizacoes30Dias: '5.1k' },
    { pos: 9, nome: 'Gabriel Rocha', handle: '@gabrielr', cargo: 'Position', rentabilidade: '+ R$ 2.900', assertividade: '76%', avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150', bio: 'Alocação de longo prazo em ações.', seguidores: '390', postsCount: 3, visualizacoes30Dias: '4.2k' },
    { pos: 10, nome: 'Camila Martins', handle: '@camilam', cargo: 'Iniciante Pro', rentabilidade: '+ R$ 1.800', assertividade: '74%', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150', bio: 'Evoluindo no método Jenios.', seguidores: '310', postsCount: 2, visualizacoes30Dias: '3.0k' }
  ]);

  // Ticker e Notícias
  const [tickerMacro, setTickerMacro] = useState([
    { id: 1, rede: 'B3', tipo: '📊 MEGAPULSE', titulo: 'Conectando ao fluxo institucional...' }
  ]);

  useEffect(() => {
    async function varrerMercado() {
      try {
        const res = await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=volume_desc&per_page=6&page=1');
        const dados = await res.json();
        if (Array.isArray(dados)) {
          setTickerMacro(dados.map((c, i) => ({ id: i+1, rede: c.symbol.toUpperCase(), tipo: i===0?'🔥 TOP VOLUME':'⚡ TRENDING', titulo: `${c.name} ($${c.current_price}) | Vol: $${c.total_volume.toLocaleString()}` })));
        }
      } catch (e) {}
    }
    varrerMercado();
    const t = setInterval(varrerMercado, 60000);
    return () => clearInterval(t);
  }, []);

  const tickerDuplicado = [...tickerMacro, ...tickerMacro];

  const [noticiasMacro, setNoticiasMacro] = useState([
    { id: 1, hora: 'Ao vivo', cat: 'GLOBAL', titulo: 'Bancos centrais avaliam ajustes na liquidez', impacto: 'Alto', url: 'https://www.reuters.com' }
  ]);

  useEffect(() => {
    async function carregarNoticias() {
      try {
        const res = await fetch('https://api.coingecko.com/api/v3/news');
        const dados = await res.json();
        if (dados && dados.data) {
          setNoticiasMacro(dados.data.slice(0, 4).map((n, i) => ({ id: i+1, hora: 'Recente', cat: 'CRYPTO', titulo: n.title, impacto: 'Monitorado', url: n.url })));
        }
      } catch (e) {}
    }
    carregarNoticias();
    const tn = setInterval(carregarNoticias, 90000);
    return () => clearInterval(tn);
  }, []);

  const [posts, setPosts] = useState([
    { id: 1, autor: 'Carlos M.', handle: '@carlosm', cargo: 'ESTRATEGISTA HFT', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', texto: 'Modo Reverso ativado no Mini-Índice com sucesso!', tipoMidia: 'nenhuma', urlMidia: '', tempo: 'Há 15 mins', likes: 34, curtido: false, perfilAssociado: rankingOperadores[0] }
  ]);

  const publicarPost = (e) => {
    e.preventDefault();
    if (!novoTexto.trim() && !urlMidiaInput.trim()) return;
    const novoP = {
      id: Date.now(),
      autor: meuPerfil.nome,
      handle: meuPerfil.handle,
      cargo: 'ESTRATEGISTA',
      avatar: meuPerfil.avatar,
      texto: novoTexto,
      tipoMidia: tipoMidia,
      urlMidia: urlMidiaInput,
      tempo: 'Agora mesmo',
      likes: 0,
      curtido: false,
      perfilAssociado: meuPerfil
    };
    setPosts([novoP, ...posts]);
    setNovoTexto('');
    setUrlMidiaInput('');
    setTipoMidia('nenhuma');
    const perfilAtualizado = {
      ...meuPerfil,
      postsCount: Number(meuPerfil.postsCount || 0) + 1,
      visualizacoes30Dias: Number(meuPerfil.visualizacoes30Dias || 0) + 15
    };
    setMeuPerfil(perfilAtualizado);
    localStorage.setItem('jenios_social_perfil', JSON.stringify(perfilAtualizado));
    alert('🚀 Publicação realizada!');
  };

  const curtirPost = (id) => {
    setPosts(posts.map(p => p.id === id ? { ...p, likes: p.curtido ? p.likes - 1 : p.likes + 1, curtido: !p.curtido } : p));
  };

  const visitarPerfil = (usuario) => {
    setPerfilVisitado(usuario);
    setAbaAtiva('perfil-visita');
  };return (
    <main style={{ backgroundColor: '#f1f5f9', color: '#0f172a', minHeight: '100vh', paddingBottom: '60px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes marquee { 0% { transform: translateX(0%); } 100% { transform: translateX(-50%); } }
        .ticker-container { overflow: hidden; white-space: nowrap; width: 100%; }
        .ticker-track { display: inline-flex; animation: marquee 35s linear infinite; }
        .ticker-track:hover { animation-play-state: paused; }
      ` }} />

      {/* Ticker Superior */}
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

      {/* MODAL CÂMERA */}
      {modalCamera && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 30000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
          <div style={{ backgroundColor: '#1e293b', borderRadius: '20px', padding: '25px', maxWidth: '500px', width: '100%', textAlign: 'center' }}>
            <h3 style={{ color: '#fff', marginBottom: '15px' }}>📸 Tirar Foto na Hora</h3>
            <video ref={videoRef} autoPlay playsInline style={{ width: '100%', borderRadius: '10px', backgroundColor: '#000', marginBottom: '15px' }}></video>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
              <button onClick={tirarFoto} style={{ backgroundColor: '#059669', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Capturar 🟢</button>
              <button onClick={() => setModalCamera(false)} style={{ backgroundColor: '#ef4444', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL AUTENTICAÇÃO */}
      {modalAutenticacao && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.85)', zIndex: 20000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '20px', maxWidth: '400px', width: '100%', padding: '30px', boxShadow: '0 25px 50px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>{modoAuth === 'login' ? '🔑 Entrar' : '✨ Criar Nova Conta'}</h3>
              <button onClick={() => setModalAutenticacao(false)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
            </div>
            <form onSubmit={processarAuth} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>E-mail:</label>
                <input type="email" placeholder="seu@email.com" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px', marginTop: '4px' }} required />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>Senha:</label>
                <input type="password" placeholder="••••••••" value={authSenha} onChange={(e) => setAuthSenha(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px', marginTop: '4px' }} required />
              </div>
              <button type="submit" style={{ backgroundColor: '#7c3aed', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer', marginTop: '8px' }}>
                {modoAuth === 'login' ? 'Entrar' : 'Criar Conta (Métricas Zeradas 0)'}
              </button>
              <button type="button" onClick={() => setModoAuth(modoAuth === 'login' ? 'cadastro' : 'login')} style={{ background: 'none', border: 'none', color: '#7c3aed', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', marginTop: '4px' }}>
                {modoAuth === 'login' ? 'Não tem conta? Criar nova' : 'Já tem conta? Fazer login'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE EDIÇÃO DE PERFIL COM UPLOAD DE FOTO */}
      {modalEditarPerfil && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.85)', zIndex: 20000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '20px', maxWidth: '450px', width: '100%', padding: '30px', boxShadow: '0 25px 50px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>⚙️ Editar Perfil & Handle</h3>
              <button onClick={() => setModalEditarPerfil(false)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
            </div>
            <form onSubmit={salvarEdicaoPerfil} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>Nome:</label>
                <input type="text" value={meuPerfil.nome} onChange={(e) => setMeuPerfil({...meuPerfil, nome: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px', marginTop: '4px' }} required />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>Handle (@usuario):</label>
                <input type="text" value={meuPerfil.handle} onChange={(e) => setMeuPerfil({...meuPerfil, handle: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px', marginTop: '4px' }} required />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>Foto de Perfil (Galeria / Arquivos):</label>
                <input type="file" accept="image/*" onChange={handleAvatarUpload} style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px', marginTop: '4px', backgroundColor: '#f8fafc' }} />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>Cargo:</label>
                <input type="text" value={meuPerfil.cargo} onChange={(e) => setMeuPerfil({...meuPerfil, cargo: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px', marginTop: '4px' }} />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>Bio:</label>
                <textarea value={meuPerfil.bio} onChange={(e) => setMeuPerfil({...meuPerfil, bio: e.target.value})} style={{ width: '100%', height: '70px', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px', marginTop: '4px' }} />
              </div>
              <button type="submit" style={{ backgroundColor: '#7c3aed', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer', marginTop: '8px' }}>Salvar Alterações</button>
            </form>
          </div>
        </div>
      )}

      {/* CABEÇALHO */}
      <div style={{ maxWidth: '1050px', margin: '0 auto', padding: '30px 20px 0 20px' }}>
        
        {/* Barra Superior */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', background: '#ffffff', padding: '12px 20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }} onClick={() => setAbaAtiva('feed')}>
            <span style={{ fontSize: '14px', fontWeight: '900', color: '#7c3aed' }}>JENIOS SOCIAL</span>
            <span style={{ fontSize: '11px', color: '#64748b' }}>• Comunidade HFT & Mercado</span>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {meuPerfil.autenticado ? (
              <>
                <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#059669' }}>{meuPerfil.handle}</span>
                <button onClick={fazerLogout} style={{ backgroundColor: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', fontSize: '11px', fontWeight: 'bold', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer' }}>
                  🚪 Sair
                </button>
              </>
            ) : (
              <>
                <button onClick={() => { setModoAuth('login'); setModalAutenticacao(true); }} style={{ backgroundColor: '#f1f5f9', color: '#0f172a', border: '1px solid #cbd5e1', fontSize: '11px', fontWeight: 'bold', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer' }}>
                  🔑 Entrar
                </button>
                <button onClick={() => { setModoAuth('cadastro'); setModalAutenticacao(true); }} style={{ backgroundColor: '#7c3aed', color: '#fff', border: 'none', fontSize: '11px', fontWeight: 'bold', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer' }}>
                  ✨ Criar Conta
                </button>
              </>
            )}
          </div>
        </div>

        {/* Perfil Header */}
        <div style={{ backgroundColor: '#ffffff', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0', marginBottom: '25px', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flex: 1, minWidth: '280px' }}>
              <img src={meuPerfil.avatar} alt="Avatar" style={{ width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #7c3aed' }} />
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 2px 0' }}>{meuPerfil.nome} <span style={{ fontSize: '13px', color: '#7c3aed' }}>{meuPerfil.handle}</span></h2>
                <span style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 'bold', display: 'block' }}>{meuPerfil.cargo}</span>
                <span style={{ fontSize: '11px', color: '#64748b' }}>{meuPerfil.status}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '16px', backgroundColor: '#f8fafc', padding: '12px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', alignItems: 'center' }}>
              <div style={{ textAlign: 'center' }}>
                <span style={{ fontSize: '10px', color: '#64748b', display: 'block', fontWeight: 'bold' }}>POSTS</span>
                <b style={{ fontSize: '15px', color: '#0f172a' }}>{meuPerfil.postsCount || 0}</b>
              </div>
              <div style={{ width: '1px', height: '24px', backgroundColor: '#cbd5e1' }}></div>
              <div style={{ textAlign: 'center' }}>
                <span style={{ fontSize: '10px', color: '#64748b', display: 'block', fontWeight: 'bold' }}>SEGUIDORES</span>
                <b style={{ fontSize: '15px', color: '#7c3aed' }}>{meuPerfil.seguidores || 0}</b>
              </div>
              <div style={{ width: '1px', height: '24px', backgroundColor: '#cbd5e1' }}></div>
              <div style={{ textAlign: 'center' }}>
                <span style={{ fontSize: '10px', color: '#64748b', display: 'block', fontWeight: 'bold' }}>VIEWS (30D)</span>
                <b style={{ fontSize: '15px', color: '#059669' }}>{meuPerfil.visualizacoes30Dias || 0}</b>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button onClick={() => setModalEditarPerfil(true)} style={{ backgroundColor: '#7c3aed', color: '#fff', border: 'none', fontSize: '11px', fontWeight: 'bold', padding: '10px 14px', borderRadius: '8px', cursor: 'pointer' }}>
                ⚙️ Editar Perfil
              </button>
              <button onClick={() => window.location.href = '/dashboard-logado'} style={{ backgroundColor: '#f1f5f9', color: '#0f172a', border: '1px solid #cbd5e1', fontSize: '11px', fontWeight: 'bold', padding: '10px 14px', borderRadius: '8px', cursor: 'pointer' }}>
                Sala de Controle
              </button>
            </div>

          </div>
        </div>

        {/* Abas */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '25px' }}>
          <button onClick={() => setAbaAtiva('feed')} style={{ padding: '10px 20px', borderRadius: '8px', border: abaAtiva === 'feed' ? '2px solid #7c3aed' : '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#0f172a', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}>
            📱 Feed Contínuo
          </button>
          <button onClick={() => setAbaAtiva('ranking')} style={{ padding: '10px 20px', borderRadius: '8px', border: abaAtiva === 'ranking' ? '2px solid #f59e0b' : '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#0f172a', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}>
            🏆 Ranking Top 10 Semanal
          </button>
        </div>

        {/* 1. ABA FEED */}
        {abaAtiva === 'feed' && (
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '25px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Caixa de Criação de Post com Upload Real de Arquivo */}
              <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '24px' }}>
                <form onSubmit={publicarPost}>
                  <textarea value={novoTexto} onChange={(e) => setNovoTexto(e.target.value)} placeholder="Compartilhe uma análise, setup HFT ou visão de mercado..." style={{ width: '100%', height: '80px', backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '14px', fontSize: '13px', outline: 'none', boxSizing: 'border-box', marginBottom: '12px' }} />

                  <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <label style={{ backgroundColor: '#f1f5f9', padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', border: '1px solid #cbd5e1' }}>
                      📁 Subir Foto (Arquivos/Galeria) <input type="file" accept="image/*" onChange={handlePostImageUpload} style={{ display: 'none' }} />
                    </label>
                    <button type="button" onClick={iniciarCamera} style={{ backgroundColor: '#f1f5f9', color: '#0f172a', border: '1px solid #cbd5e1', padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>
                      📷 Tirar Foto (Câmera)
                    </button>
                    <button type="button" onClick={() => { setTipoMidia('youtube'); setUrlMidiaInput(prompt('Cole o link do vídeo do YouTube:') || ''); }} style={{ backgroundColor: '#f1f5f9', color: '#0f172a', border: '1px solid #cbd5e1', padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>
                      ▶️ Vídeo YouTube
                    </button>
                    <button type="button" onClick={() => { setTipoMidia('live'); setUrlMidiaInput('TRANSMISSÃO AO VIVO'); alert('🔴 Live iniciada!'); }} style={{ backgroundColor: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>
                      🔴 Fazer Live
                    </button>
                  </div>

                  {urlMidiaInput && tipoMidia === 'imagem' && (
                    <div style={{ fontSize: '11px', color: '#059669', marginBottom: '10px', fontWeight: 'bold' }}>✓ Imagem carregada e pronta para publicação.</div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button type="submit" style={{ backgroundColor: '#7c3aed', color: '#fff', border: 'none', padding: '12px 20px', borderRadius: '8px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}>Publicar no Feed 🚀</button>
                  </div>
                </form>
              </div>

              {/* Posts */}
              {posts.map((p) => (
                <div key={p.id} style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', overflow: 'hidden' }}>
                  <div onClick={() => visitarPerfil(p.perfilAssociado || { nome: p.autor, handle: p.handle, avatar: p.avatar, cargo: p.cargo })} style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid #e2e8f0', cursor: 'pointer', backgroundColor: '#faf5ff' }}>
                    <img src={p.avatar} alt="Avatar" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} />
                    <div>
                      <b style={{ color: '#0f172a', fontSize: '14px' }}>{p.autor} <span style={{ fontSize: '11px', color: '#7c3aed' }}>{p.handle}</span></b>
                      <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>{p.tempo} • Visitar perfil ↗️</span>
                    </div>
                  </div>
                  <div style={{ padding: '20px' }}><p style={{ fontSize: '13px', color: '#334155', margin: 0 }}>{p.texto}</p></div>
                  
                  {p.tipoMidia === 'imagem' && p.urlMidia && (
                    <div style={{ width: '100%', maxHeight: '400px', backgroundColor: '#000', overflow: 'hidden' }}>
                      <img src={p.urlMidia} alt="Mídia Post" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    </div>
                  )}

                  <div style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0', fontSize: '12px' }}>
                    <button onClick={() => curtirPost(p.id)} style={{ background: 'none', border: 'none', color: p.curtido ? '#dc2626' : '#64748b', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>
                      {p.curtido ? '❤️' : '🤍'} {p.likes} Curtidas
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Coluna Direita (Notícias e Top Traders) */}
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

              {/* Top Traders (Visualização Completa do Top 10 Semanal) */}
              <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 6px 0' }}>🏆 Top Traders (Semanal)</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {rankingOperadores.slice(0, 5).map((op) => (
                    <div key={op.pos} onClick={() => visitarPerfil(op)} style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <img src={op.avatar} alt="Avatar" style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }} />
                        <div>
                          <b style={{ fontSize: '11px', color: '#0f172a', display: 'block' }}>{op.pos}º - {op.nome}</b>
                          <span style={{ fontSize: '9px', color: '#059669', fontWeight: 'bold' }}>{op.rentabilidade}</span>
                        </div>
                      </div>
                      <span style={{ fontSize: '9px', color: '#7c3aed', fontWeight: 'bold' }}>Ver ↗️</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. ABA RANKING COMPLETO TOP 10 SEMANAL */}
        {abaAtiva === 'ranking' && (
          <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '30px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#0f172a', marginBottom: '6px' }}>🏆 Ranking Oficial Top 10 (Semanal)</h2>
            <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '20px' }}>Disputa semanal dos melhores operadores da plataforma Jenios. Clique em qualquer operador para visitar o perfil completo.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {rankingOperadores.map((op) => (
                <div key={op.pos} onClick={() => visitarPerfil(op)} style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <img src={op.avatar} alt="Avatar" style={{ width: '42px', height: '42px', borderRadius: '50%', objectFit: 'cover' }} />
                    <div>
                      <b style={{ fontSize: '14px', color: '#0f172a', display: 'block' }}>#{op.pos} - {op.nome} ({op.handle})</b>
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

        {/* 3. PÁGINA DE PERFIL DEDICADA (ESTILO INSTAGRAM) */}
        {abaAtiva === 'perfil-visita' && perfilVisitado && (
          <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '30px' }}>
            <button onClick={() => setAbaAtiva('feed')} style={{ background: 'none', border: 'none', color: '#7c3aed', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer', marginBottom: '20px' }}>
              ← Voltar ao Feed Principal
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '30px', flexWrap: 'wrap' }}>
              <img src={perfilVisitado.avatar} alt="Avatar" style={{ width: '90px', height: '90px', borderRadius: '50%', objectFit: 'cover', border: '3px solid #7c3aed' }} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '8px', flexWrap: 'wrap' }}>
                  <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>{perfilVisitado.nome}</h2>
                  <span style={{ fontSize: '14px', color: '#7c3aed', fontWeight: 'bold' }}>{perfilVisitado.handle}</span>
                  <button onClick={() => alert(`Você agora está seguindo ${perfilVisitado.nome}!`)} style={{ backgroundColor: '#7c3aed', color: '#fff', border: 'none', padding: '8px 18px', borderRadius: '8px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}>
                    Seguir ⚡
                  </button>
                </div>
                <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 10px 0' }}>{perfilVisitado.cargo} • {perfilVisitado.bio}</p>
                <div style={{ display: 'flex', gap: '25px', fontSize: '13px' }}>
                  <div><b>{perfilVisitado.postsCount || 5}</b> posts</div>
                  <div><b>{perfilVisitado.seguidores || '1.2k'}</b> seguidores</div>
                  <div><b>{perfilVisitado.visualizacoes30Dias || '15k'}</b> views</div>
                </div>
              </div>
            </div>

            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '20px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#0f172a', marginBottom: '15px' }}>Publicações de {perfilVisitado.nome}</h3>
              <div style={{ backgroundColor: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>Nenhum post recente fixado por este operador no momento.</p>
              </div>
            </div>
          </div>
        )}

      </div>
    </main>
  );
}