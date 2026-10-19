'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../../../lib/supabase';
import SocialPinnedPosts from '../../../components/SocialPinnedPosts';

const safe = value => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch { return false; }
};
const validMedia = post => (Array.isArray(post?.media) ? post.media : []).filter(item =>
  (item?.type === 'video' || item?.type === 'image') && safe(item.url)
);

export default function PublicProfile() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [message, setMessage] = useState('Carregando perfil…');
  const [selectedPost, setSelectedPost] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [viewerId,setViewerId]=useState(null);
  const epoch = useRef(0), moreBusy = useRef(false);

  useEffect(() => {
    const version = ++epoch.current;
    setData(null); setSelectedPost(null); setMessage('Carregando perfil…');
    setLoadingMore(false); moreBusy.current = false;
    async function load() {
      try {
        if (!supabase) throw new Error('Conexão não configurada.');
        const { data: auth } = await supabase.auth.getSession();
        if (!auth?.session || auth.session.user?.is_anonymous) throw new Error('Entre na sua conta para visitar o perfil.');
        const response = await fetch('/api/social/profiles?id=' + encodeURIComponent(id), {
          cache: 'no-store', headers: { authorization: 'Bearer ' + auth.session.access_token }
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Não foi possível carregar o perfil.');
        if (version === epoch.current) {
          setViewerId(auth.session.user.id);
          setData({ ...result, posts: Array.isArray(result.posts) ? result.posts : [] });
          setMessage('');
        }
      } catch (error) {
        if (version === epoch.current) setMessage(error.message || 'Não foi possível carregar o perfil.');
      }
    }
    void load();
    const listener = supabase?.auth.onAuthStateChange(event => {
      if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') return;
      epoch.current++; moreBusy.current = false;
      setData(null); setSelectedPost(null); setLoadingMore(false); setViewerId(null);
      setMessage('A conta mudou. Reabra o perfil.');
    });
    return () => {
      epoch.current++; moreBusy.current = false;
      listener?.data?.subscription?.unsubscribe();
    };
  }, [id]);

  useEffect(() => {
    if (!selectedPost) return;
    const onKeyDown = event => { if (event.key === 'Escape') setSelectedPost(null); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedPost]);

  async function loadMore() {
    if (moreBusy.current || !data || data.nextOffset == null) return;
    moreBusy.current = true; setLoadingMore(true);
    const version = epoch.current;
    try {
      if (!supabase) throw new Error('Conexão não configurada.');
      const { data: auth } = await supabase.auth.getSession();
      if (!auth?.session) throw new Error('Sua sessão expirou. Entre novamente.');
      const response = await fetch('/api/social/profiles?id=' + encodeURIComponent(id) + '&offset=' + data.nextOffset, {
        cache: 'no-store', headers: { authorization: 'Bearer ' + auth.session.access_token }
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Não foi possível carregar mais publicações.');
      if (version !== epoch.current) return;
      setData(old => {
        if (!old) return old;
        const previous = new Set(old.posts.map(post => post.id));
        const additional = (Array.isArray(result.posts) ? result.posts : []).filter(post => !previous.has(post.id));
        return { ...old, posts: [...old.posts, ...additional], nextOffset: result.nextOffset, postsCount: result.postsCount };
      });
      setMessage('');
    } catch (error) {
      if (version === epoch.current) setMessage(error.message || 'Não foi possível carregar mais publicações.');
    } finally {
      if (version === epoch.current) { moreBusy.current = false; setLoadingMore(false); }
    }
  }

  return (
    <main style={{ maxWidth: 760, margin: 'auto', padding: 24, fontFamily: 'system-ui', color: '#172033' }}>
      <Link href="/social">← Voltar à Social</Link>
      {message && <p role="status">{message}</p>}
      {data && <>
        <header style={{ marginTop: 24 }}>
          {safe(data.profile?.avatar_url) && <img src={data.profile.avatar_url} alt="" width={90} height={90} style={{ borderRadius: '50%', objectFit: 'cover' }} />}
          <h1>{data.profile?.display_name || data.profile?.handle || 'Perfil'}</h1>
          <p>@{String(data.profile?.handle || '').replace(/^@/, '')}</p>
          {viewerId && viewerId!==data.profile?.id && data.profile?.handle && <Link
             href={'/social?perfil='+encodeURIComponent(data.profile.handle)+'&direct=1'}
             style={{display:'inline-block',padding:'10px 15px',borderRadius:10,background:'#7c3aed',color:'#fff',fontWeight:700,textDecoration:'none',marginBottom:14}}>
             ✉ Enviar mensagem
          </Link>}
          <p style={{ whiteSpace: 'pre-wrap' }}>{data.profile?.bio}</p>
          {safe(data.profile?.website) && <a href={data.profile.website} target="_blank" rel="noopener noreferrer">Site informado no perfil ↗</a>}
        </header>
        <SocialPinnedPosts ownerId={data.profile?.id} accountId={viewerId} candidatePosts={data.posts}/>
        <h2>Feed</h2>
        <p style={{ fontSize: 13, color: '#64748b' }}>
          {Number(data.postsCount) || 0} publicações visíveis. Selecione uma miniatura para abrir o conteúdo.
        </p>
        <div className="jenios-public-profile-grid" aria-label="Grade de publicações do perfil">
          {data.posts.map(post => {
            const media = validMedia(post), primary = media[0];
            return <button type="button" key={post.id} className="jenios-public-profile-tile"
              onClick={() => setSelectedPost(post)} aria-label={'Abrir publicação: ' + (post.body?.slice(0, 75) || 'mídia')}>
              {primary?.type === 'image' && <img src={primary.url} alt="" loading="lazy" />}
              {primary?.type === 'video' && <span className="jenios-public-profile-video">▶ Vídeo</span>}
              {!primary && <span className="jenios-public-profile-text">{post.body || 'Publicação sem legenda'}</span>}
              {media.length > 1 && <span className="jenios-public-profile-count" aria-label={media.length + ' mídias'}>▣ {media.length}</span>}
            </button>;
          })}
        </div>
        {data.posts.length === 0 && <p>Nenhuma publicação disponível.</p>}
        {data.nextOffset != null && <button type="button" className="jenios-public-profile-more"
          onClick={loadMore} disabled={loadingMore}>{loadingMore ? 'Carregando…' : 'Carregar mais publicações'}</button>}
      </>}
      {selectedPost && <div className="jenios-public-profile-overlay" role="presentation" onClick={() => setSelectedPost(null)}>
        <section className="jenios-public-profile-dialog" role="dialog" aria-modal="true" aria-label="Publicação aberta" onClick={event => event.stopPropagation()}>
          <button type="button" className="jenios-public-profile-close" onClick={() => setSelectedPost(null)}>Fechar ×</button>
          <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{selectedPost.body}</p>
          {validMedia(selectedPost).map((media, index) => media.type === 'video'
            ? <video key={index} controls playsInline preload="metadata" src={media.url} style={{ display: 'block', width: '100%', maxHeight: 480, marginBottom: 12 }} />
            : <img key={index} src={media.url} alt={'Mídia da publicação ' + (index + 1)} loading="lazy" style={{ display: 'block', width: '100%', maxHeight: 480, objectFit: 'contain', marginBottom: 12 }} />)}
        </section>
      </div>}
    </main>
  );
}
