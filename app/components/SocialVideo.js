'use client';
import {useEffect,useRef,useState} from 'react';
import {supabase} from '../../lib/supabase';
import {playbackSource,shouldRequestVideoVariant,nextVideoVariant} from '../../lib/social/video-playback.mjs';
const variants=new Map(), attempted=new Map();
const optimizedVideoEnabled=process.env.NEXT_PUBLIC_SOCIAL_OPTIMIZED_VIDEO==='true';
/** Feed videos play their original immediately. Processing is optional and never blocks playback. */
export default function SocialVideo({src,postId,style}){
 const ref=useRef(null),container=useRef(null),pendingVariant=useRef('');
 const [near,setNear]=useState(false),[url,setUrl]=useState(variants.get(src)||src),[status,setStatus]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{
  const target=container.current;if(!target)return;
  if(typeof IntersectionObserver==='undefined'){setNear(true);return;}
  const observer=new IntersectionObserver(entries=>{for(const entry of entries){
   setNear(entry.isIntersecting);if(!entry.isIntersecting)ref.current?.pause();
  }},{rootMargin:'220px'});observer.observe(target);return()=>observer.disconnect();
 },[]);
 useEffect(()=>{pendingVariant.current='';setUrl(variants.get(src)||src);setStatus('');},[src]);
 useEffect(()=>{
  if(!near||!shouldRequestVideoVariant({src,postId,enabled:optimizedVideoEnabled})||variants.has(src))return;
  if(attempted.has(src) && Date.now()-attempted.get(src)<5*60*1000)return;
  attempted.set(src,Date.now());while(attempted.size>128)attempted.delete(attempted.keys().next().value);
  const controller=new AbortController();let alive=true;
  async function requestOptimizedVideo(){
   try{
    const {data,error}=await supabase?.auth.getSession();
    if(error||!data?.session?.access_token)return;
    const response=await fetch('/api/social/video',{
     method:'POST',cache:'no-store',signal:controller.signal,
     headers:{'content-type':'application/json',authorization:'Bearer '+data.session.access_token},
     body:JSON.stringify({url:src,postId})
    });
    if(!response.ok)return;
    const result=await response.json();
    if(!result?.url||!nextVideoVariant(variants,src,result.url))return;
    if(!alive)return;
    if(ref.current&&!ref.current.paused&&!ref.current.ended)pendingVariant.current=result.url;
    else setUrl(result.url);
   }catch{/* The original URL remains playable when optimization fails or is unavailable. */}
  }
  void requestOptimizedVideo();return()=>{alive=false;controller.abort();};
 },[src,postId,near]);
 useEffect(()=>{
  const hidden=()=>{if(document.hidden)ref.current?.pause();};
  const competing=e=>{if(e.detail!==ref.current)ref.current?.pause();};
  document.addEventListener('visibilitychange',hidden);
  window.addEventListener('jenios:video-play',competing);
  return()=>{document.removeEventListener('visibilitychange',hidden);window.removeEventListener('jenios:video-play',competing);};
 },[]);
 const display=playbackSource({near,original:src,variant:url});
 return <div ref={container} style={{width:'100%',position:'relative',minHeight:180}}>
  <video ref={ref} key={url+'-'+retry} src={display} controls playsInline preload={near?'metadata':'none'}
   onPlay={e=>{e.currentTarget.preload='auto';window.dispatchEvent(new CustomEvent('jenios:video-play',{detail:e.currentTarget}));}}
   onPause={()=>{if(pendingVariant.current){setUrl(pendingVariant.current);pendingVariant.current='';}}}
   onPlaying={()=>setStatus('')}
   onWaiting={()=>setStatus('Carregando vídeo…')}
   onError={()=>{
    if(url!==src){setUrl(src);setStatus('A versão otimizada não abriu. Tente o vídeo original.');}
    else setStatus('Não foi possível reproduzir. Tente carregar novamente.');
   }}
   style={{width:'100%',maxHeight:'80vh',display:'block',...style}}/>
  {status&&<div role="status" style={{padding:10,background:'#0f172a',color:'white',fontSize:12}}>
   {status} {status.includes('novamente')&&<button type="button" onClick={()=>{setStatus('');setRetry(n=>n+1);}}>Recarregar vídeo</button>}
  </div>}
 </div>;
}
