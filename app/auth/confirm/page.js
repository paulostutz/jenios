'use client';
import Link from 'next/link';
import {useEffect,useRef,useState} from 'react';
import {supabase} from '../../../lib/supabase';
import {verifySocialConfirmation} from '../../../lib/social/confirmation-flow.mjs';

export default function ConfirmacaoSocial(){
 const [state,setState]=useState('checking');const run=useRef(0);
 useEffect(()=>{
  let active=true;const current=++run.current;
  async function verify(){
   const result=await verifySocialConfirmation(supabase,window.location.href);
   if(!active||current!==run.current)return;
   // Remove one-time codes from the address bar; never render or log them.
   window.history.replaceState(null,'',window.location.pathname);
   setState(result.status);
  }
  void verify();return()=>{active=false;run.current++;};
 },[]);
 const text={checking:'Verificando confirmação pelo servidor…',invalid:'Link inválido ou expirado. Entre ou solicite nova confirmação.',unavailable:'Não foi possível verificar sua conta agora. Tente novamente.', 'profile-missing':'Autenticação reconhecida, mas seu perfil na Social precisa de regularização.',ready:'Sessão e perfil da Social confirmados.'};
 return <main style={{minHeight:'100vh',padding:'50px 18px',background:'#0f172a',color:'#fff',fontFamily:'system-ui'}}>
  <section style={{maxWidth:550,margin:'auto',background:'#fff',color:'#1e293b',borderRadius:16,padding:28}}>
   <strong>JENIOS · Confirmação de acesso</strong><h1>Verificação da conta Social</h1>
   <p role="status">{text[state]||text.unavailable}</p>
   <p>Esta página não exibe códigos de confirmação ou dados de identificação.</p>
   {state==='ready'?<Link href="/s04-laboratorio">Abrir laboratório de testes</Link>:<Link href="/login">Voltar ao login</Link>}
  </section>
 </main>;
}
