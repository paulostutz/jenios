'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {platformSupabase} from '../../../lib/platform/supabase-client';
import {currentPlatformSession} from '../../../lib/platform/diagnostic-client.mjs';

/** Somente exibe atalho após a API exclusiva confirmar platform.admin. */
export default function PlatformAdminShortcut({className}){
 const [visible,setVisible]=useState(false);
 const revision=useRef(0);
 useEffect(()=>{
  let live=true;
  async function load(){
   const id=++revision.current;
   setVisible(false);
   try{
    const session=await currentPlatformSession(platformSupabase);
    if(!session)return;
    const response=await fetch('/api/platform/admin/access',{cache:'no-store',headers:{authorization:'Bearer '+session.access_token}});
    if(!response.ok)return;
    const body=await response.json();
    const latest=await currentPlatformSession(platformSupabase);
    if(live && id===revision.current && latest?.user?.id===session.user.id &&
       Array.isArray(body.permissions) && body.permissions.includes('platform.admin')){
      setVisible(true);
    }
   }catch{if(live&&id===revision.current)setVisible(false);}
  }
  void load();
  let timer;
  const sub=platformSupabase?.auth?.onAuthStateChange(event=>{
    if(event==='TOKEN_REFRESHED'||event==='INITIAL_SESSION')return;
    clearTimeout(timer);
    revision.current++;setVisible(false);
    timer=setTimeout(()=>{if(live)void load();},0);
  });
  return()=>{live=false;revision.current++;clearTimeout(timer);sub?.data?.subscription?.unsubscribe?.();};
 },[]);
 if(!visible)return null;
 return <Link className={className} href="/platform/admin">◈ Administração Platform</Link>;
}
