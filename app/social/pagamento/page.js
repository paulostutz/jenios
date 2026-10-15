'use client';
import {Suspense,useEffect,useRef,useState} from 'react';
import {useSearchParams} from 'next/navigation';
import Link from 'next/link';
import {supabase} from '../../../lib/supabase';

const destinations={
  'social-bankscore-report':'/bankscore/detalhado',
  'social-crypto-validator':'/social/consulta-detalhada',
  'social-specialist-offer':'/especialistas/atendimentos',
  'social-boost':'/impulsionar/campanhas',
};
function Payment(){
  const id=useSearchParams().get('pedido'),[data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[copied,setCopied]=useState(false),reload=useRef(null);
  useEffect(()=>{
    let active=true,running=false,done=false,revision=0,identity;
    async function refresh(){
      if(running||done||document.hidden)return;running=true;setBusy(true);const requestRevision=revision;
      try{
        const auth=await supabase?.auth.getSession();
        if(auth?.error)throw Error('Não foi possível verificar sua conta.');
        if(requestRevision!==revision)return;
        identity=auth?.data?.session?.user?.id||null;
        const response=await fetch('/api/jenios-pay/pix?id='+encodeURIComponent(id||''),{cache:'no-store',headers:auth?.data?.session?.access_token?{Authorization:'Bearer '+auth.data.session.access_token}:{}});
        const result=await response.json();if(!response.ok)throw Error(result.error||'Não foi possível consultar o pagamento.');
        if(active&&requestRevision===revision){setData(result);setError('');done=['paid','refunded','cancelled','expired'].includes(result.status);}
      }catch(e){if(active&&requestRevision===revision){setData(null);setError(e.message);}}finally{running=false;if(active)setBusy(false);}
    }
    reload.current=refresh;refresh();const timer=setInterval(refresh,15000);document.addEventListener('visibilitychange',refresh);
    const subscription=supabase?.auth.onAuthStateChange((event,session)=>{
      if(event==='INITIAL_SESSION'||event==='TOKEN_REFRESHED'||identity===(session?.user?.id||null))return;
      identity=session?.user?.id||null;revision++;done=false;setData(null);setError('Conta alterada. Verifique o pedido na conta que realizou a compra.');
    });
    return()=>{active=false;revision++;clearInterval(timer);document.removeEventListener('visibilitychange',refresh);reload.current=null;subscription?.data?.subscription?.unsubscribe();};
  },[id]);
  const paid=data?.status==='paid',ended=['expired','cancelled','refunded'].includes(data?.status);
  const destination=destinations[data?.productCode];
  return <main style={{maxWidth:560,margin:'40px auto',padding:24,background:'#fff',borderRadius:16,color:'#172554',border:'1px solid #ddd6fe'}}>
    <Link href="/social">← Voltar à Social</Link><h1>Pagamento Pix</h1>
    {data&&<><h2 style={{fontSize:20}}>{data.productName}</h2><p style={{fontSize:28,fontWeight:800}}>{(data.amount_cents/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</p></>}
    {error&&<p role="alert">{error}</p>}
    {!data&&busy&&<p role="status">Consultando seu pedido…</p>}
    {paid?<><p role="status">Pagamento confirmado.</p>{destination&&<Link href={destination+'?pedido='+encodeURIComponent(id)}>Acessar minha compra →</Link>}</>:
      ended?<p role="status">{data.status==='expired'?'Este Pix expirou. Volte ao produto para iniciar outro pedido.':data.status==='refunded'?'Este pagamento foi devolvido.':'Esta cobrança foi cancelada.'}</p>:
      data?.pixCode?<><p>Copie o código e use a opção <strong>Pix Copia e Cola</strong> no aplicativo do seu banco. Confira o recebedor e o valor antes de confirmar.</p>
        <textarea readOnly aria-label="Código Pix Copia e Cola" value={data.pixCode} onFocus={e=>e.target.select()} style={{boxSizing:'border-box',width:'100%',minHeight:110,overflowWrap:'anywhere'}}/>
        <button onClick={async()=>{try{await navigator.clipboard.writeText(data.pixCode);setCopied(true);}catch{setError('Selecione e copie o código no campo acima.');}}} style={{padding:12,background:'#6d28d9',color:'#fff',border:0,borderRadius:8}}>{copied?'Código copiado':'Copiar código Pix'}</button>
        <p>Válido até {new Date(data.expiresAt).toLocaleString('pt-BR')}.</p><p>Após pagar, mantenha esta tela aberta. A confirmação será consultada automaticamente.</p></>:null}
    {!paid&&!ended&&<button onClick={()=>reload.current?.()} disabled={busy} style={{marginTop:12,padding:10}}>{busy?'Consultando…':'Já paguei · verificar pagamento'}</button>}
    <p style={{fontSize:12,overflowWrap:'anywhere'}}>Pedido: {id}</p>
  </main>;
}
export default function Page(){return <Suspense fallback={<p>Carregando pagamento…</p>}><Payment/></Suspense>;}
