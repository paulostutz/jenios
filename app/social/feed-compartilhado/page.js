'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { createSocialFeedClient } from '../../../lib/social/feed-client.mjs';
import SocialMediaPicker from '../../components/SocialMediaPicker';
import PromotedPost from '../../components/PromotedPost';
import { uploadSocialMedia } from '../../../lib/social/media.mjs';

const enabled = process.env.NEXT_PUBLIC_SOCIAL_SHARED_PREVIEW_ENABLED === 'true';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUP_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export default function FeedCompartilhadoPreview() {
  const supabase = useMemo(() => enabled && url && key
    ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } })
    : null, []);
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [posts, setPosts] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [draft, setDraft] = useState('');
  const [media,setMedia]=useState([]);
  const [commentDrafts, setCommentDrafts] = useState({});
  const [comments, setComments] = useState({});
  const [likes, setLikes] = useState({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const generation = useRef(0);
  const sessionRef = useRef(null);
  const api = useMemo(() => createSocialFeedClient({
    getAccessToken: async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      return data?.session?.access_token ?? null;
    }
  }), [supabase]);

  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!alive) return;
      if (sessionRef.current !== next?.user?.id) {
        generation.current += 1;
        setPosts([]); setCursor(null); setComments({}); setLikes({}); setDraft(''); setMedia([]); setCommentDrafts({});
      }
      sessionRef.current = next?.user?.id ?? null;
      setSession(next);
    });
    supabase.auth.getSession().then(({data}) => {
      if (!alive) return;
      // Never overwrite a newer auth event with an older session response.
      if (sessionRef.current === null && data?.session) {
        sessionRef.current = data.session.user.id;
        generation.current += 1;
        setSession(data.session);
      }
    }).catch(() => { if (alive) setMessage('Não foi possível consultar a sessão.'); });
    return () => { alive = false; generation.current += 1; listener.subscription.unsubscribe(); };
  }, [supabase]);

  const load = useCallback(async (next = false) => {
    const epoch = generation.current;
    setBusy(true); setMessage('');
    try {
      const result = await api.listPosts({limit:20, cursor:next ? cursor : null});
      if (epoch !== generation.current) return;
      setPosts(previous => next ? [...previous, ...result.posts] : result.posts);
      setCursor(result.nextBefore && result.nextBeforeId ? {before:result.nextBefore,beforeId:result.nextBeforeId} : null);
    } catch (error) { if (epoch === generation.current) setMessage('Feed indisponível: ' + (error.code || 'ERRO_DE_CONEXAO')); }
    finally { if (epoch === generation.current) setBusy(false); }
  }, [api,cursor]);

  useEffect(() => { if (session?.user?.id) load(false); }, [session?.user?.id]);

  async function signIn(event) {
    event.preventDefault(); setMessage(''); setBusy(true);
    try {
      const {error} = await supabase.auth.signInWithPassword({email, password});
      if (error) setMessage('Não foi possível entrar. Confira seus dados.');
      else { setEmail(''); setPassword(''); }
    } catch { setMessage('Falha ao conectar à autenticação.'); }
    finally { setBusy(false); }
  }
  async function act(fn, refresh = true) {
    const epoch = generation.current;
    setBusy(true); setMessage('');
    try {
      await fn();
      if (epoch !== generation.current) return;
      if (refresh) await load(false);
      return true;
    } catch (error) { if (epoch === generation.current) setMessage(error.code || error.message || 'OPERAÇÃO_NÃO_CONCLUÍDA'); return false; }
    finally { if (epoch === generation.current) setBusy(false); }
  }
  if (!enabled) return <main style={{padding:32}}>Homologação do feed desabilitada. <Link href="/social">Voltar</Link></main>;
  if (!supabase) return <main style={{padding:32}}>Supabase não configurado para esta Preview.</main>;
  return <main style={{maxWidth:760,margin:'0 auto',padding:24,fontFamily:'system-ui'}}>
    <p><Link href="/social">← Voltar à Social</Link></p>
    <h1>JENIOS Social — homologação multiusuário</h1>
    <p>Ambiente de teste. Não utilize dados financeiros ou informações sensíveis.</p>
    {message && <p role="alert" style={{color:'#b91c1c'}}>{message}</p>}
    {!session ? <form onSubmit={signIn}>
      <label>E-mail <input type="email" required autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)}/></label>
      <label>Senha <input type="password" required autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label>
      <button disabled={busy} type="submit">Entrar com conta de teste</button>
    </form> : <>
      <p>Conta autenticada: {session.user.email}</p>
      <button disabled={busy} onClick={()=>supabase.auth.signOut()}>Sair</button>
      <form onSubmit={e=>{e.preventDefault();act(async()=>{const uploaded=media.length?await uploadSocialMedia(media,{client:supabase,onProgress:setMedia,getAccessToken:async()=>{const {data}=await supabase.auth.getSession();return data?.session?.access_token}}):[];await api.createPost({body:draft,media:uploaded.map(item=>({url:item.src,type:item.tipo==='video'?'video':'image'}))});}).then(ok=>{if(ok){setDraft('');setMedia([]);}});}}>
        <textarea aria-label="Nova publicação" value={draft} maxLength={10000} onChange={e=>setDraft(e.target.value)}/>
        <SocialMediaPicker items={media} onChange={setMedia} disabled={busy}/>
        <button type="submit" disabled={busy || (!draft.trim() && !media.length)}>Publicar</button>
      </form>
      <button disabled={busy} onClick={()=>load(false)}>Atualizar feed</button>
      <PromotedPost client={supabase}/>
      {posts.map(post=><article key={post.id} style={{border:'1px solid #aaa',padding:12,marginTop:12}}>
        <p style={{whiteSpace:'pre-wrap'}}>{post.body}</p>
        {(post.media||[]).map((item,index)=>item.type==='video'?<video key={index} src={item.url||item.src} controls playsInline style={{width:'100%',maxHeight:450}}/>:<img key={index} src={item.url||item.src} alt={'Mídia '+(index+1)} style={{width:'100%',maxHeight:450,objectFit:'contain'}}/>)}
        <small>{new Date(post.created_at).toLocaleString('pt-BR')}</small>
        <div>
          <button disabled={busy} onClick={()=>act(async()=>{const r=await api.getLikes(post.id);await (r.liked?api.unlikePost(post.id):api.likePost(post.id));})}>Curtir / descurtir</button>
          <button disabled={busy} onClick={()=>act(async()=>{const r=await api.getLikes(post.id);setLikes(old=>({...old,[post.id]:r}));},false)}>Ver curtidas</button>
          {likes[post.id] && <span> {likes[post.id].count} curtidas</span>}
          <button disabled={busy} onClick={()=>act(async()=>{const r=await api.listComments(post.id);setComments(old=>({...old,[post.id]:r.comments}));},false)}>Ver comentários</button>
          {post.author_id === session.user.id && <button disabled={busy} onClick={()=>act(()=>api.deletePost(post.id))}>Excluir meu post</button>}
        </div>
        {(comments[post.id]||[]).map(c=><p key={c.id}>{c.body}</p>)}
        <form onSubmit={e=>{e.preventDefault();act(async()=>{await api.createComment({postId:post.id,body:commentDrafts[post.id]||''});const r=await api.listComments(post.id);setComments(old=>({...old,[post.id]:r.comments}));},false).then(()=>setCommentDrafts(old=>({...old,[post.id]:''})));}}>
          <input aria-label="Novo comentário" value={commentDrafts[post.id]||''} onChange={e=>setCommentDrafts(old=>({...old,[post.id]:e.target.value}))}/>
          <button disabled={busy || !(commentDrafts[post.id]||'').trim()}>Comentar</button>
        </form>
      </article>)}
      {cursor && <button disabled={busy} onClick={()=>load(true)}>Carregar mais</button>}
    </>}
  </main>;
}
