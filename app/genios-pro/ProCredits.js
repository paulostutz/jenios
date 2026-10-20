'use client';
import {useEffect,useRef,useState} from 'react';
import {formatNanoUsd,formatProDate} from './pro-client.mjs';
import {creditOfferReady,formatBrlCents,formatFxMicros,validCreditQuote,validCreditAttempt,projectCreditCheckout,projectCreditStatus,preserveCreditAttempt} from './credits-client.mjs';
import styles from './pro.module.css';
import credits from './credits.module.css';

export default function ProCredits({userId,offer,request,onCredited}){
 const [quote,setQuote]=useState(null),[consent,setConsent]=useState(false),[attempt,setAttempt]=useState(null);
 const [busy,setBusy]=useState(''),[error,setError]=useState(''),[copied,setCopied]=useState(false),[clock,setClock]=useState(Date.now()),[salesBlocked,setSalesBlocked]=useState(false);
 const live=useRef(true),busyRef=useRef(false),quoteKey=useRef(null),attemptRef=useRef(null);
 const storageKey=userId?'jenios:pro:credits:'+userId:null;
 const enabled=Boolean(userId&&creditOfferReady(offer)&&!salesBlocked),activeQuote=attempt?.quote||quote;
 const quoteReady=validCreditQuote(quote,{offer,now:clock});
 const final=attempt&&['credited','closed'].includes(attempt.state);

 useEffect(()=>{
  live.current=true;
  if(storageKey){try{
   const saved=JSON.parse(sessionStorage.getItem(storageKey)||'null');
   if(validCreditAttempt(saved)){
    const restored={requestKey:saved.requestKey,quote:saved.quote,orderId:saved.orderId,state:'restored',status:null,retrySameOrder:!saved.orderId,checkoutUrl:null,pixCode:null,pixExpiresAt:null};
    attemptRef.current=restored;setAttempt(restored);
   }else if(saved)sessionStorage.removeItem(storageKey);
  }catch{}}
  return()=>{live.current=false;};
 },[storageKey]);
 useEffect(()=>{setSalesBlocked(false);},[offer]);
 useEffect(()=>{
  if(!activeQuote)return;
  setClock(Date.now());const timer=setInterval(()=>setClock(Date.now()),1000);return()=>clearInterval(timer);
 },[activeQuote]);

 function remember(next,{required=false}={}){
  if(!live.current)return false;
  try{if(storageKey)sessionStorage.setItem(storageKey,JSON.stringify({requestKey:next.requestKey,quote:next.quote,orderId:next.orderId}));}
  catch{if(required){setError('Não foi possível guardar a referência deste pedido no navegador. Nenhum pedido foi enviado.');return false;}}
  attemptRef.current=next;setAttempt(next);setCopied(false);return true;
 }
 function report(message){if(live.current)setError(message);}
 async function getQuote(){
  if(busyRef.current||!enabled||attemptRef.current)return;
  busyRef.current=true;setBusy('quote');setError('');setConsent(false);
  if(!quoteKey.current||quote&&Date.parse(quote.expiresAt)<=Date.now())quoteKey.current=crypto.randomUUID();
  try{
   const result=await request('quote',{requestKey:quoteKey.current});
   if(!live.current)return;
   if(result?.ok!==true||!validCreditQuote(result?.quote,{offer}))throw Error('Não foi possível conferir os valores desta cotação. Nenhum pedido foi aberto.');
   setClock(Date.now());setQuote(result.quote);
  }catch(e){if(live.current&&e.name!=='AbortError'){
   if(e.proBody?.code==='QUOTE_EXPIRED'){quoteKey.current=null;setQuote(null);}
   if(e.proBody?.code==='PRO_PAYMENTS_DISABLED')setSalesBlocked(true);
   setError(e.message);
  }}finally{if(live.current){busyRef.current=false;setBusy('');}}
 }
 async function statusFor(current){
  let result;
  try{result=await request('status?orderId='+encodeURIComponent(current.orderId));}
  catch(e){if(e.proBody?.state==='paid_pending_credit')result=e.proBody;else throw e;}
  if(!live.current)return;
  const next=projectCreditStatus(result,current);
  if(!next)throw Error('Não foi possível confirmar o estado deste pedido. Consulte o mesmo pedido novamente.');
  remember(next);
  if(next.state==='credited')await onCredited?.();
 }
 async function checkout(current){
  try{
   const result=await request('checkout',{quoteId:current.quote.id,requestKey:current.requestKey,acceptTerms:true,amountCents:current.quote.amountCents,currency:'BRL',termsVersion:current.quote.termsVersion});
   if(!live.current)return;
   const next=projectCreditCheckout(result,current);
   if(!next)throw Error('O pedido ainda precisa de conferência. Retome a mesma solicitação.');
   remember(next);
   if(next.state!=='closed'){
    try{await statusFor(next);}catch(e){if(live.current&&e.name!=='AbortError'){remember(preserveCreditAttempt(next,e.proBody));if(e.proBody?.code==='PRO_PAYMENTS_DISABLED')setSalesBlocked(true);report('O pedido foi preservado. '+e.message);}}
   }
  }catch(e){if(live.current&&e.name!=='AbortError'){
   const next=preserveCreditAttempt(current,e.proBody);remember(next);
   if(e.proBody?.code==='PRO_PAYMENTS_DISABLED')setSalesBlocked(true);
   report(next.state==='closed'?'A solicitação foi encerrada. Você pode conferir uma nova cotação.':next.state==='reference_conflict'?'Esta referência já pertence a outro pedido. Confira o pedido original antes de continuar.':'Não foi possível confirmar o pagamento. Retome este mesmo pedido; não abra outro. '+e.message);
  }}
 }
 async function confirm(){
  if(busyRef.current||!enabled||attemptRef.current||!consent||!validCreditQuote(quote,{offer}))return;
  const next={requestKey:crypto.randomUUID(),quote,orderId:null,state:'order_unconfirmed',status:null,retrySameOrder:true,checkoutUrl:null,pixCode:null,pixExpiresAt:null};
  if(!remember(next,{required:true}))return;
  busyRef.current=true;setBusy('checkout');setError('');
  try{await checkout(next);}finally{if(live.current){busyRef.current=false;setBusy('');}}
 }
 async function recover(){
  const current=attemptRef.current;
  if(busyRef.current||!enabled||!current||!current.retrySameOrder)return;
  busyRef.current=true;setBusy('checkout');setError('');
  try{await checkout(current);}finally{if(live.current){busyRef.current=false;setBusy('');}}
 }
 async function refreshOrder(){
  const current=attemptRef.current;
  if(busyRef.current||!enabled||!current?.orderId)return;
  busyRef.current=true;setBusy('status');setError('');
  try{await statusFor(current);}catch(e){if(live.current&&e.name!=='AbortError'){
   remember(preserveCreditAttempt(current,e.proBody));
   if(e.proBody?.code==='PRO_PAYMENTS_DISABLED')setSalesBlocked(true);
   report(e.message+' Continue acompanhando este pedido antes de iniciar outro.');
  }}finally{if(live.current){busyRef.current=false;setBusy('');}}
 }
 function reset(){
  if(busyRef.current||!final)return;
  try{if(storageKey)sessionStorage.removeItem(storageKey);}catch{}
  attemptRef.current=null;quoteKey.current=null;setAttempt(null);setQuote(null);setConsent(false);setError('');setCopied(false);
 }
 async function copyPix(){
  const code=attemptRef.current?.pixCode;if(!code)return;
  try{await navigator.clipboard.writeText(code);if(live.current)setCopied(true);}catch{report('Selecione e copie o código no campo Pix Copia e Cola.');}
 }

 return <section className={styles.panel} aria-labelledby="pro-credits-title">
  <div className={styles.sectionHeading}><div><h2 id="pro-credits-title">Créditos JENIOS Pro</h2><p>Seu consumo corresponde a <strong>duas vezes o custo efetivo da API</strong>, preservando frações de centavo. Créditos comprados e franquia do plano são acompanhados separadamente.</p></div>{!attempt&&<button type="button" className={styles.secondary} disabled={!enabled||Boolean(busy)} onClick={getQuote}>{busy==='quote'?'Conferindo valor…':quote?'Atualizar cotação':'Comprar créditos'}</button>}</div>
  {!enabled&&<p className={styles.small}><strong>{userId?'Contratação ainda não habilitada.':'Entre na sua conta para consultar os créditos Pro.'}</strong> O valor e a moeda do pacote serão confirmados e exibidos antes de qualquer pagamento. {attempt?'A referência do seu pedido foi preservada; sua conferência será retomada quando o serviço estiver disponível.':''}</p>}
  {enabled&&!activeQuote&&<p className={styles.small}>Confira a cotação antes de confirmar a compra. Consultar o valor não abre um pedido de pagamento.</p>}
  {activeQuote&&<div className={credits.quote}>
   <h3>{attempt?'Valores do seu pedido':'Confira a compra de créditos'}</h3>
   <dl className={styles.amounts}><div><dt>Pagamento em reais</dt><dd>{formatBrlCents(activeQuote.amountCents)}</dd></div><div><dt>Créditos Pro a receber</dt><dd>{formatNanoUsd(activeQuote.retailNanoUsd)}</dd></div><div><dt>Câmbio aplicado a US$ 1,00</dt><dd>{formatFxMicros(activeQuote.fxBrlMicrosPerUsd)}</dd></div></dl>
   <p className={styles.small}>Câmbio: PTAX de venda do Banco Central, fechamento de {formatProDate(activeQuote.rateAt)} (horário local). Condições desta cotação: {activeQuote.termsVersion}.</p>
   {!attempt&&<>
    <p className={styles.small}>{quoteReady?'Cotação válida até '+formatProDate(activeQuote.expiresAt)+'.':'A cotação venceu. Atualize o valor antes de confirmar.'} Os créditos serão adicionados após a confirmação do recebimento.</p>
    <label className={styles.consent}><input type="checkbox" checked={consent} disabled={!enabled||!quoteReady||Boolean(busy)} onChange={e=>setConsent(e.target.checked)}/><span>Confirmo o pagamento de <strong>{formatBrlCents(activeQuote.amountCents)}</strong> para receber <strong>{formatNanoUsd(activeQuote.retailNanoUsd)}</strong> em créditos Pro, pelo câmbio e pelas condições exibidas.</span></label>
    <button type="button" className={styles.primary} disabled={!enabled||!quoteReady||!consent||Boolean(busy)} onClick={confirm}>{busy==='checkout'?'Preparando seu pedido…':'Confirmar compra e gerar Pix'}</button>
   </>}
  </div>}
  {attempt&&<div className={credits.order}>
   <p role="status" className={attempt.state==='credited'?styles.notice:styles.pendingNotice}>{attempt.state==='credited'?'Recebimento e créditos Pro confirmados.':attempt.state==='paid_pending_credit'?'O pagamento e a liberação dos créditos estão em conferência. Acompanhe este mesmo pedido, sem fazer outro pagamento.':attempt.state==='closed'?attempt.code==='QUOTE_EXPIRED'?'A cotação venceu antes da abertura do pedido.':attempt.status==='refunded'?'Este pagamento foi devolvido.':attempt.status==='expired'?'Este pedido expirou.':'Este pedido foi encerrado.':attempt.state==='reference_conflict'?'A referência informada pertence a outro pedido. Confira o pedido original antes de continuar.':attempt.state==='awaiting_payment'?'Aguardando confirmação do recebimento. Acompanhe este mesmo pedido após o pagamento.':attempt.state==='restored'?'Encontramos a referência de um pedido desta sessão. Confira seu estado antes de iniciar outra compra.':'Este pedido precisa de conferência. Retome a mesma solicitação; nenhum novo pedido será aberto automaticamente.'}</p>
   {attempt.orderId&&<p className={styles.small}>Pedido: {attempt.orderId}</p>}
   {enabled&&attempt.state==='awaiting_payment'&&attempt.pixCode&&Date.parse(attempt.pixExpiresAt)>clock&&<div className={credits.pix}>
    <label htmlFor="pro-credit-pix">Pix Copia e Cola<textarea id="pro-credit-pix" readOnly value={attempt.pixCode} onFocus={e=>e.target.select()}/></label>
    <p className={styles.small}>Confira o recebedor e o valor no aplicativo do seu banco. Código válido até {formatProDate(attempt.pixExpiresAt)}.</p>
    <button type="button" className={styles.secondary} onClick={copyPix}>{copied?'Código copiado':'Copiar código Pix'}</button>
   </div>}
   <div className={styles.actions}>
    {attempt.orderId&&attempt.state!=='credited'&&<button type="button" className={styles.secondary} disabled={!enabled||Boolean(busy)} onClick={refreshOrder}>{busy==='status'?'Conferindo pedido…':attempt.state==='awaiting_payment'?'Já paguei · conferir pedido':'Conferir este pedido'}</button>}
    {attempt.retrySameOrder&&<button type="button" className={styles.secondary} disabled={!enabled||Boolean(busy)} onClick={recover}>{busy==='checkout'?'Retomando pedido…':'Retomar o mesmo pedido'}</button>}
    {attempt.state==='awaiting_payment'&&attempt.checkoutUrl&&enabled&&<a className={styles.secondary} href={attempt.checkoutUrl} target="_blank" rel="noopener noreferrer">Abrir página de pagamento</a>}
    {final&&<button type="button" className={styles.secondary} disabled={!enabled||Boolean(busy)} onClick={reset}>Iniciar outra compra</button>}
   </div>
  </div>}
  {error&&<p role="alert" className={styles.error}>{error}</p>}
 </section>;
}
