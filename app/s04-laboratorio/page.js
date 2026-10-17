'use client';
import {useCallback, useEffect, useState} from 'react';
import Link from 'next/link';
import {supabase} from '../../lib/supabase';

/** Test-only account view. NEVER collect identity documents, money or passwords here. */
export default function StagingLabPage(){
  const [state,setState]=useState({kind:'loading',handle:''});
  const [busy,setBusy]=useState(false);
  const refresh=useCallback(async()=>{
    if(!supabase){setState({kind:'unavailable',handle:''});return;}
    setBusy(true);
    try{
      const {data,error}=await supabase.auth.getUser();
      const user=data?.user;
      if(error||!user?.id||user.is_anonymous){setState({kind:'guest',handle:''});return;}
      const result=await supabase.from('profiles').select('id,handle').eq('id',user.id).maybeSingle();
      if(result.error){setState({kind:'unavailable',handle:''});return;}
      if(result.data?.id!==user.id){setState({kind:'profile-missing',handle:''});return;}
      setState({kind:'ready',handle:result.data.handle||''});
    }catch{setState({kind:'unavailable',handle:''});}
    finally{setBusy(false);}
  },[]);
  useEffect(()=>{let active=true;void refresh();const sub=supabase?.auth.onAuthStateChange(()=>{if(active)queueMicrotask(()=>{if(active)void refresh();});});return()=>{active=false;sub?.data?.subscription?.unsubscribe();};},[refresh]);
  async function leave(){if(!supabase)return;setBusy(true);try{await supabase.auth.signOut();setState({kind:'guest',handle:''});}catch{setState({kind:'unavailable',handle:''});}finally{setBusy(false);}}
  const box={maxWidth:670,margin:'48px auto',padding:26,borderRadius:20,background:'#fff',color:'#0f172a',lineHeight:1.65,fontFamily:'system-ui,sans-serif'};
  const primary={display:'inline-block',padding:'10px 16px',background:'#6d28d9',color:'#fff',borderRadius:10,textDecoration:'none'};
  return <main style={{minHeight:'100vh',background:'#0f172a',padding:'24px',boxSizing:'border-box'}}>
    <section style={box}>
      <p style={{color:'#6d28d9',fontWeight:800,margin:0}}>JENIOS · LABORATÓRIO S04</p>
      <h1 style={{fontSize:26,margin:'8px 0'}}>Homologação isolada</h1>
      <p>Este endereço é exclusivo para testes com dados fictícios. Não utilize sua conta real, CPF, cartão ou informações de clientes.</p>
      <hr style={{border:0,borderTop:'1px solid #ddd',margin:'24px 0'}}/>
      {state.kind==='loading' && <p role="status">Verificando sessão de teste…</p>}
      {state.kind==='guest' && <><p role="status">Nenhuma conta de teste autenticada.</p><Link href="/cadastro" style={primary}>Criar conta fictícia</Link>{' '}<Link href="/login" style={{color:'#6d28d9'}}>Entrar no laboratório</Link></>}
      {state.kind==='ready' && <><p role="status">Autenticação confirmada, perfil encontrado e regras de leitura aplicadas.</p><p>Seu identificador de teste: <strong>@{state.handle}</strong></p><button type="button" onClick={leave} disabled={busy} style={primary}>Sair da conta de teste</button></>}
      {state.kind==='profile-missing' && <p role="alert">Sessão válida, mas o perfil de teste não foi criado. O cadastro precisa de revisão; nenhuma conta real foi afetada.</p>}
      {state.kind==='unavailable' && <p role="alert">Não foi possível confirmar a conexão com o banco de testes. Nenhum acesso foi liberado.</p>}
      <div style={{marginTop:20}}><button type="button" onClick={refresh} disabled={busy} style={{padding:'8px 14px'}}>Revalidar sessão e perfil</button></div>
      <p style={{marginTop:25,fontSize:12,color:'#475569'}}>Nesta prévia, pagamentos, APIs financeiras, mídia privada, exclusão definitiva e ativação do teste grátis estão bloqueados.</p>
    </section>
  </main>;
}
