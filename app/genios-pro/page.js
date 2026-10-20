'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {supabase} from '../../lib/supabase';
import {PERSONAS} from '../../lib/assistant/contracts.mjs';
import ProCredits from './ProCredits';
import {PRO_UI_TASKS,PRO_PLAN_LABELS,PRO_TIMEFRAME_LABELS,formatNanoUsd,formatProDate,
 verifiedWallet,verifiedAllowance,taskAvailability,validQuote,requestStateLabel,fileProblem,canPrepareQuote,unresolvedRequest,initialProTask} from './pro-client.mjs';
import styles from './pro.module.css';

function BalanceRows({rows}){return <dl className={styles.amounts}>{rows.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{formatNanoUsd(value)}</dd></div>)}</dl>;}
function VerifiedSource({source}){
 if(!source||typeof source.provider!=='string'||typeof source.symbol!=='string'||!Number.isFinite(Date.parse(source.sourceAt)))return null;
 return <p className={styles.source}>Fonte: {source.provider} · {source.symbol}{PRO_TIMEFRAME_LABELS[source.timeframe]?' · '+PRO_TIMEFRAME_LABELS[source.timeframe]:''}. Último candle encerrado em {formatProDate(source.sourceAt)} (horário local).</p>;
}
function History({state,error,items,onRefresh,busy}){
 return <section className={styles.panel} aria-labelledby="pro-history-title">
  <div className={styles.sectionHeading}><div><h2 id="pro-history-title">Seu histórico de consumo</h2><p>Valores e estados das suas últimas 50 consultas.</p></div><button type="button" className={styles.secondary} onClick={onRefresh} disabled={busy}>Atualizar histórico</button></div>
  {state==='loading'?<p role="status">Conferindo seu histórico…</p>:error?<p role="alert" className={styles.error}>{error}</p>:!items.length?<p className={styles.empty}>Nenhum consumo Pro registrado nesta conta.</p>:<ol className={styles.history}>{items.map((item,index)=>{
   const task=PRO_UI_TASKS.find(t=>t.id===item.task),persona=PERSONAS.find(p=>p.id===item.persona);
   return <li key={item.id||item.requestKey||index}>
    <div><strong>{task?.label||'Consulta Pro'}</strong><small>{formatProDate(item.createdAt)}{persona?' · '+persona.name+' Pro':''}</small><span>{item.source==='included'?'Franquia do plano':item.source==='prepaid'?'Créditos comprados':'Origem a verificar'}</span></div>
    <div className={styles.historyAmount}><span className={unresolvedRequest(item.state)?styles.pending:styles.status}>{requestStateLabel(item.state)}</span><strong>{!['settled','released'].includes(item.state)||item.chargedNanoUsd===null||item.chargedNanoUsd===undefined?'Valor a confirmar':formatNanoUsd(item.chargedNanoUsd)}</strong></div>
    {item.state==='settled'&&typeof item.answer==='string'&&item.answer&&<details className={styles.historyDetail}><summary>Ver resposta</summary><div className={styles.answer}>{item.answer}</div><VerifiedSource source={item.sourceInfo}/></details>}
   </li>;
  })}</ol>}
  <p className={styles.small}>O histórico mostra somente a sua conta. As imagens não são armazenadas neste extrato.</p>
 </section>;
}

export default function GeniosPro(){
 const [account,setAccount]=useState({kind:'checking'}),[refresh,setRefresh]=useState(0),[error,setError]=useState('');
 const [history,setHistory]=useState({kind:'loading',items:[],error:''}),[busy,setBusy]=useState('');
 const [persona,setPersona]=useState('genio'),[taskId,setTaskId]=useState('advanced_question'),[prompt,setPrompt]=useState('');
 const [source,setSource]=useState('prepaid'),[symbol,setSymbol]=useState(''),[timeframe,setTimeframe]=useState('');
 const [attachment,setAttachment]=useState(null),[imageReading,setImageReading]=useState(false);
 const [quote,setQuote]=useState(null),[consent,setConsent]=useState(false),[clock,setClock]=useState(Date.now());
 const [pendingKey,setPendingKey]=useState(null),[notice,setNotice]=useState(''),[answers,setAnswers]=useState([]);
 const epoch=useRef(0),owner=useRef(null),controller=useRef(null),busyRef=useRef(false),imageEpoch=useRef(0),fileInput=useRef(null),previewRef=useRef(null);
 const data=account.data||{},wallet=verifiedWallet(data.wallet),allowance=verifiedAllowance(data.allowance),task=taskAvailability(data,taskId);
 const hasPending=Boolean(pendingKey||data.pendingRequests>0||history.items.some(item=>unresolvedRequest(item.state)));
 const locked=Boolean(busy||imageReading||hasPending||account.kind==='ready'&&(history.kind==='loading'||history.error));
 const symbols=Array.isArray(data.marketSymbols)?data.marketSymbols.filter(s=>typeof s==='string'):[];
 const timeframes=Array.isArray(data.marketTimeframes)?data.marketTimeframes.filter(t=>Object.hasOwn(PRO_TIMEFRAME_LABELS,t)):[];
 const selectedPersona=PERSONAS.find(p=>p.id===persona)||PERSONAS[0];
 const quoteCurrent=validQuote(quote,source,clock);
 const canPrepare=account.kind==='ready'&&canPrepareQuote({data,taskId,source,prompt,image:attachment,hasPending,locked})&&
  (!task?.requiresCurrentData||(symbols.includes(symbol)&&timeframes.includes(timeframe)));
 const canSend=account.kind==='ready'&&quoteCurrent&&consent&&canPrepare;

 function clearImage(){imageEpoch.current++;setImageReading(false);if(previewRef.current)URL.revokeObjectURL(previewRef.current);previewRef.current=null;setAttachment(null);if(fileInput.current)fileInput.current.value='';}
 function invalidateQuote(){setQuote(null);setConsent(false);setError('');setNotice('');}
 function clearPrivateState(){
  clearImage();setPrompt('');setQuote(null);setConsent(false);setPendingKey(null);setAnswers([]);setNotice('');setError('');
  setHistory({kind:'loading',items:[],error:''});setPersona('genio');setTaskId(initialProTask(typeof window==='undefined'?'':window.location.search));setSymbol('');setTimeframe('');setSource('prepaid');
 }
 async function sessionFor(expectedOwner){
  const result=await supabase?.auth.getSession(),session=result?.data?.session;
  if(result?.error||!session?.access_token||session.user?.is_anonymous||session.user?.id!==expectedOwner)throw Error('Sua sessão mudou. Entre novamente para continuar.');
  return session;
 }
 async function api(path,token,{body,signal}={}){
  const response=await fetch('/api/assistant/pro/'+path,{method:body?'POST':'GET',cache:'no-store',signal,
   headers:{authorization:'Bearer '+token,...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  let value;try{value=await response.json();}catch{throw Error('O serviço não confirmou a resposta. Atualize o status antes de tentar novamente.');}
  if(!response.ok||value?.ok===false)throw Object.assign(Error(typeof value?.error==='string'?value.error:'Não foi possível concluir esta solicitação.'),{proState:value?.state,requestId:value?.requestId,status:response.status,proBody:value});
  return value;
 }
 async function requestCredits(path,body){
  const ticket=epoch.current,expectedOwner=owner.current,session=await sessionFor(expectedOwner);
  if(ticket!==epoch.current)throw new DOMException('Sua sessão mudou.','AbortError');
  const result=await api('credits/'+path,session.access_token,{body,signal:controller.current.signal});
  if(ticket!==epoch.current)throw new DOMException('Sua sessão mudou.','AbortError');
  return result;
 }
 function historyItems(value){if(!Array.isArray(value?.items))throw Error('Não foi possível confirmar seu histórico. Atualize antes de continuar.');return value.items;}
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
   if(verifiedAllowance(value.allowance)?.available>0)setSource('included');
   try{
    const ledger=await api('history',session.access_token,{signal:controller.current.signal});
    if(live&&ticket===epoch.current)setHistory({kind:'ready',items:historyItems(ledger),error:''});
   }catch(e){if(live&&ticket===epoch.current&&e.name!=='AbortError')setHistory({kind:'ready',items:[],error:e.message});}
  }catch(e){if(live&&ticket===epoch.current&&e.name!=='AbortError'){setAccount({kind:'unavailable'});setError(e.message);}}}
  void load();
  const auth=supabase?.auth.onAuthStateChange((event,session)=>{
   if(event==='INITIAL_SESSION'||session?.user?.id===owner.current&&['SIGNED_IN','TOKEN_REFRESHED','USER_UPDATED'].includes(event))return;
   epoch.current++;controller.current?.abort();owner.current=null;setAccount({kind:'checking'});clearPrivateState();
   setTimeout(()=>{if(live)setRefresh(n=>n+1);},0);
  });
  return()=>{live=false;epoch.current++;controller.current?.abort();imageEpoch.current++;if(previewRef.current)URL.revokeObjectURL(previewRef.current);auth?.data?.subscription?.unsubscribe();};
 },[refresh]);
 useEffect(()=>{if(!quote)return;setClock(Date.now());const timer=setInterval(()=>setClock(Date.now()),1000);return()=>clearInterval(timer);},[quote]);

 async function refreshLedger(){
  if(busyRef.current||!owner.current)return;busyRef.current=true;setBusy('refresh');const ticket=epoch.current,expectedOwner=owner.current;
  try{
   const session=await sessionFor(expectedOwner);if(ticket!==epoch.current)return;
   const [accessResult,historyResult]=await Promise.allSettled([
    api('access',session.access_token,{signal:controller.current.signal}),api('history',session.access_token,{signal:controller.current.signal})
   ]);
   if(ticket!==epoch.current)return;
   if(accessResult.status==='fulfilled')acceptAccess(accessResult.value);
   else{setError(accessResult.reason.message);setAccount(old=>({...old,data:{...old.data,paidGenerationEnabled:false,readinessMessage:'Atualize o histórico para confirmar seu acesso antes de continuar.'}}));}
   if(historyResult.status==='fulfilled'){
    const items=historyItems(historyResult.value);setHistory({kind:'ready',items,error:''});
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
 function draft(){return {persona,task:taskId,prompt:prompt.trim(),source,
  ...(task?.requiresCurrentData?{symbol,timeframe}:{}),...(attachment?{image:{mime:attachment.mime,base64:attachment.base64}}:{})};}
 async function prepare(event){
  event.preventDefault();if(busyRef.current||!canPrepare)return;busyRef.current=true;setBusy('quote');setError('');setNotice('');setQuote(null);setConsent(false);const ticket=epoch.current,expectedOwner=owner.current;
  try{
   const session=await sessionFor(expectedOwner);if(ticket!==epoch.current)return;
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
   submitted=true;setPendingKey(key);
   const result=await api('chat',session.access_token,{body:{...input,requestKey:key,quoteId:quote.id,consent:true,maxRetailNanoUsd:quote.maxRetailNanoUsd},signal:controller.current.signal});
   if(ticket!==epoch.current)return;
   if(result.state==='settled'){
    setPendingKey(null);setAnswers(old=>[...old.slice(-7),{id:result.requestId||key,persona,question:input.prompt,answer:typeof result.answer==='string'?result.answer:'A consulta foi concluída. Confira o registro de consumo.',chargedNanoUsd:result.chargedNanoUsd,source,sourceInfo:result.sourceInfo}]);
    setPrompt('');clearImage();setNotice('Consulta concluída. O consumo confirmado está no histórico.');
   }else if(['released','not_started'].includes(result.state)){setPendingKey(null);setNotice('Esta consulta não gerou consumo confirmado. Você pode solicitar uma nova estimativa.');}
   else setNotice('Estamos conferindo o consumo desta solicitação. Atualize o histórico antes de iniciar outra consulta.');
  }catch(e){
   if(ticket===epoch.current&&e.name!=='AbortError'){
    if(!submitted||['released','not_started'].includes(e.proState))setPendingKey(null);
    setError(submitted&&!['released','not_started'].includes(e.proState)?'A resposta ainda não foi confirmada. Não reenvie a consulta; atualize o histórico para conferir o consumo.':e.message);
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
   if(results[1].status==='fulfilled')setHistory({kind:'ready',items:historyItems(results[1].value),error:''});
   else setHistory(old=>({...old,error:'Não foi possível atualizar o histórico. Consulte novamente antes de continuar.'}));
  }catch{if(ticket===epoch.current)setHistory(old=>({...old,error:'Não foi possível atualizar o histórico. Consulte novamente antes de continuar.'}));}
 }

 return <main className={styles.page} data-jenios-pro="b145"><div className={styles.wrap}>
  <header className={styles.header}><div className={styles.topLinks}><Link href="/social">← JENIOS Social</Link><Link href="/social">Atendimento gratuito →</Link></div>
   <div className={styles.tag}>JENIOS · INTELIGÊNCIA AVANÇADA</div><h1>Gênio Pro e Gênia Pro</h1><p>Aprofunde suas dúvidas, estude gráficos e acompanhe o mercado. Você escolhe a consulta e confirma o limite de consumo antes de cada resposta.</p>
  </header>
  <section className={styles.panel} aria-label="Sua conta Pro">
   {account.kind==='checking'?<p role="status">Verificando sua conta…</p>:account.kind==='guest'?<div className={styles.sectionHeading}><div><h2>Entre para acessar o Pro</h2><p>Gênio e Gênia gratuitos continuam disponíveis na Social, sem cadastro. Sua conta permite verificar a Universidade, a franquia e os créditos Pro.</p></div><Link className={styles.primary} href="/login">Entrar na JENIOS</Link></div>:account.kind==='unavailable'?<><p role="alert" className={styles.error}>{error}</p><button type="button" className={styles.secondary} onClick={()=>setRefresh(n=>n+1)}>Verificar minha conta novamente</button></>:<>
    <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>SUA CONTA</span><h2>{data.masterPreview?'Administrador JENIOS':PRO_PLAN_LABELS[data.planCode]||'Acesso sem assinatura'}</h2><p>{['purchased-pass','university-monthly'].includes(data.universityAccessKind)?'Universidade contratada separadamente e ativa.':data.universityIncluded?'Universidade incluída no seu plano.':'Universidade disponível separadamente por R$ 49,90 mensais.'} {data.proIncluded?'O Pro inclui uma franquia limitada.':'O Pro utiliza créditos comprados.'}</p></div><Link className={styles.secondary} href="/platform/aprender">Abrir Universidade →</Link></div>
    <div className={styles.balanceGrid}>
     <section className={styles.balanceCard} aria-label="Créditos comprados"><h3>Créditos comprados</h3>{wallet?<><div className={styles.balanceMain}>{formatNanoUsd(wallet.available)}<small>disponíveis</small></div><BalanceRows rows={[["Saldo total",wallet.total],["Reservado",wallet.reserved]]}/></>:<p>Saldo ainda indisponível para consulta.</p>}</section>
     <section className={styles.balanceCard} aria-label="Franquia do plano"><h3>Franquia do plano</h3>{allowance?<><div className={styles.balanceMain}>{formatNanoUsd(allowance.available)}<small>disponíveis neste ciclo</small></div><BalanceRows rows={[["Franquia total",allowance.total],["Utilizado",allowance.spent],["Reservado",allowance.reserved]]}/>{data.allowance?.periodEnd&&<p className={styles.small}>Ciclo até {formatProDate(data.allowance.periodEnd)}.</p>}</>:<p>{!data.proIncluded?'Seu acesso não inclui franquia mensal de IA.':data.allowance?.status==='unconfigured'?'O valor da franquia ainda aguarda definição.':'Franquia temporariamente indisponível para consulta. Atualize seu histórico para conferir.'}</p>}</section>
    </div>
   </>}
   <nav className={styles.links}><Link href="/platform/aprender">Universidade JENIOS →</Link><Link href="/universidade">Contratação independente da Universidade →</Link><Link href="/social">Gênio e Gênia gratuitos →</Link></nav>
  </section>
  <section className={styles.panel} aria-labelledby="pro-consult-title">
   <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>SUA PRÓXIMA CONSULTA</span><h2 id="pro-consult-title">Como podemos ajudar?</h2></div><span className={data.paidGenerationEnabled?styles.status:styles.pending}>{data.paidGenerationEnabled?'Pro disponível':'Pro em preparação'}</span></div>
   <div className={styles.personas} aria-label="Escolha seu assistente Pro">{PERSONAS.map(p=><button key={p.id} type="button" className={styles.character} aria-pressed={persona===p.id} disabled={locked} onClick={()=>{setPersona(p.id);invalidateQuote();}}><img src={p.image} alt="" width="68" height="68"/><span><strong>{p.name} Pro</strong><small>{persona===p.id?'Seu assistente selecionado':'Selecionar assistente'}</small></span></button>)}</div>
   {!data.paidGenerationEnabled&&<p className={styles.availability} role="status">{data.readinessMessage||'A IA Pro aguarda ativação. Você já pode continuar com o atendimento gratuito e os estudos disponíveis na Universidade.'}</p>}
   {hasPending&&<p role="status" className={styles.pendingNotice}>Há uma consulta com consumo em conferência. Atualize o histórico para acompanhar a confirmação; a mesma pergunta não será reenviada automaticamente.</p>}
   <form onSubmit={prepare} className={styles.form}>
    <div className={styles.fields}><label htmlFor="pro-task">Tipo de consulta<select id="pro-task" value={taskId} disabled={locked} onChange={e=>{setTaskId(e.target.value);if(!PRO_UI_TASKS.find(t=>t.id===e.target.value)?.acceptsImage)clearImage();invalidateQuote();}}>{PRO_UI_TASKS.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}</select></label><label htmlFor="pro-source">De onde usar o saldo<select id="pro-source" value={source} disabled={locked||account.kind!=='ready'} onChange={e=>{setSource(e.target.value);invalidateQuote();}}><option value="prepaid">Créditos comprados</option><option value="included" disabled={!allowance}>Franquia do plano</option></select></label></div>
    <p className={styles.taskHelp}>{task?.description}</p>
    {task?.requiresCurrentData&&<div className={styles.fields}><label htmlFor="pro-symbol">Ativo<select id="pro-symbol" value={symbol} disabled={locked||!symbols.length} onChange={e=>{setSymbol(e.target.value);invalidateQuote();}}>{!symbols.length&&<option value="">Aguardando ativos disponíveis</option>}{symbols.map(s=><option key={s} value={s}>{s}</option>)}</select></label><label htmlFor="pro-timeframe">Intervalo do gráfico<select id="pro-timeframe" value={timeframe} disabled={locked||!timeframes.length} onChange={e=>{setTimeframe(e.target.value);invalidateQuote();}}>{!timeframes.length&&<option value="">Aguardando intervalos disponíveis</option>}{timeframes.map(t=><option key={t} value={t}>{PRO_TIMEFRAME_LABELS[t]}</option>)}</select></label></div>}
    <label htmlFor="pro-prompt">Sua pergunta<textarea id="pro-prompt" value={prompt} rows={4} maxLength={2500} disabled={locked||account.kind!=='ready'} onChange={e=>{setPrompt(e.target.value);invalidateQuote();}} placeholder={taskId==='chart_screenshot'?'Ex.: quais padrões estão visíveis neste gráfico e o que a imagem não permite concluir?':'Descreva o que deseja entender e o contexto da sua dúvida.'}/><span className={styles.counter}>{prompt.length}/2.500</span></label>
    {task?.acceptsImage&&<div className={styles.upload}><label htmlFor="pro-image">{taskId==='chart_screenshot'?'Captura do gráfico':'Captura do gráfico (opcional)'}<input ref={fileInput} id="pro-image" type="file" accept="image/png,image/jpeg,image/webp" disabled={locked||account.kind!=='ready'} onChange={chooseImage}/></label><p className={styles.small}>PNG, JPEG ou WebP de até 3 MB. A imagem será enviada ao provedor somente após sua confirmação.</p>{imageReading&&<p role="status">Preparando a imagem…</p>}{attachment&&<div className={styles.preview}><img src={attachment.preview} alt="Prévia da captura que será analisada"/><div><strong>{attachment.name}</strong><small>{attachment.width} × {attachment.height} pixels</small><button type="button" className={styles.secondary} disabled={Boolean(busy)||hasPending} onClick={()=>{clearImage();invalidateQuote();}}>Remover imagem</button></div></div>}</div>}
    {task?.reason&&data.paidGenerationEnabled&&!task.available&&<p className={styles.availability}>{task.reason}</p>}
    {account.kind==='ready'&&error&&<p role="alert" className={styles.error}>{error}</p>}{notice&&<p role="status" className={styles.notice}>{notice}</p>}
    <div className={styles.actions}><button type="submit" className={styles.primary} disabled={!canPrepare}>{busy==='quote'?'Conferindo limite…':'Ver limite de consumo'}</button><p className={styles.small}>Consultar o limite não debita seu saldo.</p></div>
   </form>
   {quote&&<section className={styles.confirmation} aria-labelledby="pro-confirm-title"><h3 id="pro-confirm-title">Confira antes de enviar</h3><p><strong>Limite máximo desta consulta: {formatNanoUsd(quote.maxRetailNanoUsd)}</strong></p><p>Usaremos {source==='included'?'a franquia do seu plano':'seus créditos comprados'}. O consumo final será de duas vezes o custo efetivo da API. A parte reservada e não utilizada será liberada.</p><p className={styles.small}>{quoteCurrent?'Estimativa válida até '+formatProDate(quote.expiresAt)+'.':'Esta estimativa venceu. Solicite um novo limite para continuar.'}</p><label className={styles.consent}><input type="checkbox" checked={consent} disabled={locked||!quoteCurrent} onChange={e=>setConsent(e.target.checked)}/><span>Autorizo enviar minha pergunta{attachment?' e esta imagem':''} à OpenAI e consumir até o limite acima nesta consulta.</span></label><button type="button" className={styles.primary} disabled={!canSend} onClick={send}>{busy==='chat'?'Preparando sua resposta…':'Confirmar e perguntar a '+selectedPersona.name+' Pro'}</button></section>}
   <p className={styles.small}>As análises são informativas. Leituras do momento exigem dados recentes verificados; as decisões e as operações permanecem com você.</p>
  </section>
  {!!answers.length&&<section className={styles.panel} aria-label="Respostas desta sessão"><h2>Respostas desta sessão</h2><div className={styles.answers}>{answers.map(result=><article key={result.id}><div className={styles.answerHeading}><strong>{PERSONAS.find(p=>p.id===result.persona)?.name||'Gênio'} Pro</strong><small>Consumo: {formatNanoUsd(result.chargedNanoUsd)}</small></div><p className={styles.question}>{result.question}</p><div className={styles.answer}>{result.answer}</div><VerifiedSource source={result.sourceInfo}/></article>)}</div><p className={styles.small}>As consultas concluídas também podem ser consultadas no histórico desta conta.</p></section>}
  {account.kind==='ready'&&<History state={history.kind} error={history.error} items={history.items} onRefresh={refreshLedger} busy={Boolean(busy)||imageReading}/>}
  <ProCredits key={account.kind==='ready'?owner.current:'visitor'} userId={account.kind==='ready'?owner.current:null} offer={account.kind==='ready'?data.creditsOffer:null} request={requestCredits} onCredited={refreshLedger}/>
 </div></main>;
}
