'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {supabase} from '../../lib/supabase';
import {createSessionFence} from '../../lib/social/session-fence.mjs';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const button={background:'#7c3aed',color:'#fff',border:0,borderRadius:8,padding:'9px 13px',cursor:'pointer',fontSize:12,fontWeight:700};
const summary=p=>String(p.body||p.texto||'Publicação com mídia').slice(0,140);

export default function SocialPinnedPosts({ownerId,accountId,candidatePosts=[]}){
 const fence=useRef(createSessionFence());
 const [pins,setPins]=useState([]),[busy,setBusy]=useState(false),[ready,setReady]=useState(false);
 const [selected,setSelected]=useState(''),[error,setError]=useState('');
 const own=Boolean(ownerId&&accountId&&ownerId===accountId);

 async function call(ticket,path,options={}){
  if(!ticket?.owner||!fence.current.current(ticket)||!supabase)throw Error('SESSION_CHANGED');
  const result=await supabase.auth.getSession();
  const session=result.data?.session;
  if(result.error||!fence.current.current(ticket)||session?.user?.id!==ticket.owner
    ||session.user.is_anonymous)throw Error('SESSION_CHANGED');
  const response=await fetch(path,{...options,cache:'no-store',
   headers:{authorization:'Bearer '+session.access_token,accept:'application/json',
    ...(options.body?{'content-type':'application/json'}:{})}});
  let body={};try{body=await response.json();}catch{}
  if(!response.ok)throw Error(body.error||'REQUEST_FAILED');
  return body;
 }
 async function refresh(ticket){
  const data=await call(ticket,'/api/social/pinned-posts?'+new URLSearchParams({ownerId}));
  if(fence.current.current(ticket))setPins(data.posts||[]);
 }
 useEffect(()=>{
  const ticket=fence.current.change(accountId||null);
  let live=true;
  setPins([]);setSelected('');setBusy(false);setReady(false);setError('');
  if(!UUID.test(String(ownerId))||!UUID.test(String(accountId))||!supabase){
   setReady(true);
   return()=>{live=false;fence.current.change();};
  }
  void refresh(ticket).catch(()=>{
   if(live&&fence.current.current(ticket))setError('Não foi possível carregar as publicações fixadas.');
  }).finally(()=>{if(live&&fence.current.current(ticket))setReady(true);});
  const listener=supabase.auth.onAuthStateChange((event,session)=>{
   if(event==='INITIAL_SESSION'||event==='TOKEN_REFRESHED')return;
   if(session?.user?.id!==ticket.owner){
    fence.current.change();setPins([]);setSelected('');setReady(true);setError('');
   }
  });
  return()=>{live=false;fence.current.change();listener?.data?.subscription?.unsubscribe();};
 },[ownerId,accountId]);
 async function change(postId,method){
  if(!own||busy||!UUID.test(String(postId)))return;
  const ticket=fence.current.capture();setBusy(true);setError('');
  try{
   await call(ticket,method==='POST'?'/api/social/pinned-posts':
     '/api/social/pinned-posts?'+new URLSearchParams({postId}),
     method==='POST'?{method,body:JSON.stringify({postId})}:{method});
   if(fence.current.current(ticket)){setSelected('');await refresh(ticket);}
  }catch(e){
   if(fence.current.current(ticket))setError(e.message==='PIN_LIMIT'?'Limite de três publicações fixadas.':
    e.message==='POST_ALREADY_PINNED'?'Esta publicação já está fixada.':
    e.message==='SESSION_CHANGED'?'Sua sessão mudou. Reabra o perfil.':
    'Não foi possível atualizar as publicações fixadas.');
  }finally{if(fence.current.current(ticket))setBusy(false);}
 }
 const options=(Array.isArray(candidatePosts)?candidatePosts:[])
  .filter(p=>(p.authorId||p.author_id)===accountId&&!p.archivedAt&&!p.archived_at&&!pins.some(x=>x.id===p.id))
  .slice(0,50);
 if(!own&&ready&&!pins.length)return null;
 return <section aria-label="Publicações fixadas" style={{background:'#faf5ff',border:'1px solid #ddd6fe',borderRadius:12,padding:16,margin:'16px 0'}}>
  <h3 style={{margin:'0 0 11px',color:'#4c1d95',fontSize:16}}>📌 Publicações fixadas</h3>
  {!ready&&<p role="status">Carregando publicações fixadas…</p>}
  {ready&&!pins.length&&own&&<p style={{color:'#64748b',fontSize:12}}>Você ainda não fixou publicações no perfil.</p>}
  {error&&<p role="alert" style={{color:'#b91c1c',fontSize:12}}>{error}</p>}
  {!!pins.length&&<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:8,marginBottom:12}}>
   {pins.map(p=><div key={p.id} style={{border:'1px solid #e9d5ff',background:'#fff',padding:12,borderRadius:9}}>
    <div style={{fontSize:12,fontWeight:700,overflowWrap:'anywhere',color:'#1f2937'}}>{p.archived?'Arquivada — só você pode ver':summary(p)}</div>
    {!p.archived&&<Link href={'/social?post='+encodeURIComponent(p.id)} style={{color:'#6d28d9',fontSize:12}}>Abrir publicação ↗</Link>}
    {own&&<button type="button" disabled={busy} onClick={()=>void change(p.id,'DELETE')}
     style={{...button,background:'#fff',color:'#6d28d9',border:'1px solid #ddd6fe',display:'block',marginTop:8}}>Desafixar</button>}
   </div>)}
  </div>}
  {own&&pins.length<3&&<div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
   <select aria-label="Selecionar publicação para fixar" value={selected} onChange={e=>setSelected(e.target.value)}
    style={{minWidth:180,flex:1,padding:9,background:'#fff',border:'1px solid #ddd6fe',borderRadius:8}}>
    <option value="">Escolha uma publicação do perfil</option>
    {options.map(p=><option key={p.id} value={p.id}>{summary(p).slice(0,85)}</option>)}
   </select>
   <button type="button" disabled={busy||!selected} onClick={()=>void change(selected,'POST')} style={button}>Fixar publicação</button>
  </div>}
  {own&&<p style={{fontSize:11,color:'#64748b',margin:'9px 0 0'}}>Até três publicações. Posts arquivados não aparecem para visitantes.</p>}
 </section>;
}
