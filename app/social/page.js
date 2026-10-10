'use client';
import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function SocialContent() {
  const searchParams = useSearchParams();
  const perfilUrl = searchParams.get('perfil');

  const [abaAtiva, setAbaAtiva] = useState('feed');
  const [novoTexto, setNovoTexto] = useState('');
  const [youtubeLink, setYoutubeLink] = useState('');
  const [proporcaoFoto, setProporcaoFoto] = useState('quadrada');
  const [imagensPreview, setImagensPreview] = useState([]);
  const [indiceCarrossel, setIndiceCarrossel] = useState({});
  const [perfilVisitado, setPerfilVisitado] = useState(null);
  const [chatAtivo, setChatAtivo] = useState(null);
  const [textoMensagem, setTextoMensagem] = useState('');
  const [mensagensDirect, setMensagensDirect] = useState({});

  // Modais
  const [modalEditarPerfil, setModalEditarPerfil] = useState(false);
  const [modalAutenticacao, setModalAutenticacao] = useState(false);
  const [modalLista, setModalLista] = useState(null);
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
    bio: 'Pastor, empresário, escritor e palestrante.\nCEO-Founder da Letter e da Jenios Social.\n+14 anos de experiência no mercado financeiro.',
    seguidoresLista: ['@carlosm', '@anapaula', '@robertodias', '@julianac'],
    seguindoLista: ['@carlosm', '@anapaula', '@fernandal'],
    postsCount: 2,
    visualizacoes30Dias: 1420,
    status: '🏆 Conta Verificada',
    autenticado: true
  });

  // Ranking Top 10 Semanal Completo
  const [rankingOperadores] = useState([
    { pos: 1, nome: 'Carlos M.', handle: '@carlosm', cargo: 'Trader Pro', rentabilidade: '+ R$ 14.850', assertividade: '94%', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', bio: 'Especialista em robôs HFT e Mini-Índice.', seguidoresLista: ['@paulostutz', '@anapaula'], seguindoLista: ['@paulostutz'], postsCount: 12, visualizacoes30Dias: '28.4k' },
    { pos: 2, nome: 'Ana Paula S.', handle: '@anapaula', cargo: 'Institucional', rentabilidade: '+ R$ 11.200', assertividade: '91%', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150', bio: 'Arbitragem algorítmica multi-rede na Solana.', seguidoresLista: ['@paulostutz', '@carlosm'], seguindoLista: ['@paulostutz'], postsCount: 9, visualizacoes30Dias: '21.0k' },
    { pos: 3, nome: 'Roberto Dias', handle: '@robertodias', cargo: 'Swing Trader', rentabilidade: '+ R$ 9.400', assertividade: '88%', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150', bio: 'Foco em tendências de médio prazo.', seguidoresLista: ['@paulostutz'], seguindoLista: ['@carlosm'], postsCount: 7, visualizacoes30Dias: '15.8k' },
    { pos: 4, nome: 'Juliana Costa', handle: '@julianac', cargo: 'Scalper', rentabilidade: '+ R$ 7.800', assertividade: '86%', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150', bio: 'Operações de alta frequência no Dólar.', seguidoresLista: [], seguindoLista: [], postsCount: 14, visualizacoes30Dias: '12.1k' },
    { pos: 5, nome: 'Marcos Vinicius', handle: '@marcosv', cargo: 'Quant Dev', rentabilidade: '+ R$ 6.500', assertividade: '85%', avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150', bio: 'Desenvolvedor de estratégias matemáticas.', seguidores: [], seguindoLista: [], postsCount: 5, visualizacoes30Dias: '9.4k' },
    { pos: 6, nome: 'Fernanda Lima', handle: '@fernandal', cargo: 'Analista Macro', rentabilidade: '+ R$ 5.200', assertividade: '82%', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150', bio: 'Foco em notícias globais e commodities.', seguidores: ['@paulostutz'], seguindoLista: ['@paulostutz'], postsCount: 8, visualizacoes30Dias: '8.2k' },
    { pos: 7, nome: 'Lucas Mendes', handle: '@lucasm', cargo: 'Crypto Trader', rentabilidade: '+ R$ 4.300', assertividade: '80%', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150', bio: 'Especialista em DEX e pools de liquidez.', seguidores: [], seguindoLista: [], postsCount: 6, visualizacoes30Dias: '6.9k' },
    { pos: 8, nome: 'Beatriz Souza', handle: '@beatrizs', cargo: 'Day Trader', rentabilidade: '+ R$ 3.800', assertividade: '78%', avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150', bio: 'Operando price action clássico.', seguidores: [], seguindoLista: [], postsCount: 4, visualizacoes30Dias: '5.1k' },
    { pos: 9, nome: 'Gabriel Rocha', handle: '@gabrielr', cargo: 'Position', rentabilidade: '+ R$ 2.900', assertividade: '76%', avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150', bio: 'Alocação de longo prazo em ações.', seguidores: [], seguindoLista: [], postsCount: 3, visualizacoes30Dias: '4.2k' },
    { pos: 10, nome: 'Camila Martins', handle: '@camilam', cargo: 'Iniciante Pro', rentabilidade: '+ R$ 1.800', assertividade: '74%', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150', bio: 'Evoluindo no método Jenios.', seguidores: [], seguindoLista: [], postsCount: 2, visualizacoes30Dias: '3.0k' }
  ]);

  const [noticiasMacro] = useState([
    { id: 1, fonte: 'Bloomberg', cat: 'GLOBAL', titulo: 'Bancos centrais avaliam corte agressivo na taxa de juros global', impacto: '🟢 Positivo p/ Risco', hora: 'Há 5 mins' },
    { id: 2, fonte: 'Reuters', cat: 'COMMODITIES', titulo: 'Fluxo institucional estrangeiro dispara na B3 com alta do minério', impacto: '🟢 Alta Liquidez', hora: 'Há 12 mins' },
    { id: 3, fonte: 'InfoMoney', cat: 'HFT & MERCADO', titulo: 'Volatilidade no Mini-Índice atinge pico recorde no trimestre', impacto: '🔴 Alerta Volatilidade', hora: 'Há 25 mins' }
  ]);

  const [posts, setPosts] = useState([
    { 
      id: 1, 
      autor: 'Carlos M.', 
      handle: '@carlosm', 
      cargo: 'ESTRATEGISTA HFT', 
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', 
      bio: 'Especialista em robôs HFT e Mini-Índice.',
      texto: 'Modo Reverso ativado no Mini-Índice com sucesso!', 
      imagens: ['https://images.unsplash.com/photo-1642543492481-44e81e3914a7?w=800'], 
      youtubeUrl: '',
      proporcao: 'quadrada',
      tempo: 'Há 15 mins', 
      likes: 34, 
      curtido: false, 
      views: 342,
      perfilAssociado: rankingOperadores[0] 
    }
  ]);

  useEffect(() => {
    const perfilSalvo = localStorage.getItem('jenios_social_perfil');
    if (perfilSalvo) {
      try { setMeuPerfil(JSON.parse(perfilSalvo)); } catch(e) {}
    }

    const postsSalvos = localStorage.getItem('jenios_social_posts_v4');
    if (postsSalvos) {
      try { setPosts(JSON.parse(postsSalvos)); } catch(e) {}
    } else {
      const atualizados = posts.map(p => ({ ...p, views: p.views + 1 }));
      setPosts(atualizados);
    }

    const directSalvo = localStorage.getItem('jenios_social_directs');
    if (directSalvo) {
      try { setMensagensDirect(JSON.parse(directSalvo)); } catch(e) {}
    }

    if (perfilUrl) {
      const encontrado = rankingOperadores.find(op => op.handle === perfilUrl) || meuPerfil;
      setPerfilVisitado(encontrado);
      setAbaAtiva('perfil-visita');
    }
  }, [perfilUrl]);

  const salvarPostsNoStorage = (novosPosts) => {
    setPosts(novosPosts);
    localStorage.setItem('jenios_social_posts_v4', JSON.stringify(novosPosts));
  };

  const extrairEmbedYoutube = (url) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? `https://www.youtube.com/embed/${match[2]}` : null;
  };

  const salvarEdicaoPerfil = (e) => {
    e.preventDefault();
    localStorage.setItem('jenios_social_perfil', JSON.stringify(meuPerfil));
    setModalEditarPerfil(false);
    alert('✅ Perfil e Bio atualizados com sucesso!');
  };

  const handleUploadAvatar = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setMeuPerfil(prev => ({ ...prev, avatar: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const fazerLogout = () => {
    const perfilSair = { ...meuPerfil, autenticado: false, nome: 'Visitante', handle: '@visitante' };
    setMeuPerfil(perfilSair);
    localStorage.setItem('jenios_social_perfil', JSON.stringify(perfilSair));
    alert('Sessão encerrada.');
  };

  const processarAuth = (e) => {
    e.preventDefault();
    const perfilLogado = { ...meuPerfil, autenticado: true };
    setMeuPerfil(perfilLogado);
    localStorage.setItem('jenios_social_perfil', JSON.stringify(perfilLogado));
    setModalAutenticacao(false);
    alert('Autenticado com sucesso!');
  };

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
    alert('📸 Foto capturada e adicionada ao carrossel!');
  };

  const publicarPost = (e) => {
    e.preventDefault();
    if (!novoTexto.trim() && imagensPreview.length === 0 && !youtubeLink.trim()) return;

    const novoP = {
      id: Date.now(),
      autor: meuPerfil.nome,
      handle: meuPerfil.handle,
      cargo: meuPerfil.cargo,
      avatar: meuPerfil.avatar,
      bio: meuPerfil.bio,
      texto: novoTexto,
      imagens: imagensPreview,
      youtubeUrl: youtubeLink.trim(),
      proporcao: proporcaoFoto,
      tempo: 'Agora mesmo',
      likes: 0,
      curtido: false,
      views: 1,
      perfilAssociado: meuPerfil
    };

    const atualizados = [novoP, ...posts];
    salvarPostsNoStorage(atualizados);
    setNovoTexto('');
    setYoutubeLink('');
    setImagensPreview([]);
    setProporcaoFoto('quadrada');

    const perfilAtualizado = {
      ...meuPerfil,
      postsCount: Number(meuPerfil.postsCount || 0) + 1,
      visualizacoes30Dias: Number(meuPerfil.visualizacoes30Dias || 0) + 15
    };
    setMeuPerfil(perfilAtualizado);
    localStorage.setItem('jenios_social_perfil', JSON.stringify(perfilAtualizado));
    alert('🚀 Publicação realizada com sucesso!');
  };

  const repostarPost = (postOriginal) => {
    const novoP = {
      id: Date.now(),
      autor: meuPerfil.nome,
      handle: meuPerfil.handle,
      cargo: meuPerfil.cargo,
      avatar: meuPerfil.avatar,
      bio: meuPerfil.bio,
      texto: `🔄 Repost de ${postOriginal.handle}: "${postOriginal.texto}"`,
      imagens: postOriginal.imagens || [],
      youtubeUrl: postOriginal.youtubeUrl || '',
      proporcao: postOriginal.proporcao || 'quadrada',
      tempo: 'Agora mesmo',
      likes: 0,
      curtido: false,
      views: 1,
      perfilAssociado: meuPerfil
    };
    const atualizados = [novoP, ...posts];
    salvarPostsNoStorage(atualizados);
    alert('🚀 Post repostado com sucesso no seu feed!');
  };

  const curtirPost = (id) => {
    const atualizados = posts.map(p => p.id === id ? { 
      ...p, 
      likes: p.curtido ? p.likes - 1 : p.likes + 1, 
      curtido: !p.curtido 
    } : p);
    salvarPostsNoStorage(atualizados);
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

  const enviarMensagemDirect = (e) => {
    e.preventDefault();
    if (!textoMensagem.trim() || !chatAtivo) return;
    const handleDest = chatAtivo.handle;
    const conversaAtual = mensagensDirect[handleDest] || [];
    const novaMensagem = { remetente: meuPerfil.handle, texto: textoMensagem, hora: 'Agora' };
    const novasConversas = { ...mensagensDirect, [handleDest]: [...conversaAtual, novaMensagem] };
    
    setMensagensDirect(novasConversas);
    localStorage.setItem('jenios_social_directs', JSON.stringify(novasConversas));
    setTextoMensagem('');
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

      {modalLista && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.85)', zIndex: 25000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '20px', maxWidth: '380px', width: '100%', padding: '25px', boxShadow: '0 25px 50px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 'bold', textTransform: 'capitalize', margin: 0 }}>{modalLista}</h3>
              <button onClick={() => setModalLista(null)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '250px', overflowY: 'auto' }}>
              {(meuPerfil[modalLista === 'seguidores' ? 'seguidoresLista' : 'seguindoLista'] || []).map((handle, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#7c3aed' }}>{handle}</span>
                  <span style={{ fontSize: '10px', color: '#059669', fontWeight: 'bold' }}>Seguindo ⚡</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDITAR PERFIL COM SUPORTE A FOTO / AVATAR */}
      {modalEditarPerfil && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.85)', zIndex: 20000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '20px', maxWidth: '450px', width: '100%', padding: '30px', boxShadow: '0 25px 50px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>⚙️ Editar Perfil & Foto</h3>
              <button onClick={() => setModalEditarPerfil(false)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
            </div>
            <form onSubmit={salvarEdicaoPerfil} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              
              <div style={{ textAlign: 'center', marginBottom: '10px' }}>
                <img src={meuPerfil.avatar} alt="Avatar Atual" style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '3px solid #7c3aed', marginBottom: '8px' }} />
                <div>
                  <label style={{ backgroundColor: '#f1f5f9', color: '#0f172a', border: '1px solid #cbd5e1', padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', display: 'inline-block' }}>
                    📁 Carregar Nova Foto do Dispositivo
                    <input type="file" accept="image/*" onChange={handleUploadAvatar} style={{ display: 'none' }} />
                  </label>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>Ou Link da Foto (URL):</label>
                <input type="text" value={meuPerfil.avatar} onChange={(e) => setMeuPerfil({...meuPerfil, avatar: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px', marginTop: '4px', boxSizing: 'border-box' }} />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>Nome:</label>
                <input type="text" value={meuPerfil.nome} onChange={(e) => setMeuPerfil({...meuPerfil, nome: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px', marginTop: '4px', boxSizing: 'border-box' }} required />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>Handle (@usuário):</label>
                <input type="text" value={meuPerfil.handle} onChange={(e) => setMeuPerfil({...meuPerfil, handle: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px', marginTop: '4px', boxSizing: 'border-box' }} required />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>Cargo / Título:</label>
                <input type="text" value={meuPerfil.cargo} onChange={(e) => setMeuPerfil({...meuPerfil, cargo: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px', marginTop: '4px', boxSizing: 'border-box' }} />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>Bio Completa (Fixada no Perfil):</label>
                <textarea value={meuPerfil.bio} onChange={(e) => setMeuPerfil({...meuPerfil, bio: e.target.value})} style={{ width: '100%', height: '80px', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px', marginTop: '4px', boxSizing: 'border-box' }} />
              </div>

              <button type="submit" style={{ backgroundColor: '#7c3aed', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer', marginTop: '8px' }}>Salvar Alterações</button>
            </form>
          </div>
        </div>
      )}

      {/* CABEÇALHO */}
      <div style={{ maxWidth: '1050px', margin: '0 auto', padding: '30px 20px 0 20px' }}>
        
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
              <button onClick={() => setModalAutenticacao(true)} style={{ backgroundColor: '#7c3aed', color: '#fff', border: 'none', fontSize: '11px', fontWeight: 'bold', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer' }}>
                🔑 Entrar
              </button>
            )}
          </div>
        </div>

        {/* PERFIL HEADER */}
        <div style={{ backgroundColor: '#ffffff', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0', marginBottom: '25px', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px' }}>
            
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '20px', flex: 1, minWidth: '300px' }}>
              <img src={meuPerfil.avatar} alt="Avatar" style={{ width: '85px', height: '85px', borderRadius: '50%', objectFit: 'cover', border: '3px solid #7c3aed', flexShrink: 0 }} />
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 2px 0' }}>{meuPerfil.nome} <span style={{ fontSize: '14px', color: '#7c3aed' }}>{meuPerfil.handle}</span></h2>
                <span style={{ fontSize: '12px', color: '#7c3aed', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>{meuPerfil.cargo}</span>
                <p style={{ fontSize: '12px', color: '#334155', margin: 0, whiteSpace: 'pre-line', lineHeight: '1.4' }}>{meuPerfil.bio}</p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '16px', backgroundColor: '#f8fafc', padding: '14px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', alignItems: 'center' }}>
              <div style={{ textAlign: 'center' }}>
                <span style={{ fontSize: '10px', color: '#64748b', display: 'block', fontWeight: 'bold' }}>POSTS</span>
                <b style={{ fontSize: '15px', color: '#0f172a' }}>{posts.filter(p => p.handle === meuPerfil.handle).length}</b>
              </div>
              <div style={{ width: '1px', height: '24px', backgroundColor: '#cbd5e1' }}></div>
              <div onClick={() => setModalLista('seguidores')} style={{ textAlign: 'center', cursor: 'pointer' }}>
                <span style={{ fontSize: '10px', color: '#64748b', display: 'block', fontWeight: 'bold' }}>SEGUIDORES</span>
                <b style={{ fontSize: '15px', color: '#7c3aed' }}>{(meuPerfil.seguidoresLista || []).length}</b>
              </div>
              <div style={{ width: '1px', height: '24px', backgroundColor: '#cbd5e1' }}></div>
              <div onClick={() => setModalLista('seguindo')} style={{ textAlign: 'center', cursor: 'pointer' }}>
                <span style={{ fontSize: '10px', color: '#64748b', display: 'block', fontWeight: 'bold' }}>SEGUINDO</span>
                <b style={{ fontSize: '15px', color: '#7c3aed' }}>{(meuPerfil.seguindoLista || []).length}</b>
              </div>
              <div style={{ width: '1px', height: '24px', backgroundColor: '#cbd5e1' }}></div>
              <div style={{ textAlign: 'center' }}>
                <span style={{ fontSize: '10px', color: '#64748b', display: 'block', fontWeight: 'bold' }}>VIEWS</span>
                <b style={{ fontSize: '15px', color: '#059669' }}>{posts.reduce((acc, p) => acc + (p.views || 0), meuPerfil.visualizacoes30Dias)}</b>
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

        {/* ABA FEED */}
        {abaAtiva === 'feed' && (
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '25px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '24px' }}>
                <form onSubmit={publicarPost}>
                  <textarea value={novoTexto} onChange={(e) => setNovoTexto(e.target.value)} placeholder="Compartilhe uma análise, setup HFT ou visão de mercado..." style={{ width: '100%', height: '80px', backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '14px', fontSize: '13px', outline: 'none', boxSizing: 'border-box', marginBottom: '12px' }} />

                  <div style={{ marginBottom: '12px' }}>
                    <input type="text" placeholder="🔗 Link de vídeo do YouTube (Opcional)" value={youtubeLink} onChange={(e) => setYoutubeLink(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px', boxSizing: 'border-box' }} />
                  </div>

                  <div style={{ display: 'flex', gap: '10px', marginBottom: '12px', alignItems: 'center', fontSize: '11px', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 'bold', color: '#64748b' }}>Formato da Foto:</span>
                    <label><input type="radio" name="prop" checked={proporcaoFoto === 'quadrada'} onChange={() => setProporcaoFoto('quadrada')} /> Quadrada (1:1)</label>
                    <label><input type="radio" name="prop" checked={proporcaoFoto === 'em-pe'} onChange={() => setProporcaoFoto('em-pe')} /> Em Pé (4:5)</label>
                    <label><input type="radio" name="prop" checked={proporcaoFoto === 'deitada'} onChange={() => setProporcaoFoto('deitada')} /> Deitada (16:9)</label>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <button type="button" onClick={iniciarCamera} style={{ backgroundColor: '#f1f5f9', color: '#0f172a', border: '1px solid #cbd5e1', padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>
                      📷 Tirar Foto (Câmera)
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', marginBottom: '12px', overflowX: 'auto', paddingBottom: '6px', alignItems: 'center' }}>
                    {imagensPreview.map((imgSrc, idx) => (
                      <div key={idx} style={{ position: 'relative', width: '80px', height: '80px', borderRadius: '8px', overflow: 'hidden', border: '2px solid #7c3aed', flexShrink: 0 }}>
                        <img src={imgSrc} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <button type="button" onClick={() => removerFotoPreview(idx)} style={{ position: 'absolute', top: '2px', right: '2px', backgroundColor: 'rgba(239,68,68,0.9)', color: '#fff', border: 'none', borderRadius: '50%', width: '20px', height: '20px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer' }}>✕</button>
                      </div>
                    ))}

                    <label style={{ width: '80px', height: '80px', borderRadius: '8px', border: '2px dashed #7c3aed', backgroundColor: '#faf5ff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }} title="Adicionar mais fotos ao carrossel">
                      <span style={{ fontSize: '24px', color: '#7c3aed', fontWeight: 'bold', lineHeight: 1 }}>+</span>
                      <span style={{ fontSize: '9px', color: '#7c3aed', fontWeight: 'bold', marginTop: '2px' }}>Adicionar</span>
                      <input type="file" accept="image/*" multiple onChange={handleUploadCarrossel} style={{ display: 'none' }} />
                    </label>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button type="submit" style={{ backgroundColor: '#7c3aed', color: '#fff', border: 'none', padding: '12px 20px', borderRadius: '8px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}>Publicar no Feed 🚀</button>
                  </div>
                </form>
              </div>

              {posts.map((p) => {
                const imgAtualIdx = indiceCarrossel[p.id] || 0;
                const temVariasFotos = p.imagens && p.imagens.length > 1;
                const embedYoutubeUrl = extrairEmbedYoutube(p.youtubeUrl);

                let estiloProporcao = { width: '100%', minHeight: '350px', maxHeight: '550px' };
                if (p.proporcao === 'em-pe') estiloProporcao = { width: '100%', minHeight: '450px', maxHeight: '600px' };
                if (p.proporcao === 'deitada') estiloProporcao = { width: '100%', minHeight: '280px', maxHeight: '400px' };

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
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={() => repostarPost(p)} style={{ backgroundColor: '#f3e8ff', color: '#7c3aed', border: '1px solid #d8b4fe', padding: '6px 10px', borderRadius: '6px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer' }}>🔄 Repostar</button>
                        <button onClick={() => copiarLinkPost(p.id)} style={{ backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', padding: '6px 10px', borderRadius: '6px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer' }}>🔗 Copiar Link</button>
                      </div>
                    </div>

                    <div style={{ padding: '20px' }}><p style={{ fontSize: '13px', color: '#334155', margin: 0 }}>{p.texto}</p></div>
                    
                    {embedYoutubeUrl && (
                      <div style={{ width: '100%', height: '360px', backgroundColor: '#000' }}>
                        <iframe src={embedYoutubeUrl} title="YouTube video player" style={{ width: '100%', height: '100%', border: 'none' }} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen></iframe>
                      </div>
                    )}

                    {p.imagens && p.imagens.length > 0 && !embedYoutubeUrl && (
                      <div style={{ ...estiloProporcao, backgroundColor: '#000', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <img src={p.imagens[imgAtualIdx]} alt="Post Mídia" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />

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
                      <span style={{ color: '#64748b', fontSize: '11px' }}>👁️ {p.views || 1} visualizações</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Notícias e Top Traders */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 10px 0' }}>🌐 Canal de Notícias Macro (3 Fontes)</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {noticiasMacro.map((n) => (
                    <div key={n.id} style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#7c3aed', backgroundColor: '#f3e8ff', padding: '2px 6px', borderRadius: '4px' }}>{n.fonte}</span>
                        <span style={{ fontSize: '10px', color: '#64748b' }}>{n.hora}</span>
                      </div>
                      <h4 style={{ fontSize: '11px', color: '#0f172a', margin: '0 0 6px 0', fontWeight: 'bold' }}>{n.titulo}</h4>
                      <span style={{ fontSize: '10px', fontWeight: 'bold' }}>{n.impacto}</span>
                    </div>
                  ))}
                </div>
              </div>

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

        {/* ABA RANKING */}
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

        {/* PERFIL VISITA */}
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

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '24px', marginBottom: '30px', flexWrap: 'wrap' }}>
              <img src={perfilVisitado.avatar} alt="Avatar" style={{ width: '90px', height: '90px', borderRadius: '50%', objectFit: 'cover', border: '3px solid #7c3aed' }} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '8px', flexWrap: 'wrap' }}>
                  <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>{perfilVisitado.nome}</h2>
                  <span style={{ fontSize: '14px', color: '#7c3aed', fontWeight: 'bold' }}>{perfilVisitado.handle}</span>
                  <button onClick={() => setChatAtivo(perfilVisitado)} style={{ backgroundColor: '#7c3aed', color: '#fff', border: 'none', padding: '8px 18px', borderRadius: '8px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}>
                    💬 Enviar Mensagem (Direct)
                  </button>
                </div>
                <p style={{ fontSize: '12px', color: '#334155', margin: '0 0 12px 0', whiteSpace: 'pre-line' }}>{perfilVisitado.bio}</p>
                <div style={{ display: 'flex', gap: '25px', fontSize: '13px' }}>
                  <div><b>{posts.filter(p => p.handle === perfilVisitado.handle).length || perfilVisitado.postsCount}</b> posts</div>
                  <div><b>{(perfilVisitado.seguidoresLista || []).length || 140}</b> seguidores</div>
                  <div><b>{perfilVisitado.visualizacoes30Dias}</b> views</div>
                </div>
              </div>
            </div>

            {chatAtivo && chatAtivo.handle === perfilVisitado.handle && (
              <div style={{ backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '20px', marginTop: '20px' }}>
                <h4 style={{ fontSize: '13px', fontWeight: 'bold', color: '#0f172a', marginBottom: '10px' }}>💬 Conversa Direta com {perfilVisitado.nome}</h4>
                <div style={{ height: '150px', backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px', overflowY: 'auto', marginBottom: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {(mensagensDirect[perfilVisitado.handle] || []).length === 0 ? (
                    <span style={{ fontSize: '11px', color: '#64748b', textAlign: 'center', marginTop: '50px' }}>Nenhuma mensagem enviada ainda. Inicie a conversa!</span>
                  ) : (
                    (mensagensDirect[perfilVisitado.handle] || []).map((msg, index) => (
                      <div key={index} style={{ alignSelf: msg.remetente === meuPerfil.handle ? 'flex-end' : 'flex-start', backgroundColor: msg.remetente === meuPerfil.handle ? '#7c3aed' : '#e2e8f0', color: msg.remetente === meuPerfil.handle ? '#fff' : '#0f172a', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', maxWidth: '70%' }}>
                        {msg.texto}
                      </div>
                    ))
                  )}
                </div>
                <form onSubmit={enviarMensagemDirect} style={{ display: 'flex', gap: '8px' }}>
                  <input type="text" placeholder="Escreva uma mensagem..." value={textoMensagem} onChange={(e) => setTextoMensagem(e.target.value)} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px' }} required />
                  <button type="submit" style={{ backgroundColor: '#059669', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: '8px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}>Enviar 📨</button>
                </form>
              </div>
            )}

            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '20px', marginTop: '20px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#0f172a', marginBottom: '15px' }}>📸 Publicações de {perfilVisitado.nome}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px' }}>
                {posts.filter(p => p.handle === perfilVisitado.handle).length === 0 ? (
                  <p style={{ fontSize: '12px', color: '#64748b', gridColumn: 'span 3', textAlign: 'center' }}>Este operador ainda não publicou fotos no feed.</p>
                ) : (
                  posts.filter(p => p.handle === perfilVisitado.handle).map(p => (
                    <div key={p.id} style={{ height: '160px', borderRadius: '10px', overflow: 'hidden', backgroundColor: '#000', border: '1px solid #e2e8f0' }}>
                      {p.imagens && p.imagens[0] && <img src={p.imagens[0]} alt="Post" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        )}

      </div>
    </main>
  );
}

export default function SocialPage() {
  return (
    <Suspense fallback={<div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Carregando comunidade social...</div>}>
      <SocialContent />
    </Suspense>
  );
}