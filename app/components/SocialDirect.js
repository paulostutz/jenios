"use client";
import {useEffect,useRef,useState,useMemo} from 'react';
import {supabase,accountDatabase} from '../../lib/supabase';
import {createDirectService} from '../../lib/social/directService.mjs';
const box={background:'#fff',padding:20,border:'1px solid #ddd6fe',borderRadius:14};
export default function SocialDirect({user,profile,initialPerson,onLogin}){
 const api=useMemo(()=>createDirectService(supabase,{databaseForOwner:accountDatabase}),[]),epoch=useRef(0),inFlight=useRef(false),selectedThread=useRef(null),messageRevision=useRef(0),initialOpened=useRef('');
 const [threads,setThreads]=useState([]),[messages,setMessages]=useState([]),[thread,setThread]=useState(null),[body,setBody]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[ready,setReady]=useState(false);
 useEffect(()=>{const e=++epoch.current;let live=true;selectedThread.current=null;messageRevision.current++;initialOpened.current='';setThreads([]);setMessages([]);setThread(null);setBody('');setError('');setReady(false);inFlight.current=false;setBusy(false);
 if(user?.id)api.register(user.id,profile).then(()=>api.threads(user.id)).then(rows=>{if(live&&e===epoch.current){setThreads(rows);setReady(true);}}).catch(err=>{if(live&&e===epoch.current)setError(err.message);});
 return()=>{live=false;epoch.current++;};},[user?.id,api]);
 useEffect(()=>{let live=true,running=false;const e=epoch.current;if(!thread||!user?.id)return;
 async function refresh(){if(running||document.hidden||inFlight.current)return;running=true;const revision=messageRevision.current;try{const rows=await api.messages(user.id,thread.id);if(live&&e===epoch.current&&revision===messageRevision.current&&selectedThread.current===thread.id)setMessages(rows);}catch(err){if(live&&e===epoch.current)setError(err.message);}finally{running=false;}}
 setMessages([]);refresh();const timer=setInterval(refresh,5000);document.addEventListener('visibilitychange',refresh);return()=>{live=false;clearInterval(timer);document.removeEventListener('visibilitychange',refresh);};},[thread?.id,user?.id,api]);
 useEffect(()=>{if(!ready||!user?.id)return;let live=true,running=false;const e=epoch.current;async function refresh(){if(running||document.hidden)return;running=true;try{const rows=await api.threads(user.id);if(live&&e===epoch.current)setThreads(rows);}catch(err){if(live&&e===epoch.current)setError(err.message);}finally{running=false;}}const timer=setInterval(refresh,15000);return()=>{live=false;clearInterval(timer);};},[ready,user?.id,api]);
 async function run(fn){if(inFlight.current)return;inFlight.current=true;setBusy(true);setError('');const e=epoch.current;try{await fn(()=>e===epoch.current);}catch(err){if(e===epoch.current)setError(err.message);}finally{if(e===epoch.current){inFlight.current=false;setBusy(false);}}}
 function chooseThread(t){selectedThread.current=t.id;messageRevision.current++;setThread(t);setBody('');setMessages([]);setError('');}
 function showInbox(){selectedThread.current=null;messageRevision.current++;setThread(null);setMessages([]);setBody('');setError('');}
 function openPerson(person){run(async current=>{const id=await api.open(user.id,person.user_id);const rows=await api.threads(user.id);if(current()){setThreads(rows);chooseThread({id,person});}});}
 useEffect(()=>{
  const personId=(initialPerson?.userId||initialPerson?.id);
  if(!ready||!user?.id||!personId||personId===user.id)return;
  const key=user.id+':'+personId;
  if(initialOpened.current===key)return;
  initialOpened.current=key;
  openPerson({user_id:personId,display_name:initialPerson.nome,handle:String(initialPerson.handle||'').replace(/^@/,'')});
},[ready,(initialPerson?.userId||initialPerson?.id),user?.id]);

 if(!user)return <section className="jenios-direct-body"><p>Entre na sua conta para conversar com outros usuários.</p><button type="button" onClick={onLogin}>Entrar</button></section>;
 return <section className="jenios-direct-body">
  {error&&<p role="alert" className="jenios-direct-error">{error}</p>}
  {!thread?<>
    <p className="jenios-direct-hint">Suas conversas</p>
    {!ready&&!error&&<p role="status">Carregando mensagens…</p>}
    {ready&&!threads.length&&<p className="jenios-direct-hint">Nenhuma conversa ainda. Para começar uma, visite o perfil da pessoa e toque em <strong>Enviar mensagem</strong>.</p>}
    <nav aria-label="Conversas" className="jenios-direct-threads">
      {threads.map(t=><button type="button" key={t.id} disabled={busy} onClick={()=>chooseThread(t)}>
        <span className="jenios-direct-avatar" aria-hidden="true">◉</span>
        <span><strong>{t.person?.display_name||'Usuário'}</strong>
        <small>@{t.person?.handle||'perfil'}</small></span>
        <span aria-hidden="true">›</span>
      </button>)}
    </nav>
  </>:<>
    <button type="button" className="jenios-direct-back" onClick={showInbox}>← Conversas</button>
    <h3 className="jenios-direct-contact">{thread.person?.display_name||'Conversa'}</h3>
    <div role="log" aria-label="Mensagens recebidas e enviadas" aria-live="polite" className="jenios-direct-messages">
      {messages.map(m=><div key={m.id} className={m.sender_id===user.id?'jenios-direct-bubble own':'jenios-direct-bubble'}>
        <p>{m.body}</p>
        <small>{new Date(m.created_at).toLocaleString('pt-BR')}</small>
      </div>)}
      {!messages.length&&!busy&&<p className="jenios-direct-hint">Escreva sua primeira mensagem.</p>}
    </div>
    <form onSubmit={e=>{e.preventDefault();const text=body.trim(),target=thread.id;
      if(!text||text.length>5000||busy)return;
      messageRevision.current++;
      run(async current=>{
        await api.send(user.id,target,text);
        const rows=await api.messages(user.id,target);
        if(current()&&selectedThread.current===target){
          setBody(old=>old===text?'':old);setMessages(rows);
        }
      });
    }} className="jenios-direct-compose">
      <input aria-label="Texto da mensagem" disabled={busy} value={body}
        onChange={e=>setBody(e.target.value)} maxLength={5000} placeholder="Escreva uma mensagem…"/>
      <button type="submit" disabled={busy||!body.trim()||body.length>5000}>
        {busy?'…':'Enviar'}
      </button>
    </form>
  </>}
 </section>;
}
