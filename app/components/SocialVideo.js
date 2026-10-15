'use client';
import {useEffect,useRef,useState} from 'react';
import {supabase} from '../../lib/supabase';
const variants=new Map();
export default function SocialVideo({src,postId,style}){
 const ref=useRef(null),container=useRef(null),[near,setNear]=useState(false),[url,setUrl]=useState(variants.get(src)||src),[status,setStatus]=useState(''),[retry,setRetry]=useState(0),[originalFallback,setOriginalFallback]=useState(false);
 const needsProcessing=postId&&!/-stream-v1\.mp4$/.test(url)&&url.includes('/storage/v1/object/public/')&&!originalFallback;
 useEffect(()=>{const observer=new IntersectionObserver(entries=>{for(const e of entries){setNear(e.isIntersecting);if(!e.isIntersecting)ref.current?.pause();}},{rootMargin:'150px'});observer.observe(container.current);return()=>observer.disconnect();},[]);
 useEffect(()=>{let live=true;setUrl(variants.get(src)||src);setOriginalFallback(false);
  async function prepare(){if(!near||!postId||variants.has(src)||/-stream-v1\.mp4$/.test(src)||!src.includes('/storage/v1/object/public/'))return;
   try{const {data}=await supabase.auth.getSession();if(!data.session)throw Error('session required');setStatus('Preparando reprodução…');
    const response=await fetch('/api/social/video',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+data.session.access_token},body:JSON.stringify({url:src,postId})});
    if(!response.ok)throw Error('unavailable');const result=await response.json();variants.set(src,result.url);if(live){setUrl(result.url);setStatus('');}
   }catch{if(live){setOriginalFallback(true);setStatus('Use reproduzir para assistir ao arquivo original.');}}
  }prepare();return()=>{live=false;};
 },[src,postId,near]);
 useEffect(()=>{const stop=()=>{if(document.hidden)ref.current?.pause();};const play=e=>{if(e.detail!==ref.current)ref.current?.pause();};document.addEventListener('visibilitychange',stop);window.addEventListener('jenios:video-play',play);return()=>{document.removeEventListener('visibilitychange',stop);window.removeEventListener('jenios:video-play',play);};},[]);
 return <div ref={container} style={{width:'100%',position:'relative',minHeight:180}}><video ref={ref} key={url+retry} src={near&&!needsProcessing?url:undefined} controls playsInline preload={near?'metadata':'none'} onPlay={e=>{e.currentTarget.preload='auto';window.dispatchEvent(new CustomEvent('jenios:video-play',{detail:e.currentTarget}));}} onPlaying={()=>setStatus('')} onWaiting={()=>setStatus('Carregando vídeo…')} onError={()=>setStatus('Não foi possível reproduzir. Tente carregar novamente.')} style={{width:'100%',maxHeight:'80vh',display:'block',...style}}/>{status&&<div role="status" style={{padding:10,background:'#0f172a',color:'white',fontSize:12}}>{status} {status.includes('novamente')&&<button onClick={()=>{setStatus('');setRetry(n=>n+1);}}>Recarregar vídeo</button>}</div>}</div>;
}
