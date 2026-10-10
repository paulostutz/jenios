'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import CryptoValidator from '../components/CryptoValidator';
import SocialPostCard from '../components/SocialPostCard';
import SocialStories from '../components/SocialStories';



const JENIOS_SOCIAL_DB = 'jenios-social-db';
const JENIOS_SOCIAL_STORE = 'social-data';
const JENIOS_POSTS_KEY = 'posts-v1';

function abrirJeniosSocialDb() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB não disponível.'));
      return;
    }

    const request = indexedDB.open(JENIOS_SOCIAL_DB, 1);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(JENIOS_SOCIAL_STORE)) {
        db.createObjectStore(JENIOS_SOCIAL_STORE);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function salvarPostsIndexedDb(posts) {
  const db = await abrirJeniosSocialDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(
      JENIOS_SOCIAL_STORE,
      'readwrite'
    );

    const store = transaction.objectStore(
      JENIOS_SOCIAL_STORE
    );

    store.put(posts, JENIOS_POSTS_KEY);

    transaction.oncomplete = () => {
      db.close();
      resolve();
    };

    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
  });
}

async function carregarPostsIndexedDb() {
  const db = await abrirJeniosSocialDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(
      JENIOS_SOCIAL_STORE,
      'readonly'
    );

    const store = transaction.objectStore(
      JENIOS_SOCIAL_STORE
    );

    const request = store.get(JENIOS_POSTS_KEY);

    request.onsuccess = () => {
      db.close();
      resolve(request.result || null);
    };

    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

function SocialContent() {
  const [abaGaleria, setAbaGaleria] = useState('posts');

  const searchParams = useSearchParams();
  const perfilUrl = searchParams.get('perfil');

  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }

    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'instant',
    });

    const timer = setTimeout(() => {
      window.scrollTo(0, 0);
    }, 50);

    return () => clearTimeout(timer);
  }, []);

  const [abaAtiva, setAbaAtiva] = useState('feed');
  const [storiesJenios, setStoriesJenios] = useState([]);

  useEffect(() => {
    try {
      const salvos = JSON.parse(
        localStorage.getItem('jenios_social_stories') || '[]'
      );

      if (Array.isArray(salvos)) {
        setStoriesJenios(
          salvos.filter((s) =>
            Date.now() - new Date(s.criadoEm).getTime() <
            24 * 60 * 60 * 1000
          )
        );
      }
    } catch (error) {
      console.error('Erro ao carregar Stories:', error);
    }
  }, []);

  const adicionarStoryJenios = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,video/*';

    input.onchange = async (evento) => {
      const arquivo = evento.target.files?.[0];
      if (!arquivo) return;

      if (arquivo.size > 4 * 1024 * 1024) {
        alert('Arquivo muito grande. Limite temporario: 4 MB.');
        return;
      }

      const leitor = new FileReader();

      leitor.onload = () => {
        const novoStory = {
          id: Date.now(),
          autor: meuPerfil.nome,
          handle: meuPerfil.handle,
          avatar: meuPerfil.avatar,
          src: leitor.result,
          tipo: arquivo.type.startsWith('video/')
            ? 'video'
            : 'imagem',
          criadoEm: new Date().toISOString(),
        };

        const atualizados = [...storiesJenios, novoStory];

        try {
          localStorage.setItem(
            'jenios_social_stories',
            JSON.stringify(atualizados)
          );
          setStoriesJenios(atualizados);
        } catch (error) {
          console.error(error);
          alert('Nao foi possivel salvar o Story.');
        }
      };

      leitor.readAsDataURL(arquivo);
    };

    input.click();
  };

  const excluirStoryJenios = (id) => {
    setStoriesJenios((anteriores) => {
      const atualizados = anteriores.filter((story) => story.id !== id);
      try {
        localStorage.setItem('jenios_social_stories', JSON.stringify(atualizados));
      } catch (erro) {
        console.error('Erro ao persistir exclusão do Story:', erro);
      }
      return atualizados;
    });
  };

  const [novoTexto, setNovoTexto] = useState('');
  const [youtubeLink, setYoutubeLink] = useState('');
  const [imagensPreview, setImagensPreview] = useState([]);
  const [indiceCarrossel, setIndiceCarrossel] = useState({});
  const [perfilVisitado, setPerfilVisitado] = useState(null);
  const [postEmFoco, setPostEmFoco] = useState(null);
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
    avatar:
      'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
    bio:
      'Pastor, empresário, escritor e palestrante.\nCEO-Founder da Letter e da Jenios Social.\n+14 anos de experiência no mercado financeiro.',
    seguidoresLista: [
      '@carlosm',
      '@anapaula',
      '@robertodias',
      '@julianac',
    ],
    seguindoLista: ['@carlosm', '@anapaula', '@fernandal'],
    postsCount: 2,
    visualizacoes30Dias: 1420,
    status: '🏆 Conta Verificada',
    autenticado: true,
  });

  // Ranking Top 10 Semanal Completo
  const [rankingOperadores] = useState([
    {
      pos: 1,
      nome: 'Carlos M.',
      handle: '@carlosm',
      cargo: 'Trader Pro',
      rentabilidade: '+ R$ 14.850',
      assertividade: '94%',
      avatar:
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
      bio: 'Especialista em robôs HFT e Mini-Índice.',
      seguidoresLista: ['@paulostutz', '@anapaula'],
      seguindoLista: ['@paulostutz'],
      postsCount: 12,
      visualizacoes30Dias: '28.4k',
    },
    {
      pos: 2,
      nome: 'Ana Paula S.',
      handle: '@anapaula',
      cargo: 'Institucional',
      rentabilidade: '+ R$ 11.200',
      assertividade: '91%',
      avatar:
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      bio: 'Arbitragem algorítmica multi-rede na Solana.',
      seguidoresLista: ['@paulostutz', '@carlosm'],
      seguindoLista: ['@paulostutz'],
      postsCount: 9,
      visualizacoes30Dias: '21.0k',
    },
    {
      pos: 3,
      nome: 'Roberto Dias',
      handle: '@robertodias',
      cargo: 'Swing Trader',
      rentabilidade: '+ R$ 9.400',
      assertividade: '88%',
      avatar:
        'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
      bio: 'Foco em tendências de médio prazo.',
      seguidoresLista: ['@paulostutz'],
      seguindoLista: ['@carlosm'],
      postsCount: 7,
      visualizacoes30Dias: '15.8k',
    },
    {
      pos: 4,
      nome: 'Juliana Costa',
      handle: '@julianac',
      cargo: 'Scalper',
      rentabilidade: '+ R$ 7.800',
      assertividade: '86%',
      avatar:
        'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
      bio: 'Operações de alta frequência no Dólar.',
      seguidoresLista: [],
      seguindoLista: [],
      postsCount: 14,
      visualizacoes30Dias: '12.1k',
    },
    {
      pos: 5,
      nome: 'Marcos Vinicius',
      handle: '@marcosv',
      cargo: 'Quant Dev',
      rentabilidade: '+ R$ 6.500',
      assertividade: '85%',
      avatar:
        'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150',
      bio: 'Desenvolvedor de estratégias matemáticas.',
      seguidores: [],
      seguindoLista: [],
      postsCount: 5,
      visualizacoes30Dias: '9.4k',
    },
    {
      pos: 6,
      nome: 'Fernanda Lima',
      handle: '@fernandal',
      cargo: 'Analista Macro',
      rentabilidade: '+ R$ 5.200',
      assertividade: '82%',
      avatar:
        'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150',
      bio: 'Foco em notícias globais e commodities.',
      seguidores: ['@paulostutz'],
      seguindoLista: ['@paulostutz'],
      postsCount: 8,
      visualizacoes30Dias: '8.2k',
    },
    {
      pos: 7,
      nome: 'Lucas Mendes',
      handle: '@lucasm',
      cargo: 'Crypto Trader',
      rentabilidade: '+ R$ 4.300',
      assertividade: '80%',
      avatar:
        'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
      bio: 'Especialista em DEX e pools de liquidez.',
      seguidores: [],
      seguindoLista: [],
      postsCount: 6,
      visualizacoes30Dias: '6.9k',
    },
    {
      pos: 8,
      nome: 'Beatriz Souza',
      handle: '@beatrizs',
      cargo: 'Day Trader',
      rentabilidade: '+ R$ 3.800',
      assertividade: '78%',
      avatar:
        'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150',
      bio: 'Operando price action clássico.',
      seguidores: [],
      seguindoLista: [],
      postsCount: 4,
      visualizacoes30Dias: '5.1k',
    },
    {
      pos: 9,
      nome: 'Gabriel Rocha',
      handle: '@gabrielr',
      cargo: 'Position',
      rentabilidade: '+ R$ 2.900',
      assertividade: '76%',
      avatar:
        'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150',
      bio: 'Alocação de longo prazo em ações.',
      seguidores: [],
      seguindoLista: [],
      postsCount: 3,
      visualizacoes30Dias: '4.2k',
    },
    {
      pos: 10,
      nome: 'Camila Martins',
      handle: '@camilam',
      cargo: 'Iniciante Pro',
      rentabilidade: '+ R$ 1.800',
      assertividade: '74%',
      avatar:
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      bio: 'Evoluindo no método Jenios.',
      seguidores: [],
      seguindoLista: [],
      postsCount: 2,
      visualizacoes30Dias: '3.0k',
    },
  ]);

  const [noticiasMacro] = useState([
    {
      id: 1,
      fonte: 'Bloomberg',
      cat: 'GLOBAL',
      titulo:
        'Bancos centrais avaliam corte agressivo na taxa de juros global',
      impacto: '🟢 Positivo p/ Risco',
      hora: 'Há 5 mins',
    },
    {
      id: 2,
      fonte: 'Reuters',
      cat: 'COMMODITIES',
      titulo:
        'Fluxo institucional estrangeiro dispara na B3 com alta do minério',
      impacto: '🟢 Alta Liquidez',
      hora: 'Há 12 mins',
    },
    {
      id: 3,
      fonte: 'InfoMoney',
      cat: 'HFT & MERCADO',
      titulo:
        'Volatilidade no Mini-Índice atinge pico recorde no trimestre',
      impacto: '🔴 Alerta Volatilidade',
      hora: 'Há 25 mins',
    },
  ]);

  const [postsProntos, setPostsProntos] = useState(false);
  const [erroPosts, setErroPosts] = useState('');
  const [posts, setPosts] = useState([
    {
      id: 1,
      autor: 'Carlos M.',
      handle: '@carlosm',
      cargo: 'ESTRATEGISTA HFT',
      avatar:
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
      bio: 'Especialista em robôs HFT e Mini-Índice.',
      texto: 'Modo Reverso ativado no Mini-Índice com sucesso!',
      imagens: [
        'https://images.unsplash.com/photo-1642543492481-44e81e3914a7?w=800',
      ],
      youtubeUrl: '',
      proporcao: 'quadrada',
      tempo: 'Há 15 mins',
      likes: 34,
      curtido: false,
      views: 342,
      perfilAssociado: rankingOperadores[0],
    },
  ]);

  useEffect(() => {
    const perfilSalvo = localStorage.getItem('jenios_social_perfil');

    if (perfilSalvo) {
      try {
        setMeuPerfil(JSON.parse(perfilSalvo));
      } catch (e) {}
    }

    carregarPostsIndexedDb()
      .then((dados) => {
        if (Array.isArray(dados)) {
          setPosts(dados);
          setPostsProntos(true);
        } else if (dados == null) {
          setPosts([]);
          setPostsProntos(true);
        } else {
          setErroPosts(
            'Formato inesperado. Dados preservados.'
          );
        }
      })
      .catch((erro) => {
        console.error('Erro ao recuperar posts:', erro);
        setErroPosts(
          'Não foi possível carregar as publicações.'
        );
      });

    const directSalvo = localStorage.getItem('jenios_social_directs');

    if (directSalvo) {
      try {
        setMensagensDirect(JSON.parse(directSalvo));
      } catch (e) {}
    }

    if (perfilUrl) {
      const encontrado =
        rankingOperadores.find((op) => op.handle === perfilUrl) || meuPerfil;

      setPerfilVisitado(encontrado);
      setAbaAtiva('perfil-visita');
    }
  }, [perfilUrl]);

  const salvarPostsNoStorage = (novosPosts) => {
    if (!postsProntos || erroPosts) {
      alert('Aguarde o carregamento das publicações.');
      return;
    }
    setPosts(novosPosts);

    salvarPostsIndexedDb(novosPosts).catch((error) => {
      console.error(
        'Erro ao salvar posts da JENIOS Social:',
        error
      );

      alert(
        'Não foi possível salvar esta publicação no armazenamento local.'
      );
    });
  };

  const extrairEmbedYoutube = (url) => {
    if (!url) return null;

    const regExp =
      /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;

    const match = url.match(regExp);

    return match && match[2].length === 11
      ? `https://www.youtube.com/embed/${match[2]}`
      : null;
  };

  // VERIFICAÇÃO DE DUPLICIDADE DE @HANDLE
  const verificarHandleEmUso = (handleInformado) => {
    const handleLimpo = handleInformado.startsWith('@')
      ? handleInformado.trim().toLowerCase()
      : `@${handleInformado.trim().toLowerCase()}`;

    if (handleLimpo === meuPerfil.handle.toLowerCase()) return false;

    const existeNoRanking = rankingOperadores.some(
      (op) => op.handle.toLowerCase() === handleLimpo
    );

    if (existeNoRanking) return true;

    const usuariosSalvos = JSON.parse(
      localStorage.getItem('jenios_social_usuarios_registrados') || '[]'
    );

    const existeNosSalvos = usuariosSalvos.some(
      (u) =>
        u.handle.toLowerCase() === handleLimpo &&
        u.handle.toLowerCase() !== meuPerfil.handle.toLowerCase()
    );

    return existeNosSalvos;
  };

  const salvarEdicaoPerfil = (e) => {
    e.preventDefault();

    let handleFormatado = meuPerfil.handle.trim();

    if (!handleFormatado.startsWith('@')) {
      handleFormatado = `@${handleFormatado}`;
    }

    if (verificarHandleEmUso(handleFormatado)) {
      alert(
        '❌ Este @ já está em uso por outro usuário. Escolha um identificador único.'
      );
      return;
    }

    const perfilAtualizado = {
      ...meuPerfil,
      handle: handleFormatado,
    };

    setMeuPerfil(perfilAtualizado);

    localStorage.setItem(
      'jenios_social_perfil',
      JSON.stringify(perfilAtualizado)
    );

    const usuariosSalvos = JSON.parse(
      localStorage.getItem('jenios_social_usuarios_registrados') || '[]'
    );

    const filtrados = usuariosSalvos.filter(
      (u) => u.email !== authEmail
    );

    localStorage.setItem(
      'jenios_social_usuarios_registrados',
      JSON.stringify([...filtrados, perfilAtualizado])
    );

    setModalEditarPerfil(false);

    alert('✅ Perfil e @ atualizados com sucesso!');
  };

  const handleUploadAvatar = (e) => {
    const file = e.target.files[0];

    if (file) {
      const reader = new FileReader();

      reader.onloadend = () => {
        setMeuPerfil((prev) => ({
          ...prev,
          avatar: reader.result,
        }));
      };

      reader.readAsDataURL(file);
    }
  };

  const fazerLogout = () => {
    const perfilSair = {
      ...meuPerfil,
      autenticado: false,
      nome: 'Visitante',
      handle: '@visitante',
    };

    setMeuPerfil(perfilSair);

    localStorage.setItem(
      'jenios_social_perfil',
      JSON.stringify(perfilSair)
    );

    alert('Sessão encerrada.');
  };

  const processarAuth = (e) => {
    e.preventDefault();

    let handleFormatado = meuPerfil.handle.trim();

    if (!handleFormatado.startsWith('@')) {
      handleFormatado = `@${handleFormatado}`;
    }

    if (verificarHandleEmUso(handleFormatado)) {
      alert(
        '❌ Este @ já está cadastrado. Por favor, escolha outro.'
      );
      return;
    }

    const perfilLogado = {
      ...meuPerfil,
      handle: handleFormatado,
      autenticado: true,
    };

    setMeuPerfil(perfilLogado);

    localStorage.setItem(
      'jenios_social_perfil',
      JSON.stringify(perfilLogado)
    );

    const usuariosSalvos = JSON.parse(
      localStorage.getItem('jenios_social_usuarios_registrados') || '[]'
    );

    localStorage.setItem(
      'jenios_social_usuarios_registrados',
      JSON.stringify([...usuariosSalvos, perfilLogado])
    );

    setModalAutenticacao(false);

    alert('Autenticado com sucesso!');
  };

  const comprimirImagem = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (evento) => {
      const imagem = new Image();

      imagem.onload = () => {
        const larguraOriginal = imagem.naturalWidth;
        const alturaOriginal = imagem.naturalHeight;

        // Detecta automaticamente o formato original da foto
        let orientacao = 'quadrada';

        const proporcaoOriginal = larguraOriginal / alturaOriginal;

        if (proporcaoOriginal > 1.08) {
          orientacao = 'horizontal';
        } else if (proporcaoOriginal < 0.92) {
          orientacao = 'vertical';
        }

        // Redimensiona apenas se a imagem for muito grande.
        // Mantém sempre a proporção original.
        const TAMANHO_MAXIMO = 1600;

        let novaLargura = larguraOriginal;
        let novaAltura = alturaOriginal;

        if (
          larguraOriginal > TAMANHO_MAXIMO ||
          alturaOriginal > TAMANHO_MAXIMO
        ) {
          const escala = Math.min(
            TAMANHO_MAXIMO / larguraOriginal,
            TAMANHO_MAXIMO / alturaOriginal
          );

          novaLargura = Math.round(larguraOriginal * escala);
          novaAltura = Math.round(alturaOriginal * escala);
        }

        const canvas = document.createElement('canvas');

        canvas.width = novaLargura;
        canvas.height = novaAltura;

        const ctx = canvas.getContext('2d');

        if (!ctx) {
          reject(new Error('Não foi possível processar a imagem.'));
          return;
        }

        ctx.drawImage(
          imagem,
          0,
          0,
          novaLargura,
          novaAltura
        );

        // Compressão para não estourar o localStorage durante o desenvolvimento
        const imagemComprimida = canvas.toDataURL(
          'image/jpeg',
          0.78
        );

        resolve({
          src: imagemComprimida,
          largura: novaLargura,
          altura: novaAltura,
          larguraOriginal,
          alturaOriginal,
          proporcao: novaLargura / novaAltura,
          orientacao,
        });
      };

      imagem.onerror = () => {
        reject(new Error('Não foi possível abrir a imagem.'));
      };

      imagem.src = evento.target.result;
    };

    reader.onerror = () => {
      reject(new Error('Não foi possível ler o arquivo.'));
    };

    reader.readAsDataURL(file);
  });
};

const handleUploadCarrossel = async (e) => {
  const files = Array.from(e.target.files || []);

  if (files.length === 0) {
    return;
  }

  try {
    const imagensProcessadas = await Promise.all(
      files.map((file) => comprimirImagem(file))
    );

    setImagensPreview((prev) => [
      ...prev,
      ...imagensProcessadas,
    ]);

    // Permite selecionar novamente o mesmo arquivo depois
    e.target.value = '';
  } catch (error) {
    console.error('Erro ao processar imagem:', error);

    alert(
      'Não foi possível processar uma das imagens. Tente novamente.'
    );
  }
};

  const removerFotoPreview = (index) => {
    setImagensPreview((prev) =>
      prev.filter((_, i) => i !== index)
    );
  };

  const iniciarCamera = async () => {
    setModalCamera(true);

    try {
      const stream =
        await navigator.mediaDevices.getUserMedia({
          video: true,
        });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
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

    ctx.drawImage(
      videoRef.current,
      0,
      0,
      canvas.width,
      canvas.height
    );

    const fotoUrl = canvas.toDataURL(
      'image/jpeg',
      0.82
    );

    const largura = canvas.width;
    const altura = canvas.height;

    let orientacao = 'quadrada';

    if (largura > altura) {
      orientacao = 'horizontal';
    } else if (altura > largura) {
      orientacao = 'vertical';
    }

    setImagensPreview((prev) => [
      ...prev,
      {
        src: fotoUrl,
        largura,
        altura,
        larguraOriginal: largura,
        alturaOriginal: altura,
        proporcao: largura / altura,
        orientacao,
      },
    ]);

    const stream = videoRef.current.srcObject;

    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
    }

    setModalCamera(false);

    alert('📸 Foto capturada e adicionada ao carrossel!');
  };

  const publicarPost = (e) => {
    e.preventDefault();

    if (
      !novoTexto.trim() &&
      imagensPreview.length === 0 &&
      !youtubeLink.trim()
    ) {
      return;
    }

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
      tempo: 'Agora mesmo',
      likes: 0,
      curtido: false,
      views: 1,
      perfilAssociado: meuPerfil,
    };

    const atualizados = [novoP, ...posts];

    salvarPostsNoStorage(atualizados);

    setNovoTexto('');
    setYoutubeLink('');
    setImagensPreview([]);

    const perfilAtualizado = {
      ...meuPerfil,
      postsCount: Number(meuPerfil.postsCount || 0) + 1,
      // Não inventar visualizações quando um post é publicado.
      visualizacoes30Dias: meuPerfil.visualizacoes30Dias,
    };

    setMeuPerfil(perfilAtualizado);

    localStorage.setItem(
      'jenios_social_perfil',
      JSON.stringify(perfilAtualizado)
    );

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
      perfilAssociado: meuPerfil,
    };

    const atualizados = [novoP, ...posts];

    salvarPostsNoStorage(atualizados);

    alert('🚀 Post repostado com sucesso no seu feed!');
  };

  const curtirPost = (id) => {
    const atualizados = posts.map((p) =>
      p.id === id
        ? {
            ...p,
            likes: p.curtido
              ? p.likes - 1
              : p.likes + 1,
            curtido: !p.curtido,
          }
        : p
    );

    salvarPostsNoStorage(atualizados);
  };
const atualizarPost = (id, alteracoes) => {
  const atualizados = posts.map((p) =>
    p.id === id
      ? { ...p, ...alteracoes }
      : p
  );

  salvarPostsNoStorage(atualizados);
};

const excluirPost = (id) => {
  const atualizados = posts.filter(
    (p) => p.id !== id
  );

  salvarPostsNoStorage(atualizados);
};
  const mudarFotoCarrossel = (
    postId,
    direcao,
    totalImagens
  ) => {
    setIndiceCarrossel((prev) => {
      const atual = prev[postId] || 0;

      let novo = atual + direcao;

      if (novo < 0) novo = totalImagens - 1;
      if (novo >= totalImagens) novo = 0;

      return {
        ...prev,
        [postId]: novo,
      };
    });
  };

  // Abre uma publicação selecionada na galeria, inclusive em Salvos.
  const abrirPostDaGaleria = (postId) => {
    setPostEmFoco(postId);
    setAbaAtiva('feed');
  };

  useEffect(() => {
    if (abaAtiva !== 'feed' || postEmFoco == null) return;
    const timer = setTimeout(() => {
      document.getElementById(`jenios-post-${postEmFoco}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }, 100);
    return () => clearTimeout(timer);
  }, [abaAtiva, postEmFoco]);

  const visitarPerfil = (usuario) => {
    if (!usuario?.handle) return;
    // Resolve dados atualizados e evita abrir um perfil incompleto do post.
    const perfil = usuario.handle === meuPerfil.handle
      ? meuPerfil
      : rankingOperadores.find((item) => item.handle === usuario.handle) || usuario;
    setPerfilVisitado(perfil);
    setAbaGaleria('posts');
    setAbaAtiva('perfil-visita');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const enviarMensagemDirect = (e) => {
    e.preventDefault();

    if (!textoMensagem.trim() || !chatAtivo) return;

    const handleDest = chatAtivo.handle;

    const conversaAtual =
      mensagensDirect[handleDest] || [];

    const novaMensagem = {
      remetente: meuPerfil.handle,
      texto: textoMensagem,
      hora: 'Agora',
    };

    const novasConversas = {
      ...mensagensDirect,
      [handleDest]: [
        ...conversaAtual,
        novaMensagem,
      ],
    };

    setMensagensDirect(novasConversas);

    localStorage.setItem(
      'jenios_social_directs',
      JSON.stringify(novasConversas)
    );

    setTextoMensagem('');
  };

  const copiarLinkPost = (id) => {
    const url =
      `${window.location.origin}/social?post=${id}`;

    navigator.clipboard.writeText(url);

    alert('🔗 Link do post copiado!');
  };

  const copiarLinkPerfil = (handle) => {
    const handleLimpo = handle.replace('@', '');

    const url =
      `jenios.com.br/${handleLimpo}`;

    navigator.clipboard.writeText(url);

    alert(`🔗 Link do perfil copiado: ${url}`);
  };

  if (erroPosts || !postsProntos) {
    return (
      <main style={{ padding: 32 }}>
        <h2>JENIOS Social</h2>
        <p>
          {erroPosts ||
            'Carregando publicações salvas...'}
        </p>
      </main>
    );
  }

  return (
    <main
      style={{
        backgroundColor: '#f1f5f9',
        color: '#0f172a',
        minHeight: '100vh',
        paddingBottom: '60px',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >{/* MODAL CÂMERA */}
      {modalCamera && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.9)',
            zIndex: 30000,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '20px',
          }}
        >
          <div
            style={{
              backgroundColor: '#1e293b',
              borderRadius: '20px',
              padding: '25px',
              maxWidth: '500px',
              width: '100%',
              textAlign: 'center',
            }}
          >
            <h3 style={{ color: '#fff', marginBottom: '15px' }}>
              📸 Tirar Foto na Hora
            </h3>

            <video
              ref={videoRef}
              autoPlay
              playsInline
              style={{
                width: '100%',
                borderRadius: '10px',
                backgroundColor: '#000',
                marginBottom: '15px',
              }}
            />

            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                gap: '12px',
              }}
            >
              <button
                onClick={tirarFoto}
                style={{
                  backgroundColor: '#059669',
                  color: '#fff',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '8px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                }}
              >
                Capturar 🟢
              </button>

              <button
                onClick={() => setModalCamera(false)}
                style={{
                  backgroundColor: '#ef4444',
                  color: '#fff',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '8px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL LISTA */}
      {modalLista && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.85)',
            zIndex: 25000,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '20px',
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '20px',
              maxWidth: '380px',
              width: '100%',
              padding: '25px',
              boxShadow: '0 25px 50px rgba(0,0,0,0.2)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '15px',
              }}
            >
              <h3
                style={{
                  fontSize: '15px',
                  fontWeight: 'bold',
                  textTransform: 'capitalize',
                  margin: 0,
                }}
              >
                {modalLista}
              </h3>

              <button
                onClick={() => setModalLista(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '18px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                }}
              >
                ✕
              </button>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                maxHeight: '250px',
                overflowY: 'auto',
              }}
            >
              {(
                meuPerfil[
                  modalLista === 'seguidores'
                    ? 'seguidoresLista'
                    : 'seguindoLista'
                ] || []
              ).map((handle, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    backgroundColor: '#f8fafc',
                    borderRadius: '8px',
                  }}
                >
                  <span
                    style={{
                      fontSize: '13px',
                      fontWeight: 'bold',
                      color: '#7c3aed',
                    }}
                  >
                    {handle}
                  </span>

                  <span
                    style={{
                      fontSize: '10px',
                      color: '#059669',
                      fontWeight: 'bold',
                    }}
                  >
                    Seguindo ⚡
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDITAR PERFIL */}
      {modalEditarPerfil && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.85)',
            zIndex: 20000,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '20px',
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '20px',
              maxWidth: '450px',
              width: '100%',
              padding: '30px',
              boxShadow: '0 25px 50px rgba(0,0,0,0.2)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <h3
                style={{
                  fontSize: '16px',
                  fontWeight: 'bold',
                  color: '#0f172a',
                  margin: 0,
                }}
              >
                ⚙️ Editar Perfil & Foto
              </h3>

              <button
                onClick={() => setModalEditarPerfil(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '18px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                }}
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={salvarEdicaoPerfil}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div
                style={{
                  textAlign: 'center',
                  marginBottom: '10px',
                }}
              >
                <img
                  src={meuPerfil.avatar}
                  alt="Avatar Atual"
                  style={{
                    width: '80px',
                    height: '80px',
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '3px solid #7c3aed',
                    marginBottom: '8px',
                  }}
                />

                <div>
                  <label
                    style={{
                      backgroundColor: '#f1f5f9',
                      color: '#0f172a',
                      border: '1px solid #cbd5e1',
                      padding: '6px 12px',
                      borderRadius: '8px',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      display: 'inline-block',
                    }}
                  >
                    📁 Carregar Nova Foto do Dispositivo

                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleUploadAvatar}
                      style={{ display: 'none' }}
                    />
                  </label>
                </div>
              </div>

              <div>
                <label
                  style={{
                    fontSize: '11px',
                    fontWeight: 'bold',
                    color: '#64748b',
                  }}
                >
                  Ou Link da Foto (URL):
                </label>

                <input
                  type="text"
                  value={meuPerfil.avatar}
                  onChange={(e) =>
                    setMeuPerfil({
                      ...meuPerfil,
                      avatar: e.target.value,
                    })
                  }
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '12px',
                    marginTop: '4px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    fontSize: '11px',
                    fontWeight: 'bold',
                    color: '#64748b',
                  }}
                >
                  Nome:
                </label>

                <input
                  type="text"
                  value={meuPerfil.nome}
                  onChange={(e) =>
                    setMeuPerfil({
                      ...meuPerfil,
                      nome: e.target.value,
                    })
                  }
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '12px',
                    marginTop: '4px',
                    boxSizing: 'border-box',
                  }}
                  required
                />
              </div>

              <div>
                <label
                  style={{
                    fontSize: '11px',
                    fontWeight: 'bold',
                    color: '#64748b',
                  }}
                >
                  @Handle (Único no sistema):
                </label>

                <input
                  type="text"
                  value={meuPerfil.handle}
                  onChange={(e) =>
                    setMeuPerfil({
                      ...meuPerfil,
                      handle: e.target.value,
                    })
                  }
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '12px',
                    marginTop: '4px',
                    boxSizing: 'border-box',
                  }}
                  required
                />

                <span
                  style={{
                    fontSize: '10px',
                    color: '#64748b',
                    display: 'block',
                    marginTop: '2px',
                  }}
                >
                  O seu link será: jenios.com.br/
                  {meuPerfil.handle.replace('@', '')}
                </span>
              </div>

              <div>
                <label
                  style={{
                    fontSize: '11px',
                    fontWeight: 'bold',
                    color: '#64748b',
                  }}
                >
                  Cargo / Título:
                </label>

                <input
                  type="text"
                  value={meuPerfil.cargo}
                  onChange={(e) =>
                    setMeuPerfil({
                      ...meuPerfil,
                      cargo: e.target.value,
                    })
                  }
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '12px',
                    marginTop: '4px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    fontSize: '11px',
                    fontWeight: 'bold',
                    color: '#64748b',
                  }}
                >
                  Bio Completa (Fixada no Perfil):
                </label>

                <textarea
                  value={meuPerfil.bio}
                  onChange={(e) =>
                    setMeuPerfil({
                      ...meuPerfil,
                      bio: e.target.value,
                    })
                  }
                  style={{
                    width: '100%',
                    height: '80px',
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '12px',
                    marginTop: '4px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <button
                type="submit"
                style={{
                  backgroundColor: '#7c3aed',
                  color: '#fff',
                  border: 'none',
                  padding: '12px',
                  borderRadius: '8px',
                  fontWeight: 'bold',
                  fontSize: '12px',
                  cursor: 'pointer',
                  marginTop: '8px',
                }}
              >
                Salvar Alterações
              </button>
            </form>
          </div>
        </div>
      )}

      {/* CONTEÚDO PRINCIPAL */}
      <div
        style={{
          maxWidth: '1050px',
          margin: '0 auto',
          padding: '30px 20px 0 20px',
        }}
      >
        {/* CABEÇALHO */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px',
            background: '#ffffff',
            padding: '12px 20px',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              cursor: 'pointer',
            }}
            onClick={() => setAbaAtiva('feed')}
          >
            <span
              style={{
                fontSize: '14px',
                fontWeight: '900',
                color: '#7c3aed',
              }}
            >
              JENIOS SOCIAL
            </span>

            <span
              style={{
                fontSize: '11px',
                color: '#64748b',
              }}
            >
              • Comunidade HFT & Mercado
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              gap: '8px',
              alignItems: 'center',
            }}
          >
            {meuPerfil.autenticado ? (
              <>
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 'bold',
                    color: '#059669',
                  }}
                >
                  {meuPerfil.handle}
                </span>

                <button
                  onClick={fazerLogout}
                  style={{
                    backgroundColor: '#fee2e2',
                    color: '#dc2626',
                    border: '1px solid #fca5a5',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                  }}
                >
                  🚪 Sair
                </button>
              </>
            ) : (
              <button
                onClick={() => setModalAutenticacao(true)}
                style={{
                  backgroundColor: '#7c3aed',
                  color: '#fff',
                  border: 'none',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                }}
              >
                🔑 Entrar
              </button>
            )}
          </div>
        </div>

        {/* PERFIL HEADER */}
        <div
          style={{
            backgroundColor: '#ffffff',
            display: abaAtiva === 'perfil-visita' ? 'none' : 'block',
            padding: '24px',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            marginBottom: '25px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              flexWrap: 'wrap',
              gap: '20px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '20px',
                flex: 1,
                minWidth: '300px',
              }}
            >
              <img
                src={meuPerfil.avatar}
                onClick={() => visitarPerfil(meuPerfil)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    visitarPerfil(meuPerfil);
                  }
                }}
                alt="Avatar"
                style={{
                  width: '85px',
                  height: '85px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '3px solid #7c3aed',
                  flexShrink: 0,
                }}
              />

              <div>
                <h2
                  style={{
                    fontSize: '20px',
                    fontWeight: 'bold',
                    color: '#0f172a',
                    margin: '0 0 2px 0',
                  }}
                >
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={() => visitarPerfil(meuPerfil)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        visitarPerfil(meuPerfil);
                      }
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    {meuPerfil.nome}
                  </span>{' '}
                  <span
                    style={{
                      fontSize: '14px',
                      color: '#7c3aed',
                    }}
                  >
                    {meuPerfil.handle}
                  </span>
                </h2>

                <span
                  style={{
                    fontSize: '12px',
                    color: '#7c3aed',
                    fontWeight: 'bold',
                    display: 'block',
                    marginBottom: '6px',
                  }}
                >
                  {meuPerfil.cargo}
                </span>

                <p
                  style={{
                    fontSize: '12px',
                    color: '#334155',
                    margin: '0 0 8px 0',
                    whiteSpace: 'pre-line',
                    lineHeight: '1.4',
                  }}
                >
                  {meuPerfil.bio}
                </p>

                <span
                  style={{
                    fontSize: '11px',
                    color: '#64748b',
                    backgroundColor: '#f1f5f9',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    fontWeight: 'bold',
                  }}
                >
                  🔗 jenios.com.br/
                  {meuPerfil.handle.replace('@', '')}
                </span>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                gap: '16px',
                backgroundColor: '#f8fafc',
                padding: '14px 20px',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                alignItems: 'center',
              }}
            >
              <div
                  onClick={() => visitarPerfil(meuPerfil)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      visitarPerfil(meuPerfil);
                    }
                  }}
                  style={{
                    textAlign: 'center',
                    cursor: 'pointer'
                  }}
                >
                <span
                  style={{
                    fontSize: '10px',
                    color: '#64748b',
                    display: 'block',
                    fontWeight: 'bold',
                  }}
                >
                  POSTS
                </span>
                <b style={{ fontSize: '15px', color: '#0f172a' }}>
                  {
                    posts.filter(
                      (p) => p.handle === meuPerfil.handle
                    ).length
                  }
                </b>
              </div>

              <div
                style={{
                  width: '1px',
                  height: '24px',
                  backgroundColor: '#cbd5e1',
                }}
              />

              <div
                onClick={() => setModalLista('seguidores')}
                style={{
                  textAlign: 'center',
                  cursor: 'pointer',
                }}
              >
                <span
                  style={{
                    fontSize: '10px',
                    color: '#64748b',
                    display: 'block',
                    fontWeight: 'bold',
                  }}
                >
                  SEGUIDORES
                </span>
                <b style={{ fontSize: '15px', color: '#7c3aed' }}>
                  {(meuPerfil.seguidoresLista || []).length}
                </b>
              </div>

              <div
                style={{
                  width: '1px',
                  height: '24px',
                  backgroundColor: '#cbd5e1',
                }}
              />

              <div
                onClick={() => setModalLista('seguindo')}
                style={{
                  textAlign: 'center',
                  cursor: 'pointer',
                }}
              >
                <span
                  style={{
                    fontSize: '10px',
                    color: '#64748b',
                    display: 'block',
                    fontWeight: 'bold',
                  }}
                >
                  SEGUINDO
                </span>
                <b style={{ fontSize: '15px', color: '#7c3aed' }}>
                  {(meuPerfil.seguindoLista || []).length}
                </b>
              </div>

              <div
                style={{
                  width: '1px',
                  height: '24px',
                  backgroundColor: '#cbd5e1',
                }}
              />

              <div style={{ textAlign: 'center' }}>
                <span
                  style={{
                    fontSize: '10px',
                    color: '#64748b',
                    display: 'block',
                    fontWeight: 'bold',
                  }}
                >
                  VIEWS (30 DIAS)
                </span>

                <b style={{ fontSize: '15px', color: '#059669' }}>
                  {'—'}
                </b>
                <span title="Aguardando registro de visualizações datadas em banco compartilhado" style={{display:'block',fontSize:'9px',color:'#64748b'}}>Métrica em preparação</span>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                gap: '8px',
                alignItems: 'center',
              }}
            >
              <button
                onClick={() => setModalEditarPerfil(true)}
                style={{
                  backgroundColor: '#7c3aed',
                  color: '#fff',
                  border: 'none',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                }}
              >
                ⚙️ Editar Perfil
              </button>

              <button
                onClick={() =>
                  (window.location.href = '/dashboard-logado')
                }
                style={{
                  backgroundColor: '#f1f5f9',
                  color: '#0f172a',
                  border: '1px solid #cbd5e1',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                }}
              >
                Sala de Controle
              </button>
            </div>
          </div>
        </div>

        {/* JENIOS V4: navegacao compacta */}
        <nav aria-label="Navegação da JENIOS Social" style={{display:'flex',alignItems:'center',gap:'8px',flexWrap:'wrap',margin:'12px 0 14px'}}>
          {[
            ['feed','🏠 Feed'],
            ['ranking','🏆 Ranking'],
            ['perfil','👤 Meu Perfil'],
            ['salvos','🔖 Salvos']
          ].map(([destino,rotulo]) => (
            <button key={destino} type="button" onClick={() => {
              if (destino === 'perfil' || destino === 'salvos') {
                setPerfilVisitado(meuPerfil);
                setAbaGaleria(destino === 'salvos' ? 'salvos' : 'posts');
                setAbaAtiva('perfil-visita');
              } else {
                setAbaAtiva(destino);
              }
              window.scrollTo({top:0,behavior:'smooth'});
            }} style={{padding:'9px 13px',borderRadius:'9px',cursor:'pointer',fontSize:'12px',fontWeight:700,
              border:'1px solid #ddd6fe',backgroundColor:(abaAtiva === destino || (destino === 'perfil' && abaAtiva === 'perfil-visita' && abaGaleria !== 'salvos') || (destino === 'salvos' && abaAtiva === 'perfil-visita' && abaGaleria === 'salvos')) ? '#7c3aed' : '#fff',
              color:(abaAtiva === destino || (destino === 'perfil' && abaAtiva === 'perfil-visita' && abaGaleria !== 'salvos') || (destino === 'salvos' && abaAtiva === 'perfil-visita' && abaGaleria === 'salvos')) ? '#fff' : '#4c1d95'}}>{rotulo}</button>
          ))}
        </nav>

        {/* ABA FEED */}
        {abaAtiva === 'feed' && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 2fr) minmax(260px, 1fr)',
              gap: '14px',
            }}
          >


            {/* COLUNA PRINCIPAL */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
              }}
            >
              <SocialStories
                meuPerfil={meuPerfil}
                stories={storiesJenios}
                onExcluirStory={excluirStoryJenios}
                onAdicionarStory={adicionarStoryJenios}
              />
              {/* CRIAR PUBLICAÇÃO */}
              <div
                style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '16px',
                  padding: '24px',
                }}
              >
                <form onSubmit={publicarPost}>
                  <textarea
                    value={novoTexto}
                    onChange={(e) =>
                      setNovoTexto(e.target.value)
                    }
                    placeholder="Compartilhe uma análise, setup HFT ou visão de mercado..."
                    style={{
                      width: '100%',
                      height: '80px',
                      backgroundColor: '#f8fafc',
                      border: '1px solid #cbd5e1',
                      borderRadius: '10px',
                      padding: '14px',
                      fontSize: '13px',
                      outline: 'none',
                      boxSizing: 'border-box',
                      marginBottom: '12px',
                    }}
                  />

                  <div style={{ marginBottom: '12px' }}>
                    <input
                      type="text"
                      placeholder="🔗 Link de vídeo do YouTube (Opcional)"
                      value={youtubeLink}
                      onChange={(e) =>
                        setYoutubeLink(e.target.value)
                      }
                      style={{
                        width: '100%',
                        padding: '10px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '12px',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  <div
                    style={{
                      marginBottom: '12px',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      backgroundColor: '#faf5ff',
                      border: '1px solid #e9d5ff',
                      color: '#6d28d9',
                      fontSize: '11px',
                      fontWeight: '600',
                    }}
                  >
                    ✨ Formato automático — cada foto mantém sua proporção original.
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      gap: '8px',
                      marginBottom: '12px',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                    }}
                  >
                    <button
                      type="button"
                      onClick={iniciarCamera}
                      style={{
                        backgroundColor: '#f1f5f9',
                        color: '#0f172a',
                        border: '1px solid #cbd5e1',
                        padding: '6px 12px',
                        borderRadius: '8px',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                      }}
                    >
                      📷 Tirar Foto (Câmera)
                    </button>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      gap: '10px',
                      marginBottom: '12px',
                      overflowX: 'auto',
                      paddingBottom: '6px',
                      alignItems: 'center',
                    }}
                  >
                    {imagensPreview.map((imagem, idx) => (
                      <div
                        key={idx}
                        style={{
                          position: 'relative',
                          width: '110px',
                          minHeight: '80px',
                          borderRadius: '8px',
                          overflow: 'hidden',
                          border: '2px solid #7c3aed',
                          backgroundColor: '#000',
                          flexShrink: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <img
                          src={
                            typeof imagem === 'string'
                              ? imagem
                              : imagem?.src
                          }
                          alt="Preview"
                          style={{
                            width: '100%',
                            height: 'auto',
                            maxHeight: '150px',
                            objectFit: 'contain',
                            display: 'block',
                          }}
                        />

                        <button
                          type="button"
                          onClick={() =>
                            removerFotoPreview(idx)
                          }
                          style={{
                            position: 'absolute',
                            top: '2px',
                            right: '2px',
                            backgroundColor:
                              'rgba(239,68,68,0.9)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '50%',
                            width: '20px',
                            height: '20px',
                            fontSize: '10px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}

                    <label
                      style={{
                        width: '80px',
                        height: '80px',
                        borderRadius: '8px',
                        border: '2px dashed #7c3aed',
                        backgroundColor: '#faf5ff',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                    >
                      <span
                        style={{
                          fontSize: '24px',
                          color: '#7c3aed',
                          fontWeight: 'bold',
                          lineHeight: 1,
                        }}
                      >
                        +
                      </span>

                      <span
                        style={{
                          fontSize: '9px',
                          color: '#7c3aed',
                          fontWeight: 'bold',
                          marginTop: '2px',
                        }}
                      >
                        Adicionar
                      </span>

                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleUploadCarrossel}
                        style={{ display: 'none' }}
                      />
                    </label>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'flex-end',
                    }}
                  >
                    <button
                      type="submit"
                      style={{
                        backgroundColor: '#7c3aed',
                        color: '#fff',
                        border: 'none',
                        padding: '12px 20px',
                        borderRadius: '8px',
                        fontWeight: 'bold',
                        fontSize: '12px',
                        cursor: 'pointer',
                      }}
                    >
                      Publicar no Feed 🚀
                    </button>
                  </div>
                </form>
              </div>

              {/* POSTS */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '20px',
                }}
              >
                {posts.map((p) => (
                  <div key={p.id} id={`jenios-post-${p.id}`}
                    style={{outline: postEmFoco === p.id ? '2px solid #7c3aed' : 'none', borderRadius:'16px'}}>
                  <SocialPostCard
                    post={p}
                    meuPerfil={meuPerfil}
                    indiceCarrossel={indiceCarrossel[p.id] || 0}
                    onMudarFoto={mudarFotoCarrossel}
                    onCurtir={curtirPost}
                    onRepostar={repostarPost}
                    onCompartilhar={copiarLinkPost}
                    onVisitarPerfil={visitarPerfil}
                    onAtualizarPost={atualizarPost}
                    onExcluirPost={excluirPost}
                    extrairEmbedYoutube={extrairEmbedYoutube}
                  />
                  </div>
                ))}
              </div>

              </div>

            {/* COLUNA DIREITA */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
              }}
            >
              {/* NOTÍCIAS MACRO */}
              <div
                style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '16px',
                  padding: '20px',
                }}
              >
                <h3
                  style={{
                    fontSize: '14px',
                    fontWeight: 'bold',
                    color: '#0f172a',
                    margin: '0 0 10px 0',
                  }}
                >
                  🌐 Canal de Notícias Macro
                </h3>

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  {noticiasMacro.map((n) => (
                    <div
                      key={n.id}
                      style={{
                        backgroundColor: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '10px',
                        padding: '10px',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '8px',
                          marginBottom: '5px',
                        }}
                      >
                        <span
                          style={{
                            fontSize: '9px',
                            fontWeight: 'bold',
                            color: '#7c3aed',
                            backgroundColor: '#f3e8ff',
                            padding: '3px 6px',
                            borderRadius: '4px',
                          }}
                        >
                          {n.fonte}
                        </span>

                        <span
                          style={{
                            fontSize: '9px',
                            color: '#64748b',
                          }}
                        >
                          {n.hora}
                        </span>
                      </div>

                      <span
                        style={{
                          display: 'block',
                          fontSize: '9px',
                          fontWeight: 'bold',
                          color: '#94a3b8',
                          marginBottom: '4px',
                        }}
                      >
                        {n.cat}
                      </span>

                      <h4
                        style={{
                          fontSize: '11px',
                          color: '#0f172a',
                          margin: '0 0 6px 0',
                          fontWeight: 'bold',
                          lineHeight: '1.4',
                        }}
                      >
                        {n.titulo}
                      </h4>

                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 'bold',
                          color: '#334155',
                        }}
                      >
                        {n.impacto}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* TOP TRADERS */}
              <div
                style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '16px',
                  padding: '20px',
                }}
              >
                <h3
                  style={{
                    fontSize: '14px',
                    fontWeight: 'bold',
                    color: '#0f172a',
                    margin: '0 0 6px 0',
                  }}
                >
                  🏆 Top Traders (Semanal)
                </h3>

                <p
                  style={{
                    fontSize: '10px',
                    color: '#64748b',
                    margin: '0 0 12px 0',
                  }}
                >
                  Ranking dos operadores em destaque.
                </p>

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  {rankingOperadores
                    .slice(0, 5)
                    .map((op) => (
                      <div
                        key={op.pos}
                        onClick={() => visitarPerfil(op)}
                        style={{
                          backgroundColor: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: '10px',
                          padding: '10px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          cursor: 'pointer',
                          gap: '8px',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            minWidth: 0,
                          }}
                        >
                          <div
                            style={{
                              width: '22px',
                              height: '22px',
                              borderRadius: '50%',
                              backgroundColor:
                                op.pos === 1
                                  ? '#fef3c7'
                                  : '#f1f5f9',
                              color:
                                op.pos === 1
                                  ? '#d97706'
                                  : '#475569',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '9px',
                              fontWeight: '900',
                              flexShrink: 0,
                            }}
                          >
                            {op.pos}
                          </div>

                          <img
                            src={op.avatar}
                            alt={op.nome}
                            style={{
                              width: '30px',
                              height: '30px',
                              borderRadius: '50%',
                              objectFit: 'cover',
                              flexShrink: 0,
                            }}
                          />

                          <div style={{ minWidth: 0 }}>
                            <b
                              style={{
                                fontSize: '11px',
                                color: '#0f172a',
                                display: 'block',
                              }}
                            >
                              {op.nome}
                            </b>

                            <span
                              style={{
                                fontSize: '9px',
                                color: '#059669',
                                fontWeight: 'bold',
                              }}
                            >
                              {op.rentabilidade}
                            </span>
                          </div>
                        </div>

                        <span
                          style={{
                            fontSize: '9px',
                            color: '#7c3aed',
                            fontWeight: 'bold',
                            flexShrink: 0,
                          }}
                        >
                          Ver ↗️
                        </span>
                      </div>
                    ))}
                </div>

                <button
                  type="button"
                  onClick={() => setAbaAtiva('ranking')}
                  style={{
                    width: '100%',
                    marginTop: '12px',
                    padding: '9px',
                    backgroundColor: '#faf5ff',
                    color: '#7c3aed',
                    border: '1px solid #d8b4fe',
                    borderRadius: '8px',
                    fontSize: '10px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                  }}
                >
                  Ver Top 10 Completo →
                </button>
              </div>

              {/* VALIDADOR DE CRIPTOATIVOS */}
              <CryptoValidator />
            </div>
          </div>
        )}

        {/* ABA RANKING */}
        {abaAtiva === 'ranking' && (
          <div
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '16px',
              padding: '30px',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '15px',
                flexWrap: 'wrap',
                marginBottom: '22px',
              }}
            >
              <div>
                <h2
                  style={{
                    fontSize: '20px',
                    fontWeight: 'bold',
                    color: '#0f172a',
                    margin: '0 0 5px 0',
                  }}
                >
                  🏆 Ranking Oficial Top 10
                </h2>

                <p
                  style={{
                    fontSize: '11px',
                    color: '#64748b',
                    margin: 0,
                  }}
                >
                  Classificação semanal dos operadores da
                  comunidade JENIOS.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setAbaAtiva('feed')}
                style={{
                  backgroundColor: '#f1f5f9',
                  color: '#0f172a',
                  border: '1px solid #cbd5e1',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                }}
              >
                ← Voltar ao Feed
              </button>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              {rankingOperadores.map((op) => (
                <div
                  key={op.pos}
                  onClick={() => visitarPerfil(op)}
                  style={{
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '16px 20px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                    gap: '15px',
                    flexWrap: 'wrap',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '14px',
                    }}
                  >
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        backgroundColor:
                          op.pos === 1
                            ? '#fef3c7'
                            : '#e2e8f0',
                        color:
                          op.pos === 1
                            ? '#d97706'
                            : '#475569',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '11px',
                        fontWeight: '900',
                      }}
                    >
                      {op.pos}
                    </div>

                    <img
                      src={op.avatar}
                      alt={op.nome}
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '50%',
                        objectFit: 'cover',
                      }}
                    />

                    <div>
                      <b
                        style={{
                          fontSize: '14px',
                          color: '#0f172a',
                          display: 'block',
                        }}
                      >
                        {op.nome}{' '}
                        <span
                          style={{
                            color: '#7c3aed',
                            fontSize: '11px',
                          }}
                        >
                          {op.handle}
                        </span>
                      </b>

                      <span
                        style={{
                          fontSize: '11px',
                          color: '#64748b',
                          display: 'block',
                        }}
                      >
                        {op.cargo}
                      </span>

                      <span
                        style={{
                          fontSize: '10px',
                          color: '#94a3b8',
                        }}
                      >
                        jenios.com.br/
                        {op.handle.replace('@', '')}
                      </span>
                    </div>
                  </div>

                  <div
                    style={{
                      textAlign: 'right',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '15px',
                        fontWeight: 'bold',
                        color: '#059669',
                        display: 'block',
                      }}
                    >
                      {op.rentabilidade}
                    </span>

                    <span
                      style={{
                        fontSize: '11px',
                        color: '#7c3aed',
                        fontWeight: 'bold',
                      }}
                    >
                      Assertividade: {op.assertividade}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PERFIL VISITADO */}
        {abaAtiva === 'perfil-visita' &&
          perfilVisitado && (
            <div
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '16px',
                padding: '30px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '20px',
                  gap: '10px',
                  flexWrap: 'wrap',
                }}
              >
                <button
                  type="button"
                  onClick={() => setAbaAtiva('feed')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#7c3aed',
                    fontWeight: 'bold',
                    fontSize: '12px',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  ← Voltar ao Feed Principal
                </button>

                <button
                  type="button"
                  onClick={() =>
                    copiarLinkPerfil(
                      perfilVisitado.handle
                    )
                  }
                  style={{
                    backgroundColor: '#f1f5f9',
                    color: '#0f172a',
                    border: '1px solid #cbd5e1',
                    padding: '7px 12px',
                    borderRadius: '8px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                  }}
                >
                  🔗 Copiar Link do Perfil
                </button>
              </div>

              {/* CABEÇALHO DO PERFIL VISITADO */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '24px',
                  marginBottom: '30px',
                  flexWrap: 'wrap',
                }}
              >
                <img
                  src={perfilVisitado.avatar}
                  alt={perfilVisitado.nome}
                  style={{
                    width: '90px',
                    height: '90px',
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '3px solid #7c3aed',
                  }}
                />

                <div
                  style={{
                    flex: 1,
                    minWidth: '250px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      marginBottom: '8px',
                      flexWrap: 'wrap',
                    }}
                  >
                    <h2
                      style={{
                        fontSize: '20px',
                        fontWeight: 'bold',
                        color: '#0f172a',
                        margin: 0,
                      }}
                    >
                      {perfilVisitado.nome}
                    </h2>

                    <span
                      style={{
                        fontSize: '13px',
                        color: '#7c3aed',
                        fontWeight: 'bold',
                      }}
                    >
                      {perfilVisitado.handle}
                    </span>

                    {perfilVisitado.handle !==
                      meuPerfil.handle && (
                      <button
                        type="button"
                        onClick={() =>
                          setChatAtivo(perfilVisitado)
                        }
                        style={{
                          backgroundColor: '#7c3aed',
                          color: '#fff',
                          border: 'none',
                          padding: '8px 16px',
                          borderRadius: '8px',
                          fontWeight: 'bold',
                          fontSize: '11px',
                          cursor: 'pointer',
                        }}
                      >
                        💬 Enviar Mensagem
                      </button>
                    )}
                  </div>

                  <span
                    style={{
                      fontSize: '11px',
                      color: '#64748b',
                      fontWeight: 'bold',
                      display: 'block',
                      marginBottom: '8px',
                    }}
                  >
                    {perfilVisitado.cargo}
                  </span>

                  <p
                    style={{
                      fontSize: '12px',
                      color: '#334155',
                      margin: '0 0 12px 0',
                      whiteSpace: 'pre-line',
                      lineHeight: '1.5',
                    }}
                  >
                    {perfilVisitado.bio}
                  </p>

                  <span
                    style={{
                      fontSize: '10px',
                      color: '#64748b',
                      backgroundColor: '#f1f5f9',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      display: 'inline-block',
                      marginBottom: '15px',
                    }}
                  >
                    🔗 jenios.com.br/
                    {perfilVisitado.handle.replace('@', '')}
                  </span>

                  <div
                    style={{
                      display: 'flex',
                      gap: '25px',
                      fontSize: '12px',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div>
                      <b>
                        {posts.filter(
                          (p) =>
                            p.handle ===
                            perfilVisitado.handle
                        ).length ||
                          perfilVisitado.postsCount ||
                          0}
                      </b>{' '}
                      posts
                    </div>

                    <div>
                      <b>
                        {(
                          perfilVisitado.seguidoresLista ||
                          perfilVisitado.seguidores ||
                          []
                        ).length}
                      </b>{' '}
                      seguidores
                    </div>

                    <div>
                      <b>
                        {(
                          perfilVisitado.seguindoLista ||
                          []
                        ).length}
                      </b>{' '}
                      seguindo
                    </div>

                    <div>
                      <b>—</b>{' '}
                      views (30 dias)
                    </div>
                  </div>
                </div>
              </div>

              {/* DIRECT */}
              {chatAtivo &&
                chatAtivo.handle ===
                  perfilVisitado.handle && (
                  <div
                    style={{
                      backgroundColor: '#f8fafc',
                      border: '1px solid #cbd5e1',
                      borderRadius: '12px',
                      padding: '20px',
                      marginTop: '20px',
                      marginBottom: '25px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '10px',
                        marginBottom: '12px',
                      }}
                    >
                      <h4
                        style={{
                          fontSize: '13px',
                          fontWeight: 'bold',
                          color: '#0f172a',
                          margin: 0,
                        }}
                      >
                        💬 Conversa com{' '}
                        {perfilVisitado.nome}
                      </h4>

                      <button
                        type="button"
                        onClick={() => setChatAtivo(null)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '15px',
                          fontWeight: 'bold',
                          color: '#64748b',
                        }}
                      >
                        ✕
                      </button>
                    </div>

                    <div
                      style={{
                        height: '180px',
                        backgroundColor: '#fff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        padding: '10px',
                        overflowY: 'auto',
                        marginBottom: '10px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '7px',
                      }}
                    >
                      {(
                        mensagensDirect[
                          perfilVisitado.handle
                        ] || []
                      ).length === 0 ? (
                        <span
                          style={{
                            fontSize: '11px',
                            color: '#64748b',
                            textAlign: 'center',
                            marginTop: '65px',
                          }}
                        >
                          Nenhuma mensagem ainda. Inicie a
                          conversa.
                        </span>
                      ) : (
                        (
                          mensagensDirect[
                            perfilVisitado.handle
                          ] || []
                        ).map((msg, index) => (
                          <div
                            key={index}
                            style={{
                              alignSelf:
                                msg.remetente ===
                                meuPerfil.handle
                                  ? 'flex-end'
                                  : 'flex-start',
                              backgroundColor:
                                msg.remetente ===
                                meuPerfil.handle
                                  ? '#7c3aed'
                                  : '#e2e8f0',
                              color:
                                msg.remetente ===
                                meuPerfil.handle
                                  ? '#fff'
                                  : '#0f172a',
                              padding: '8px 12px',
                              borderRadius: '10px',
                              fontSize: '12px',
                              maxWidth: '75%',
                            }}
                          >
                            <div>{msg.texto}</div>

                            <span
                              style={{
                                display: 'block',
                                marginTop: '3px',
                                fontSize: '8px',
                                opacity: 0.7,
                              }}
                            >
                              {msg.hora}
                            </span>
                          </div>
                        ))
                      )}
                    </div>

                    <form
                      onSubmit={enviarMensagemDirect}
                      style={{
                        display: 'flex',
                        gap: '8px',
                      }}
                    >
                      <input
                        type="text"
                        placeholder="Escreva uma mensagem..."
                        value={textoMensagem}
                        onChange={(e) =>
                          setTextoMensagem(e.target.value)
                        }
                        style={{
                          flex: 1,
                          padding: '10px',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1',
                          fontSize: '12px',
                          minWidth: 0,
                        }}
                        required
                      />

                      <button
                        type="submit"
                        style={{
                          backgroundColor: '#059669',
                          color: '#fff',
                          border: 'none',
                          padding: '10px 18px',
                          borderRadius: '8px',
                          fontWeight: 'bold',
                          fontSize: '12px',
                          cursor: 'pointer',
                        }}
                      >
                        Enviar 📨
                      </button>
                    </form>
                  </div>
                )}

              {/* PUBLICAÇÕES DO PERFIL - jenios-galeria-v2 */}
              <div style={{
                borderTop: '1px solid #e2e8f0',
                paddingTop: '20px',
                marginTop: '20px',
              }}>
                <h3 style={{
                  fontSize: '16px',
                  color: '#0f172a',
                  marginBottom: '15px',
                }}>
                  Publicações de {perfilVisitado.nome}
                </h3>

                <div style={{
                  display: 'flex',
                  gap: '8px',
                  flexWrap: 'wrap',
                  marginBottom: '20px',
                }}>
                  {[
                    ['posts', 'Posts'],
                    ['fotos', 'Fotos'],
                    ['videos', 'Vídeos'],
                    ['salvos', 'Salvos'],
                  ].filter(([tipo]) =>
                    tipo !== 'salvos' ||
                    perfilVisitado.handle === meuPerfil.handle
                  ).map(([tipo, nome]) => (
                    <button
                      key={tipo}
                      type="button"
                      onClick={() => setAbaGaleria(tipo)}
                      style={{
                        padding: '10px 15px',
                        borderRadius: '9px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        border: '1px solid #ddd6fe',
                        backgroundColor:
                          abaGaleria === tipo ? '#7c3aed' : '#fff',
                        color:
                          abaGaleria === tipo ? '#fff' : '#6d28d9',
                      }}
                    >
                      {nome}
                    </button>
                  ))}
                </div>

                {(() => {
                  const publicacoes = posts.filter((p) => {
                    const ehDoPerfil =
                      p.handle === perfilVisitado.handle;

                    if (abaGaleria === 'salvos') {
                      return (
                        perfilVisitado.handle === meuPerfil.handle &&
                        Boolean(p.salvo)
                      );
                    }

                    if (!ehDoPerfil) return false;

                    if (abaGaleria === 'fotos') {
                      return Array.isArray(p.imagens) &&
                        p.imagens.length > 0;
                    }

                    if (abaGaleria === 'videos') {
                      return Boolean(p.youtubeUrl || p.videoUrl);
                    }

                    return true;
                  });

                  if (publicacoes.length === 0) {
                    return (
                      <p style={{
                        padding: '25px',
                        textAlign: 'center',
                        color: '#64748b',
                        backgroundColor: '#f8fafc',
                        borderRadius: '10px',
                      }}>
                        Nenhuma publicação nesta categoria.
                      </p>
                    );
                  }

                  return (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns:
                        'repeat(auto-fill, minmax(160px, 1fr))',
                      gap: '12px',
                    }}>
                      {publicacoes.map((p) => {
                        const primeira = p.imagens?.[0];
                        const src = typeof primeira === 'string'
                          ? primeira
                          : primeira?.src;

                        return (
                          <button key={p.id} type="button"
                            onClick={() => abrirPostDaGaleria(p.id)}
                            aria-label={`Abrir publicação de ${p.autor || p.handle || 'usuário'}`}
                            style={{
                            padding: 0,
                            textAlign: 'left',
                            cursor: 'pointer',
                            border: '1px solid #e2e8f0',
                            borderRadius: '10px',
                            overflow: 'hidden',
                            backgroundColor: '#fff',
                          }}>
                            <div style={{
                              height: '180px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: src ? '#000' : '#f8fafc',
                              overflow: 'hidden',
                            }}>
                              {src ? (
                                <img
                                  src={src}
                                  alt="Publicação"
                                  style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'contain',
                                  }}
                                />
                              ) : (
                                <span style={{
                                  padding: '12px',
                                  fontSize: '12px',
                                  color: '#475569',
                                  overflowWrap: 'anywhere',
                                }}>
                                  {p.texto?.slice(0, 130) ||
                                    (p.youtubeUrl || p.videoUrl
                                      ? 'Vídeo'
                                      : 'Publicação')}
                                </span>
                              )}
                            </div>

                            <div style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              padding: '10px',
                              fontSize: '11px',
                              color: '#64748b',
                            }}>
                              <span>❤️ {p.likes || 0}</span>
                              <span>👁️ {p.views || 0}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
      </div>

      {/* MODAL DE AUTENTICAÇÃO */}
      {modalAutenticacao && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.88)',
            zIndex: 40000,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '20px',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '420px',
              backgroundColor: '#ffffff',
              borderRadius: '20px',
              padding: '28px',
              boxShadow: '0 25px 60px rgba(0,0,0,0.25)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '20px',
              }}
            >
              <div>
                <h3
                  style={{
                    margin: '0 0 4px 0',
                    color: '#0f172a',
                    fontSize: '18px',
                  }}
                >
                  {modoAuth === 'login'
                    ? '🔑 Entrar na JENIOS'
                    : '🚀 Criar Conta JENIOS'}
                </h3>

                <span
                  style={{
                    fontSize: '10px',
                    color: '#64748b',
                  }}
                >
                  JENIOS Social
                </span>
              </div>

              <button
                type="button"
                onClick={() =>
                  setModalAutenticacao(false)
                }
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '18px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  color: '#64748b',
                }}
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={processarAuth}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              {modoAuth === 'cadastro' && (
                <>
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '10px',
                        fontWeight: 'bold',
                        color: '#64748b',
                        marginBottom: '4px',
                      }}
                    >
                      Nome
                    </label>

                    <input
                      type="text"
                      value={meuPerfil.nome}
                      onChange={(e) =>
                        setMeuPerfil({
                          ...meuPerfil,
                          nome: e.target.value,
                        })
                      }
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        padding: '11px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '12px',
                      }}
                      required
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '10px',
                        fontWeight: 'bold',
                        color: '#64748b',
                        marginBottom: '4px',
                      }}
                    >
                      @Handle único
                    </label>

                    <input
                      type="text"
                      value={meuPerfil.handle}
                      onChange={(e) =>
                        setMeuPerfil({
                          ...meuPerfil,
                          handle: e.target.value,
                        })
                      }
                      placeholder="@seunome"
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        padding: '11px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '12px',
                      }}
                      required
                    />
                  </div>
                </>
              )}

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '10px',
                    fontWeight: 'bold',
                    color: '#64748b',
                    marginBottom: '4px',
                  }}
                >
                  E-mail
                </label>

                <input
                  type="email"
                  value={authEmail}
                  onChange={(e) =>
                    setAuthEmail(e.target.value)
                  }
                  placeholder="seu@email.com"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '11px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '12px',
                  }}
                  required
                />
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '10px',
                    fontWeight: 'bold',
                    color: '#64748b',
                    marginBottom: '4px',
                  }}
                >
                  Senha
                </label>

                <input
                  type="password"
                  value={authSenha}
                  onChange={(e) =>
                    setAuthSenha(e.target.value)
                  }
                  placeholder="••••••••"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '11px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '12px',
                  }}
                  required
                />
              </div>

              <button
                type="submit"
                style={{
                  marginTop: '5px',
                  width: '100%',
                  backgroundColor: '#7c3aed',
                  color: '#ffffff',
                  border: 'none',
                  padding: '12px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                }}
              >
                {modoAuth === 'login'
                  ? 'Entrar na Conta'
                  : 'Criar Minha Conta'}
              </button>
            </form>

            <div
              style={{
                textAlign: 'center',
                marginTop: '16px',
                paddingTop: '14px',
                borderTop: '1px solid #e2e8f0',
              }}
            >
              <span
                style={{
                  fontSize: '11px',
                  color: '#64748b',
                }}
              >
                {modoAuth === 'login'
                  ? 'Ainda não possui uma conta?'
                  : 'Já possui uma conta?'}
              </span>

              <button
                type="button"
                onClick={() =>
                  setModoAuth(
                    modoAuth === 'login'
                      ? 'cadastro'
                      : 'login'
                  )
                }
                style={{
                  marginLeft: '5px',
                  background: 'none',
                  border: 'none',
                  color: '#7c3aed',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                {modoAuth === 'login'
                  ? 'Criar conta'
                  : 'Fazer login'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default function SocialPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            padding: '40px',
            textAlign: 'center',
            color: '#64748b',
          }}
        >
          Carregando comunidade social...
        </div>
      }
    >
      <SocialContent />
    </Suspense>
  );
}