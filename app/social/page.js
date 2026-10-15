'use client';

import useSocialFeed from '../components/useSocialFeed';
import SocialDirectSession from '../components/SocialDirectSession';
import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase, accountDatabase } from '../../lib/supabase';
import { uploadSocialMedia } from '../../lib/social/media.mjs';
const REMOTE_MEDIA = true;

import CryptoValidator from '../components/CryptoValidator';
import SocialSidebarPremium from '../components/SocialSidebarPremium';
import './jenios-theme.css';
import SocialPostCard from '../components/SocialPostCard';
import SocialBlocks from '../components/SocialBlocks';
import SocialStories from '../components/SocialStories';
import SocialLives from '../components/SocialLives';



function SocialContent() {
  const [blocksOpen,setBlocksOpen]=useState(false);
  const [abaGaleria, setAbaGaleria] = useState('posts');

  const searchParams = useSearchParams();
  const perfilUrl = searchParams.get('perfil');
  const postUrl = searchParams.get('post');
  const [erroPostEmFoco, setErroPostEmFoco] = useState('');

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
  const [storyUploading,setStoryUploading]=useState(false);
  const adicionarStoryJenios = async () => {
    if(!meuPerfil.autenticado){setModalAutenticacao(true);return;}
    if(storyUploading)return;
    const owner=meuPerfil.id,input=document.createElement('input');input.type='file';input.accept='image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime';
    input.onchange=async event=>{
      const file=event.target.files?.[0];if(!file)return;
      setStoryUploading(true);const src=URL.createObjectURL(file);
      try{
        let duration;
        if(file.type.startsWith('video/'))duration=await new Promise((resolve,reject)=>{const video=document.createElement('video');const timer=setTimeout(()=>reject(Error('Não foi possível ler o vídeo.')),15000);video.preload='metadata';video.onloadedmetadata=()=>{clearTimeout(timer);resolve(video.duration);};video.onerror=()=>{clearTimeout(timer);reject(Error('Não foi possível ler o vídeo.'));};video.src=src;});
        const media=await uploadSocialMedia([{src,_file:file,tipo:file.type.startsWith('video/')?'video':'imagem',duracao:duration}],{client:supabase,getAccessToken:async()=>{const r=await supabase.auth.getSession();if(r.data?.session?.user.id!==owner)throw Error('Sua sessão mudou.');return r.data.session.access_token;}});
        if(sessionOwnerRef.current!==owner)throw Error('Sua sessão mudou.');
        await feed.createStory({url:media[0].src,type:media[0].tipo==='video'?'video':'image'});
      }catch(error){alert(error.message||'Não foi possível publicar o Story.');}
      finally{URL.revokeObjectURL(src);setStoryUploading(false);}
    };input.click();
  };
  const excluirStoryJenios=async id=>{try{await feed.deleteStory(id);}catch{alert('Não foi possível excluir o Story.');}};

  const [novoTexto, setNovoTexto] = useState('');
  const [youtubeLink, setYoutubeLink] = useState('');
  const [imagensPreview, setImagensPreview] = useState([]);
  const [enviandoPublicacao, setEnviandoPublicacao] = useState(false);
  const [indiceCarrossel, setIndiceCarrossel] = useState({});
  const [perfilVisitado, setPerfilVisitado] = useState(null);
  const [profilePosts,setProfilePosts]=useState([]),[profileNext,setProfileNext]=useState(null);
  const [profileBusy,setProfileBusy]=useState(false),[profileError,setProfileError]=useState('');
  const profileRequest=useRef(0);
  const [followRows,setFollowRows]=useState([]),[followNext,setFollowNext]=useState(null),[followError,setFollowError]=useState('');
  const [postEmFoco, setPostEmFoco] = useState(null);
  const [chatAtivo, setChatAtivo] = useState(null);
  const directAutoOpened=useRef(false);
  const [textoMensagem, setTextoMensagem] = useState('');
  const [mensagensDirect, setMensagensDirect] = useState({});
  const [mensagensAberta, setMensagensAberta] = useState(false);

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
  const feed = useSocialFeed();
  const storiesJenios=feed.stories;
  const {profile:meuPerfil,setProfile:setMeuPerfil,posts,setPosts,ready:postsProntos,error:erroPosts}=feed;
  const sessionOwnerRef=useRef(null);sessionOwnerRef.current=meuPerfil.id;
  useEffect(()=>{if(modalAutenticacao)window.location.href='/login';},[modalAutenticacao]);
  useEffect(()=>{setBlocksOpen(false);setNovoTexto('');setYoutubeLink('');setImagensPreview([]);setModalEditarPerfil(false);setPerfilVisitado(null);setPostEmFoco(null);setErroPostEmFoco('');setMensagensAberta(false);setChatAtivo(null);setTextoMensagem('');profileRequest.current++;setProfilePosts([]);setProfileNext(null);setProfileBusy(false);setProfileError('');setModalLista(null);setFollowRows([]);},[meuPerfil.id]);
  useEffect(()=>{if(postsProntos&&!directAutoOpened.current&&searchParams.get('direct')==='1'){directAutoOpened.current=true;setMensagensAberta(true);}},[postsProntos,meuPerfil.id,searchParams]);

  // Ranking Top 10 Semanal Completo
  const rankingOperadores = [];

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

  // Shared feed and authentication are loaded by useSocialFeed, never from localStorage.
  useEffect(()=>{if(perfilUrl&&meuPerfil.id&&postsProntos)void visitarPerfil({handle:perfilUrl});},[perfilUrl,meuPerfil.id,postsProntos]);

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

  const salvarEdicaoPerfil = async (e) => {
    e.preventDefault();
    if(!meuPerfil.autenticado){setModalAutenticacao(true);return;}
    const handle=meuPerfil.handle.trim().replace(/^@/,'').toLowerCase();
    if(!/^[a-z0-9_]{3,30}$/.test(handle)){alert('Use de 3 a 30 letras, números ou _ no identificador.');return;}
    try{
      const checked=await supabase.auth.getUser();
      if(checked.error||checked.data?.user?.id!==meuPerfil.id||checked.data.user.is_anonymous)throw Error('Entre na sua conta novamente.');
      let avatar=meuPerfil.avatar;
      if(avatar.startsWith('data:image/')){
        const uploaded=await uploadSocialMedia([{src:avatar,tipo:'imagem'}],{client:supabase,getAccessToken:async()=>{const r=await supabase.auth.getSession();return r.data?.session?.access_token;}});avatar=uploaded[0].src;
      }
      if(avatar&&!avatar.startsWith('https://'))avatar=null;
      const result=await accountDatabase(meuPerfil.id).from('profiles').upsert({id:checked.data.user.id,handle,display_name:meuPerfil.nome.trim(),bio:meuPerfil.bio,avatar_url:avatar},{onConflict:'id'});
      if(result.error)throw Error(result.error.code==='23505'?'Este identificador já está em uso.':'Não foi possível salvar o perfil.');
      const current=await supabase.auth.getUser();
      if(current.data?.user?.id!==meuPerfil.id)return;
      setMeuPerfil(p=>({...p,handle:'@'+handle,avatar:avatar||p.avatar}));setModalEditarPerfil(false);
    }catch(error){alert(error.message);}
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

  const fazerLogout = async () => {
    const result=await supabase?.auth.signOut({scope:'local'});
    if(result?.error){alert('Não foi possível encerrar a sessão. Tente novamente.');return;}
    setModalEditarPerfil(false);setPerfilVisitado(null);setAbaAtiva('feed');
  };
  const processarAuth = (event) => {event.preventDefault();window.location.href='/login';};

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
          tipo: 'imagem',
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

  if (files.length === 0) return;
  if(files.length+imagensPreview.length>10){alert('Use no máximo dez fotos e vídeos.');e.target.value='';return;}

  const processarVideo = (file) => new Promise((resolve, reject) => {
    if (file.size > 50 * 1024 * 1024) {
      reject(new Error('O vídeo deve ter no máximo 50 MB.'));
      return;
    }

    const video = document.createElement('video');
    const objectUrl = URL.createObjectURL(file);
    video.preload = 'metadata';

    video.onloadedmetadata = () => {
      const duracao = video.duration;
      URL.revokeObjectURL(objectUrl);

      if (!Number.isFinite(duracao) || duracao > 90) {
        reject(new Error('O vídeo deve ter no máximo 1 minuto e 30 segundos.'));
        return;
      }

      if(REMOTE_MEDIA){resolve({src:URL.createObjectURL(file),tipo:'video',duracao,_file:file});return;}

      const reader = new FileReader();
      reader.onload = () => resolve({
        src: reader.result,
        tipo: 'video',
        duracao
      });
      reader.onerror = () => reject(new Error('Não foi possível ler o vídeo.'));
      reader.readAsDataURL(file);
    };

    video.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Formato de vídeo não suportado.'));
    };
    video.src = objectUrl;
  });

  try {
    const midiasProcessadas = await Promise.all(files.map((file) => {
      if (file.type.startsWith('image/')) return comprimirImagem(file);
      if (file.type.startsWith('video/')) return processarVideo(file);
      throw new Error('Selecione apenas fotos ou vídeos.');
    }));

    setImagensPreview((prev) => [
      ...prev,
      ...midiasProcessadas,
    ]);
  } catch (error) {
    console.error('Erro ao processar mídia:', error);
    alert(error.message || 'Não foi possível processar uma das mídias.');
  } finally {
    // Permite selecionar novamente o mesmo arquivo depois
    e.target.value = '';
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

  const publicarPost = async (e) => {
    e.preventDefault();
    if(enviandoPublicacao)return;
    if(!meuPerfil.autenticado){setModalAutenticacao(true);return;}
    if(!novoTexto.trim()&&!imagensPreview.length&&!youtubeLink.trim())return;
    setEnviandoPublicacao(true);
    try {
      if(!supabase)throw Error('Entre na sua conta para publicar.');
      const {data,error}=await supabase.auth.getUser();
      if(error||!data.user?.id||data.user.is_anonymous||data.user.id!==meuPerfil.id)throw Error('Sua sessão mudou. Entre novamente.');
      const owner=data.user.id;
      const media=imagensPreview.length?await uploadSocialMedia(imagensPreview,{client:supabase,onProgress:items=>{if(sessionOwnerRef.current===owner)setImagensPreview(items);},getAccessToken:async()=>{const r=await supabase.auth.getSession();if(r.data?.session?.user.id!==owner)throw Error('Sua sessão mudou.');return r.data?.session?.access_token;}}):[];
      const check=await supabase.auth.getUser();
      if(check.error||check.data?.user?.id!==owner)throw Error('Sua sessão mudou. O texto foi preservado.');
      await feed.publish([novoTexto.trim(),youtubeLink.trim()].filter(Boolean).join('\n'),media.map(x=>({url:x.src,type:x.tipo==='video'?'video':'image'})));
      if(sessionOwnerRef.current!==owner)return;
      for(const item of imagensPreview)if(item.src?.startsWith('blob:'))URL.revokeObjectURL(item.src);
      setNovoTexto('');setYoutubeLink('');setImagensPreview([]);
    }catch(error){alert(error.message||'Não foi possível publicar. Seu texto foi preservado.');}
    finally{setEnviandoPublicacao(false);}
  };
  const repostarPost = async (post) => {
    if(!meuPerfil.autenticado){setModalAutenticacao(true);return;}
    try{await feed.publish(`Repost de ${post.handle}:\n${post.texto}\n${window.location.origin}/social?post=${post.id}`,[]);}catch(error){alert(error.message);}
  };
  const curtirPost = async (id) => {try{const post=posts.find(p=>p.id===id);if(post)await feed.like(post);}catch(error){alert(error.message);}};
  const atualizarPost = async (id,changes) => {
    if(Object.keys(changes).some(k=>k!=='salvo'))return;
    try{const post=posts.find(p=>p.id===id);if(post)await feed.save(post,Boolean(changes.salvo));}catch(error){alert(error.message);}
  };
  const excluirPost = async (id) => {try{await feed.remove(id);}catch(error){alert(error.message);}};

  useEffect(()=>{
    if(!postUrl||!meuPerfil.autenticado||!postsProntos)return;
    let live=true;setErroPostEmFoco('');
    if(!/^[0-9a-f-]{36}$/i.test(postUrl)){setErroPostEmFoco('Link de publicação inválido.');return;}
    feed.openPost(postUrl).then(()=>{if(live){setPostEmFoco(postUrl);setAbaAtiva('feed');}}).catch(error=>{if(live)setErroPostEmFoco(error.code==='POST_NOT_FOUND'?'Esta publicação não está disponível.':'Não foi possível abrir esta publicação.');});
    return()=>{live=false;};
  },[postUrl,meuPerfil.id,postsProntos]);

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
  const abrirPostDaGaleria = async (postId) => {
    try{await feed.openPost(postId);setPostEmFoco(postId);setAbaAtiva('feed');}catch(error){alert('Não foi possível abrir a publicação.');}
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

  const alternarSeguir = async () => {
    const owner=sessionOwnerRef.current,request=profileRequest.current;
    try{const updated=await feed.toggleFollow(perfilVisitado);if(owner===sessionOwnerRef.current&&request===profileRequest.current)setPerfilVisitado(updated);}catch(error){alert(error.message);}
  };
  const visitarPerfil = async (usuario,tab='posts',offset=0) => {
    if(!meuPerfil.autenticado){setModalAutenticacao(true);return;}
    if(!usuario?.handle&&!usuario?.id)return;
    const request=++profileRequest.current,owner=sessionOwnerRef.current;
    setProfileBusy(true);setProfileError('');setAbaGaleria(tab);setAbaAtiva('perfil-visita');
    if(!offset){setPerfilVisitado(usuario);setProfilePosts([]);setProfileNext(null);}
    try{
      const result=await feed.visit(usuario,offset);
      if(owner!==sessionOwnerRef.current||request!==profileRequest.current)return;
      setPerfilVisitado(result.profile);setProfilePosts(old=>offset?[...old,...result.posts.filter(p=>!old.some(x=>x.id===p.id))]:result.posts);setProfileNext(result.nextOffset);
      if(tab==='salvos')await feed.loadSaved();
    }catch(error){if(owner===sessionOwnerRef.current&&request===profileRequest.current)setProfileError('Não foi possível carregar o perfil. Tente novamente.');}
    finally{if(owner===sessionOwnerRef.current&&request===profileRequest.current)setProfileBusy(false);}
    if(!offset)window.scrollTo({top:0,behavior:'smooth'});
  };
  const abrirLista = async (kind,offset=0) => {
    const owner=sessionOwnerRef.current;
    setModalLista(kind);setFollowError('');if(!offset){setFollowRows([]);setFollowNext(null);}
    try{const result=await feed.followList(owner,kind==='seguidores'?'followers':'following',offset);if(owner===sessionOwnerRef.current){setFollowRows(old=>offset?[...old,...result.profiles]:result.profiles);setFollowNext(result.nextOffset);}}
    catch{if(owner===sessionOwnerRef.current)setFollowError('Não foi possível carregar esta lista.');}
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
      `${window.location.origin}/social?perfil=${encodeURIComponent(handleLimpo)}`;

    navigator.clipboard.writeText(url);

    alert(`🔗 Link do perfil copiado: ${url}`);
  };


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
    >{blocksOpen&&<SocialBlocks key={meuPerfil.id} onLoad={feed.blocks} onUnblock={feed.unblock} onClose={()=>setBlocksOpen(false)}/>}
      {/* MODAL CÂMERA */}
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
              {followError && <p role="alert">{followError}</p>}
              {followRows.map(person=><button key={person.id} onClick={()=>{setModalLista(null);void visitarPerfil({id:person.id,handle:person.handle});}} style={{padding:10,border:'1px solid #ddd6fe',borderRadius:8,background:'#fff',color:'#7c3aed',cursor:'pointer'}}>{person.display_name || person.handle} · @{person.handle}</button>)}
              {followNext!==null && <button onClick={()=>abrirLista(modalLista,followNext)}>Carregar mais</button>}
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
        <div className="social-main-header"
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
            <a className="social-header-link" href="/lp">Conheça a Tecnologia JENIOS ↗</a>
            <button className="social-header-link" onClick={() => setMensagensAberta(true)}>Mensagens</button>
            <a className="social-header-link" href="/notifications" aria-label="Notificações"><svg width="14" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg></a>
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

        {mensagensAberta && <div className="social-message-backdrop" onClick={() => setMensagensAberta(false)}><section className="social-message-dialog" role="dialog" aria-modal="true" aria-label="Mensagens" onClick={e=>e.stopPropagation()}>
          <button autoFocus className="social-header-link" onClick={() => setMensagensAberta(false)}>Fechar</button><h2>Mensagens</h2>
          <SocialDirectSession initialPerson={chatAtivo}/>
        </section></div>}

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
          <div className="social-profile-row"
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
                onClick={() => window.dispatchEvent(new Event("jenios:abrir-meu-story"))}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    window.dispatchEvent(new Event("jenios:abrir-meu-story"));
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

              <button type="button" onClick={adicionarStoryJenios} aria-label="Adicionar Story" title="Adicionar Story" style={{marginLeft:-39,marginTop:64,zIndex:2,background:'#7c3aed',color:'#fff',border:'2px solid white',borderRadius:'50%',width:28,height:28,fontSize:20,cursor:'pointer',flexShrink:0}}>+</button>
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

            <div className="social-profile-stats"
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
                onClick={() => abrirLista('seguidores')}
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
                  {meuPerfil.followersCount ?? '—'}
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
                onClick={() => abrirLista('seguindo')}
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
                  {meuPerfil.followingCount ?? '—'}
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
                <span title="Aguardando registro de visualizações datadas em banco compartilhado" style={{display:'block',fontSize:'9px',color:'#64748b'}}>Métrica em preparação</span><a href="/insights" style={{display:"block",fontSize:11,color:"#7c3aed",marginTop:4,fontWeight:700}}>Abrir Insights ↗</a>
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
            ['lives','🔴 Lives'],
            ['perfil','👤 Meu Perfil'],
            ['salvos','🔖 Salvos'],
            ['bloqueados','Usuários bloqueados']
          ].map(([destino,rotulo]) => (
            <button key={destino} type="button" onClick={() => {
              if(destino==='bloqueados'){if(!meuPerfil.autenticado){setModalAutenticacao(true);return;}setBlocksOpen(true);return;}
              if (destino === 'perfil' || destino === 'salvos') {
                void visitarPerfil(meuPerfil,destino === 'salvos' ? 'salvos' : 'posts');
              } else {
                setAbaAtiva(destino);
              }
              window.scrollTo({top:0,behavior:'smooth'});
            }} style={{padding:'9px 13px',borderRadius:'9px',cursor:'pointer',fontSize:'12px',fontWeight:700,
              border:'1px solid #ddd6fe',backgroundColor:(abaAtiva === destino || (destino === 'perfil' && abaAtiva === 'perfil-visita' && abaGaleria !== 'salvos') || (destino === 'salvos' && abaAtiva === 'perfil-visita' && abaGaleria === 'salvos')) ? '#7c3aed' : '#fff',
              color:(abaAtiva === destino || (destino === 'perfil' && abaAtiva === 'perfil-visita' && abaGaleria !== 'salvos') || (destino === 'salvos' && abaAtiva === 'perfil-visita' && abaGaleria === 'salvos')) ? '#fff' : '#4c1d95'}}>{rotulo}</button>
          ))}
        </nav>

        <nav aria-label="Ferramentas JENIOS" style={{display:"flex",gap:8,flexWrap:"wrap",margin:"0 0 16px"}}>
          {[
            ["Simulador","/social/simulador"],
            ["Hub de Tendências","/tendencias"],
            ["BankScore","/bankscore"],
            ["Especialistas","/especialistas"],
            ["Insights","/insights"],
            ["Impulsionar","/impulsionar"]
          ].map(([titulo,url])=><a key={url} href={url} style={{padding:"9px 14px",borderRadius:10,border:"1px solid #ddd6fe",color:"#6d28d9",background:"#faf5ff",fontWeight:700,fontSize:12,textDecoration:"none"}}>{titulo} ↗</a>)}
        </nav>
        {/* JENIOS V7: compartilhamento de transmissões do YouTube */}
        {abaAtiva === 'lives' && <SocialLives key={meuPerfil?.id} meuPerfil={meuPerfil} onLoad={feed.lives} onCreate={feed.createLive} onRemove={feed.deleteLive} onReport={feed.reportLive} />}

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
              {storyUploading && <p role="status">Enviando Story…</p>}
                  {feed.storiesError && <p role="alert">{feed.storiesError} <button onClick={()=>feed.loadStories().catch(()=>{})}>Tentar novamente</button></p>}
                  {feed.storiesNext!==null && <button onClick={()=>feed.loadStories(feed.storiesNext).catch(()=>{})}>Carregar mais Stories</button>}
                  <SocialStories
                meuPerfil={meuPerfil}
                stories={storiesJenios}
                onExcluirStory={excluirStoryJenios}
                onAdicionarStory={adicionarStoryJenios}
                ocultarMeuStory={false}
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
                  {!meuPerfil.autenticado && <p style={{fontSize:14,color:"#475569",margin:"0 0 16px"}}>Entre na sua conta para publicar fotos, vídeos e Stories.</p>}
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
                    ✨ Um único botão para fotos e vídeos. Vídeos de até 1 minuto e 30 segundos.
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
                        {(imagem?.tipo === 'video' || imagem?.src?.startsWith('data:video/')) ? (
                          <video
                            src={imagem.src}
                            controls
                            playsInline
                            preload="metadata"
                            style={{ width: '100%', maxHeight: '150px', display: 'block' }}
                          />
                        ) : (
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
                        />)}

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
                        accept="image/*,video/*"
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
                {!postsProntos&&<p role="status">Carregando publicações…</p>}
                {erroPosts&&<p role="alert">{erroPosts} <button onClick={feed.retry}>Tentar novamente</button></p>}
                {erroPostEmFoco&&<p role="alert">{erroPostEmFoco}</p>}
                {postsProntos&&!erroPosts&&!posts.length&&<p>{meuPerfil.autenticado?'Nenhuma publicação disponível.':'Entre na sua conta para acompanhar as publicações.'}</p>}
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
                    onLoadComments={feed.comments}
                    onCreateComment={feed.comment}
                    onDeleteComment={feed.removeComment}
                    onLikeComment={feed.likeComment}
                    onReport={feed.report}
                    onBlock={feed.block}
                    extrairEmbedYoutube={extrairEmbedYoutube}
                  />
                  </div>
                ))}
                {feed.cursor&&<button disabled={feed.loading} onClick={feed.more}>{feed.loading?'Carregando…':'Carregar mais publicações'}</button>}
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
              <SocialSidebarPremium operadores={rankingOperadores} onOpenRanking={() => {setAbaAtiva('ranking');window.scrollTo({top:0,behavior:'smooth'});}} />

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
                  🏆 Ranking Semanal · Top 10
                </h2>

                <p
                  style={{
                    fontSize: '11px',
                    color: '#64748b',
                    margin: 0,
                  }}
                >
                  Ranking em preparação. Os resultados serão publicados após conferência.
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
              {[].map((op) => (
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

                    {perfilVisitado.handle !== meuPerfil.handle && (
                      <button
                        type="button"
                        aria-pressed={Boolean(perfilVisitado.followed)}
                        onClick={() => alternarSeguir()}
                        style={{
                          backgroundColor: Boolean(perfilVisitado.followed) ? '#f5f3ff' : '#7c3aed',
                          color: Boolean(perfilVisitado.followed) ? '#6d28d9' : '#fff',
                          border: '1px solid #7c3aed',
                          padding: '8px 16px',
                          borderRadius: '8px',
                          fontWeight: 'bold',
                          fontSize: '11px',
                          cursor: 'pointer',
                        }}
                      >
                        {Boolean(perfilVisitado.followed) ? '✓ Seguindo' : '+ Seguir'}
                      </button>
                    )}
                    {perfilVisitado.handle !==
                      meuPerfil.handle && (
                      <button
                        type="button"
                        onClick={() => {setChatAtivo(perfilVisitado);setMensagensAberta(true);}}
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
                        {perfilVisitado.postsCount ?? '—'}
                      </b>{' '}
                      posts
                    </div>

                    <div>
                      <b>
                        {perfilVisitado.followersCount ?? '—'}
                      </b>{' '}
                      seguidores
                    </div>

                    <div>
                      <b>
                        {perfilVisitado.followingCount ?? '—'}
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
              {false && chatAtivo &&
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

              {perfilVisitado.handle !== meuPerfil.handle && (
                <p style={{fontSize:'11px', color:'#64748b', margin:'0 0 12px'}}>
                  Seguir e mensagens estão em modo de demonstração local até a integração das contas.
                </p>
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
                      onClick={() => {setAbaGaleria(tipo);if(tipo==='salvos')feed.loadSaved().catch(()=>setProfileError('Não foi possível carregar os salvos.'));}}
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

                {profileBusy && <p role="status">Carregando perfil…</p>}
                {profileError && <p role="alert">{profileError} <button onClick={()=>visitarPerfil(perfilVisitado,abaGaleria)}>Tentar novamente</button></p>}
                {(() => {
                  const publicacoes = (abaGaleria==='salvos'?feed.savedPosts:profilePosts).filter((p) => {
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
                      return p.imagens?.some(item=>item.tipo!=='video');
                    }

                    if (abaGaleria === 'videos') {
                      return Boolean(p.youtubeUrl || p.videoUrl || p.imagens?.some(item=>item.tipo==='video'));
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
                              {src && primeira?.tipo==='video' ? <video src={src} muted playsInline preload="metadata" style={{width:'100%',height:'100%',objectFit:'contain'}}/> : src ? (
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
                {(abaGaleria==='salvos'?feed.savedNext:profileNext)!==null && <button disabled={profileBusy} onClick={()=>abaGaleria==='salvos'?feed.loadSaved(feed.savedNext).catch(()=>setProfileError('Não foi possível carregar mais salvos.')):visitarPerfil(perfilVisitado,abaGaleria,profileNext)}>Carregar mais publicações</button>}
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