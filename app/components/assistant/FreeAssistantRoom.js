'use client';
import {useEffect,useRef,useState} from 'react';
import {connectionSecret} from '../../../lib/platform/connections/support.mjs';
import {readFreeReply,FREE_REPLY_UNAVAILABLE} from '../../../lib/assistant/free-reply-client.mjs';
import {PERSONAS} from '../../../lib/assistant/contracts.mjs';
import s from './FreeAssistantRoom.module.css';
const starters=['Qual plano você me recomenda conhecer?','O que está incluído no plano de R$ 149,90?','Como contratar a JENIOS?'];
export default function FreeAssistantRoom({onPersonaChange,initialPersona='genio',guideQuestion=null}){
 const [persona,setPersona]=useState(initialPersona==='genia'?'genia':'genio'),[question,setQuestion]=useState(''),[history,setHistory]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const controller=useRef(null);
 useEffect(()=>()=>controller.current?.abort(),[]);
 const selected=PERSONAS.find(x=>x.id===persona)||PERSONAS[0];
 async function ask(message=question){
  if(busy||!message.trim())return;
  if(connectionSecret(message)){setError('Não envie chaves, senhas ou tokens. Revogue no fornecedor qualquer credencial real exposta.');return;}
  setBusy(true);setError('');
  const owner=persona,attempt=new AbortController();controller.current=attempt;
  try{
   const response=await fetch('/api/assistant/free',{method:'POST',cache:'no-store',signal:attempt.signal,
    headers:{'content-type':'application/json'},body:JSON.stringify({persona:owner,message:message.trim()})});
   const body=await readFreeReply(response,owner);
   if(attempt.signal.aborted)return;
   setHistory(prev=>[...prev.slice(-11),{id:crypto.randomUUID(),question:message,reply:body}]);setQuestion('');
  }catch(e){if(e.name!=='AbortError')setError(FREE_REPLY_UNAVAILABLE);}finally{if(!attempt.signal.aborted)setBusy(false);}
 }
 return <section className={s.root} aria-label="Atendimento gratuito da JENIOS">
  <div className={s.personas} aria-label="Escolha quem vai conversar com você">
   {PERSONAS.map(p=><button key={p.id} type="button" disabled={busy} onClick={()=>{setPersona(p.id);onPersonaChange?.(p.id);}}
    aria-pressed={persona===p.id} className={s.persona}><img src={p.image} alt="" width="35" height="35"/>{p.name}</button>)}
  </div>
  <p className={s.welcome}><strong>{selected.name}:</strong> Posso explicar nossos produtos, responder dúvidas e acompanhar você até a contratação pelo checkout oficial.</p>
  {!history.length&&<div className={s.starters}>{(guideQuestion?[guideQuestion,...starters]:starters).map(t=><button type="button" key={t} disabled={busy} onClick={()=>ask(t)}>{t}</button>)}</div>}
  <div className={s.history} aria-live="polite">{history.map(row=><article key={row.id} className={s.exchange}><p className={s.question}>{row.question}</p><div className={s.reply}><strong>{row.reply.name}</strong><p>{row.reply.explanation}</p><div className={s.links}>{row.reply.links.map(x=><a href={x.href} key={x.href+':'+(x.title||x.id)}>{x.title} ↗</a>)}</div></div></article>)}</div>
  {error&&<p role="alert" className={s.error}>{error}</p>}
  <form className={s.form} onSubmit={e=>{e.preventDefault();void ask();}}><label htmlFor="jenios-free-question">Sua pergunta</label>
   <textarea id="jenios-free-question" rows={2} maxLength={1000} value={question} disabled={busy} placeholder="Pergunte sobre a JENIOS, planos, assinatura ou funcionalidades…" onChange={e=>setQuestion(e.target.value)}/>
   <button type="submit" disabled={busy||!question.trim()}>{busy?'Consultando…':'Enviar pergunta'}</button>
  </form>
  <nav className={s.footer} aria-label="Outras opções"><a href="/platform/aprender">Universidade ↗</a><a href="/genios-pro">Gênio/Gênia Pro ↗</a><a href="/platform/assistente">Consultas com login ↗</a></nav>
 </section>;
}
