'use client';
import {useEffect,useState} from 'react';
import {usePathname} from 'next/navigation';
import dynamic from 'next/dynamic';
import {createPortal} from 'react-dom';
import {supabase} from '../../../lib/supabase';
import {platformSupabase} from '../../../lib/platform/supabase-client';
import {PERSONAS} from '../../../lib/assistant/contracts.mjs';
import s from './AssistantEntry.module.css';

const AssistantRoom=dynamic(()=>import('./AssistantRoom'),{ssr:false,loading:()=> <p role="status" className={s.loading}>Abrindo atendimento…</p>});
const PAGES=new Set(['/dashboard-logado','/dashboard','/mesa-operacoes']);
const signed=session=>Boolean(session?.access_token&&session.user?.id&&!session.user.is_anonymous);

export default function AssistantEntry(){
 const path=usePathname();
 const [mounted,setMounted]=useState(false),[access,setAccess]=useState({source:'none',id:null});
 const [open,setOpen]=useState(false),[everOpened,setEverOpened]=useState(false),[expanded,setExpanded]=useState(false),[persona,setPersona]=useState('genio');
 useEffect(()=>{setMounted(true);},[]);
 useEffect(()=>{
  let live=true,version=0;
  async function sync(){
   const ticket=++version;
   const [social,platform]=await Promise.allSettled([supabase?.auth?.getSession?.(),platformSupabase?.auth?.getSession?.()]);
   if(!live||version!==ticket)return;
   const a=social.status==='fulfilled'?social.value?.data?.session:null;
   const b=platform.status==='fulfilled'?platform.value?.data?.session:null;
   if(signed(a))setAccess({source:'social',id:a.user.id});
   else if(signed(b))setAccess({source:'platform',id:b.user.id});
   else{setAccess({source:'none',id:null});setOpen(false);setEverOpened(false);}
  }
  void sync();
  const onAuth=event=>{if(event!=='INITIAL_SESSION'&&event!=='TOKEN_REFRESHED')void sync();};
  const socialSub=supabase?.auth?.onAuthStateChange?.(onAuth);
  const platformSub=platformSupabase?.auth?.onAuthStateChange?.(onAuth);
  return()=>{live=false;version++;socialSub?.data?.subscription?.unsubscribe?.();platformSub?.data?.subscription?.unsubscribe?.();};
 },[]);
 useEffect(()=>{
  if(!open)return;
  function onKey(event){if(event.key==='Escape'){event.preventDefault();setOpen(false);}}
  document.addEventListener('keydown',onKey);
  return()=>document.removeEventListener('keydown',onKey);
 },[open]);
 if(!mounted||!PAGES.has(path)||access.source==='none')return null;
 const choice=PERSONAS.find(p=>p.id===persona)||PERSONAS[0];
 const launch=()=>{setEverOpened(true);setOpen(true);};
 return createPortal(<div className={s.dock} data-jenios-assistant="floating">
  <section id="jenios-floating-assistant" role="dialog" aria-modal="false" aria-label="Atendimento Gênio e Gênia"
   className={s.panel+' '+(expanded?s.expanded:'')+' '+(!open?s.collapsed:'')}>
   <header className={s.bar}>
    <div className={s.identity}><img src={choice.image} alt="" width="44" height="44"/>
     <div><strong>{access.source==='platform'?'Gênio / Gênia':choice.name}</strong><small>Assistente JENIOS</small></div></div>
    <div className={s.controls}>
     <button type="button" onClick={()=>setExpanded(v=>!v)} title={expanded?'Restaurar tamanho':'Expandir atendimento'}
       aria-label={expanded?'Restaurar janela':'Expandir janela'}>{expanded?'▣':'⛶'}</button>
     <button type="button" onClick={()=>setOpen(false)} title="Minimizar" aria-label="Minimizar atendimento">−</button>
    </div>
   </header>
   <nav className={s.shortcuts} aria-label="Acessos do assistente">
    <a href="/platform/aprender">🎓 Universidade JENIOS</a>
    <a href="/platform/assistente">↗ Ver atendimento completo</a>
    <a href="/genios-pro">✦ Gênio/Gênia Pro</a>
   </nav>
   <div className={s.body}>
    {access.source==='platform'?<section className={s.connect}>
      <strong>Conecte sua conta da JENIOS Social</strong>
      <p>Seu login exclusivo da Platform não substitui a autorização dos módulos conectados à Social. Entre na conta da Social para conversar e salvar as preferências do atendimento.</p>
      <a href="/login?next=/dashboard-logado">Entrar na JENIOS Social →</a>
     </section>:everOpened&&<AssistantRoom key={access.id} embedded onPersonaChange={setPersona}/>}
   </div>
  </section>
  <button type="button" className={s.launcher} onClick={open?()=>setOpen(false):launch}
   aria-controls="jenios-floating-assistant" aria-expanded={open}
   aria-label={open?'Minimizar Gênio e Gênia':'Conversar com Gênio ou Gênia'}>
   <img src={choice.image} alt="" width="49" height="49"/>
   <span>{open?'Minimizar':'Gênio ou Gênia'}</span>
   {!open&&<span className={s.dot} aria-hidden="true"/>}
  </button>
  {!open&&<span className={s.hint}>Oi! Posso ajudar?</span>}
 </div>,document.body);
}
