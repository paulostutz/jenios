'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../../../lib/supabase';
const safe = value => { try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; } catch { return false; } };
export default function PublicProfile() {
  const { id } = useParams(), [data, setData] = useState(null), [message, setMessage] = useState('Carregando perfil…');
  const epoch = useRef(0);
  useEffect(() => {
    const version = ++epoch.current; setData(null); setMessage('Carregando perfil…');
    async function load() {
      try {
        if (!supabase) throw new Error('Conexão não configurada.');
        const { data } = await supabase.auth.getSession();
        if (!data?.session) throw new Error('Entre na sua conta para visitar o perfil.');
        const response = await fetch('/api/social/profiles?id=' + encodeURIComponent(id), { cache: 'no-store', headers: { authorization: 'Bearer ' + data.session.access_token } });
        const result = await response.json(); if (!response.ok) throw new Error(result.error);
        if (version === epoch.current) { setData(result); setMessage(''); }
      } catch (error) { if (version === epoch.current) setMessage(error.message); }
    }
    load();
    const listener = supabase?.auth.onAuthStateChange(event => { if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') return; epoch.current++; setData(null); setMessage('A conta mudou. Reabra o perfil.'); });
    return () => { epoch.current++; listener?.data?.subscription?.unsubscribe(); };
  }, [id]);
  return <main style={{ maxWidth: 760, margin: 'auto', padding: 24, fontFamily: 'system-ui', color: '#172033' }}><Link href="/social">← Voltar à Social</Link>{message && <p role="status">{message}</p>}{data && <><header style={{ marginTop: 24 }}>{safe(data.profile.avatar_url) && <img src={data.profile.avatar_url} alt="" width={90} height={90} style={{ borderRadius: '50%', objectFit: 'cover' }} />}<h1>{data.profile.display_name || data.profile.handle || 'Perfil'}</h1><p>{data.profile.handle}</p><p style={{ whiteSpace: 'pre-wrap' }}>{data.profile.bio}</p>{safe(data.profile.website) && <a href={data.profile.website} target="_blank" rel="noopener noreferrer">Site informado no perfil ↗</a>}</header><h2>Publicações recentes</h2><p>Até 20 publicações visíveis para sua conta. Este perfil é somente leitura.</p>{data.posts.map(post => <article key={post.id} style={{ padding: 18, border: '1px solid #ddd', borderRadius: 12, marginTop: 12 }}><p style={{ whiteSpace: 'pre-wrap' }}>{post.body}</p>{post.media.map((media, index) => media.type === 'video' ? <video key={index} controls playsInline src={media.url} style={{ maxWidth: '100%', maxHeight: 400 }} /> : <img key={index} src={media.url} alt="Mídia da publicação" style={{ maxWidth: '100%', maxHeight: 400 }} />)}</article>)}{!data.posts.length && <p>Nenhuma publicação disponível.</p>}</>}</main>;
}
