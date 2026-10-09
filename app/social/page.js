'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

export default function SocialPage() {
  const [abaAtiva, setAbaAtiva] = useState('feed');
  const [novoTexto, setNovoTexto] = useState('');
  const [tipoMidia, setTipoMidia] = useState('nenhuma'); // 'nenhuma', 'imagem', 'youtube', 'live'
  const [urlMidiaInput, setUrlMidiaInput] = useState('');
  const [perfilAtivo, setPerfilAtivo] = useState(null);
  const [storyAtivo, setStoryAtivo] = useState(null);

  // Modais
  const [modalEditarPerfil, setModalEditarPerfil] = useState(false);
  const [modalCriarStory, setModalCriarStory] = useState(false);
  const [modalAutenticacao, setModalAutenticacao] = useState(false);
  const [modoAuth, setModoAuth] = useState('login'); // 'login' ou 'cadastro'
  const [authEmail, setAuthEmail] = useState('');
  const [authSenha, setAuthSenha] = useState('');

  // Câmera / Tirar Foto na Hora
  const [modalCamera, setModalCamera] = useState(false);
  const videoRef = useRef(null);
  const [cameraAtiva, setCameraAtiva] = useState(false);

  // Perfil do Usuário com persistência e métricas dinâmicas
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
    alert('✅ Perfil e handle atualizados com sucesso!');
  };

  const fazerLogout = () => {
    const perfilSair = { ...meuPerfil, autenticado: false, nome: 'Visitante', handle: '@visitante' };
    setMeuPerfil(perfilSair);
    localStorage.setItem('jenios_social_perfil', JSON.stringify(perfilSair));
    alert('Sessão encerrada com sucesso.');
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
    alert(modoAuth === 'cadastro' ? '🎉 Conta criada com sucesso! Métricas iniciadas.' : 'Bem-vindo de volta!');
  };

  // Upload de Imagem do Computador
  const handleFileUpload = (e) => {
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

  // Câmera ao Vivo
  const iniciarCamera = async () => {
    setModalCamera(true);
    setCameraAtiva(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      alert('Não foi possível acessar a câmera do dispositivo.');
      setModalCamera(false);
    }
  };

  const tirarFoto = () => {
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/png');
    setUrlMidiaInput(dataUrl);
    setTipoMidia('imagem');
    
    // Parar stream
    const stream = videoRef.current.srcObject;
    if (stream) stream.getTracks().forEach(track => track.stop());
    setModalCamera(false);
    alert('📸 Foto capturada com sucesso!');
  };

  // Varredura de Ticker de Mercado Real
  const [tickerMacro, setTickerMacro] = useState([
    { id: 1, rede: 'B3', tipo: '📊 MEGAPULSE', titulo: 'Conectando ao fluxo institucional em tempo real...' }
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
            tipo: index === 0 ? '🔥 TOP VOLUME' : '⚡ TRENDING',
            titulo: `${coin.name} ($${coin.current_price}) | Vol: $${coin.total_volume.toLocaleString()}`
          }));
          setTickerMacro(itensReais);
        }
      } catch (e) {}
    }
    varrerMercadoReal();
    const timer = setInterval(varrerMercadoReal, 60000);
    return () => clearInterval(timer);
  }, []);

  const tickerDuplicado = [...tickerMacro, ...tickerMacro];

  // Notícias Globais Reais e Fluidas
  const [noticiasMacro, setNoticiasMacro] = useState([
    { id: 1, hora: 'Ao vivo', cat: 'GLOBAL', titulo: 'Bancos centrais avaliam ajustes na liquidez de ativos', impacto: 'Monitorado', url: 'https://www.reuters.com' },
    { id: 2, hora: 'Recente', cat: 'MERCADO', titulo: 'Fluxo de capital institucional migra para ativos multichain', impacto: 'Alto', url: 'https://www.bloomberg.com' }
  ]);

  useEffect(() => {
    async function carregarNoticiasFluido() {
      try {
        const res = await fetch('https://api.coingecko.com/api/v3/news');
        const dados = await res.json();
        if (dados && dados.data && Array.isArray(dados.data)) {
          const formatadas = dados.data.slice(0, 4).map((item, idx) => ({
            id: idx + 1,
            hora: 'Agora',
            cat: item.news_type ? item.news_type.toUpperCase() : 'CRYPTO',
            titulo: item.title,
            impacto: 'Relevante',
            url: item.url
          }));
          setNoticiasMacro(formatadas);
        }
      } catch (e) {}
    }
    carregarNoticiasFluido();
    const timerNews = setInterval(carregarNoticiasFluido, 90000);
    return () => clearInterval(timerNews);
  }, []);

  const [posts, setPosts] = useState([
    { id: 1, autor: 'Carlos M.', handle: '@carlosm', cargo: 'ESTRATEGISTA HFT', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', texto: 'Modo Reverso ativado no Mini-Índice com sucesso!', tipoMidia: 'nenhuma', urlMidia: '', tempo: 'Há 15 mins', likes: 34, curtido: false, perfilAssociado: { nome: 'Carlos M.', handle: '@carlosm', cargo: 'Trader Pro', rentabilidade: '+ R$ 14.850', assertividade: '94%', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', seguidores: '1.4k', bio: 'Especialista em robôs HFT.' } }
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

    // Atualizar métricas do perfil
    const perfilAtualizado = {
      ...meuPerfil,
      postsCount: Number(meuPerfil.postsCount || 0) + 1,
      visualizacoes30Dias: Number(meuPerfil.visualizacoes30Dias || 0) + 12
    };
    setMeuPerfil(perfilAtualizado);
    localStorage.setItem('jenios_social_perfil', JSON.stringify(perfilAtualizado));
    alert('🚀 Publicação realizada com sucesso!');
  };

  const curtirPost = (id) => {
    setPosts(posts.map(p => p.id === id ? { ...p, likes: p.curtido ? p.likes - 1 : p.likes + 1, curtido: !p.curtido } : p));
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

      {/* MODAL DE CÂMERA (TIRAR FOTO NA HORA) */}
      {modalCamera && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 30000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
          <div style={{ backgroundColor: '#1e293b', borderRadius: '20px', padding: '25px', maxWidth: '500px', width: '100%', textAlign: 'center' }}>
            <h3 style={{ color: '#fff', marginBottom: '15px' }}>📸 Tirar Foto na Hora</h3>
            <video ref={videoRef} autoPlay playsInline style={{ width: '100%', borderRadius: '10px', backgroundColor: '#000', marginBottom: '15px' }}></video>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
              <button onClick={tirarFoto} style={{ backgroundColor: '#059669', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Capturar Foto 🟢</button>
              <button onClick={() => { setModalCamera(false); }} style={{ backgroundColor: '#ef4444', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE AUTENTICAÇÃO (ENTRAR / CRIAR CONTA) */}
      {modalAutenticacao && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.85)', zIndex: 20000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '20px', maxWidth: '400px', width: '100%', padding: '30px', boxShadow: '0 25px 50px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>{modoAuth === 'login' ? '🔑 Entrar na Conta' : '✨ Criar Nova Conta'}</h3>
              <button onClick={() => setModalAutenticacao(false)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
            </div>
            <form onSubmit={processarAuth} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>E-mail:</label>
                <input type="email5" placeholder="seu@email.com" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px', marginTop: '4px' }} required />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>Senha:</label>
                <input type="password" placeholder="••••••••" value={authSenha} onChange={(e) => setAuthSenha(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px', marginTop: '4px' }} required />
              </div>
              <button type="submit" style={{ backgroundColor: '#7c3aed', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer', marginTop: '8px' }}>
                {modoAuth === 'login' ? 'Entrar Agora' : 'Criar Conta (Métricas Zeradas 0)'}
              </button>
              <button type="button" onClick={() => setModoAuth(modoAuth === 'login' ? 'cadastro' : 'login')} style={{ background: 'none', border: 'none', color: '#7c3aed', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', marginTop: '4px' }}>
                {modoAuth === 'login' ? 'Não tem conta? Criar nova conta' : 'Já tem conta? Fazer login'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE EDIÇÃO DE PERFIL */}
      {modalEditarPerfil && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.85)', zIndex: 20000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '20px', maxWidth: '450px', width: '100%', padding: '30px', boxShadow: '0 25px 50px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>⚙️ Editar Meu Perfil & Handle</h3>
              <button onClick={() => setModalEditarPerfil(false)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
            </div>
            <form onSubmit={salvarEdicaoPerfil} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>Nome Completo:</label>
                <input type="text" value={meuPerfil.nome} onChange={(e) => setMeuPerfil({...meuPerfil, nome: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px', marginTop: '4px' }} required />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>Handle (@usuario):</label>
                <input type="text" value={meuPerfil.handle} onChange={(e) => setMeuPerfil({...meuPerfil, handle: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px', marginTop: '4px' }} required />
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

      {/* MODAL DE PERFIL CLICADO */}
      {perfilAtivo && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 25000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', maxWidth: '420px', width: '100%', padding: '24px', boxShadow: '0 20px 25px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#7c3aed' }}>PERFIL DO TRADER</span>
              <button onClick={() => setPerfilAtivo(null)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
              <img src={perfilAtivo.avatar} alt="Avatar" style={{ width: '56px', height: '56px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #7c3aed' }} />
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>{perfilAtivo.nome}</h3>
                <span style={{ fontSize: '12px', color: '#7c3aed', fontWeight: 'bold' }}>{perfilAtivo.handle || '@trader'}</span>
                <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>{perfilAtivo.cargo || 'Investidor Institucional'}</span>
              </div>
            </div>
            <p style={{ fontSize: '12px', color: '#334155', marginBottom: '16px' }}>{perfilAtivo.bio || 'Operador de alta frequência ativo na plataforma Jenios.'}</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', backgroundColor: '#f8fafc', padding: '12px', borderRadius: '10px', marginBottom: '16px', textAlign: 'center' }}>
              <div>
                <span style={{ fontSize: '10px', color: '#64748b', display: 'block', fontWeight: 'bold' }}>RENTABILIDADE</span>
                <b style={{ fontSize: '13px', color: '#059669' }}>{perfilAtivo.rentabilidade || 'R$ 0,00'}</b>
              </div>
              <div>
                <span style={{ fontSize: '10px', color: '#64748b', display: 'block', fontWeight: 'bold' }}>ASSERTIVIDADE</span>
                <b style={{ fontSize: '13px', color: '#7c3aed' }}>{perfilAtivo.assertividade || '0%'}</b>
              </div>
              <div>
                <span style={{ fontSize: '10px', color: '#64748b', display: 'block', fontWeight: 'bold' }}>SEGUIDORES</span>
                <b style={{ fontSize: '13px', color: '#0f172a' }}>{perfilAtivo.seguidores || 0}</b>
              </div>
            </div>
            <button onClick={() => { alert(`Agora você está seguindo ${perfilAtivo.nome}!`); setPerfilAtivo(null); }} style={{ width: '100%', backgroundColor: '#7c3aed', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}>
              Seguir Trader ⚡
            </button>
          </div>
        </div>
      )}

      {/* CABEÇALHO PRINCIPAL DA SOCIAL */}
      <div style={{ maxWidth: '1050px', margin: '0 auto', padding: '30px 20px 0 20px' }}>
        
        {/* Barra Superior com Botões de Entrar / Sair / Criar Conta */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', background: '#ffffff', padding: '12px 20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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

            {/* Métricas Dinâmicas (Zeradas se nova conta) */}
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
              <button onClick={() => window.location.href = '/dashboard'} style={{ backgroundColor: '#f1f5f9', color: '#0f172a', border: '1px solid #cbd5e1', fontSize: '11px', fontWeight: 'bold', padding: '10px 14px', borderRadius: '8px', cursor: 'pointer' }}>
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
            🏆 Ranking Top 10
          </button>
        </div>

        {/* ABA FEED */}
        {abaAtiva === 'feed' && (
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '25px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Caixa de Criação de Post Completa (Upload, Câmera, YouTube, Live) */}
              <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '24px' }}>
                <form onSubmit={publicarPost}>
                  <textarea value={novoTexto} onChange={(e) => setNovoTexto(e.target.value)} placeholder="Compartilhe uma análise, setup HFT ou visão de mercado..." style={{ width: '100%', height: '80px', backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '14px', fontSize: '13px', outline: 'none', boxSizing: 'border-box', marginBottom: '12px' }} />

                  {/* Seletor de Tipo de Mídia */}
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <label style={{ backgroundColor: '#f1f5f9', padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', border: '1px solid #cbd5e1' }}>
                      📁 Subir Foto <input type="file" accept="image/*" onChange={handleFileUpload} style={{ display: 'none' }} />
                    </label>
                    <button type="button" onClick={iniciarCamera} style={{ backgroundColor: '#f1f5f9', color: '#0f172a', border: '1px solid #cbd5e1', padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>
                      📷 Tirar Foto (Câmera)
                    </button>
                    <button type="button" onClick={() => { setTipoMidia('youtube'); setUrlMidiaInput(prompt('Cole o link do vídeo do YouTube:') || ''); }} style={{ backgroundColor: '#f1f5f9', color: '#0f172a', border: '1px solid #cbd5e1', padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>
                      ▶️ Vídeo YouTube
                    </button>
                    <button type="button" onClick={() => { setTipoMidia('live'); setUrlMidiaInput('TRANSMISSÃO AO VIVO HFT'); alert('🔴 Transmissão ao vivo iniciada no feed!'); }} style={{ backgroundColor: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>
                      🔴 Fazer Live
                    </button>
                  </div>

                  {tipoMidia === 'youtube' && urlMidiaInput && (
                    <div style={{ fontSize: '11px', color: '#059669', marginBottom: '10px', fontWeight: 'bold' }}>✓ Vídeo do YouTube anexado com sucesso.</div>
                  )}
                  {tipoMidia === 'live' && (
                    <div style={{ fontSize: '11px', color: '#dc2626', marginBottom: '10px', fontWeight: 'bold' }}>🔴 Status: Transmissão ao vivo ativa no feed.</div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button type="submit" style={{ backgroundColor: '#7c3aed', color: '#fff', border: 'none', padding: '12px 20px', borderRadius: '8px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}>Publicar no Feed 🚀</button>
                  </div>
                </form>
              </div>

              {/* Posts do Feed (Com clique nos perfis e mídias) */}
              {posts.map((p) => (
                <div key={p.id} style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', overflow: 'hidden' }}>
                  <div onClick={() => setPerfilAtivo(p.perfilAssociado || { nome: p.autor, handle: p.handle, avatar: p.avatar, cargo: p.cargo })} style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid #e2e8f0', cursor: 'pointer', backgroundColor: '#faf5ff' }}>
                    <img src={p.avatar} alt="Avatar" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} />
                    <div>
                      <b style={{ color: '#0f172a', fontSize: '14px' }}>{p.autor} <span style={{ fontSize: '11px', color: '#7c3aed' }}>{p.handle}</span></b>
                      <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>{p.tempo} • Clicar para ver perfil 🔍</span>
                    </div>
                  </div>
                  <div style={{ padding: '20px' }}><p style={{ fontSize: '13px', color: '#334155', margin: 0 }}>{p.texto}</p></div>
                  
                  {p.tipoMidia === 'imagem' && p.urlMidia && (
                    <div style={{ width: '100%', maxHeight: '400px', backgroundColor: '#000', overflow: 'hidden' }}>
                      <img src={p.urlMidia} alt="Mídia Post" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    </div>
                  )}

                  {p.tipoMidia === 'youtube' && (
                    <div style={{ padding: '10px 20px', backgroundColor: '#000', color: '#fff', textAlign: 'center', fontSize: '12px' }}>
                      ▶️ Vídeo incorporado: {p.urlMidia}
                    </div>
                  )}

                  {p.tipoMidia === 'live' && (
                    <div style={{ padding: '15px', backgroundColor: '#991b1b', color: '#fff', textAlign: 'center', fontWeight: 'bold', fontSize: '13px' }}>
                      🔴 TRANSMISSÃO AO VIVO HFT EM ANDAMENTO
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

            {/* Coluna Direita (Notícias Globais Fluídas & Top Traders) */}
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

              {/* Top Traders Clicáveis */}
              <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 6px 0' }}>🏆 Top Traders da Semana</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {[
                    { pos: 1, nome: 'Carlos M.', handle: '@carlosm', cargo: 'Trader Pro', rentabilidade: '+ R$ 14.850', assertividade: '94%', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', bio: 'Especialista em robôs HFT.' },
                    { pos: 2, nome: 'Ana Paula S.', handle: '@anapaula', cargo: 'Institucional', rentabilidade: '+ R$ 11.200', assertividade: '91%', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150', bio: 'Gestora de capital.' }
                  ].map((op) => (
                    <div key={op.pos} onClick={() => setPerfilAtivo(op)} style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <img src={op.avatar} alt="Avatar" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
                        <div>
                          <b style={{ fontSize: '12px', color: '#0f172a', display: 'block' }}>{op.pos}º - {op.nome} ({op.handle})</b>
                          <span style={{ fontSize: '10px', color: '#059669', fontWeight: 'bold' }}>{op.rentabilidade}</span>
                        </div>
                      </div>
                      <span style={{ fontSize: '10px', color: '#7c3aed', backgroundColor: '#ede9fe', padding: '4px 8px', borderRadius: '6px', fontWeight: 'bold' }}>Ver 🔍</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ABA RANKING */}
        {abaAtiva === 'ranking' && (
          <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '30px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#0f172a', marginBottom: '6px' }}>Ranking Completo Top 10</h2>
            <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '20px' }}>Clique em qualquer operador para inspecionar métricas e perfil completo.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                { pos: 1, nome: 'Carlos M.', handle: '@carlosm', cargo: 'Trader Pro', rentabilidade: '+ R$ 14.850', assertividade: '94%', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', bio: 'Especialista em HFT.' },
                { pos: 2, nome: 'Ana Paula S.', handle: '@anapaula', cargo: 'Institucional', rentabilidade: '+ R$ 11.200', assertividade: '91%', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150', bio: 'Arbitragem algorítmica.' }
              ].map((op) => (
                <div key={op.pos} onClick={() => setPerfilAtivo(op)} style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
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

      </div>
    </main>
  );
}