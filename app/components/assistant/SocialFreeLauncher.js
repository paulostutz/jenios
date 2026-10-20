'use client';
import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import dynamic from 'next/dynamic';
import {supabase} from '../../../lib/supabase';
import {PERSONAS} from '../../../lib/assistant/contracts.mjs';
import {validPersona,personaPreferenceKey,readPersonaPreference,savePersonaPreference} from '../../../lib/assistant/persona-preference.mjs';
import s from './AssistantEntry.module.css';
const FreeAssistantRoom=dynamic(()=>import('./FreeAssistantRoom'),{ssr:false});
export default function SocialFreeLauncher({guideQuestion=null}){
 const [mounted,setMounted]=useState(false),[open,setOpen]=useState(false),[expanded,setExpanded]=useState(false),[persona,setPersona]=useState(null),[scope,setScope]=useState('visitor'),[choosing,setChoosing]=useState(false),[saveNotice,setSaveNotice]=useState('');
 const owner=useRef('visitor'),epoch=useRef(0),choice=useRef(0);
 useEffect(()=>{
  let live=true;setMounted(true);
  function sync(session){
   const next=session?.user&&!session.user.is_anonymous?session.user.id:'visitor';
   if(next!==owner.current){epoch.current++;owner.current=next;setScope(next);setOpen(false);setSaveNotice('');}
   const stored=validPersona(session?.user?.user_metadata?.jenios_assistant_persona)||readPersonaPreference(window.localStorage,next);
   setPersona(stored);setChoosing(false);
  }
  sync(null);
  const initial=choice.current;
  supabase?.auth.getSession().then(async({data,error})=>{
   if(!live||initial!==choice.current||error)return;sync(data?.session);
   if(data?.session?.user&&!data.session.user.is_anonymous){const stamp=epoch.current,selected=choice.current;const result=await supabase.auth.getUser();if(live&&stamp===epoch.current&&selected===choice.current&&!result.error&&result.data.user?.id===owner.current){const remote=validPersona(result.data.user.user_metadata?.jenios_assistant_persona);if(remote){setPersona(remote);savePersonaPreference(window.localStorage,owner.current,remote);}}}
  }).catch(()=>{});
  const sub=supabase?.auth.onAuthStateChange((event,session)=>{
   if(event==='INITIAL_SESSION')return;
   const next=session?.user&&!session.user.is_anonymous?session.user.id:'visitor';
   if(next===owner.current&&['SIGNED_IN','TOKEN_REFRESHED','USER_UPDATED'].includes(event))return;
   choice.current++;sync(session);
  });
  const storage=e=>{if(e.key===personaPreferenceKey(owner.current)){const value=validPersona(e.newValue);setPersona(value);setChoosing(!value);}};
  window.addEventListener('storage',storage);
  return()=>{live=false;epoch.current++;sub?.data?.subscription?.unsubscribe();window.removeEventListener('storage',storage);};
 },[]);
 useEffect(()=>{if(!open)return;const escape=e=>{if(e.key==='Escape')setOpen(false);};document.addEventListener('keydown',escape);return()=>document.removeEventListener('keydown',escape);},[open]);
 async function selectPersona(value){
  if(!validPersona(value))return;
  const selected=++choice.current,stamp=epoch.current,currentOwner=owner.current;
  setPersona(value);setChoosing(false);setSaveNotice('');
  const local=savePersonaPreference(window.localStorage,currentOwner,value);
  if(currentOwner==='visitor'){if(!local)setSaveNotice('A escolha vale nesta visita; o navegador não permitiu salvá-la.');return;}
  try{
   const session=await supabase.auth.getSession();
   if(stamp!==epoch.current||selected!==choice.current||session.data.session?.user?.id!==currentOwner)return;
   const result=await supabase.auth.updateUser({data:{jenios_assistant_persona:value}});
   if(result.error)throw result.error;
  }catch{if(stamp===epoch.current&&selected===choice.current)setSaveNotice(local?'Escolha salva neste navegador. A sincronização com sua conta não foi confirmada.':'Não foi possível salvar a preferência. Sua escolha vale nesta visita.');}
 }
 if(!mounted)return null;
 const character=PERSONAS.find(x=>x.id===persona);
 return createPortal(<div className={s.dock} data-jenios-assistant="social-free" data-persona={persona||'unselected'}>
  <section id="jenios-social-assistant" className={s.panel+' '+(expanded?s.expanded:'')+' '+(!open?s.collapsed:'')} role="dialog" aria-modal="false" aria-label="Converse gratuitamente com Gênio e Gênia">
   <header className={s.bar}><div className={s.identity}>
    {character&&<img src={character.image} alt="" width="44" height="44"/>}<div><strong>{character?.name||'Escolha seu assistente'}</strong><small>Atendimento gratuito JENIOS</small></div>
   </div><div className={s.controls}>
    <button type="button" aria-label={expanded?'Restaurar janela':'Expandir janela'} onClick={()=>setExpanded(x=>!x)}>{expanded?'▣':'⛶'}</button>
    <button type="button" aria-label="Minimizar atendimento" onClick={()=>setOpen(false)}>−</button>
   </div></header>
   <div className={s.body}>{!character||choosing?<section aria-label="Escolha Gênio ou Gênia" style={{padding:20,color:'#172033'}}>
    <h2 style={{fontSize:20}}>Com quem deseja conversar?</h2><p>Escolha Gênio ou Gênia. Você pode mudar quando quiser.</p>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>{PERSONAS.map(p=><button type="button" key={p.id} aria-pressed={p.id===persona} onClick={()=>void selectPersona(p.id)} style={{border:'1px solid #c4b5fd',borderRadius:14,background:'#faf5ff',color:'#4c1d95',padding:16,cursor:'pointer',display:'grid',justifyItems:'center',gap:10,fontWeight:800}}><img src={p.image} alt="" width="78" height="78" style={{borderRadius:'50%',objectFit:'cover'}}/>Conversar com {p.name}</button>)}</div>
    <p style={{fontSize:12}}>Sem cobrança. A preferência é salva na sua conta quando você está conectado; visitantes usam este navegador.</p>
   </section>:<><button type="button" onClick={()=>setChoosing(true)} style={{margin:'10px 12px 0',padding:'8px 12px',background:'#f5f3ff',border:'1px solid #ddd6fe',borderRadius:8,color:'#5b21b6',cursor:'pointer'}}>Trocar assistente</button><FreeAssistantRoom key={scope+':'+persona} initialPersona={persona} onPersonaChange={selectPersona} guideQuestion={guideQuestion}/></>}
   {saveNotice&&<p role="status" style={{padding:12,fontSize:12,color:'#92400e'}}>{saveNotice}</p>}</div>
  </section>
  <button type="button" className={s.launcher} aria-controls="jenios-social-assistant" aria-expanded={open} aria-label={open?'Minimizar atendimento gratuito':character?'Abrir '+character.name+' gratuito':'Abrir Gênio e Gênia gratuitos'} onClick={()=>setOpen(v=>!v)}>
   {character?<img src={character.image} alt="" width="49" height="49"/>:<span style={{display:'flex'}}>{PERSONAS.map(p=><img key={p.id} src={p.image} alt="" width="30" height="30" style={{borderRadius:'50%'}}/>)}</span>}<span>{character?.name||'Gênio ou Gênia'}</span>{!open&&<span className={s.dot} aria-hidden="true"/>}
  </button>{!open&&<span className={s.hint}>Converse gratuitamente</span>}
 </div>,document.body);
}
