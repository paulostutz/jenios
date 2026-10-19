'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {platformSupabase} from '../../../lib/platform/supabase-client';

/** Guard da área logada Platform: não reutilizar AuthGuard da JENIOS Social. */
export default function PlatformAuthGuard({children}){
 const router=useRouter();
 const [state,setState]=useState('checking');
 useEffect(()=>{
  if(!platformSupabase?.auth){setState('unconfigured');return;}
  let live=true,seq=0;
  async function validate(){
   const revision=++seq;
   setState('checking');
   try{
    const {data,error}=await platformSupabase.auth.getUser();
    if(!live || revision!==seq)return;
    if(error||!data?.user?.id||data.user.is_anonymous){
     setState('unauthorized');
     router.replace('/platform/entrar');
    }else setState('authorized');
   }catch{
    if(live && revision===seq){setState('unauthorized');router.replace('/platform/entrar');}
   }
  }
  void validate();
  let pendingTimer=null;
  const sub=platformSupabase.auth.onAuthStateChange(event=>{
   if(event==='TOKEN_REFRESHED' || event==='INITIAL_SESSION')return;
   clearTimeout(pendingTimer);
   pendingTimer=setTimeout(()=>{if(live)void validate();},0);
  });
  return()=>{live=false;seq++;clearTimeout(pendingTimer);sub.data.subscription.unsubscribe();};
 },[router]);

 if(state==='authorized')return children;
 return <main style={{minHeight:'100vh',background:'#10162b',color:'#fff',display:'grid',placeItems:'center',padding:24,fontFamily:'system-ui'}}>
  <section role="status" style={{maxWidth:480,lineHeight:1.65,textAlign:'center'}}>
   {state==='unconfigured'?<>
     <h1>Homologação da Platform não configurada</h1>
     <p>Informe apenas as variáveis públicas da Platform no ambiente de homologação. Não forneça chaves secretas neste formulário.</p>
     <Link href="/dashboard" style={{color:'#c4b5fd'}}>Abrir simulador sem autenticação</Link>
   </>:<>Validando acesso à JENIOS Platform…</>}
  </section>
 </main>;
}
