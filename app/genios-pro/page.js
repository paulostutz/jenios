'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {supabase} from '../../lib/supabase';
import {PERSONAS} from '../../lib/assistant/contracts.mjs';

import {PRO_UI_TASKS,PRO_PLAN_LABELS,PRO_TIMEFRAME_LABELS,formatNanoUsd,formatProDate,
 verifiedWallet,verifiedAllowance,taskAvailability,validQuote,requestStateLabel,fileProblem,canPrepareQuote,unresolvedRequest,initialProTask} from './pro-client.mjs';
import styles from './pro.module.css';
import useAssistantConversation from '../components/assistant/useAssistantConversation';
import ConversationControls,{AnswerFeedback} from '../components/assistant/ConversationControls';
import {lessonFromSearch,mergeConversationTurns,settledTurn} from '../components/assistant/conversation-client.mjs';

function BalanceRows({rows}){return <dl className={styles.amounts}>{rows.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{formatNanoUsd(value)}</dd></div>)}</dl>;}
function VerifiedSource({source}){
 if(!source||typeof source.provider!=='string'||typeof source.symbol!=='string'||!Number.isFinite(Date.parse(source.sourceAt)))return null;
 return <p className={styles.source}>Fonte: {source.provider} · {source.symbol}{PRO_TIMEFRAME_LABELS[source.timeframe]?' · '+PRO_TIMEFRAME_LABELS[source.timeframe]:''}. Último candle encerrado em {formatProDate(source.sourceAt)} (horário local).</p>;
}
function History({state,status,error,items,hasMore,onRefresh,busy,refreshing,hasPending}){
 return <section className={styles.panel} aria-labelledby="pro-history-title">
  <div className={styles.sectionHeading}><div><h2 id="pro-history-title">Seu histórico de consumo</h2><p>Até 50 consultas mais recentes desta conta, da mais nova para a mais antiga.</p></div><button type="button" className={styles.secondary} onClick={onRefresh} disabled={busy}>Atualizar histórico e conversa</button></div>
  {refreshing&&<p role="status">Atualizando os registros do consumo e da conversa…</p>}
  {hasPending&&<p className={styles.pendingNotice}>Existe uma consulta em conferência. Atualize para acompanhar o resultado; ela não será reenviada automaticamente.</p>}
  {state==='loading'?<p role="status">Conferindo seu histórico…</p>:error?<p role="alert" className={styles.error}>{error} Use “Atualizar histórico e conversa” para conferir novamente.</p>:status==='not_provisioned'?<p className={styles.empty}>O histórico Pro ainda não está disponível nesta conta. Nenhum valor foi confirmado por esta consulta.</p>:!items.length?<p className={styles.empty}>Nenhuma consulta Pro registrada nesta conta.</p>:<><ol className={styles.history} aria-label="Consultas Pro registradas">{items.map((item,index)=>{
   const task=PRO_UI_TASKS.find(t=>t.id===item.task),persona=PERSONAS.find(p=>p.id===item.persona);
   const final=['settled','released'].includes(item.state);
   return <li key={item.id||item.requestKey||index}>
    <div><strong>{task?.label||'Consulta Pro'}</strong><small>{formatProDate(item.createdAt)}{persona?' · '+persona.name+' Pro':''}</small><span>{item.source==='included'?'Franquia do plano':item.source==='prepaid'?'Créditos adquiridos anteriormente':'Origem a verificar'}</span></div>
    <div className={styles.historyAmount}><span className={final?styles.status:styles.pending}>{requestStateLabel(item.state)}</span><strong>{!final||item.chargedNanoUsd===null||item.chargedNanoUsd===undefined?'Valor a confirmar':formatNanoUsd(item.chargedNanoUsd)}</strong></div>
    {item.state==='settled'&&typeof item.answer==='string'&&item.answer&&<details className={styles.historyDetail}><summary>Ver resposta</summary><div className={styles.answer}>{item.answer}</div><VerifiedSource source={item.sourceInfo}/></details>}
   </li>;
  })}</ol><p className={styles.small}>Valores em US$ conforme o registro de consumo. O uso da franquia do plano não representa uma compra adicional.</p>{hasMore&&<p className={styles.historyLimit} role="status">Existem consultas anteriores. Este extrato exibe somente as 50 mais recentes.</p>}</>}
  <p className={styles.small}>O histórico mostra somente a sua conta. As imagens não são armazenadas neste extrato.</p>
 </section>;
}

export default function GeniosPro(){
 const memory=useAssistantConversation('pro');
 const [lessonId,setLessonId]=useState(null),[memorySyncPending,setMemorySyncPending]=useState(false);
 const sendAbort=useRef(null),answersRef=useRef(null),conversationRef=useRef(null);
 const [account,setAccount]=useState({kind:'checking'}),[refresh,setRefresh]=useState(0),[error,setError]=useState('');
 const [history,setHistory]=useState({kind:'loading',status:null,items:[],hasMore:false,error:''}),[busy,setBusy]=useState('');
 const [persona,setPersona]=useState('genio'),[taskId,setTaskId]=useState('advanced_question'),[prompt,setPrompt]=useState('');
 const [source,setSource]=useState('included'),[symbol,setSymbol]=useState(''),[timeframe,setTimeframe]=useState('');
 const [attachment,setAttachment]=useState(null),[imageReading,setImageReading]=useState(false);
 const [quote,setQuote]=useState(null),[consent,setConsent]=useState(false),[clock,setClock]=useState(Date.now());
 const [pendingKey,setPendingKey]=useState(null),[notice,setNotice]=useState(''),[answers,setAnswers]=useState([]);
 const epoch=useRef(0),owner=useRef(null),controller=useRef(null),busyRef=useRef(false),imageEpoch=useRef(0),fileInput=useRef(null),previewRef=useRef(null);
 const data=account.data||{},wallet=verifiedWallet(data.wallet),allowance=verifiedAllowance(data.allowance),task=taskAvailability(data,taskId);
 const hasPending=Boolean(pendingKey||data.pendingRequests>0||history.items.some(item=>unresolvedRequest(item.state)));
 const locked=Boolean(busy||imageReading||hasPending||account.kind==='ready'&&(history.kind==='loading'||history.error||(!data.proIncluded&&!data.masterPreview)));
 const symbols=Array.isArray(data.marketSymbols)?data.marketSymbols.filter(s=>typeof s==='string'):[];
 const timeframes=Array.isArray(data.marketTimeframes)?data.marketTimeframes.filter(t=>Object.hasOwn(PRO_TIMEFRAME_LABELS,t)):[];
 const selectedPersona=PERSONAS.find(p=>p.id===persona)||PERSONAS[0];
 const quoteCurrent=validQuote(quote,source,clock);
 const canPrepare=account.kind==='ready'&&!memorySyncPending&&!['loading','error'].includes(memory.status)&&canPrepareQuote({data,taskId,source,prompt,image:attachment,hasPending,locked})&&
  (!task?.requiresCurrentData||(symbols.includes(symbol)&&timeframes.includes(timeframe)));
 const canSend=account.kind==='ready'&&quoteCurrent&&consent&&canPrepare;

 function clearImage(){imageEpoch.current++;setImageReading(false);if(previewRef.current)URL.revokeObjectURL(previewRef.current);previewRef.current=null;setAttachment(null);if(fileInput.current)fileInput.current.value='';}
 function invalidateQuote(){setQuote(null);setConsent(false);setError('');setNotice('');}
 function clearPrivateState(){
  clearImage();setPrompt('');setQuote(null);setConsent(false);setMemorySyncPending(false);setPendingKey(null);setAnswers([]);setNotice('');setError('');
  setHistory({kind:'loading',status:null,items:[],hasMore:false,error:''});setLessonId(lessonFromSearch(typeof window==='undefined'?'':window.location.search));setTaskId(initialProTask(typeof window==='undefined'?'':window.location.search));setSymbol('');setTimeframe('');setSource('included');
 }
 async function sessionFor(expectedOwner){
  const result=await supabase?.auth.getSession(),session=result?.data?.session;
  if(result?.error||!session?.access_token||session.user?.is_anonymous||session.user?.id!==expectedOwner)throw Error('Sua sessão mudou. Entre novamente para continuar.');
  return session;
 }
 async function api(path,token,{body,signal}={}){
  const timeout=new AbortController(),forward=()=>timeout.abort(signal.reason);
  const timer=setTimeout(()=>timeout.abort(new DOMException('Tempo de espera esgotado.','TimeoutError')),path==='chat'?65000:20000);
  if(signal?.aborted)forward();else signal?.addEventListener('abort',forward,{once:true});
  try{
   const response=await fetch('/api/assistant/pro/'+path,{method:body?'POST':'GET',cache:'no-store',signal:timeout.signal,
    headers:{authorization:'Bearer '+token,...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
   let value;try{value=await response.json();}catch{throw Error('O serviço não confirmou a resposta. Atualize o status antes de tentar novamente.');}
   if(!response.ok||value?.ok===false)throw Object.assign(Error(typeof value?.error==='string'?value.error:'Não foi possível concluir esta solicitação.'),{proState:value?.state,requestId:value?.requestId,status:response.status,proBody:value});
   return value;
  }catch(error){if(timeout.signal.aborted)throw timeout.signal.reason||error;throw error;}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',forward);}
 }

 async function requestCredits(path,body){
  const ticket=epoch.current,expectedOwner=owner.current,session=await sessionFor(expectedOwner);
  if(ticket!==epoch.current)throw new DOMException('Sua sessão mudou.','AbortError');
  const result=await api('credits/'+path,session.access_token,{body,signal:controller.current.signal});
  if(ticket!==epoch.current)throw new DOMException('Sua sessão mudou.','AbortError');
  return result;
 }
 function confirmedHistory(value){
  if(!Array.isArray(value?.items)||value.items.length>50||value.items.some(item=>!item||typeof item!=='object'||Array.isArray(item))||
   value.hasMore!=null&&typeof value.hasMore!=='boolean'||value.status==='not_provisioned'&&(value.items.length||value.hasMore))throw Error('Não foi possível confirmar seu histórico. Atualize antes de continuar.');
  return {kind:'ready',status:value.status||null,items:value.items,hasMore:value.hasMore===true,error:''};
 }
 function acceptAccess(value){
  setAccount({kind:'ready',data:value});
  const availableSymbols=Array.isArray(value.marketSymbols)?value.marketSymbols:[],availableTimeframes=Array.isArray(value.marketTimeframes)?value.marketTimeframes:[];
  setSymbol(old=>availableSymbols.includes(old)?old:availableSymbols[0]||'');
  setTimeframe(old=>availableTimeframes.includes(old)?old:availableTimeframes.includes('1h')?'1h':availableTimeframes[0]||'');
 }
 useEffect(()=>{
  let live=true;const ticket=++epoch.current;controller.current?.abort();controller.current=new AbortController();owner.current=null;busyRef.current=false;setBusy('');setAccount({kind:'checking'});clearPrivateState();
  async function load(){try{
   const result=await supabase?.auth.getSession(),session=result?.data?.session;
   if(!live||ticket!==epoch.current)return;
   if(result?.error)throw Error('Não foi possível verificar sua sessão. Tente novamente.');
   if(!session?.access_token||session.user?.is_anonymous){setAccount({kind:'guest'});return;}
   owner.current=session.user.id;
   const value=await api('access',session.access_token,{signal:controller.current.signal});
   if(!live||ticket!==epoch.current)return;
   acceptAccess(value);
   setSource('included');
   try{
    const ledger=await api('history',session.access_token,{signal:controller.current.signal});
    if(live&&ticket===epoch.current)setHistory(confirmedHistory(ledger));
   }catch(e){if(live&&ticket===epoch.current&&e.name!=='AbortError')setHistory({kind:'ready',status:null,items:[],hasMore:false,error:e.message});}
  }catch(e){if(live&&ticket===epoch.current&&e.name!=='AbortError'){setAccount({kind:'unavailable'});setError(e.message);}}}
  void load();
  const auth=supabase?.auth.onAuthStateChange((event,session)=>{
   if(event==='INITIAL_SESSION'||session?.user?.id===owner.current&&['SIGNED_IN','TOKEN_REFRESHED','USER_UPDATED'].includes(event))return;
   epoch.current++;controller.current?.abort();sendAbort.current?.abort();owner.current=null;setAccount({kind:'checking'});clearPrivateState();
   setTimeout(()=>{if(live)setRefresh(n=>n+1);},0);
  });
  return()=>{live=false;epoch.current++;controller.current?.abort();sendAbort.current?.abort();imageEpoch.current++;if(previewRef.current)URL.revokeObjectURL(previewRef.current);auth?.data?.subscription?.unsubscribe();};
 },[refresh]);
 useEffect(()=>{if(!quote)return;setClock(Date.now());const timer=setInterval(()=>setClock(Date.now()),1000);return()=>clearInterval(timer);},[quote]);
 useEffect(()=>{setPersona(memory.persona);setQuote(null);setConsent(false);},[memory.persona]);
 useEffect(()=>{
  const id=memory.conversation?.id||null,previous=conversationRef.current;
  if(previous&&previous!==id){sendAbort.current?.abort();clearImage();setAnswers([]);setPrompt('');setQuote(null);setConsent(false);}
  conversationRef.current=id;
 },[memory.conversation?.id]);
 useEffect(()=>{setQuote(null);setConsent(false);setMemorySyncPending(false);},[memory.conversation?.revision]);
 useEffect(()=>{if(answers.length)answersRef.current?.scrollIntoView({block:'nearest',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});},[answers.length]);
 const visibleAnswers=mergeConversationTurns(memory.conversation,answers.map(row=>({...row,turnId:row.id})));
 async function choosePersona(value){if(locked)return;await memory.choosePersona(value);invalidateQuote();}


 async function refreshLedger(){
  if(busyRef.current||!owner.current)return;busyRef.current=true;setBusy('refresh');const ticket=epoch.current,expectedOwner=owner.current;
  try{
   const session=await sessionFor(expectedOwner);if(ticket!==epoch.current)return;
   const [accessResult,historyResult]=await Promise.allSettled([
    api('access',session.access_token,{signal:controller.current.signal}),api('history',session.access_token,{signal:controller.current.signal}),memory.reload()
   ]);
   if(ticket!==epoch.current)return;
   if(accessResult.status==='fulfilled')acceptAccess(accessResult.value);
   else{setError(accessResult.reason.message);setAccount(old=>({...old,data:{...old.data,paidGenerationEnabled:false,readinessMessage:'Atualize o histórico para confirmar seu acesso antes de continuar.'}}));}
   if(historyResult.status==='fulfilled'){
    const nextHistory=confirmedHistory(historyResult.value),items=nextHistory.items;setHistory(nextHistory);
    const completed=pendingKey&&items.find(item=>item.requestKey===pendingKey&&['settled','released'].includes(item.state));
    if(completed){setPendingKey(null);setNotice(completed.state==='settled'?'O consumo desta consulta foi confirmado no histórico.':'A reserva desta consulta foi liberada. Você pode solicitar uma nova estimativa.');setError('');}
   }else setHistory(old=>({...old,kind:'ready',error:historyResult.reason.message}));
  }catch(e){if(ticket===epoch.current&&e.name!=='AbortError'){setError(e.message);setHistory(old=>({...old,kind:'ready',error:'Não foi possível confirmar o histórico. Atualize antes de continuar.'}));}}
  finally{if(ticket===epoch.current){busyRef.current=false;setBusy('');}}
 }
 async function chooseImage(event){
  const file=event.target.files?.[0];if(!file)return;
  invalidateQuote();clearImage();const problem=fileProblem(file);if(problem){setError(problem);return;}
  const ticket=epoch.current,imageTicket=++imageEpoch.current;setImageReading(true);const preview=URL.createObjectURL(file);
  try{
   const dimensions=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve({width:img.naturalWidth,height:img.naturalHeight});img.onerror=()=>reject(Error('Não foi possível abrir esta imagem.'));img.src=preview;});
   if(dimensions.width<64||dimensions.height<64||dimensions.width>4096||dimensions.height>4096)throw Error('Use uma imagem entre 64 e 4.096 pixels de largura e altura.');
   const dataUrl=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(Error('Não foi possível ler a imagem.'));reader.readAsDataURL(file);});
   if(ticket!==epoch.current||imageTicket!==imageEpoch.current){URL.revokeObjectURL(preview);return;}
   const base64=dataUrl.split(',')[1];if(!base64)throw Error('Imagem inválida. Escolha outro arquivo.');
   previewRef.current=preview;setAttachment({name:file.name,preview,mime:file.type,base64,...dimensions});
  }catch(e){URL.revokeObjectURL(preview);if(ticket===epoch.current&&imageTicket===imageEpoch.current)setError(e.message);}
  finally{if(ticket===epoch.current&&imageTicket===imageEpoch.current)setImageReading(false);}
 }
 function draft(){const conversation=memory.current();return {persona,task:taskId,prompt:prompt.trim(),source,
  ...(conversation?{conversationId:conversation.id,conversationRevision:conversation.revision}:{}),
  ...(taskId==='university_tutor'&&lessonId?{lessonId}:{}),
  ...(task?.requiresCurrentData?{symbol,timeframe}:{}),...(attachment?{image:{mime:attachment.mime,base64:attachment.base64}}:{})};}
 async function prepare(event){
  event.preventDefault();if(busyRef.current||!canPrepare)return;busyRef.current=true;setBusy('quote');setError('');setNotice('');setQuote(null);setConsent(false);const ticket=epoch.current,expectedOwner=owner.current;
  try{
   const session=await sessionFor(expectedOwner);if(ticket!==epoch.current)return;
   await memory.ensure();if(ticket!==epoch.current)return;
   const result=await api('quote',session.access_token,{body:draft(),signal:controller.current.signal});
   if(ticket!==epoch.current)return;
   if(!validQuote(result.quote,source))throw Error('A estimativa não pôde ser confirmada. Solicite uma nova estimativa.');
   setClock(Date.now());setQuote(result.quote);
  }catch(e){if(ticket===epoch.current&&e.name!=='AbortError')setError(e.message);}
  finally{if(ticket===epoch.current){busyRef.current=false;setBusy('');}}
 }
 async function send(){
  if(busyRef.current||!canSend)return;busyRef.current=true;setBusy('chat');setError('');setNotice('');const ticket=epoch.current,expectedOwner=owner.current,key=crypto.randomUUID(),input=draft();let submitted=false;
  try{
   const session=await sessionFor(expectedOwner);if(ticket!==epoch.current)return;
   submitted=true;setPendingKey(key);sendAbort.current=new AbortController();
   setAnswers(old=>[...old,{id:key,persona,question:input.prompt,answer:'',status:'pending'}]);
   const result=await api('chat',session.access_token,{body:{...input,requestKey:key,quoteId:quote.id,consent:true,maxRetailNanoUsd:quote.maxRetailNanoUsd},signal:sendAbort.current.signal});
   if(ticket!==epoch.current)return;
   if(result.state==='settled'){
    setPendingKey(null);setAnswers(old=>old.map(row=>row.id===key?{...row,answer:typeof result.answer==='string'?result.answer:'A consulta foi concluída. Confira o histórico.',status:'completed',sourceInfo:result.sourceInfo}:row));
    if(result.conversation)memory.adopt(result.conversation);
    setMemorySyncPending(result.conversationSyncPending===true&&!result.conversation);
    setPrompt('');setNotice(result.conversationSyncPending?'A resposta foi concluída. A sincronização da memória está pendente; atualize a conversa, sem reenviar a geração.':'Consulta concluída. Você pode continuar sobre o mesmo assunto.');
   }else if(['released','not_started'].includes(result.state)){setPendingKey(null);setAnswers(old=>old.map(row=>row.id===key?{...row,status:'not_started',notice:'A geração não foi iniciada ou a reserva foi liberada.'}:row));setNotice('Esta consulta não gerou consumo confirmado. Você pode preparar uma nova consulta.');}
   else setNotice('Estamos conferindo o consumo desta solicitação. Atualize o histórico antes de iniciar outra consulta.');
  }catch(e){
   if(ticket===epoch.current){
    if(!submitted||['released','not_started'].includes(e.proState))setPendingKey(null);
    const interrupted=e.name==='AbortError'||e.name==='TimeoutError';
    const message=submitted&&!['released','not_started'].includes(e.proState)?(interrupted?'A espera foi interrompida. A solicitação pode ser concluída e contabilizada; atualize o histórico antes de uma nova consulta.':'A resposta ainda não foi confirmada. Atualize o histórico antes de uma nova consulta.'):e.message;
    setError(message);setAnswers(old=>old.map(row=>row.id===key?{...row,status:submitted?'unconfirmed':'failed',notice:message}:row));
   }
  }finally{
   if(ticket===epoch.current){setQuote(null);setConsent(false);await refreshAfterSend(ticket,expectedOwner);if(ticket===epoch.current){busyRef.current=false;setBusy('');}}
  }
 }
 async function refreshAfterSend(ticket,expectedOwner){
  try{
   const session=await sessionFor(expectedOwner);if(ticket!==epoch.current)return;
   const results=await Promise.allSettled([api('access',session.access_token,{signal:controller.current.signal}),api('history',session.access_token,{signal:controller.current.signal})]);
   if(ticket!==epoch.current)return;
   if(results[0].status==='fulfilled')acceptAccess(results[0].value);
   else setAccount(old=>({...old,data:{...old.data,paidGenerationEnabled:false,readinessMessage:'Atualize o histórico para confirmar seu saldo antes de continuar.'}}));
   if(results[1].status==='fulfilled')setHistory(confirmedHistory(results[1].value));
   else setHistory(old=>({...old,error:'Não foi possível atualizar o histórico. Consulte novamente antes de continuar.'}));
  }catch{if(ticket===epoch.current)setHistory(old=>({...old,error:'Não foi possível atualizar o histórico. Consulte novamente antes de continuar.'}));}
 }

 return <main className={styles.page} data-jenios-pro="b145"><div className={styles.wrap}>
  <header className={styles.header}><div className={styles.topLinks}><Link href="/social">← JENIOS Social</Link><Link href="/social">Atendimento gratuito →</Link></div>
   <div className={styles.tag}>JENIOS · INTELIGÊNCIA AVANÇADA</div><h1>Gênio Pro e Gênia Pro</h1><p>Estude gráficos e contextos de mercado com apoio avançado, incluído nos planos de R$ 149,90 e R$ 199,90. Sem venda de créditos individuais.</p>
  </header>
  <section className={styles.panel} aria-label="Sua conta Pro">
   {account.kind==='checking'?<p role="status">Verificando sua conta…</p>:account.kind==='guest'?<div className={styles.sectionHeading}><div><h2>Entre para acessar o Pro</h2><p>Gênio e Gênia gratuitos continuam disponíveis na Social, sem cadastro. Sua conta permite verificar a Universidade, a franquia e os créditos Pro.</p></div><Link className={styles.primary} href="/login">Entrar na JENIOS</Link></div>:account.kind==='unavailable'?<><p role="alert" className={styles.error}>{error}</p><button type="button" className={styles.secondary} onClick={()=>setRefresh(n=>n+1)}>Verificar minha conta novamente</button></>:<>
    <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>SUA CONTA</span><h2>{data.masterPreview?'Administrador JENIOS':PRO_PLAN_LABELS[data.planCode]||'Acesso sem assinatura'}</h2><p>{['purchased-pass','university-monthly'].includes(data.universityAccessKind)?'Universidade contratada separadamente e ativa.':data.universityIncluded?'Universidade incluída no seu plano.':'Universidade disponível separadamente por R$ 49,90 mensais.'} {data.proIncluded?'O suporte avançado integra o plano ativo, conforme disponibilidade.':'O suporte avançado é exclusivo dos planos Global Crypto e Internacional Pro.'}</p></div><Link className={styles.secondary} href="/platform/aprender">Abrir Universidade →</Link></div>
    <p className={styles.small}>As consultas avançadas estão incluídas nos planos de R$ 149,90 e R$ 199,90, com limites internos de segurança. Não é necessário comprar pacotes avulsos de IA.</p>
   </>}
   <nav className={styles.links}><Link href="/platform/aprender">Universidade JENIOS →</Link><Link href="/universidade">Contratação independente da Universidade →</Link><Link href="/social">Gênio e Gênia gratuitos →</Link></nav>
  </section>
  <section className={styles.panel} aria-labelledby="pro-consult-title">
   <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>SUA PRÓXIMA CONSULTA</span><h2 id="pro-consult-title">Como podemos ajudar?</h2></div><span className={data.paidGenerationEnabled?styles.status:styles.pending}>{data.paidGenerationEnabled?'Pro disponível':'Pro em preparação'}</span></div>
   <div className={styles.personas} aria-label="Escolha seu assistente Pro">{PERSONAS.map(p=><button key={p.id} type="button" className={styles.character} aria-pressed={persona===p.id} disabled={locked} onClick={()=>void choosePersona(p.id)}><img src={p.image} alt="" width="68" height="68"/><span><strong>{p.name} Pro</strong><small>{persona===p.id?'Seu assistente selecionado':'Selecionar assistente'}</small></span></button>)}</div>
   {!data.paidGenerationEnabled&&<p className={styles.availability} role="status">{data.readinessMessage||'A IA Pro aguarda ativação. Você já pode continuar com o atendimento gratuito e os estudos disponíveis na Universidade.'}</p>}
   {account.kind==='ready'&&!data.proIncluded&&!data.masterPreview&&<p role="status" className={styles.availability}>O atendimento comercial é gratuito. O suporte de gráficos e operações exige plano ativo a partir de R$ 149,90. <Link href="/checkout">Conhecer planos →</Link></p>}
   {memorySyncPending&&<p role="status" className={styles.pendingNotice}>A resposta está concluída. Atualize o histórico e a conversa para continuar com o contexto sincronizado.</p>}
   {hasPending&&<p role="status" className={styles.pendingNotice}>Há uma consulta com consumo em conferência. Atualize o histórico para acompanhar a confirmação; a mesma pergunta não será reenviada automaticamente.</p>}
   <ConversationControls memory={memory} disabled={locked}/>
   {taskId==='university_tutor'&&lessonId&&<p className={styles.notice}>Esta conversa está vinculada à aula que você abriu na Universidade.</p>}
   <form onSubmit={prepare} className={styles.form}>
    <div className={styles.fields}><label htmlFor="pro-task">Tipo de consulta<select id="pro-task" value={taskId} disabled={locked} onChange={e=>{setTaskId(e.target.value);if(!PRO_UI_TASKS.find(t=>t.id===e.target.value)?.acceptsImage)clearImage();invalidateQuote();}}>{PRO_UI_TASKS.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}</select></label></div>
    <p className={styles.taskHelp}>{task?.description}</p>
    {task?.requiresCurrentData&&<div className={styles.fields}><label htmlFor="pro-symbol">Ativo<select id="pro-symbol" value={symbol} disabled={locked||!symbols.length} onChange={e=>{setSymbol(e.target.value);invalidateQuote();}}>{!symbols.length&&<option value="">Aguardando ativos disponíveis</option>}{symbols.map(s=><option key={s} value={s}>{s}</option>)}</select></label><label htmlFor="pro-timeframe">Intervalo do gráfico<select id="pro-timeframe" value={timeframe} disabled={locked||!timeframes.length} onChange={e=>{setTimeframe(e.target.value);invalidateQuote();}}>{!timeframes.length&&<option value="">Aguardando intervalos disponíveis</option>}{timeframes.map(t=><option key={t} value={t}>{PRO_TIMEFRAME_LABELS[t]}</option>)}</select></label></div>}
    <label htmlFor="pro-prompt">Sua pergunta<textarea id="pro-prompt" value={prompt} rows={4} maxLength={2500} disabled={locked||account.kind!=='ready'} onChange={e=>{setPrompt(e.target.value);invalidateQuote();}} placeholder={taskId==='chart_screenshot'?'Ex.: quais padrões estão visíveis neste gráfico e o que a imagem não permite concluir?':'Descreva o que deseja entender e o contexto da sua dúvida.'}/><span className={styles.counter}>{prompt.length}/2.500</span></label>
    {task?.acceptsImage&&<div className={styles.upload}><label htmlFor="pro-image">{taskId==='chart_screenshot'?'Captura do gráfico':'Captura do gráfico (opcional)'}<input ref={fileInput} id="pro-image" type="file" accept="image/png,image/jpeg,image/webp" disabled={locked||account.kind!=='ready'} onChange={chooseImage}/></label><p className={styles.small}>PNG, JPEG ou WebP de até 3 MB. A captura selecionada continua disponível nesta aba para perguntas seguintes, até você removê-la ou trocar de conversa. Cada envio depende da sua confirmação.</p>{!attachment&&memory.conversation?.turns.length>0&&<p className={styles.small}>As imagens não são guardadas no histórico. Reanexe a captura para continuar uma leitura visual.</p>}{imageReading&&<p role="status">Preparando a imagem…</p>}{attachment&&<div className={styles.preview}><img src={attachment.preview} alt="Prévia da captura que será analisada"/><div><strong>{attachment.name}</strong><small>{attachment.width} × {attachment.height} pixels</small><button type="button" className={styles.secondary} disabled={Boolean(busy)||hasPending} onClick={()=>{clearImage();invalidateQuote();}}>Remover imagem</button></div></div>}</div>}
    {task?.reason&&data.paidGenerationEnabled&&!task.available&&<p className={styles.availability}>{task.reason}</p>}
    {account.kind==='ready'&&error&&<p role="alert" className={styles.error}>{error}</p>}{notice&&<p role="status" className={styles.notice}>{notice}</p>}
    <div className={styles.actions}><button type="submit" className={styles.primary} disabled={!canPrepare}>{busy==='quote'?'Conferindo limite…':'Preparar consulta avançada'}</button><p className={styles.small}>O sistema controla o orçamento de IA internamente.</p></div>
   </form>
   {quote&&<section className={styles.confirmation} aria-labelledby="pro-confirm-title"><h3 id="pro-confirm-title">Confira antes de enviar</h3><p>Consulta incluída no seu plano ativo, sujeita à franquia interna do serviço. Nenhuma compra adicional é necessária.</p><p className={styles.small}>{quoteCurrent?'Estimativa válida até '+formatProDate(quote.expiresAt)+'.':'Esta estimativa venceu. Solicite um novo limite para continuar.'}</p><label className={styles.consent}><input type="checkbox" checked={consent} disabled={locked||!quoteCurrent} onChange={e=>setConsent(e.target.checked)}/><span>Autorizo enviar minha pergunta{attachment?' e esta imagem':''} à OpenAI para esta consulta do meu plano.</span></label><button type="button" className={styles.primary} disabled={!canSend} onClick={send}>{busy==='chat'?'Preparando sua resposta…':'Confirmar e perguntar a '+selectedPersona.name+' Pro'}</button></section>}
   <p className={styles.small}>As análises são informativas. Leituras do momento exigem dados recentes verificados; as decisões e as operações permanecem com você.</p>
  </section>
  {busy==='chat'&&<div className={styles.panel} role="status"><p>Preparando sua resposta com o contexto autorizado…</p><button type="button" className={styles.secondary} onClick={()=>sendAbort.current?.abort(new DOMException('Espera interrompida.','AbortError'))}>Parar espera</button><p className={styles.small}>Interromper a espera não cancela uma geração que o provedor já iniciou.</p></div>}
  {!!visibleAnswers.length&&<section ref={answersRef} className={styles.panel} aria-label="Conversa avançada"><h2>Sua conversa</h2><div className={styles.answers} aria-live="polite">{visibleAnswers.map(result=><article key={result.turnId}><div className={styles.answerHeading}><strong>{PERSONAS.find(p=>p.id===(result.persona||memory.persona))?.name||'Gênio'} Pro</strong></div><p className={styles.question}>{result.question}</p><div className={styles.answer}>{settledTurn(result)?result.answer:result.notice||'Preparando ou conferindo a resposta…'}</div><VerifiedSource source={result.sourceInfo}/>{settledTurn(result)&&memory.conversation?.turns.some(t=>t.turnId===result.turnId)&&<div className={styles.answer}><AnswerFeedback memory={memory} turnId={result.turnId}/></div>}</article>)}</div></section>}
  {account.kind==='ready'&&<History state={history.kind} status={history.status} error={history.error} items={history.items} hasMore={history.hasMore} onRefresh={refreshLedger} busy={Boolean(busy)||imageReading} refreshing={busy==='refresh'} hasPending={hasPending}/>}

  
  
 </div></main>;
}
