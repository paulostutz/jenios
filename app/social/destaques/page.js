'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {supabase} from '../../../lib/supabase';
import {createSessionFence} from '../../../lib/social/session-fence.mjs';
import SocialVideo from '../../components/SocialVideo';

const frame={background:'#192238',border:'1px solid #354059',borderRadius:16,padding:17};
const actionStyle={background:'#6d28d9',border:0,color:'#fff',borderRadius:9,padding:'10px 13px',cursor:'pointer'};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function StoryHighlightsPage(){
 const fence=useRef(createSessionFence()),generation=useRef(0);
 const [viewer,setViewer]=useState(null),[account,setAccount]=useState(null),[target,setTarget]=useState(null);
 const [collections,setCollections]=useState([]),[items,setItems]=useState([]),[myStories,setMyStories]=useState([]);
 const [ready,setReady]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [title,setTitle]=useState(''),[selected,setSelected]=useState({});

 async function fetchFor(ticket,path,options={}){
  if(!ticket?.owner||!fence.current.current(ticket))throw Error('SESSION_CHANGED');
  const ses=await supabase.auth.getSession();
  if(ses.error||!fence.current.current(ticket)||
    ses.data?.session?.user?.id!==ticket.owner||ses.data.session.user.is_anonymous)
   throw Error('SESSION_CHANGED');
  const response=await fetch(path,{...options,cache:'no-store',
   headers:{authorization:'Bearer '+ses.data.session.access_token,accept:'application/json',
    ...(options.body?{'content-type':'application/json'}:{})}});
  let result={};try{result=await response.json()}catch{}
  if(!response.ok)throw Error(result?.error||'REQUEST_FAILED');
  return result;
 }
 async function load(ticket,profileId){
  const result=await fetchFor(ticket,'/api/social/highlights?'+new URLSearchParams({ownerId:profileId}));
  if(!fence.current.current(ticket))return;
  setCollections(result.collections||[]);setItems(result.items||[]);
  if(profileId!==ticket.owner){setMyStories([]);return;}
  const rows=await fetchFor(ticket,'/api/social/stories?offset=0');
  if(!fence.current.current(ticket))return;
  setMyStories((rows.stories||[]).filter(s=>s.author_id===ticket.owner&&
   !s.shared_post_id||false).concat((rows.stories||[]).filter(s=>s.author_id===ticket.owner&&s.shared_post_id))
   .filter(s=>Date.parse(s.expires_at)>Date.now()));
 }
 useEffect(()=>{
  let live=true;
  async function initialize(){
   const seq=++generation.current;
   fence.current.change();setAccount(null);setTarget(null);setCollections([]);setItems([]);
   setMyStories([]);setError('');setReady(false);setViewer(null);setBusy(false);
   if(!supabase){setError('Social temporariamente indisponível.');setReady(true);return;}
   try{
    const result=await supabase.auth.getUser();
    if(!live||seq!==generation.current)return;
    const user=result?.data?.user;
    if(result.error||!user?.id||user.is_anonymous){setReady(true);return;}
    const ticket=fence.current.change(user.id);
    setAccount(user.id);
    const requested=new URLSearchParams(window.location.search).get('ownerId');
    const profileId=requested&&UUID.test(requested)?requested:user.id;
    setTarget(profileId);
    await load(ticket,profileId);
    if(live&&fence.current.current(ticket))setReady(true);
   }catch(err){
    if(live&&seq===generation.current){setError(err?.message==='SESSION_CHANGED'?'Sua sessão mudou.':'Não foi possível carregar os Destaques.');setReady(true);}
   }
  }
  void initialize();
  const sub=supabase?.auth.onAuthStateChange((event,session)=>{
   if(event==='INITIAL_SESSION'||event==='TOKEN_REFRESHED')return;
   if(fence.current.capture().owner&&session?.user?.id===fence.current.capture().owner&&
    ['SIGNED_IN','USER_UPDATED'].includes(event))return;
   generation.current++;fence.current.change();setViewer(null);setCollections([]);setItems([]);
   if(live)void initialize();
  });
  return()=>{live=false;generation.current++;fence.current.change();sub?.data?.subscription?.unsubscribe();};
 },[]);
 async function change(body,method='POST',path='/api/social/highlights'){
  if(!account||target!==account||busy)return;
  setBusy(true);setError('');
  const ticket=fence.current.capture();
  try{
   await fetchFor(ticket,path,{method,...body?{body:JSON.stringify(body)}:{}});
   if(fence.current.current(ticket))await load(ticket,account);
  }catch(e){
   if(fence.current.current(ticket))setError(e?.message==='SESSION_CHANGED'?'Sua sessão mudou. Recarregue os Destaques.':
    'Não foi possível salvar. Confira o conteúdo ou tente novamente.');
  }finally{if(fence.current.current(ticket))setBusy(false);}
 }
 const own=account&&account===target;
 const storiesForSelect=myStories.filter(s=>['image','video','post'].includes(s.media_type));
 return <main style={{minHeight:'100vh',background:'#0b1020',color:'#f8fafc',padding:'24px 14px',fontFamily:'Arial,sans-serif'}}>
  <div style={{maxWidth:940,margin:'0 auto'}}>
   <header style={{marginBottom:20,display:'flex',justifyContent:'space-between',gap:15,flexWrap:'wrap'}}>
    <div><Link href="/social" style={{color:'#c4b5fd'}}>← Voltar à Social</Link>
     <h1 style={{fontSize:26,margin:'10px 0 4px'}}>Destaques dos Stories</h1>
     <p style={{color:'#b9c5d9',fontSize:13}}>Coleções dos Stories originais, inclusive após 24 horas, enquanto eles existirem.</p>
    </div><Link href="/social" style={{color:'#c4b5fd',alignSelf:'center'}}>Publicar Story ↗</Link>
   </header>
   {!ready&&<p role="status">Carregando Destaques…</p>}
   {ready&&!account&&<div style={frame}>Entre na sua conta para visualizar os Destaques. <Link href="/login" style={{color:'#c4b5fd'}}>Entrar</Link></div>}
   {error&&<p role="alert" style={{background:'#50263a',padding:12,borderRadius:9}}>{error}</p>}
   {own&&<section style={{...frame,marginBottom:18}}>
    <h2 style={{fontSize:17,marginTop:0}}>Criar coleção</h2>
    <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
     <input aria-label="Nome do Destaque" maxLength={40} value={title} onChange={e=>setTitle(e.target.value)}
       placeholder="Ex.: Viagens, Família, Eventos" style={{flex:'1 1 210px',padding:12,borderRadius:8,border:0}}/>
     <button type="button" disabled={busy||!title.trim()} style={actionStyle} onClick={async()=>{await change({action:'createCollection',title:title.trim()});setTitle('');}}>Criar Destaque</button>
    </div>
    <p style={{fontSize:12,color:'#b9c5d9'}}>Até 12 coleções com 30 Stories cada. Excluir o Story original também remove seu Destaque.</p>
   </section>}
   {ready&&account&&!collections.length&&<div style={frame} role="status">Nenhuma coleção de Destaques disponível.</div>}
   {account&&<div style={{display:'grid',gap:18}}>
    {collections.map(collection=>{
     const saved=items.filter(i=>i.collection_id===collection.id);
     return <section key={collection.id} style={frame}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap'}}>
       <h2 style={{fontSize:19,margin:'0 0 10px'}}>{collection.title} <small style={{fontSize:12,color:'#b9c5d9'}}>({saved.length})</small></h2>
       {own&&<button type="button" disabled={busy} onClick={()=>{
        if(window.confirm('Excluir esta coleção de Destaques?'))void change(null,'DELETE','/api/social/highlights?collectionId='+encodeURIComponent(collection.id));
       }} style={{background:'none',border:'1px solid #815271',color:'#ffc8d5',padding:8,borderRadius:9,cursor:'pointer'}}>Excluir coleção</button>}
      </div>
      {own&&<div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:16}}>
       <select aria-label={'Selecionar Story para '+collection.title} value={selected[collection.id]||''}
        onChange={e=>setSelected(old=>({...old,[collection.id]:e.target.value}))}
        style={{background:'#f8fafc',borderRadius:8,padding:10,flex:'1 1 190px'}}>
        <option value="">Selecione um Story seu que ainda esteja ativo</option>
        {storiesForSelect.filter(s=>!saved.some(i=>i.source_story_id===s.id)).map(s=>
         <option key={s.id} value={s.id}>{s.media_type==='post'?'Publicação compartilhada':s.media_type==='video'?'Vídeo':'Imagem'} · {new Date(s.created_at).toLocaleDateString('pt-BR')}</option>)}
       </select>
       <button type="button" disabled={busy||!selected[collection.id]}
        onClick={async()=>{await change({action:'pinStory',collectionId:collection.id,storyId:selected[collection.id]});setSelected(old=>({...old,[collection.id]:''}));}}
        style={actionStyle}>Adicionar Story</button>
      </div>}
      {!saved.length&&<p style={{fontSize:13,color:'#b9c5d9'}}>Ainda não há Stories nesta coleção.</p>}
      <div style={{display:'flex',gap:12,overflowX:'auto',paddingBottom:8}}>
       {saved.map(item=><div key={item.id} style={{minWidth:132,width:150}}>
        <button type="button" aria-label={'Abrir Story do Destaque '+collection.title}
         onClick={()=>setViewer(item)} style={{cursor:'pointer',width:140,height:180,border:'1px solid #5b627b',borderRadius:13,padding:0,background:'#080c17',overflow:'hidden',color:'white'}}>
         {item.media_type==='image'?<img src={item.media_path} alt="Imagem do Destaque" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:
          <span style={{display:'grid',placeItems:'center',height:'100%',fontWeight:800}}>{item.media_type==='video'?'▶ Vídeo':'Publicação ↗'}</span>}
        </button>
        {own&&<button type="button" disabled={busy}
          onClick={()=>change(null,'DELETE','/api/social/highlights?itemId='+encodeURIComponent(item.id))}
          style={{marginTop:7,padding:6,border:'1px solid #5b627b',borderRadius:8,background:'none',color:'#fecdd3',cursor:'pointer'}}>Remover</button>}
       </div>)}
      </div>
     </section>;
    })}
   </div>}
   {viewer&&<div role="presentation" onClick={()=>setViewer(null)} style={{position:'fixed',inset:0,zIndex:60,background:'#000e',display:'grid',placeItems:'center',padding:16}}>
    <div role="dialog" aria-modal="true" aria-label="Visualizar Destaque" onClick={e=>e.stopPropagation()} style={{maxWidth:650,width:'100%',maxHeight:'90vh',overflowY:'auto',...frame}}>
     <button type="button" onClick={()=>setViewer(null)} style={{...actionStyle,marginBottom:12}}>Fechar</button>
     {viewer.media_type==='image'&&<img src={viewer.media_path} alt="Imagem do Destaque" style={{width:'100%',maxHeight:'75vh',objectFit:'contain'}}/>}
     {viewer.media_type==='video'&&<SocialVideo src={viewer.media_path} postId={null} style={{maxHeight:'75vh'}}/>}
     {viewer.media_type==='post'&&<Link href={'/social?post='+encodeURIComponent(viewer.shared_post_id)} style={{display:'block',color:'#c4b5fd'}}>Abrir publicação original ↗</Link>}
    </div>
   </div>}
  </div>
 </main>;
}
