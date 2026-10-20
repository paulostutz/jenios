'use client';
import {useEffect,useState} from 'react';
import {createPortal} from 'react-dom';
import dynamic from 'next/dynamic';
import {PERSONAS} from '../../../lib/assistant/contracts.mjs';
import s from './AssistantEntry.module.css';
const FreeAssistantRoom=dynamic(()=>import('./FreeAssistantRoom'),{ssr:false});
export default function SocialFreeLauncher(){
 const [mounted,setMounted]=useState(false),[open,setOpen]=useState(false),[expanded,setExpanded]=useState(false),[persona,setPersona]=useState('genio');
 useEffect(()=>{setMounted(true);},[]);
 useEffect(()=>{if(!open)return;const escape=e=>{if(e.key==='Escape')setOpen(false);};document.addEventListener('keydown',escape);return()=>document.removeEventListener('keydown',escape);},[open]);
 if(!mounted)return null;
 const character=PERSONAS.find(x=>x.id===persona)||PERSONAS[0];
 return createPortal(<div className={s.dock} data-jenios-assistant="social-free">
  <section id="jenios-social-assistant" className={s.panel+' '+(expanded?s.expanded:'')+' '+(!open?s.collapsed:'')}
   role="dialog" aria-modal="false" aria-label="Converse gratuitamente com Gênio e Gênia">
   <header className={s.bar}><div className={s.identity}>
    <img src={character.image} alt="" width="44" height="44"/><div><strong>{character.name}</strong><small>Atendimento gratuito JENIOS</small></div>
   </div><div className={s.controls}>
    <button type="button" aria-label={expanded?'Restaurar janela':'Expandir janela'} onClick={()=>setExpanded(x=>!x)}>{expanded?'▣':'⛶'}</button>
    <button type="button" aria-label="Minimizar atendimento" onClick={()=>setOpen(false)}>−</button>
   </div></header>
   <div className={s.body}><FreeAssistantRoom onPersonaChange={setPersona}/></div>
  </section>
  <button type="button" className={s.launcher} aria-controls="jenios-social-assistant" aria-expanded={open}
   aria-label={open?'Minimizar atendimento gratuito':'Abrir Gênio e Gênia gratuitos'} onClick={()=>setOpen(v=>!v)}>
   <img src={character.image} alt="" width="49" height="49"/><span>{open?'Minimizar':'Gênio ou Gênia'}</span>
   {!open&&<span className={s.dot} aria-hidden="true"/>}
  </button>
  {!open&&<span className={s.hint}>Converse gratuitamente</span>}
 </div>,document.body);
}
