'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {supabase} from '../../lib/supabase';
import {UNIVERSITY_MONTHLY,validUniversityOffer,validUniversityAccess,validUniversityScheduled,canStartUniversityPurchase,projectUniversityOrder,restoreUniversityAttempt,
 preserveUniversityAttempt,universityAttemptReference,universityDate} from './university-client.mjs';
import styles from './university.module.css';

function checkedAccess(value){
 if(value?.ok!==true||!validUniversityOffer(value.offer)||!validUniversityAccess(value.access)||typeof value.canPurchase!=='boolean'||typeof value.canRenew!=='boolean')throw Error('Não foi possível conferir as condições da sua conta. Atualize o acesso antes de contratar.');
 if(value.scheduled&&!validUniversityScheduled(value.scheduled))throw Error('Seu próximo período de estudos precisa de conferência. Atualize o acesso antes de contratar.');
 if(value.order&&!projectUniversityOrder(value.order))throw Error('Há um pedido que ainda precisa de conferência. Atualize o acesso antes de continuar.');
 return value;
}

export default function UniversitySubscription(){
 const [account,setAccount]=useState({kind:'checking'}),[refresh,setRefresh]=useState(0),[error,setError]=useState('');
 const [attempt,setAttempt]=useState(null),[consent,setConsent]=useState(false),[busy,setBusy]=useState(''),[copied,setCopied]=useState(false),[clock,setClock]=useState(Date.now());
 const epoch=useRef(0),owner=useRef(null),abort=useRef(null),attemptRef=useRef(null),busyRef=useRef(false);
 const data=account.data,access=data?.access,offer=data?.offer,included=access?.included===true,scheduled=data?.scheduled;
 const final=Boolean(attempt&&['active','scheduled','closed','not_started'].includes(attempt.state));
 const canPurchase=canStartUniversityPurchase(account);
 const storageKey=()=>owner.current?'jenios:university:monthly:'+owner.current:null;

 async function request(path,body){
  const ticket=epoch.current,currentOwner=owner.current;
  const auth=await supabase?.auth.getSession(),session=auth?.data?.session;
  if(ticket!==epoch.current)throw new DOMException('Sua sessão mudou.','AbortError');
  if(auth?.error||!session?.access_token||session.user?.is_anonymous||session.user?.id!==currentOwner)throw Error('Sua sessão mudou. Entre novamente para continuar.');
  const response=await fetch('/api/assistant/university/'+path,{method:body?'POST':'GET',cache:'no-store',signal:abort.current?.signal,
   headers:{authorization:'Bearer '+session.access_token,...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  let result;try{result=await response.json();}catch{throw Error('Não recebemos a confirmação do serviço. Confira o mesmo pedido antes de tentar outra contratação.');}
  if(ticket!==epoch.current||currentOwner!==owner.current)throw new DOMException('Sua sessão mudou.','AbortError');
  if(!response.ok||result?.ok===false)throw Object.assign(Error(typeof result?.error==='string'?result.error:'Não foi possível concluir esta solicitação.'),{universityBody:result,status:response.status});
  return result;
 }
 function remember(next,{required=false}={}){
  const key=storageKey(),reference=universityAttemptReference(next);
  if(!key||!reference)return false;
  try{if(['active','scheduled','closed','not_started'].includes(next.state))sessionStorage.removeItem(key);else sessionStorage.setItem(key,JSON.stringify(reference));}
  catch{if(required){setError('Não foi possível guardar a referência deste pedido no navegador. Nenhuma contratação foi enviada.');return false;}}
  attemptRef.current=next;setAttempt(next);setCopied(false);return true;
 }
 useEffect(()=>{
  let live=true;const ticket=++epoch.current;
  abort.current?.abort();abort.current=new AbortController();owner.current=null;attemptRef.current=null;busyRef.current=false;
  setAccount({kind:'checking'});setAttempt(null);setConsent(false);setBusy('');setError('');setCopied(false);
  async function load(){try{
   const auth=await supabase?.auth.getSession(),session=auth?.data?.session;
   if(!live||ticket!==epoch.current)return;
   if(auth?.error)throw Error('Não foi possível verificar sua conta. Tente novamente.');
   if(!session?.access_token||session.user?.is_anonymous){setAccount({kind:'guest'});return;}
   owner.current=session.user.id;
   const value=checkedAccess(await request('access'));
   if(!live||ticket!==epoch.current)return;
   let saved=null;try{saved=restoreUniversityAttempt(JSON.parse(sessionStorage.getItem(storageKey())||'null'));}catch{}
   const pending=value.order?projectUniversityOrder(value.order):null;
   setAccount({kind:'ready',data:value});
   if(pending)remember(pending);else if(saved)remember(saved);
  }catch(e){if(live&&ticket===epoch.current&&e.name!=='AbortError'){setAccount({kind:'unavailable'});setError(e.message);}}}
  void load();
  const auth=supabase?.auth.onAuthStateChange((event,session)=>{
   if(event==='INITIAL_SESSION'||session?.user?.id===owner.current&&['SIGNED_IN','TOKEN_REFRESHED','USER_UPDATED'].includes(event))return;
   epoch.current++;abort.current?.abort();owner.current=null;attemptRef.current=null;setAttempt(null);setConsent(false);setError('');setAccount({kind:'checking'});
   setTimeout(()=>{if(live)setRefresh(value=>value+1);},0);
  });
  return()=>{live=false;epoch.current++;abort.current?.abort();auth?.data?.subscription?.unsubscribe();};
 },[refresh]);
 useEffect(()=>{
  if(!attempt?.pixCode)return;
  setClock(Date.now());const timer=setInterval(()=>setClock(Date.now()),1000);return()=>clearInterval(timer);
 },[attempt?.pixCode,attempt?.pixExpiresAt]);

 function acceptOrder(result,current){
  const next=projectUniversityOrder(result,current);
  if(!next)throw Error('Não foi possível conferir os valores ou o estado do pedido. Retome a mesma solicitação.');
  remember(next);
  if(next.state==='active')setAccount(old=>({...old,data:{...old.data,access:next.access,scheduled:null,
   canRenew:old.data?.offer?.available===true&&!next.access.included&&next.access.kind==='university-monthly',
   canPurchase:old.data?.offer?.available===true&&!next.access.included&&next.access.kind!=='purchased-pass'}}));
  if(next.state==='scheduled')setAccount(old=>({...old,data:{...old.data,access:next.access,scheduled:next.scheduled,canRenew:false,canPurchase:false}}));
  return next;
 }
 async function statusFor(current){
  const ticket=epoch.current;let result;
  try{result=await request('status?orderId='+encodeURIComponent(current.orderId));}
  catch(e){if(ticket!==epoch.current)throw new DOMException('Sua sessão mudou.','AbortError');if(e.universityBody?.state==='paid_pending_access')result=e.universityBody;else throw e;}
  if(ticket!==epoch.current)throw new DOMException('Sua sessão mudou.','AbortError');
  return acceptOrder(result,current);
 }
 async function checkout(current){
  const ticket=epoch.current;
  try{
   const result=await request('checkout',{requestKey:current.requestKey,acceptTerms:true,amountCents:4990,currency:'BRL',termsVersion:current.termsVersion});
   if(ticket!==epoch.current)return;
   const next=acceptOrder(result,current);
   if(next.state==='awaiting_payment'||next.state==='paid_pending_access'){
    try{await statusFor(next);}catch(e){if(ticket===epoch.current&&e.name!=='AbortError'){remember(preserveUniversityAttempt(next,e.universityBody));setError('O pedido foi preservado. '+e.message);}}
   }
  }catch(e){if(ticket===epoch.current&&e.name!=='AbortError'){remember(preserveUniversityAttempt(current,e.universityBody));setError('Confira esta mesma solicitação antes de iniciar outra. '+e.message);}}
 }
 async function confirm(){
  if(busyRef.current||!canPurchase||!consent||attemptRef.current)return;
  const next={...UNIVERSITY_MONTHLY,requestKey:crypto.randomUUID(),orderId:null,status:null,state:'order_unconfirmed',retrySameOrder:true,checkoutUrl:null,pixCode:null,pixExpiresAt:null,access:null};
  if(!remember(next,{required:true}))return;
  busyRef.current=true;setBusy('checkout');setError('');const ticket=epoch.current;
  try{await checkout(next);}finally{if(ticket===epoch.current){busyRef.current=false;setBusy('');}}
 }
 async function recover(){
  const current=attemptRef.current;
  if(busyRef.current||!current?.retrySameOrder||!offer?.available||included||scheduled)return;
  busyRef.current=true;setBusy('checkout');setError('');const ticket=epoch.current;
  try{await checkout(current);}finally{if(ticket===epoch.current){busyRef.current=false;setBusy('');}}
 }
 async function refreshOrder(){
  const current=attemptRef.current;
  if(busyRef.current||!current?.orderId)return;
  busyRef.current=true;setBusy('status');setError('');const ticket=epoch.current;
  try{await statusFor(current);}catch(e){if(ticket===epoch.current&&e.name!=='AbortError'){remember(preserveUniversityAttempt(current,e.universityBody));setError(e.message+' Acompanhe este pedido antes de iniciar outro.');}}
  finally{if(ticket===epoch.current){busyRef.current=false;setBusy('');}}
 }
 function reset(){
  if(busyRef.current||!final)return;
  try{sessionStorage.removeItem(storageKey());}catch{}
  attemptRef.current=null;setAttempt(null);setConsent(false);setError('');setCopied(false);
 }
 async function copyPix(){
  const ticket=epoch.current,code=attemptRef.current?.pixCode;if(!code)return;
  try{await navigator.clipboard.writeText(code);if(ticket===epoch.current)setCopied(true);}catch{if(ticket===epoch.current)setError('Selecione e copie o código no campo Pix Copia e Cola.');}
 }

 return <section className={styles.panel} id="contratar" aria-labelledby="university-account-title">
  <div className={styles.sectionHeading}><div><span className={styles.tag}>SUA UNIVERSIDADE</span><h2 id="university-account-title">{included?'A Universidade já faz parte do seu acesso':access?.active?'Seu acesso aos estudos':'Estude com uma contratação independente'}</h2></div>{account.kind==='ready'&&<button type="button" className={styles.secondary} disabled={Boolean(busy)} onClick={()=>setRefresh(value=>value+1)}>Atualizar meu acesso</button>}</div>
  {account.kind==='checking'?<p role="status">Conferindo sua conta e seu acesso à Universidade…</p>:account.kind==='guest'?<><p>Crie sua conta gratuita na JENIOS ou entre para contratar a Universidade por <strong>R$ 49,90 por mês</strong>. Você não precisa assinar um plano da Platform.</p><div className={styles.actions}><Link className={styles.primary} href="/universidade/entrar">Entrar para contratar</Link><Link className={styles.secondary} href="/universidade/cadastro">Criar minha conta</Link></div></>:account.kind==='unavailable'?<button type="button" className={styles.secondary} onClick={()=>setRefresh(value=>value+1)}>Conferir meu acesso novamente</button>:<>
   {access.active&&<><p className={styles.notice} role="status">{access.kind==='admin-preview'?'Acesso administrativo à Universidade.':included?'A Universidade está incluída no seu plano. Você não precisa contratar a mensalidade separada.':access.kind==='university-monthly'?'Sua Universidade mensal está ativa.':'Seu acesso educacional separado está ativo.'}{access.validUntil?' Vigente até '+universityDate(access.validUntil)+'.':''}</p><div className={styles.actions}><Link className={styles.primary} href="/platform/aprender">Continuar meus estudos →</Link></div></>}
   {scheduled&&!access.active&&<p className={styles.pending} role="status">Você já possui um período pago de {universityDate(scheduled.startsAt)} até {universityDate(scheduled.validUntil)}. A contratação de outro período está bloqueada enquanto este acesso aguarda início ou conferência.</p>}
   {!included&&!access.active&&!scheduled&&<p>Seu acesso será liberado após a confirmação do recebimento. As aulas, avaliações e revisões ficam vinculadas à sua conta.</p>}
   {!included&&<p className={styles.small}>A renovação é feita por Pix, com sua confirmação a cada mês. Para encerrar, basta não renovar: o período já pago continua válido até a data informada. Seu histórico de estudos permanece salvo.</p>}
   {canPurchase&&!attempt&&<div className={styles.purchase}><p className={styles.priceLine}>Universidade JENIOS · R$ 49,90 por mês</p><p>{data.canRenew?'A renovação acrescenta um mês ao término do período já pago. Seus dias restantes são preservados.':'O primeiro período começa após a confirmação do pagamento e dura um mês de calendário.'}</p><p className={styles.small}>Renovação mensal por Pix. Sem débito automático. A mensalidade não inclui créditos Pro.</p><label className={styles.consent}><input type="checkbox" checked={consent} disabled={Boolean(busy)} onChange={event=>setConsent(event.target.checked)}/><span>Confirmo o pagamento de <strong>R$ 49,90</strong> por <strong>um mês de Universidade JENIOS</strong>, com renovação por minha iniciativa e sem créditos de IA Pro incluídos.</span></label><button type="button" className={styles.primary} disabled={!consent||Boolean(busy)} onClick={confirm}>{busy==='checkout'?'Preparando seu pedido…':data.canRenew?'Confirmar renovação e gerar Pix':'Confirmar contratação e gerar Pix'}</button></div>}
   {!included&&!offer.available&&!attempt&&<p className={styles.pending} role="status">A contratação está temporariamente indisponível. O valor mensal aprovado é R$ 49,90. Atualize seu acesso para conferir a disponibilidade.</p>}
   {attempt&&<div className={styles.order}><p className={attempt.state==='active'?styles.notice:styles.pending} role="status">{attempt.state==='active'?'Pagamento confirmado e Universidade liberada.':attempt.state==='scheduled'?'O pagamento deste período está confirmado. Os estudos serão liberados na data inicial informada.':attempt.state==='paid_pending_access'?'O pagamento e a liberação do acesso estão em conferência. Acompanhe o mesmo pedido; não faça outro pagamento.':attempt.state==='not_started'?'A contratação não foi iniciada. Atualize seu acesso e confira as condições antes de tentar novamente.':attempt.state==='closed'?attempt.status==='refunded'?'Este pagamento foi devolvido.':attempt.status==='expired'?'Este pedido expirou.':attempt.status==='paid'?'O período de estudos deste pagamento terminou. Você pode conferir uma nova renovação.':'Este pedido foi encerrado.':attempt.state==='awaiting_payment'?'Aguardando a confirmação do recebimento. Após pagar, confira este mesmo pedido.':attempt.state==='restored'?'Encontramos uma solicitação desta sessão. Confira seu estado antes de contratar novamente.':'A solicitação precisa de conferência. Retome o mesmo pedido; uma nova cobrança não será aberta automaticamente.'}</p>
    <p className={styles.small}>Universidade mensal · R$ 49,90 · pagamento em reais.</p>{attempt.orderId&&<p className={styles.orderReference}>Pedido: {attempt.orderId}</p>}
    {!included&&!scheduled&&attempt.state==='awaiting_payment'&&attempt.pixCode&&Date.parse(attempt.pixExpiresAt)>clock&&<div className={styles.pix}><label htmlFor="university-pix-code">Pix Copia e Cola<textarea id="university-pix-code" value={attempt.pixCode} readOnly onFocus={event=>event.target.select()}/></label><p className={styles.small}>Confira o recebedor e o valor de R$ 49,90 no aplicativo do seu banco. Código válido até {universityDate(attempt.pixExpiresAt)}.</p><button type="button" className={styles.secondary} onClick={copyPix}>{copied?'Código copiado':'Copiar código Pix'}</button></div>}
    {included&&attempt.state!=='active'&&attempt.state!=='closed'&&<p className={styles.small}>Seu plano já inclui a Universidade. Não pague esta solicitação separada. Confira o estado do pedido enquanto utiliza seu acesso incluído.</p>}
    <div className={styles.actions}>{attempt.orderId&&attempt.state!=='active'&&<button type="button" className={styles.secondary} disabled={Boolean(busy)} onClick={refreshOrder}>{busy==='status'?'Conferindo pedido…':attempt.state==='awaiting_payment'?'Já paguei · conferir acesso':'Conferir este pedido'}</button>}{!included&&!scheduled&&attempt.retrySameOrder&&<button type="button" className={styles.secondary} disabled={Boolean(busy)||!offer.available} onClick={recover}>{busy==='checkout'?'Retomando pedido…':'Retomar o mesmo pedido'}</button>}{final&&!included&&attempt.state!=='scheduled'&&<button type="button" className={styles.secondary} disabled={Boolean(busy)} onClick={reset}>{attempt.state==='active'?'Preparar uma nova renovação':'Conferir nova contratação'}</button>}</div>
   </div>}
  </>}
  {error&&<p className={styles.error} role="alert">{error}</p>}
 </section>;
}
