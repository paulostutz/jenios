'use client';
import {useEffect,useRef,useState} from 'react';
import {PERSONAS} from '../../../lib/assistant/contracts.mjs';
import s from './FreeAssistantRoom.module.css';
const starters=['Como funciona a JENIOS?','Como começar na Universidade?','O que é o MegaPulse?'];
export default function FreeAssistantRoom({onPersonaChange}){
 const [persona,setPersona]=useState('genio'),[question,setQuestion]=useState(''),[history,setHistory]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const controller=useRef(null);
 useEffect(()=>()=>controller.current?.abort(),[]);
 const selected=PERSONAS.find(x=>x.id===persona)||PERSONAS[0];
 async function ask(message=question){
  if(busy||!message.trim())return;setBusy(true);setError('');
  const owner=persona,attempt=new AbortController();controller.current=attempt;
  try{
   const response=await fetch('/api/assistant/free',{method:'POST',cache:'no-store',signal:attempt.signal,
    headers:{'content-type':'application/json'},body:JSON.stringify({persona:owner,message:message.trim()})});
   const body=await response.json();
   if(!response.ok||body.ok!==true||body.persona!==owner||body.paidAi!==false)throw Error(body.error||'Não foi possível consultar a base gratuita.');
   setHistory(prev=>[...prev.slice(-11),{id:crypto.randomUUID(),question:message,reply:body}]);setQuestion('');
  }catch(e){if(e.name!=='AbortError')setError(e.message);}finally{setBusy(false);}
 }
 return <section className={s.root} aria-label="Atendimento gratuito da JENIOS">
  <div className={s.personas} aria-label="Escolha quem vai conversar com você">
   {PERSONAS.map(p=><button key={p.id} type="button" disabled={busy} onClick={()=>{setPersona(p.id);onPersonaChange?.(p.id);}}
    aria-pressed={persona===p.id} className={s.persona}>
    <img src={p.image} alt="" width="35" height="35"/>{p.name}</button>)}
  </div>
  <p className={s.welcome}><strong>{selected.name}:</strong> Posso orientar sobre a JENIOS, seus recursos e a Universidade.</p>
  {!history.length&&<div className={s.starters}>{starters.map(t=><button type="button" key={t} disabled={busy} onClick={()=>ask(t)}>{t}</button>)}</div>}
  <div className={s.history} aria-live="polite">
   {history.map(row=><article key={row.id} className={s.exchange}>
    <p className={s.question}>{row.question}</p>
    <div className={s.reply}><strong>{row.reply.name}</strong><p>{row.reply.explanation}</p>
     <div className={s.links}>{row.reply.articles.map(x=><a href={x.href} key={x.id}>{x.title} ↗</a>)}</div>
    </div>
   </article>)}
  </div>
  {error&&<p role="alert" className={s.error}>{error}</p>}
  <form className={s.form} onSubmit={e=>{e.preventDefault();void ask();}}>
   <label htmlFor="jenios-free-question">Sua pergunta</label>
   <textarea id="jenios-free-question" rows={2} maxLength={1000} value={question} disabled={busy}
    placeholder="Digite sua dúvida sobre a JENIOS…" onChange={e=>setQuestion(e.target.value)}/>
   <button type="submit" disabled={busy||!question.trim()}>{busy?'Consultando…':'Enviar pergunta'}</button>
  </form>
  <nav className={s.footer} aria-label="Outras opções">
   <a href="/platform/aprender">Universidade ↗</a><a href="/genios-pro">Gênio/Gênia Pro ↗</a>
   <a href="/platform/assistente">Consultas com login ↗</a>
  </nav>
 </section>;
}
