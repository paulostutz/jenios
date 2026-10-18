'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {supabase} from '../../../lib/supabase';
import {createScopedFeedClient} from '../../../lib/social/session-client.mjs';
import {createSessionFence} from '../../../lib/social/session-fence.mjs';
import {videoReelsFromPosts,appendUniqueVideoReels} from '../../../lib/social/reels.mjs';
import SocialVideo from '../../components/SocialVideo';

const panel={background:'#141b2a',border:'1px solid #354054',borderRadius:18,padding:16};
export default function JeniosReelsPage(){
 const fence=useRef(createSessionFence()),bootstrapEpoch=useRef(0);
 const [owner,setOwner]=useState(null),[reels,setReels]=useState([]),[cursor,setCursor]=useState(null);
 const [ready,setReady]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');

 async function loadPage(ticket,after=null){
  if(!ticket?.owner||!supabase)return;
  setBusy(true);setError('');
  try{
   const data=await createScopedFeedClient({auth:supabase.auth,fence:fence.current,ticket})
    .listPosts({limit:50,cursor:after});
   if(!fence.current.current(ticket))return;
   const next=videoReelsFromPosts(data.posts);
   setReels(old=>after?appendUniqueVideoReels(old,next):next);
   setCursor(data.nextBefore?{before:data.nextBefore,beforeId:data.nextBeforeId}:null);
  }catch(error){
   if(fence.current.current(ticket))setError(error?.code==='SESSION_CHANGED'
    ?'Sua conta mudou. Recarregue para consultar seus Reels.'
    :'Não foi possível carregar os vídeos. Tente novamente.');
  }finally{if(fence.current.current(ticket)){setBusy(false);setReady(true);}}
 }
 useEffect(()=>{
  let mounted=true;
  async function refresh(){
   const epoch=++bootstrapEpoch.current;
   fence.current.change();setOwner(null);setReels([]);setCursor(null);
   setError('');setReady(false);setBusy(false);
   if(!supabase){setError('Social temporariamente indisponível.');setReady(true);return;}
   try{
    const result=await supabase.auth.getUser();
    if(!mounted||epoch!==bootstrapEpoch.current)return;
    const user=result?.data?.user;
    if(result.error||!user?.id||user.is_anonymous){setReady(true);return;}
    const ticket=fence.current.change(user.id);
    setOwner(user.id);
    await loadPage(ticket);
   }catch{
    if(mounted&&epoch===bootstrapEpoch.current){setError('Não foi possível validar sua sessão.');setReady(true);}
   }
  }
  void refresh();
  const sub=supabase?.auth.onAuthStateChange((event,session)=>{
   if(event==='INITIAL_SESSION'||event==='TOKEN_REFRESHED')return;
   const current=fence.current.capture().owner;
   if(current&&session?.user?.id===current&&['SIGNED_IN','USER_UPDATED'].includes(event))return;
   bootstrapEpoch.current++;fence.current.change();setOwner(null);setReels([]);
   setCursor(null);setReady(false);setBusy(false);
   if(mounted)void refresh();
  });
  return()=>{mounted=false;bootstrapEpoch.current++;fence.current.change();sub?.data?.subscription?.unsubscribe();};
 },[]);
 function loadMore(){
  if(!owner||busy||!cursor)return;
  const ticket=fence.current.capture();
  if(ticket.owner===owner)void loadPage(ticket,cursor);
 }
 return <main style={{minHeight:'100vh',background:'#0b1020',color:'#f8fafc',padding:'22px 14px',fontFamily:'Arial,sans-serif'}}>
  <div style={{maxWidth:740,margin:'0 auto'}}>
   <header style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:16,flexWrap:'wrap',marginBottom:18}}>
    <div><Link href="/social" style={{color:'#c4b5fd',fontSize:14}}>← Voltar ao Feed</Link>
     <h1 style={{fontSize:26,margin:'10px 0 4px'}}>Reels JENIOS</h1>
     <p style={{fontSize:13,color:'#cbd5e1',margin:0}}>Vídeos das publicações existentes, sem duplicação ou upload adicional.</p>
    </div>
    <Link href="/social" style={{padding:'10px 14px',borderRadius:10,color:'#fff',border:'1px solid #6d28d9',textDecoration:'none'}}>Publicar no Feed</Link>
   </header>
   {!ready&&<p role="status">Carregando vídeos da Social…</p>}
   {ready&&!owner&&<section style={panel}><p>Entre na sua conta da JENIOS Social para ver os vídeos publicados.</p><Link href="/login" style={{color:'#c4b5fd'}}>Entrar ou cadastrar</Link></section>}
   {owner&&error&&<p role="alert" style={{padding:12,background:'#3c1d38',borderRadius:10}}>{error}</p>}
   {owner&&ready&&!reels.length&&!error&&<p role="status">Nenhum vídeo encontrado nas publicações consultadas.</p>}
   {owner&&<div style={{display:'grid',gap:20}}>
    {reels.map(reel=><article key={reel.id} style={panel}>
     <SocialVideo src={reel.src} postId={reel.postId} style={{background:'#000',borderRadius:12,objectFit:'contain',maxHeight:'70vh'}}/>
     {reel.caption&&<p style={{fontSize:14,lineHeight:1.6,overflowWrap:'anywhere',whiteSpace:'pre-wrap'}}>{reel.caption}</p>}
     <Link href={'/social?post='+encodeURIComponent(reel.postId)} style={{color:'#c4b5fd',fontSize:14}}>Abrir publicação para curtir, comentar ou compartilhar ↗</Link>
    </article>)}
    {cursor&&<button type="button" disabled={busy} onClick={loadMore} style={{padding:14,background:'#6d28d9',border:0,borderRadius:10,color:'#fff',cursor:busy?'wait':'pointer'}}>{busy?'Carregando…':'Carregar publicações anteriores'}</button>}
    </div>}
  </div>
 </main>;
}
