'use client';
import {useEffect,useState} from 'react';
export default function MobileAreaSwitcher(){
 const [standalone,setStandalone]=useState(false);
 useEffect(()=>{
  const media=window.matchMedia('(display-mode: standalone)');
  const update=()=>setStandalone((media.matches||navigator.standalone===true)&&!navigator.userAgent.includes('JENIOS-Mobile'));
  update();media.addEventListener?.('change',update);return()=>media.removeEventListener?.('change',update);
 },[]);
 if(!standalone)return null;
 return <a href="/mobile.html" aria-label="Escolher JENIOS Social ou Platform" style={{position:'fixed',top:'calc(env(safe-area-inset-top) + 8px)',right:12,zIndex:2147480000,minHeight:44,padding:'12px 16px',borderRadius:24,background:'#211a35',border:'1px solid #a78bfa',boxShadow:'0 2px 10px #0006',color:'#eadfff',font:'600 13px system-ui',textDecoration:'none'}}>Áreas JENIOS</a>;
}
