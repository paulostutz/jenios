'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {supabase} from '../../lib/supabase';
import {platformSupabase} from '../../lib/platform/supabase-client';
import {PLATFORM_MONTHLY_TERMS} from '../../lib/platform/monthly-billing-contract.mjs';
const brl=value=>(value/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const date=value=>new Date(value).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'});
const button={padding:'12px 16px',border:0,borderRadius:10,background:'#6d28d9',color:'#fff',fontWeight:800,cursor:'pointer'};
export default function MonthlyPix({plan,onState}){
 const [state,setState]=useState(null),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[accepted,setAccepted]=useState(false);
 const [social,setSocial]=useState(null),[platform,setPlatform]=useState(null),[payment,setPayment]=useState(null);
 const [email,setEmail]=useState(''),[password,setPassword]=useState('');
 const epoch=useRef(0),attempt=useRef(null),running=useRef(false);
 const sessions=useCallback(async()=>{
  const [a,b]=await Promise.all([supabase?.auth.getSession(),platformSupabase?.auth.getSession()]);
  if(a?.error||b?.error)throw Error('Não foi possível conferir sua sessão. Entre novamente.');
  return {a:a?.data?.session,b:b?.data?.session};
 },[]);
 const api=useCallback(async(action,body,orderId)=>{
  const {a,b}=await sessions();if(!a?.access_token)throw Error('Entre na sua conta JENIOS para continuar.');
  const response=await fetch('/api/platform/subscription/'+action+(orderId?'?orderId='+encodeURIComponent(orderId):''),{
   method:body?'POST':'GET',cache:'no-store',headers:{authorization:'Bearer '+a.access_token,...(b?.access_token?{'x-platform-authorization':'Bearer '+b.access_token}:{}),...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const result=await response.json();
  const latest=await sessions();if(latest.a?.user?.id!==a.user.id||latest.b?.user?.id!==b?.user?.id)throw Error('A conta mudou. Atualize a consulta antes de continuar.');
  if(!response.ok||result.ok===false)throw Object.assign(Error(result.error||'Não foi possível concluir.'),{result});
  return result;
 },[sessions]);
 const load=useCallback(async()=>{
  const ticket=++epoch.current;
  try{
   const {a,b}=await sessions();if(ticket!==epoch.current)return;
   setSocial(a?.user||null);setPlatform(b?.user||null);
   if(!a?.access_token){setState(null);onState?.(null);return;}
   const result=await api('access');if(ticket!==epoch.current)return;
   setState(result);onState?.(result);
  }catch(e){if(ticket===epoch.current)setMessage(e.message);}
 },[api,sessions,onState]);
 useEffect(()=>{
  const changed=()=>{epoch.current++;attempt.current=null;setAccepted(false);setPayment(null);setState(null);void load();};
  void load();
  const a=supabase?.auth.onAuthStateChange(()=>setTimeout(changed,0)),b=platformSupabase?.auth.onAuthStateChange(()=>setTimeout(changed,0));
  return()=>{epoch.current++;a?.data?.subscription?.unsubscribe();b?.data?.subscription?.unsubscribe();};
 },[load]);
 useEffect(()=>{setAccepted(false);},[plan?.code,plan?.price_cents]);
 async function run(operation){
  if(running.current)return;running.current=true;setBusy(true);setMessage('');
  try{await operation();}catch(e){
   setMessage(e.message);
   if(e.result?.orderId)setPayment(old=>({...old,...e.result,status:e.result.code==='PAID_REVIEW_REQUIRED'?'paid_pending_access':e.result.status||'pending'}));
  }finally{running.current=false;setBusy(false);}
 }
 async function status(orderId){
  const result=await api('status',undefined,orderId);setPayment(result);
  if(result.status==='paid'){attempt.current=null;setAccepted(false);setMessage(result.review?'Pagamento recebido em conferência. Não pague novamente.':'Pagamento confirmado. Seu plano mensal está liberado.');}
  if(['expired','cancelled','refunded'].includes(result.status)){attempt.current=null;setAccepted(false);setMessage('Este Pix foi encerrado. Atualize a consulta antes de iniciar outro pedido.');}
  await load();
 }
 const openOrder=payment?.orderId||state?.pending?.orderId;
 useEffect(()=>{
  if(!openOrder||payment?.status==='paid'||payment?.status==='paid_pending_access'||payment?.status==='expired'||payment?.status==='cancelled'||payment?.status==='refunded')return;
  const timer=setInterval(()=>{if(!document.hidden&&!running.current)void run(()=>status(openOrder));},15000);
  return()=>clearInterval(timer);
 // The polling closure is replaced after each response; it never starts a charge.
 },[openOrder,payment?.status,api,load]);
 async function checkout(){
  if(!plan||!accepted)throw Error('Confira e aceite o valor da mensalidade.');
  const {a,b}=await sessions();if(!b?.access_token)throw Error('Confirme o acesso da Platform antes de gerar o Pix.');
  const fingerprint=JSON.stringify([a?.user?.id,b.user.id,plan.code,plan.price_cents]);
  if(attempt.current?.fingerprint!==fingerprint)attempt.current={fingerprint,key:state?.pending?.requestKey||crypto.randomUUID()};
  const result=await api('checkout',{productCode:plan.code,amountCents:plan.price_cents,currency:'BRL',termsVersion:PLATFORM_MONTHLY_TERMS,acceptTerms:true,requestKey:attempt.current.key});
  setPayment(result);await status(result.orderId);
 }
 const pending=state?.pending;
 const selectedMatches=!pending||(plan?.code===pending.productCode&&plan?.price_cents===pending.amountCents);
 return <section style={{display:'grid',gap:14}}>
  <h2>Pix mensal, renovação por você</h2>
  <p>Você paga um mês por vez. O próximo Pix fica disponível no vencimento, pelo preço apresentado naquele momento. Não há débito automático. Se deixar vencer, o acesso pago termina; sua conta permanece.</p>
  {!social?<a href="/login?next=%2Fcheckout">Entrar na minha conta JENIOS →</a>:<p>Conta pagadora: <strong>{social.email}</strong></p>}
  {social&&!platform&&<form onSubmit={event=>{event.preventDefault();void run(async()=>{
   if(!platformSupabase)throw Error('A autenticação da Platform está indisponível.');
   try{const result=await platformSupabase.auth.signInWithPassword({email:email.trim(),password});if(result.error)throw Error('Não foi possível entrar na Platform. Confira seu acesso exclusivo.');await load();}finally{setPassword('');}
  });}} style={{display:'grid',gap:10,maxWidth:450}}>
   <p>Confirme seu acesso exclusivo da Platform para associar a assinatura à conta correta.</p>
   <label>E-mail da Platform <input type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} required disabled={busy}/></label>
   <label>Senha da Platform <input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required disabled={busy}/></label>
   <button style={button} disabled={busy}>Confirmar meu acesso da Platform</button>
   <a href="/platform/recuperar">Recuperar acesso da Platform</a>
   <small>Se você ainda só tem a conta Social, a contratação aguarda a liberação do seu acesso da Platform pelo atendimento. Você pode continuar usando a simulação.</small>
  </form>}
  {platform&&<p>Conta da Platform: <strong>{platform.email}</strong></p>}
  {social&&platform&&state&&!state.linked&&<button style={button} disabled={busy} onClick={()=>void run(async()=>{await api('link',{acceptLink:true});await load();})}>Confirmar vínculo dessas duas contas</button>}
  {state?.access&&<div role="status"><strong>Plano ativo até {date(state.access.validUntil)}</strong><p>O período pago será preservado. A renovação fica disponível nessa data.</p>
   <button disabled={busy} onClick={()=>void run(async()=>{await api('reminders',{cancelAtPeriodEnd:!state.access.cancelAtPeriodEnd});await load();})}>{state.access.cancelAtPeriodEnd?'Voltar a receber lembretes de renovação':'Não renovar e parar os lembretes'}</button></div>}
  {state&&!state.available&&<p role="status">A cobrança está em homologação. Nenhum Pix novo será emitido agora.</p>}
  {state?.review&&<p role="alert">Há um pagamento recebido em conferência. Não faça outro pagamento; procure o atendimento.</p>}
  {pending&&<p>Pedido em andamento: {brl(pending.amountCents)}. Retome este pedido antes de escolher outro plano.</p>}
  {state?.canPurchase&&platform&&plan&&selectedMatches&&<>
   <label><input type="checkbox" checked={accepted} onChange={e=>setAccepted(e.target.checked)} disabled={busy}/> Concordo em pagar <strong>{brl(pending?.amountCents||plan.price_cents)}</strong> por um mês do plano {plan.name}, com renovação manual no vencimento.</label>
   <button style={button} disabled={busy||!accepted} onClick={()=>void run(checkout)}>{busy?'Conferindo…':pending?'Retomar o mesmo Pix':'Gerar Pix mensal'}</button>
  </>}
  {payment?.pixCode&&payment.status==='awaiting_payment'&&<div style={{display:'grid',gap:10}}><strong>Pix de {brl(payment.amountCents)}</strong><p>Válido até {date(payment.expiresAt)}</p>
   <label>Pix copia e cola <textarea readOnly value={payment.pixCode} rows={4} style={{width:'100%',boxSizing:'border-box'}}/></label>
   <button disabled={busy} onClick={()=>void run(async()=>{await navigator.clipboard.writeText(payment.pixCode);setMessage('Código Pix copiado.');})}>Copiar código Pix</button>
   <p>Depois de pagar, a confirmação será consultada automaticamente enquanto esta página estiver aberta.</p></div>}
  {openOrder&&<button disabled={busy} onClick={()=>void run(()=>status(openOrder))}>Consultar pagamento deste pedido</button>}
  {message&&<p role="status">{message}</p>}
  {social&&<button disabled={busy} onClick={()=>void run(load)}>Atualizar minha assinatura</button>}
  <small>A contratação não habilita ordens reais em corretoras. Recursos de IA sujeitos à ativação e aos limites do plano.</small>
 </section>;
}
