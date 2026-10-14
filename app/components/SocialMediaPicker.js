'use client';
import { useEffect, useRef, useState } from 'react';
import { validateMediaMetadata } from '../../lib/social/media.mjs';

export default function SocialMediaPicker({items,onChange,disabled=false}){
  const [error,setError]=useState('');const urls=useRef(new Set());
  useEffect(()=>()=>{for(const url of urls.current)URL.revokeObjectURL(url);urls.current.clear()},[]);
  async function select(event){
    const files=Array.from(event.target.files||[]);event.target.value='';setError('');
    if(items.length+files.length>10){setError('Use até dez fotos e vídeos.');return;}
    const added=[];
    try{
      for(const file of files){
        const src=URL.createObjectURL(file);urls.current.add(src);let duration;
        if(file.type.startsWith('video/'))duration=await new Promise((resolve,reject)=>{const video=document.createElement('video');const timer=setTimeout(()=>reject(new Error('Não foi possível ler a duração do vídeo.')),10000);video.preload='metadata';video.onloadedmetadata=()=>{clearTimeout(timer);resolve(video.duration);video.removeAttribute('src');video.load()};video.onerror=()=>{clearTimeout(timer);reject(new Error('Formato de vídeo não suportado.'))};video.src=src;});
        validateMediaMetadata({contentType:file.type,size:file.size,duration});
        added.push({src,tipo:file.type.startsWith('video/')?'video':'imagem',duracao:duration,_file:file});
      }
      onChange([...items,...added]);
    }catch(error){for(const item of added){URL.revokeObjectURL(item.src);urls.current.delete(item.src)}setError(error.message)}
  }
  function remove(index){const item=items[index];if(item?.src?.startsWith('blob:')){URL.revokeObjectURL(item.src);urls.current.delete(item.src)}onChange(items.filter((_,i)=>i!==index));}
  return <div style={{margin:'12px 0'}}><label style={{display:'inline-block',background:'#ede9fe',color:'#6d28d9',padding:12,borderRadius:10,fontWeight:800,cursor:disabled?'wait':'pointer'}}>Foto / Vídeo<input type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime" multiple disabled={disabled} onChange={select} style={{display:'none'}}/></label><small style={{display:'block',marginTop:8}}>Até 10 mídias · vídeos até 90 segundos e 50 MB.</small>{error&&<p role="alert">{error}</p>}<div style={{display:'flex',gap:12,overflowX:'auto',marginTop:12}}>{items.map((item,index)=><div key={item.src} style={{minWidth:150,maxWidth:180}}>{item.tipo==='video'?<video src={item.src} controls playsInline style={{width:'100%',height:130,objectFit:'contain'}}/>:<img src={item.src} alt={'Foto '+(index+1)} style={{width:'100%',height:130,objectFit:'cover'}}/>}<button type="button" disabled={disabled} onClick={()=>remove(index)}>Remover mídia</button></div>)}</div></div>;
}
