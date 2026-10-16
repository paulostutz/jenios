"use client";
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {supabase,accountDatabase} from '../../lib/supabase';
import {createSessionFence} from '../../lib/social/session-fence.mjs';
import {readNotifications,markNotificationRead,safeAppTarget} from '../../lib/social/notifications.mjs';
export default function NotificationsPage(){
 const [items,setItems]=useState([]),[message,setMessage]=useState('Carregando...'),[busy,setBusy]=useState(false),[owner,setOwner]=useState(null);
 const fence=useRef(null);if(!fence.current)fence.current=createSessionFence();
 useEffect(()=>{
  let live=true,timer=null,request=0;
  async function load(){
   const seq=++request;let ticket=fence.current.capture();const current=()=>live&&seq===request&&fence.current.current(ticket);
   try{
    if(!supabase)throw new Error('CONFIG');
    const session=await supabase.auth.getUser();if(!current())return;
    const id=session.data?.user?.id;
    if(session.error||session.data?.user?.is_anonymous||!id){setItems([]);setOwner(null);setMessage('Entre na sua conta para visualizar notificações.');return;}
    if(ticket.owner!==id){ticket=fence.current.change(id);setItems([]);setOwner(id);}
    const data=await readNotifications(supabase,id);if(!current())return;
    setItems(data);setMessage(data.length?'':'Nenhuma notificação recebida.');
   }catch{if(current())setMessage('Não foi possível consultar suas notificações agora. Tente novamente.');}
   finally{if(current()){clearTimeout(timer);timer=setTimeout(load,30000);}}
  }
  void load();
  const subscription=supabase?.auth.onAuthStateChange((event)=>{
   if(event==='INITIAL_SESSION'||event==='TOKEN_REFRESHED')return;
   request++;fence.current.change();clearTimeout(timer);setItems([]);setOwner(null);setBusy(false);setMessage('Verificando conta...');timer=setTimeout(()=>{if(live)void load();},0);
  });
  return()=>{live=false;request++;fence.current.change();clearTimeout(timer);subscription?.data?.subscription?.unsubscribe();};
 },[]);
 async function markRead(id){
  if(!supabase||busy||!owner||!items.some(x=>x.id===id))return;
  const ticket=fence.current.capture();setBusy(true);
  try{const row=await markNotificationRead(supabase,owner,id,undefined,accountDatabase(owner));if(fence.current.current(ticket))setItems(old=>old.map(x=>x.id===id?{...x,read_at:row.read_at}:x));}
  catch{if(fence.current.current(ticket))setMessage('Leitura não confirmada no servidor.');}
  finally{if(fence.current.current(ticket))setBusy(false);}
 }
 const unread=items.filter(x=>!x.read_at).length;
 return <main style={{minHeight:'100vh',background:'#0f172a',color:'#f8fafc',padding:'32px 16px',fontFamily:'Arial,sans-serif'}}><div style={{maxWidth:850,margin:'auto'}}><Link href="/social" style={{color:'#c4b5fd'}}>← Voltar à JENIOS Social</Link><h1>Central de Notificações</h1><p style={{color:'#cbd5e1'}}>Consulta automática a cada 30 segundos · {unread} não lidas</p><p role="status">{message}</p><div style={{display:'grid',gap:12}}>{items.map(n=><article key={n.id} style={{background:n.read_at?'#1e293b':'#312e81',borderRadius:12,padding:18,border:'1px solid #475569'}}><div style={{display:'flex',justifyContent:'space-between',gap:10,flexWrap:'wrap'}}><strong>{n.title}</strong><small>{new Date(n.created_at).toLocaleString('pt-BR')}</small></div><p>{n.body}</p><div style={{display:'flex',gap:16}}>{safeAppTarget(n.target_url)&&<Link href={safeAppTarget(n.target_url)} style={{color:'#ddd6fe'}}>Abrir</Link>}{!n.read_at&&<button disabled={busy} onClick={()=>markRead(n.id)} style={{padding:'8px 12px',borderRadius:8,border:0,cursor:'pointer'}}>Marcar como lida</button>}</div></article>)}</div></div></main>;
}
