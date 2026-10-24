'use client';
import {useEffect,useRef,useState} from 'react';
import {connectionSecret} from '../../../lib/platform/connections/support.mjs';
import {PERSONAS} from '../../../lib/assistant/contracts.mjs';
import useAssistantConversation from './useAssistantConversation';
import ConversationControls,{AnswerFeedback} from './ConversationControls';
import {mergeConversationTurns,safeAssistantLinks,settledTurn,conversationScreen,assistantResponsePresentation} from './conversation-client.mjs';
import s from './FreeAssistantRoom.module.css';
const starters=['Qual plano você me recomenda conhecer?','O que está incluído no plano de R$ 149,90?','Como contratar a JENIOS?'];
export default function FreeAssistantRoom({onPersonaChange,initialPersona=null,guideQuestion=null,standalone=false}){
 const memory=useAssistantConversation('support',{initialPersona});
 const [question,setQuestion]=useState(''),[localTurns,setLocalTurns]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[progress,setProgress]=useState('');
 const controller=useRef(null),inflight=useRef(false),historyRef=useRef(null),contextRef=useRef({owner:'checking',id:null}),alive=useRef(true);
 const selected=PERSONAS.find(x=>x.id===memory.persona)||PERSONAS[0],history=mergeConversationTurns(memory.conversation,localTurns);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;controller.current?.abort();};},[]);
 useEffect(()=>{
  const previous=contextRef.current,next={owner:memory.actor.id,id:memory.conversation?.id||null};
  if(previous.owner!==next.owner||(previous.id&&previous.id!==next.id)){
   controller.current?.abort();inflight.current=false;setBusy(false);setQuestion('');setLocalTurns([]);setError('');setProgress('');
  }
  contextRef.current=next;
 },[memory.actor.id,memory.conversation?.id]);
 useEffect(()=>{if(memory.persona!==initialPersona)onPersonaChange?.(memory.persona);},[memory.persona,initialPersona,onPersonaChange]);
 useEffect(()=>{const box=historyRef.current;if(box)box.scrollTo({top:box.scrollHeight,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});},[history.length,busy,memory.conversation?.revision]);
 async function choose(value){if(inflight.current)return;setBusy(true);try{if(await memory.choosePersona(value))onPersonaChange?.(value);}finally{if(alive.current)setBusy(false);}}
 async function ask(message=question){
  if(inflight.current||!message.trim())return;
  if(connectionSecret(message)){setError('Não envie chaves, senhas ou tokens. Revogue no fornecedor qualquer credencial real exposta.');return;}
  inflight.current=true;setBusy(true);setError('');setProgress('Preparando o contexto da conversa…');
  const turnId=crypto.randomUUID(),text=message.trim(),attempt=new AbortController(),stamp=memory.actorEpoch();
  controller.current=attempt;setQuestion('');setLocalTurns(prev=>[...prev,{turnId,question:text,answer:'',status:'pending'}]);
  let submitted=false,conversation=null;
  try{
   conversation=await memory.ensure();if(attempt.signal.aborted||stamp!==memory.actorEpoch())throw new DOMException('Espera interrompida.','AbortError');
   setProgress('Consultando o material e preparando a resposta…');submitted=true;
   const body=await memory.request('/api/assistant/free',{body:{persona:memory.persona,message:text,
    ...(conversation?{conversationId:conversation.id,revision:conversation.revision,turnId}:{}),
    ...(conversationScreen(window.location.pathname)?{screen:conversationScreen(window.location.pathname)}:{})},signal:attempt.signal,timeoutMs:45000});
   if(!alive.current||stamp!==memory.actorEpoch())return;
   if(body.ok!==true||body.persona!==memory.persona||body.paidAi!==false)throw Error('Não foi possível confirmar a resposta do atendimento.');
   if(body.conversation&&!memory.adopt(body.conversation))throw Error('A resposta chegou, mas o histórico não pôde ser confirmado.');
   setLocalTurns(prev=>prev.map(row=>row.turnId===turnId?{...row,answer:String(body.explanation||''),articles:safeAssistantLinks(body.links||body.articles),status:'completed',mode:body.replayed?'history':body.mode,notice:body.notice,conversationId:conversation?.id}:row));
   setProgress(body.conversationSyncPending?'A resposta chegou. Atualize a conversa para conferir a sincronização do histórico.':'');
  }catch(e){
   if(!alive.current||stamp!==memory.actorEpoch())return;
   const interrupted=e.name==='AbortError'||e.name==='TimeoutError';
   const notice=interrupted?(submitted?'A espera foi interrompida. A resposta pode terminar no servidor; confira a conversa antes de perguntar novamente.':'Preparação interrompida. Nenhuma pergunta foi enviada.'):e.message;
   setError(notice);setProgress('');
   setLocalTurns(prev=>prev.map(row=>row.turnId===turnId?{...row,status:submitted?'unconfirmed':'failed',notice,conversationId:conversation?.id}:row));
   if(e.body?.conversation)memory.adopt(e.body.conversation);
  }finally{if(alive.current&&stamp===memory.actorEpoch()){inflight.current=false;setBusy(false);}}
 }
 async function reconcile(){setError('');try{await memory.reload();}catch(e){if(e.name!=='AbortError')setError(e.message);}}
 return <section className={s.root} data-standalone={standalone?'true':'false'} aria-label="Atendimento gratuito da JENIOS">
  <div className={s.personas} aria-label="Escolha quem vai conversar com você">
   {PERSONAS.map(p=><button key={p.id} type="button" disabled={busy} onClick={()=>void choose(p.id)}
    aria-pressed={memory.persona===p.id} className={s.persona}><img src={p.image} alt="" width="35" height="35"/>{p.name}</button>)}
  </div>
  <p className={s.welcome}><strong>{selected.name}:</strong> Posso explicar a JENIOS, seus planos e o próximo passo. Você pode continuar a mesma conversa ao trocar de personagem.</p>
  <details className={s.memory}><summary>Memória e conversas{memory.status==='unavailable'?' · não disponível':memory.conversation?.remember?' · salva na sua conta':''}</summary><ConversationControls memory={memory} disabled={busy}/></details>
  {!history.length&&<div className={s.starters}>{(guideQuestion?[guideQuestion,...starters]:starters).map(t=><button type="button" key={t} disabled={busy||memory.status==='loading'||memory.status==='error'} onClick={()=>void ask(t)}>{t}</button>)}</div>}
  <div ref={historyRef} className={s.history} aria-live="polite" aria-relevant="additions text">{history.map(row=>{const presentation=assistantResponsePresentation(row.mode,row.notice);return <article key={row.turnId} className={s.exchange}>
   <p className={s.question}>{row.question}</p>
   <div className={s.reply}><strong>{selected.name}</strong>{settledTurn(row)?<><small className={s.responseMode}>{presentation.label}</small><p>{row.answer}</p>{presentation.notice&&<p className={s.responseNotice}>{presentation.notice}</p>}<div className={s.links}>{safeAssistantLinks(row.articles).map(x=><a href={x.href} key={x.href}>{x.title} ↗</a>)}</div>
    {memory.conversation?.turns.some(t=>t.turnId===row.turnId)&&<AnswerFeedback key={row.turnId} memory={memory} turnId={row.turnId}/>}</>:<p role="status">{row.status==='pending'&&busy?'Preparando sua resposta…':row.notice||'Resposta em conferência. Atualize a conversa.'}</p>}
    {!settledTurn(row)&&!busy&&(row.conversationId||memory.conversation)?<button type="button" className={s.recheck} onClick={()=>void reconcile()}>Conferir resposta salva</button>:!settledTurn(row)&&!busy&&row.status==='failed'?<button type="button" className={s.recheck} onClick={()=>setQuestion(row.question)}>Retomar pergunta</button>:null}
   </div>
  </article>;})}</div>
  {progress&&<p role="status" className={s.progress}>{progress}</p>}
  {error&&<p role="alert" className={s.error}>{error}</p>}
  {memory.error&&<p role="alert" className={s.error}>{memory.error} Abra “Memória e conversas” para conferir.</p>}
  <form className={s.form} onSubmit={e=>{e.preventDefault();void ask();}}><label htmlFor="jenios-free-question">Sua pergunta</label>
   <textarea id="jenios-free-question" rows={2} maxLength={1000} value={question} disabled={busy} placeholder="Continue a conversa ou faça uma nova pergunta…" onChange={e=>setQuestion(e.target.value)}
    onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();void ask();}}}/>
   <div className={s.sendActions}>{busy?<button type="button" className={s.cancel} onClick={()=>controller.current?.abort(new DOMException('Espera interrompida.','AbortError'))}>Parar espera</button>:null}
    <button type="submit" disabled={busy||!question.trim()||memory.status==='loading'||memory.status==='error'}>{busy?'Preparando resposta…':'Enviar pergunta'}</button></div>
  </form>
  <nav className={s.footer} aria-label="Outras opções"><a href="/platform/aprender">Universidade ↗</a><a href="/genios-pro">Gênio/Gênia Pro ↗</a><a href="/platform/assistente/consultas">Consultas protegidas ↗</a></nav>
 </section>;
}
