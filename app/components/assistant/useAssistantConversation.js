'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {supabase} from '../../../lib/supabase';
import {validPersona,readPersonaPreference,savePersonaPreference,PERSONA_PREFERENCE_EVENT} from '../../../lib/assistant/persona-preference.mjs';
import {conversationSnapshot,storedConversation,rememberConversationId,validConversationId} from './conversation-client.mjs';

const EMPTY={status:'loading',conversation:null,conversations:[],error:'',notice:''};
export default function useAssistantConversation(channel,{initialPersona=null}={}){
 const [state,setState]=useState(EMPTY),[actor,setActor]=useState({id:'checking',authenticated:false});
 const [restart,setRestart]=useState(0);
 const [persona,setPersona]=useState(validPersona(initialPersona)||'genio'),[remember,setRemember]=useState(false);
 const actorRef=useRef(actor),epoch=useRef(0),active=useRef(new Set()),snapshot=useRef(null);
 const personaRef=useRef(persona),rememberRef=useRef(false),status=useRef('loading'),loading=useRef(null),newRequested=useRef(false),mounted=useRef(true);
 const write=useCallback(update=>{if(mounted.current)setState(old=>({...old,...update}));if(update.status)status.current=update.status;},[]);
 const adopt=useCallback(value=>{
  const next=conversationSnapshot(value,channel);if(!next)return null;
  snapshot.current=next;write({conversation:next,status:'ready',error:''});
  if(typeof window!=='undefined')rememberConversationId(window.sessionStorage,channel,actorRef.current.id,next.id);
  return next;
 },[channel,write]);
 const request=useCallback(async(path,{body,signal,timeoutMs=15000}={})=>{
  const stamp=epoch.current,owner=actorRef.current;
  if(owner.id==='checking')throw Error('Aguarde a verificação da sua sessão.');
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(new DOMException('Tempo de espera esgotado.','TimeoutError')),timeoutMs);
  active.current.add(controller);
  const forward=()=>controller.abort(signal.reason);if(signal?.aborted)forward();else signal?.addEventListener('abort',forward,{once:true});
  try{
   const auth=await supabase?.auth.getSession(),session=auth?.data?.session;
   if(auth?.error)throw Error('Não foi possível conferir sua sessão. Tente novamente.');
   const id=session?.access_token&&session.user&&!session.user.is_anonymous?session.user.id:'visitor';
   if(stamp!==epoch.current||owner.id!==id)throw new DOMException('Sua sessão mudou.','AbortError');
   const response=await fetch(path,{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',signal:controller.signal,
    headers:{...(owner.authenticated?{authorization:'Bearer '+session.access_token}:{}),...(body?{'content-type':'application/json'}:{})},
    ...(body?{body:JSON.stringify(body)}:{})});
   const result=await response.json().catch(()=>{throw Error('O serviço não confirmou a resposta. Confira o estado antes de tentar novamente.');});
   if(stamp!==epoch.current)throw new DOMException('Sua sessão mudou.','AbortError');
   if(!response.ok||result?.ok===false)throw Object.assign(Error(typeof result?.error==='string'?result.error:'Não foi possível concluir esta ação.'),{status:response.status,body:result});
   return result;
  }catch(error){
   if(controller.signal.aborted)throw controller.signal.reason||new DOMException('Espera interrompida.','AbortError');
   throw error;
  }finally{clearTimeout(timer);active.current.delete(controller);signal?.removeEventListener('abort',forward);}
 },[]);
 const reload=useCallback(async({id=snapshot.current?.id,restore=true}={})=>{
  const stamp=epoch.current;
  try{
   const result=await request('/api/assistant/conversations?channel='+channel+(validConversationId(id)?'&id='+encodeURIComponent(id):''));
   if(stamp!==epoch.current)return null;
   if(result.available===false){snapshot.current=null;write({status:'unavailable',conversation:null,conversations:[],error:'',notice:'A memória ainda não está disponível. Você pode usar o atendimento guiado nesta visita.'});return null;}
   if(result.available!==true)throw Error('O serviço não confirmou a disponibilidade da memória.');
   const list=Array.isArray(result.conversations)?result.conversations.filter(c=>validConversationId(c?.id)):[];
   write({status:'ready',conversations:list,error:'',notice:''});
   if(result.conversation){const next=adopt(result.conversation);if(!next)throw Error('O histórico recebido não pôde ser validado.');return next;}
   if(restore&&!newRequested.current&&list.length)return await reload({id:list[0].id,restore:false});
   return null;
  }catch(error){
   if(stamp===epoch.current&&validConversationId(id)&&[404,410].includes(error.status)){
    snapshot.current=null;newRequested.current=true;rememberConversationId(window.sessionStorage,channel,actorRef.current.id,null);
    const fresh=await request('/api/assistant/conversations?channel='+channel);
    if(fresh.available===true){write({status:'ready',conversation:null,conversations:Array.isArray(fresh.conversations)?fresh.conversations.filter(c=>validConversationId(c?.id)):[],error:'',notice:'A conversa anterior expirou ou não está mais disponível. Você pode iniciar uma nova.'});return null;}
   }
   if(stamp===epoch.current&&error.name!=='AbortError'){write({status:'error',error:error.message});}
   throw error;
  }
 },[channel,request,adopt,write]);
 useEffect(()=>{
  mounted.current=true;let live=true;
  const reset=session=>{
   const user=session?.access_token&&session.user&&!session.user.is_anonymous?session.user:null,next={id:user?.id||'visitor',authenticated:Boolean(user&&session.access_token)};
   if(actorRef.current.id===next.id&&!['loading','error'].includes(status.current))return;
   epoch.current++;for(const c of active.current)c.abort();active.current.clear();snapshot.current=null;newRequested.current=false;
   actorRef.current=next;setActor(next);setRemember(false);rememberRef.current=false;
   const preferred=validPersona(initialPersona)||validPersona(user?.user_metadata?.jenios_assistant_persona)||readPersonaPreference(window.localStorage,next.id)||'genio';
   personaRef.current=preferred;setPersona(preferred);write({...EMPTY,status:'loading'});
   const id=storedConversation(window.sessionStorage,channel,next.id);
   loading.current=reload({id}).catch(()=>null);
  };
  supabase?.auth.getSession().then(({data,error})=>{
   if(!live)return;if(error){actorRef.current={id:'error',authenticated:false};write({status:'error',error:'Não foi possível verificar sua sessão. Atualize antes de continuar.'});return;}
   reset(data?.session);
  }).catch(()=>{if(live)write({status:'error',error:'Não foi possível verificar sua sessão.'});});
  if(!supabase){actorRef.current={id:'visitor',authenticated:false};setActor(actorRef.current);write({status:'unavailable',notice:'Atendimento guiado disponível nesta visita.'});}
  const subscription=supabase?.auth.onAuthStateChange((event,session)=>{
   if(event==='INITIAL_SESSION')return;
   const id=session?.access_token&&session.user&&!session.user.is_anonymous?session.user.id:'visitor';
   if(id!==actorRef.current.id)setTimeout(()=>{if(live)reset(session);},0);
  });
  const preference=event=>{if(event.detail?.owner===actorRef.current.id&&validPersona(event.detail.persona)){personaRef.current=event.detail.persona;setPersona(event.detail.persona);}};
  window.addEventListener(PERSONA_PREFERENCE_EVENT,preference);
  return()=>{live=false;mounted.current=false;epoch.current++;for(const c of active.current)c.abort();active.current.clear();subscription?.data?.subscription?.unsubscribe();window.removeEventListener(PERSONA_PREFERENCE_EVENT,preference);};
 },[channel,reload,write,restart]);
 const ensure=useCallback(async()=>{
  await loading.current;
  if(status.current==='unavailable')return null;
  if(status.current==='error')throw Error('Confira a conexão da memória antes de enviar. Nenhuma conversa foi recriada.');
  if(snapshot.current){
   if(snapshot.current.persona!==personaRef.current){
    const updated=await request('/api/assistant/conversations?channel='+channel,{body:{action:'persona',conversationId:snapshot.current.id,revision:snapshot.current.revision,persona:personaRef.current}});
    if(!adopt(updated.conversation))throw Error('A preferência desta conversa não pôde ser sincronizada.');
   }
   return snapshot.current;
  }
  const result=await request('/api/assistant/conversations?channel='+channel,{body:{action:'create',channel,persona:personaRef.current,remember:actorRef.current.authenticated&&rememberRef.current}});
  if(result.available===false){write({status:'unavailable',notice:'A memória ainda não está disponível; o atendimento será guiado nesta visita.'});return null;}
  const next=adopt(result.conversation);if(!next)throw Error('A conversa não pôde ser confirmada.');
  newRequested.current=false;return next;
 },[channel,request,adopt,write]);
 const choosePersona=useCallback(async value=>{
  if(!validPersona(value))return false;
  const stamp=epoch.current;
  try{
   if(snapshot.current&&snapshot.current.persona!==value){
    const result=await request('/api/assistant/conversations?channel='+channel,{body:{action:'persona',conversationId:snapshot.current.id,revision:snapshot.current.revision,persona:value}});
    if(!adopt(result.conversation))throw Error('A mudança de personagem não foi confirmada.');
   }
   if(stamp!==epoch.current)return false;
   personaRef.current=value;setPersona(value);const local=savePersonaPreference(window.localStorage,actorRef.current.id,value);
   window.dispatchEvent(new CustomEvent(PERSONA_PREFERENCE_EVENT,{detail:{owner:actorRef.current.id,persona:value}}));
   if(actorRef.current.authenticated){
    const result=await supabase.auth.updateUser({data:{jenios_assistant_persona:value}});
    if(result.error)throw Error(local?'Personagem escolhido neste navegador. A sincronização com sua conta não foi confirmada.':'Não foi possível salvar sua preferência na conta.');
   }else if(!local)write({notice:'A escolha vale nesta visita; o navegador não permitiu salvá-la.'});
   return true;
  }catch(error){if(stamp===epoch.current)write({error:error.message});return false;}
 },[channel,request,adopt,write]);
 const startNew=useCallback(()=>{
  for(const c of active.current)c.abort();snapshot.current=null;newRequested.current=true;
  rememberConversationId(window.sessionStorage,channel,actorRef.current.id,null);write({conversation:null,error:'',notice:'Nova conversa. As respostas anteriores continuam separadas.'});
 },[channel,write]);
 const remove=useCallback(async()=>{
  if(!snapshot.current)return;
  const result=await request('/api/assistant/conversations?channel='+channel,{body:{action:'delete',conversationId:snapshot.current.id,revision:snapshot.current.revision}});
  if(result.ok!==true)throw Error('A exclusão não foi confirmada.');
  startNew();await reload({id:null,restore:false});write({notice:'Conversa excluída.'});
 },[channel,request,startNew,reload,write]);
 const feedback=useCallback(async(turnId,rating,note='',allowReview=false)=>{
  if(!snapshot.current)throw Error('Esta resposta não foi salva no serviço de conversas.');
  const result=await request('/api/assistant/conversations?channel='+channel,{body:{action:'feedback',conversationId:snapshot.current.id,turnId,rating,note,allowReview}});
  if(result.ok!==true)throw Error('O retorno não foi confirmado.');
  return true;
 },[channel,request]);
 return {...state,channel,actor,persona,remember,ensure,request,adopt,reload,choosePersona,startNew,remove,feedback,
  setRemember:value=>{if(!snapshot.current&&actorRef.current.authenticated){rememberRef.current=Boolean(value);setRemember(Boolean(value));}},
  retry:()=>setRestart(n=>n+1),current:()=>snapshot.current,actorEpoch:()=>epoch.current};
}

