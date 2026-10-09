'use client';
import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';

export default function SocialPage() {
  const searchParams = useSearchParams();
  const perfilUrl = searchParams.get('perfil');

  const [abaAtiva, setAbaAtiva] = useState('feed');
  const [novoTexto, setNovoTexto] = useState('');
  const [proporcaoFoto, setProporcaoFoto] = useState('quadrada'); // 'quadrada', 'em-pe', 'deitada'
  const [imagensPreview, setImagensPreview] = useState([]); // Suporte a Carrossel (várias fotos)
  const [indiceCarrossel, setIndiceCarrossel] = useState({});
  const [perfilVisitado, setPerfilVisitado] = useState(null);

  // Modais
  const [modalEditarPerfil, setModalEditarPerfil] = useState(false);
  const [modalAutenticacao, setModalAutenticacao] = useState(false);
  const [modoAuth, setModoAuth] = useState('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authSenha, setAuthSenha] = useState('');

  // Câmera
  const [modalCamera, setModalCamera] = useState(false);
  const videoRef = useRef(null);

  // Perfil do Usuário
  const [meuPerfil, setMeuPerfil] = useState({
    nome: 'Paulo Stutz Netto',
    handle: '@paulostutz',
    cargo: 'CEO & Fundador • Letter Franqueadora',
    rentabilidade: 'R$ 0,00',
    assertividade: '0%',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
    bio: 'Desenvolvedor da infraestrutura AsaaS e operador HFT.',
    seguidores: 1280,
    postsCount: 1,
    visualizacoes30Dias: 4150,
    status: '🏆 Conta Verificada',
    autenticado: true
  });

  useEffect(() => {
    const perfilSalvo = localStorage.getItem('jenios_social_perfil');
    if (perfilSalvo) {
      try { 
        const parsed = JSON.parse(perfilSalvo);
        const historicoLucro = localStorage.getItem('jenios_lucro_total');
        if (historicoLucro) {
          parsed.rentabilidade = `+ R$ ${Number(historicoLucro).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
          parsed.assertividade = '95.4%';
        }
        setMeuPerfil(parsed); 
      } catch(e) {}
    }

    if (perfilUrl) {
      const encontrado = rankingOperadores.find(op => op.handle === perfilUrl) || meuPerfil;
      setPerfilVisitado(encontrado);
      setAbaAtiva('perfil-visita');
    }
  }, [perfilUrl]);

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
    const nomeUser = modoAuth === 'cadastro' ? 'Novo Trader' : 'Paulo Stutz Netto';
    const handleUser = modoAuth === 'cadastro' ? '@novotrader' : '@paulostutz';
    
    const perfilLogado = {
      ...meuPerfil,
      nome: nomeUser,
      handle: handleUser,
      autenticado: true,
      seguidores: 0,
      postsCount: 0,
      visualizacoes30Dias: 120, // Inicial realista
      bio: modoAuth === 'cadastro' ? 'Trader iniciante na plataforma Jenios HFT.' : 'Desenvolvedor da infraestrutura AsaaS e operador HFT.'
    };

    setMeuPerfil(perfilLogado);
    localStorage.setItem('jenios_social_perfil', JSON.stringify(perfilLogado));
    setModalAutenticacao(false);
    alert('Autenticado com sucesso!');
  };

  // Upload Múltiplo de Fotos (Carrossel) com Preview Visível
  const handleUploadCarrossel = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      const leitores = files.map(file => {
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(file);
        });
      });

      Promise.all(leitores).then(resultados => {
        setImagensPreview(prev => [...prev, ...resultados]);
      });
    }
  };

  const removerFotoPreview = (index) => {
    setImagensPreview(prev => prev.filter((_, i) => i !== index));
  };

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
    const fotoUrl = canvas.toDataURL('image/png');
    setImagensPreview(prev => [...prev, fotoUrl]);
    
    const stream = videoRef.current.srcObject;
    if (stream) stream.getTracks().forEach(t => t.stop());
    setModalCamera(false);
    alert('📸 Foto capturada e adicionada ao post!');
  };

  // Ranking Top 10 Semanal Completo
  const [rankingOperadores] = useState([
    { pos: 1, nome: 'Carlos M.', handle: '@carlosm', cargo: 'Trader Pro', rentabilidade: '+ R$ 14.850', assertividade: '94%', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', bio: 'Especialista em HFT.', seguidores: '1.4k', postsCount: 12, visualizacoes30Dias: '28.4k' },
    { pos: 2, nome: 'Ana Paula S.', handle: '@anapaula', cargo: 'Institucional', rentabilidade: '+ R$ 11.200', assertividade: '91%', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150', bio: 'Arbitragem algorítmica.', seguidores: '1.2k', postsCount: 9, visualizacoes30Dias: '21.0k' },
    { pos: 3, nome: 'Roberto Dias', handle: '@robertodias', cargo: 'Swing Trader', rentabilidade: '+ R$ 9.400', assertividade: '88%', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150', bio: 'Foco em tendências.', seguidores: '950', postsCount: 7, visualizacoes30Dias: '15.8k' },
    { pos: 4, nome: 'Juliana Costa', handle: '@julianac', cargo: 'Scalper', rentabilidade: '+ R$ 7.800', assertividade: '86%', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150', bio: 'Alta frequência no Dólar.', seguidores: '820', postsCount: 14, visualizacoes30Dias: '12.1k' },
    { pos: 5, nome: 'Marcos Vinicius', handle: '@marcosv', cargo: 'Quant Dev', rentabilidade: '+ R$ 6.500', assertividade: '85%', avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150', bio: 'Estratégias matemáticas.', seguidores: '710', postsCount: 5, visualizacoes30Dias: '9.4k' },
    { pos: 6, nome: 'Fernanda Lima', handle: '@fernandal', cargo: 'Analista Macro', rentabilidade: '+ R$ 5.200', assertividade: '82%', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150', bio: 'Foco em notícias globais.', seguidores: '640', postsCount: 8, visualizacoes30Dias: '8.2k' },
    { pos: 7, nome: 'Lucas Mendes', handle: '@lucasm', cargo: 'Crypto Trader', rentabilidade: '+ R$ 4.300', assertividade: '80%', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150', bio: 'Especialista em DEX.', seguidores: '530', postsCount: 6, visualizacoes30Dias: '6.9k' },
    { pos: 8, nome: 'Beatriz Souza', handle: '@beatrizs', cargo: 'Day Trader', rentabilidade: '+ R$ 3.800', assertividade: '78%', avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150', bio: 'Price action clássico.', seguidores: '480', postsCount: 4, visualizacoes30Dias: '5.1k' },
    { pos: 9, nome: 'Gabriel Rocha', handle: '@gabrielr', cargo: 'Position', rentabilidade: '+ R$ 2.900', assertividade: '76%', avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150', bio: 'Longo prazo em ações.', seguidores: '390', postsCount: 3, visualizacoes30Dias: '4.2k' },
    { pos: 10, nome: 'Camila Martins', handle: '@camilam', cargo: 'Iniciante Pro', rentabilidade: '+ R$ 1.800', assertividade: '74%', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150', bio: 'Evoluindo no método.', seguidores: '310', postsCount: 2, visualizacoes30Dias: '3.0k' }
  ]);

  const [posts, setPosts] = useState([
    { 
      id: 1, 
      autor: 'Carlos M.', 
      handle: '@carlosm', 
      cargo: 'ESTRATEGISTA HFT', 
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', 
      texto: 'Modo Reverso ativado no Mini-Índice com sucesso!', 
      imagens: ['https://images.unsplash.com/photo-1642543492481-44e81e3914a7?w=800'], 
      proporcao: 'quadrada',
      tempo: 'Há 15 mins', 
      likes: 34, 
      curtido: false, 
      views: 890,
      perfilAssociado: rankingOperadores[0] 
    }
  ]);

  const publicarPost = (e) => {
    e.preventDefault();
    if (!novoTexto.trim() && imagensPreview.length === 0) return;

    const novoP = {
      id: Date.now(),
      autor: meuPerfil.nome,
      handle: meuPerfil.handle,
      cargo: 'ESTRATEGISTA',
      avatar: meuPerfil.avatar,
      bio: meuPerfil.bio,
      texto: novoTexto,
      imagens: imagensPreview,
      proporcao: proporcaoFoto,
      tempo: 'Agora mesmo',
      likes: 0,
      curtido: false,
      views: 1, // Visualização inicial orgânica
      perfilAssociado: meuPerfil
    };

    setPosts([novoP, ...posts]);
    setNovoTexto('');
    setImagensPreview([]);
    setProporcaoFoto('quadrada');

    const perfilAtualizado = {
      ...meuPerfil,
      postsCount: Number(meuPerfil.postsCount || 0) + 1,
      visualizacoes30Dias: Number(meuPerfil.visualizacoes30Dias || 0) + 45
    };
    setMeuPerfil(perfilAtualizado);
    localStorage.setItem('jenios_social_perfil', JSON.stringify(perfilAtualizado));
    alert('🚀 Publicação realizada com sucesso!');
  };

  const curtirPost = (id) => {
    setPosts(posts.map(p => p.id === id ? { ...p, likes: p.curtido ? p.likes - 1 : p.likes + 1, curtido: !p.curtido } : p));
  };

  const mudarFotoCarrossel = (postId, direcao, totalImagens) => {
    setIndiceCarrossel(prev => {
      const atual = prev[postId] || 0;
      let novo = atual + direcao;
      if (novo < 0) novo = totalImagens - 1;
      if (novo >= totalImagens) novo = 0;
      return { ...prev, [postId]: novo };
    });
  };

  const visitarPerfil = (usuario) => {
    setPerfilVisitado(usuario);
    setAbaAtiva('perfil-visita');
  };

  const copiarLinkPost = (id) => {
    const url = `${window.location.origin}/social?post=${id}`;
    navigator.clipboard.writeText(url);
    alert('🔗 Link do post copiado!');
  };

  const copiarLinkPerfil = (handle) => {
    const url = `${window.location.origin}/social?perfil=${handle}`;
    navigator.clipboard.writeText(url);
    alert(`🔗 Link do perfil ${handle} copiado!`);
  };return (
    <main style={{ backgroundColor: '#f1f5f9', color: '#0f172a', minHeight: '100vh', paddingBottom: '60px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      
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

      {/* MODAL EDIÇÃO DE PERFIL */}
      {modalEditarPerfil && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.85)', zIndex: 20000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '20px', maxWidth: '450px', width: '100%', padding: '30px', boxShadow: '0 25px 50px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>⚙️ Editar Perfil & Bio</h3>
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
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>Bio (Biografia):</label>
                <textarea value={meuPerfil.bio} onChange={(e) => setMeuPerfil({...meuPerfil, bio: e.target.value})} style={{ width: '100%', height: '80px', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px', marginTop: '4px' }} />
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
                <button onClick={() => setModalAutenticacao(true)} style={{ backgroundColor: '#7c3aed', color: '#fff', border: 'none', fontSize: '11px', fontWeight: 'bold', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer' }}>
                  🔑 Entrar / Criar Conta
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
                <p style={{ fontSize: '11px', color: '#64748b', margin: '4px 0 0 0' }}>{meuPerfil.bio}</p>
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
              <button onClick={() => copiarLinkPerfil(meuPerfil.handle)} style={{ backgroundColor: '#e2e8f0', color: '#0f172a', border: 'none', fontSize: '11px', fontWeight: 'bold', padding: '10px 12px', borderRadius: '8px', cursor: 'pointer' }}>
                🔗 Compartilhar
              </button>
            </div>

          </div>
        </div>

        {/* STORIES VERTICAIS (Estilo Instagram) */}
        <div style={{ backgroundColor: '#ffffff', padding: '15px 20px', borderRadius: '16px', border: '1px solid #e2e8f0', marginBottom: '25px', display: 'flex', gap: '15px', overflowX: 'auto' }}>
          {[
            { nome: 'Seu Story', avatar: meuPerfil.avatar, meu: true },
            { nome: 'Carlos M.', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150' },
            { nome: 'Ana Paula', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150' },
            { nome: 'Roberto Dias', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150' }
          ].map((st, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', cursor: 'pointer', minWidth: '70px' }}>
              <div style={{ width: '64px', height: '110px', borderRadius: '12px', border: '3px solid #7c3aed', padding: '2px', backgroundColor: '#000', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                <img src={st.avatar} alt="Story" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '10px' }} />
                {st.meu && <span style={{ position: 'absolute', bottom: '4px', backgroundColor: '#7c3aed', color: '#fff', fontSize: '10px', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>+</span>}
              </div>
              <span style={{ fontSize: '11px', color: '#334155', fontWeight: 'bold' }}>{st.nome}</span>
            </div>
          ))}
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
              
              {/* Caixa de Criação de Post com Preview de Imagens e Seletor de Proporção */}
              <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '24px' }}>
                <form onSubmit={publicarPost}>
                  <textarea value={novoTexto} onChange={(e) => setNovoTexto(e.target.value)} placeholder="Compartilhe uma análise, setup HFT ou visão de mercado..." style={{ width: '100%', height: '80px', backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '14px', fontSize: '13px', outline: 'none', boxSizing: 'border-box', marginBottom: '12px' }} />

                  {/* Seletor de Proporção da Foto */}
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '12px', alignItems: 'center', fontSize: '11px' }}>
                    <span style={{ fontWeight: 'bold', color: '#64748b' }}>Formato da Foto:</span>
                    <label><input type="radio" name="prop" checked={proporcaoFoto === 'quadrada'} onChange={() => setProporcaoFoto('quadrada')} /> Quadrada (1:1)</label>
                    <label><input type="radio" name="prop" checked={proporcaoFoto === 'em-pe'} onChange={() => setProporcaoFoto('em-pe')} /> Em Pé (4:5)</label>
                    <label><input type="radio" name="prop" checked={proporcaoFoto === 'deitada'} onChange={() => setProporcaoFoto('deitada')} /> Deitada (16:9)</label>
                  </div>

                  {/* Botões de Upload e Câmera */}
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <label style={{ backgroundColor: '#f1f5f9', padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', border: '1px solid #cbd5e1' }}>
                      📁 Subir Fotos (Carrossel / Múltiplas) <input type="file" accept="image/*" multiple onChange={handleUploadCarrossel} style={{ display: 'none' }} />
                    </label>
                    <button type="button" onClick={iniciarCamera} style={{ backgroundColor: '#f1f5f9', color: '#0f172a', border: '1px solid #cbd5e1', padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>
                      📷 Tirar Foto (Câmera)
                    </button>
                  </div>

                  {/* PREVIEW VISÍVEL DAS FOTOS SELECIONADAS */}
                  {imagensPreview.length > 0 && (
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '12px', overflowX: 'auto', paddingBottom: '6px' }}>
                      {imagensPreview.map((imgSrc, idx) => (
                        <div key={idx} style={{ position: 'relative', width: '80px', height: '80px', borderRadius: '8px', overflow: 'hidden', border: '2px solid #7c3aed', flexShrink: 0 }}>
                          <img src={imgSrc} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          <button type="button" onClick={() => removerFotoPreview(idx)} style={{ position: 'absolute', top: '2px', right: '2px', backgroundColor: 'rgba(239,68,68,0.9)', color: '#fff', border: 'none', borderRadius: '50%', width: '20px', height: '20px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer' }}>✕</button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button type="submit" style={{ backgroundColor: '#7c3aed', color: '#fff', border: 'none', padding: '12px 20px', borderRadius: '8px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}>Publicar no Feed 🚀</button>
                  </div>
                </form>
              </div>

              {/* Feed Posts (Com Carrossel e Proporções Corretas) */}
              {posts.map((p) => {
                const imgAtualIdx = indiceCarrossel[p.id] || 0;
                const temVariasFotos = p.imagens && p.imagens.length > 1;

                let estiloProporcao = { width: '100%', height: '400px' };
                if (p.proporcao === 'em-pe') estiloProporcao = { width: '100%', height: '500px' };
                if (p.proporcao === 'deitada') estiloProporcao = { width: '100%', height: '280px' };

                return (
                  <div key={p.id} style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', overflow: 'hidden' }}>
                    <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', backgroundColor: '#faf5ff' }}>
                      <div onClick={() => visitarPerfil(p.perfilAssociado || { nome: p.autor, handle: p.handle, avatar: p.avatar, bio: p.bio, cargo: p.cargo })} style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                        <img src={p.avatar} alt="Avatar" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} />
                        <div>
                          <b style={{ color: '#0f172a', fontSize: '14px' }}>{p.autor} <span style={{ fontSize: '11px', color: '#7c3aed' }}>{p.handle}</span></b>
                          <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>{p.tempo} • Visitar perfil ↗️</span>
                        </div>
                      </div>
                      <button onClick={() => copiarLinkPost(p.id)} style={{ backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', padding: '6px 10px', borderRadius: '6px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer' }}>
                        🔗 Copiar Link
                      </button>
                    </div>

                    <div style={{ padding: '20px' }}><p style={{ fontSize: '13px', color: '#334155', margin: 0 }}>{p.texto}</p></div>
                    
                    {/* Exibição de Imagens / Carrossel */}
                    {p.imagens && p.imagens.length > 0 && (
                      <div style={{ ...estiloProporcao, backgroundColor: '#000', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <img src={p.imagens[imgAtualIdx]} alt="Post Mídia" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />

                        {temVariasFotos && (
                          <>
                            <button onClick={() => mudarFotoCarrossel(p.id, -1, p.imagens.length)} style={{ position: 'absolute', left: '10px', backgroundColor: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: '50%', width: '30px', height: '30px', cursor: 'pointer', fontWeight: 'bold' }}>‹</button>
                            <button onClick={() => mudarFotoCarrossel(p.id, 1, p.imagens.length)} style={{ position: 'absolute', right: '10px', backgroundColor: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: '50%', width: '30px', height: '30px', cursor: 'pointer', fontWeight: 'bold' }}>›</button>
                            <div style={{ position: 'absolute', bottom: '10px', backgroundColor: 'rgba(0,0,0,0.7)', color: '#fff', padding: '2px 8px', borderRadius: '10px', fontSize: '11px' }}>
                              {imgAtualIdx + 1} / {p.imagens.length}
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    <div style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0', fontSize: '12px' }}>
                      <button onClick={() => curtirPost(p.id)} style={{ background: 'none', border: 'none', color: p.curtido ? '#dc2626' : '#64748b', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>
                        {p.curtido ? '❤️' : '🤍'} {p.likes} Curtidas
                      </button>
                      <span style={{ color: '#64748b', fontSize: '11px' }}>👁️ {p.views || 120} visualizações</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Coluna Direita (Top Traders) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 6px 0' }}>🏆 Top Traders (Semanal)</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {rankingOperadores.slice(0, 10).map((op) => (
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

        {/* 2. ABA RANKING */}
        {abaAtiva === 'ranking' && (
          <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '30px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#0f172a', marginBottom: '6px' }}>🏆 Ranking Oficial Top 10 (Semanal)</h2>
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

        {/* 3. PERFIL DEDICADO */}
        {abaAtiva === 'perfil-visita' && perfilVisitado && (
          <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '30px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <button onClick={() => setAbaAtiva('feed')} style={{ background: 'none', border: 'none', color: '#7c3aed', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}>
                ← Voltar ao Feed Principal
              </button>
              <button onClick={() => copiarLinkPerfil(perfilVisitado.handle)} style={{ backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>
                🔗 Copiar Link deste Perfil
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '30px', flexWrap: 'wrap' }}>
              <img src={perfilVisitado.avatar} alt="Avatar" style={{ width: '90px', height: '90px', borderRadius: '50%', objectFit: 'cover', border: '3px solid #7c3aed' }} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '8px', flexWrap: 'wrap' }}>
                  <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>{perfilVisitado.nome}</h2>
                  <span style={{ fontSize: '14px', color: '#7c3aed', fontWeight: 'bold' }}>{perfilVisitado.handle}</span>
                </div>
                <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 10px 0' }}>{perfilVisitado.cargo} • {perfilVisitado.bio}</p>
                <div style={{ display: 'flex', gap: '25px', fontSize: '13px' }}>
                  <div><b>{perfilVisitado.postsCount || 5}</b> posts</div>
                  <div><b>{perfilVisitado.seguidores || '1.2k'}</b> seguidores</div>
                  <div><b>{perfilVisitado.visualizacoes30Dias || '15k'}</b> views</div>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </main>
  );
}