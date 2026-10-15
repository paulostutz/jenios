"use client";
import {useEffect,useRef,useState,useMemo} from 'react';
import {supabase,accountDatabase} from '../../lib/supabase';
import {createDirectService} from '../../lib/social/directService.mjs';
const box={background:'#fff',padding:20,border:'1px solid #ddd6fe',borderRadius:14};
export default function SocialDirect({user,profile,initialPerson,onLogin}){
 const api=useMemo(()=>createDirectService(supabase,{databaseForOwner:accountDatabase}),[]),epoch=useRef(0),inFlight=useRef(false),selectedThread=useRef(null),messageRevision=useRef(0),initialOpened=useRef('');
 const [threads,setThreads]=useState([]),[messages,setMessages]=useState([]),[thread,setThread]=useState(null),[people,setPeople]=useState([]),[query,setQuery]=useState(''),[body,setBody]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[ready,setReady]=useState(false);
 useEffect(()=>{const e=++epoch.current;let live=true;selectedThread.current=null;messageRevision.current++;initialOpened.current='';setThreads([]);setMessages([]);setThread(null);setPeople([]);setBody('');setError('');setReady(false);inFlight.current=false;setBusy(false);
 if(user?.id)api.register(user.id,profile).then(()=>api.threads(user.id)).then(rows=>{if(live&&e===epoch.current){setThreads(rows);setReady(true);}}).catch(err=>{if(live&&e===epoch.current)setError(err.message);});
 return()=>{live=false;epoch.current++;};},[user?.id,api]);
 useEffect(()=>{let live=true,running=false;const e=epoch.current;if(!thread||!user?.id)return;
 async function refresh(){if(running||document.hidden||inFlight.current)return;running=true;const revision=messageRevision.current;try{const rows=await api.messages(user.id,thread.id);if(live&&e===epoch.current&&revision===messageRevision.current&&selectedThread.current===thread.id)setMessages(rows);}catch(err){if(live&&e===epoch.current)setError(err.message);}finally{running=false;}}
 setMessages([]);refresh();const timer=setInterval(refresh,3000);document.addEventListener('visibilitychange',refresh);return()=>{live=false;clearInterval(timer);document.removeEventListener('visibilitychange',refresh);};},[thread?.id,user?.id,api]);
 useEffect(()=>{if(!ready||!user?.id)return;let live=true,running=false;const e=epoch.current;async function refresh(){if(running||document.hidden)return;running=true;try{const rows=await api.threads(user.id);if(live&&e===epoch.current)setThreads(rows);}catch(err){if(live&&e===epoch.current)setError(err.message);}finally{running=false;}}const timer=setInterval(refresh,10000);return()=>{live=false;clearInterval(timer);};},[ready,user?.id,api]);
 async function run(fn){if(inFlight.current)return;inFlight.current=true;setBusy(true);setError('');const e=epoch.current;try{await fn(()=>e===epoch.current);}catch(err){if(e===epoch.current)setError(err.message);}finally{if(e===epoch.current){inFlight.current=false;setBusy(false);}}}
 function chooseThread(t){selectedThread.current=t.id;messageRevision.current++;setThread(t);setBody('');setMessages([]);setError('');}
 function openPerson(person){run(async current=>{const id=await api.open(user.id,person.user_id);const rows=await api.threads(user.id);if(current()){setThreads(rows);chooseThread({id,person});}});}
 useEffect(()=>{
  const personId=(initialPerson?.userId||initialPerson?.id);
  if(!ready||!user?.id||!personId||personId===user.id)return;
  const key=user.id+':'+personId;
  if(initialOpened.current===key)return;
  initialOpened.current=key;
  openPerson({user_id:personId,display_name:initialPerson.nome,handle:String(initialPerson.handle||'').replace(/^@/,'')});
},[ready,(initialPerson?.userId||initialPerson?.id),user?.id]);
 if(!user)return <section style={box}><h2>Mensagens · Direct</h2><p>Entre na sua conta para conversar com outros usuários.</p><button onClick={onLogin} type="button">Entrar</button></section>;
 return <section style={box}><h2>Mensagens · Direct</h2><p style={{color:'#64748b',fontSize:12}}>Converse em particular. As mensagens são atualizadas automaticamente.</p>{error&&<p role="alert">{error}</p>}
 <form onSubmit={e=>{e.preventDefault();run(async current=>{const rows=await api.search(user.id,query);if(current())setPeople(rows);});}}><label>Buscar pelo @ <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Digite pelo menos 3 caracteres" minLength={3}/></label><button disabled={!ready||busy}>Buscar</button></form>
 {people.map(person=><button type="button" disabled={busy} key={person.user_id} onClick={()=>openPerson(person)}>{person.display_name} · @{person.handle}</button>)}
 <div style={{display:'flex',gap:18,flexWrap:'wrap',marginTop:18}}><nav aria-label="Conversas" style={{flex:'1 1 200px'}}>{threads.map(t=><button type="button" key={t.id} disabled={busy} onClick={()=>chooseThread(t)} style={{display:'block',padding:12,width:'100%',marginBottom:6}}>{t.person.display_name} @{t.person.handle}</button>)}{ready&&!threads.length&&<p>Nenhuma conversa. Pesquise alguém que já tenha ativado o perfil nesta versão.</p>}</nav><div style={{flex:'3 1 300px'}}>{thread&&<><h3>{thread.person?.display_name||'Conversa'}</h3><div role="log" aria-label="Mensagens recebidas e enviadas" style={{height:300,overflowY:'auto',border:'1px solid #ddd',padding:12}}>{messages.map(m=><p key={m.id} style={{textAlign:m.sender_id===user.id?'right':'left'}}><b>{m.sender_id===user.id?'Você':'Contato'}: </b>{m.body}<small style={{display:'block'}}>{new Date(m.created_at).toLocaleString('pt-BR')}</small></p>)}</div><form onSubmit={e=>{e.preventDefault();const text=body.trim(),target=thread.id;if(!text||text.length>5000||busy)return;messageRevision.current++;run(async current=>{await api.send(user.id,target,text);const rows=await api.messages(user.id,target);if(current()&&selectedThread.current===target){setBody(old=>old===text?'':old);setMessages(rows);}});}} style={{display:'flex',gap:8,marginTop:10}}><input aria-label="Texto da mensagem" disabled={busy} value={body} onChange={e=>setBody(e.target.value)} maxLength={5000} style={{flex:1}}/><button disabled={busy||!body.trim()||body.length>5000}>{busy?'Enviando…':'Enviar'}</button></form></>}</div></div></section>;
}
