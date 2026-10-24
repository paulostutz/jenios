'use client';
import {createContext,useContext,useEffect,useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {platformSupabase} from '../../../lib/platform/supabase-client';
import {resolveSocialPortalEntry,observeSocialPortalAuth} from '../../../lib/platform/unified-entry.mjs';
import {socialAuthReturnPath} from '../social-auth-return.mjs';

const PlatformEntryContext=createContext(null);
export const usePlatformPortalEntry=()=>useContext(PlatformEntryContext);

/**
 * The Social session unlocks only the simulated control room.
 * The Platform Supabase token remains mandatory for dedicated diagnostic,
 * administrator, risk and subscription APIs.
 */
export default function PlatformAuthGuard({children,returnTo='/dashboard-logado'}){
 const router=useRouter();
 const [state,setState]=useState({phase:'checking',access:null});
 useEffect(()=>{
  let live=true,seq=0,pendingTimer=null;
  function login(){
   if(returnTo==='/dashboard-logado')router.replace('/platform/entrar');
   else router.replace('/platform/entrar?next='+encodeURIComponent(socialAuthReturnPath(returnTo)));
  }
  async function validate(){
   const rev=++seq;
   setState({phase:'checking',access:null});
   const social=await resolveSocialPortalEntry();
   if(!live||rev!==seq)return;
   if(social){
    setState({phase:'authorized',access:social});
    return;
   }
   if(!platformSupabase?.auth){
    setState({phase:'unauthorized',access:null});
    login();
    return;
   }
   try{
    const {data,error}=await platformSupabase.auth.getUser();
    if(!live||rev!==seq)return;
    const user=data?.user;
    if(!error&&user?.id&&!user.is_anonymous){
     const label=String(user.user_metadata?.full_name||user.user_metadata?.name||
       user.email?.split('@')[0]||'Operador').slice(0,80);
     setState({phase:'authorized',access:{source:'platform',userId:user.id,label}});
    }else{
     setState({phase:'unauthorized',access:null});
     login();
    }
   }catch{
    if(live&&rev===seq){
     setState({phase:'unauthorized',access:null});
     login();
    }
   }
  }
  function revalidate(){
   clearTimeout(pendingTimer);seq++;
   setState({phase:'checking',access:null});
   pendingTimer=setTimeout(()=>{if(live)void validate();},0);
  }
  void validate();
  const platformSub=platformSupabase?.auth?.onAuthStateChange(event=>{
   if(event==='INITIAL_SESSION'||event==='TOKEN_REFRESHED')return;
   revalidate();
  });
  const socialSub=observeSocialPortalAuth(event=>{
   if(event==='INITIAL_SESSION'||event==='TOKEN_REFRESHED')return;
   revalidate();
  });
  const onFocus=()=>{if(live)revalidate();};
  window.addEventListener('focus',onFocus);
  return()=>{
   live=false;seq++;clearTimeout(pendingTimer);
   window.removeEventListener('focus',onFocus);
   platformSub?.data?.subscription?.unsubscribe?.();
   socialSub?.data?.subscription?.unsubscribe?.();
  };
 },[router,returnTo]);
 if(state.phase==='authorized')return <PlatformEntryContext.Provider value={state.access}>{children}</PlatformEntryContext.Provider>;
 return <main style={{minHeight:'100vh',background:'#10162b',color:'#fff',display:'grid',placeItems:'center',padding:24,fontFamily:'system-ui'}}>
  <section role="status" style={{maxWidth:480,lineHeight:1.65,textAlign:'center'}}>
   {state.phase==='unconfigured'?<>
     <h1>Acesso à Platform temporariamente indisponível</h1>
     <p>Entre na Social para abrir a Sala de Controle ou procure o suporte. Nenhuma credencial será compartilhada entre bancos.</p>
     <Link href="/login" style={{color:'#c4b5fd'}}>Entrar na JENIOS Social</Link>
   </>:<>Validando acesso à JENIOS Platform…</>}
  </section>
 </main>;
}
