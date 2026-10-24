'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import AdminAccess,{adminFetch} from '../../../components/AdminAccess';
import {supabase} from '../../../../lib/supabase';
import styles from './page.module.css';

const EMPTY_ITEM={title:'',summary:'',sourceName:'',sourceUrl:''};
const LABELS={draft:'Rascunho',approved:'Aprovada e agendada',retired:'Arquivada'};
const localInput=date=>{const d=new Date(date);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);};
const dateLabel=date=>new Date(date).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'});
function Radar(){
 const [editions,setEditions]=useState([]),[selected,setSelected]=useState(null),[form,setForm]=useState(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const active=useRef(true),identity=useRef(null),operation=useRef(null);
 const [accountReady,setAccountReady]=useState(false);
 useEffect(()=>{active.current=true;const controller=new AbortController();
  adminFetch('/api/admin/newsletters',{signal:controller.signal}).then(r=>r.json()).then(data=>{if(active.current)setEditions(data.editions);})
   .catch(e=>{if(active.current&&!controller.signal.aborted)setError(e.message);});
  const auth=supabase?.auth.onAuthStateChange((_event,session)=>{
   const id=session?.user?.is_anonymous?null:session?.user?.id||null;
   if(identity.current!==id)operation.current?.abort();
   identity.current=id;if(active.current)setAccountReady(Boolean(id));
  });
  return()=>{active.current=false;controller.abort();operation.current?.abort();auth?.data?.subscription?.unsubscribe();};
 },[]);
 const select=edition=>{
  setSelected(edition);setError('');setNotice('');
  setForm({editionKey:edition.edition_key,scheduledAt:localInput(edition.scheduled_at),items:edition.items.map(item=>({...item}))});
 };
 const newEdition=()=>{
  setSelected(null);setError('');setNotice('');
  setForm({editionKey:'radar-'+new Date().toISOString().slice(0,10)+'-'+crypto.randomUUID().slice(0,8),
   scheduledAt:localInput(Date.now()+86400000),items:[{...EMPTY_ITEM}]});
 };
 const updateItem=(index,key,value)=>setForm(old=>({...old,items:old.items.map((item,i)=>i===index?{...item,[key]:value}:item)}));
 const readonly=Boolean(selected&&selected.status!=='draft');
 async function submit(action){
  if(busy||!form||!identity.current)return;
  const actorId=identity.current,controller=new AbortController();operation.current=controller;
  setBusy(true);setError('');setNotice('');
  try{
   const body={action,...(selected?{id:selected.id,revision:selected.revision}:{})};
   if(action==='create'||action==='save'){
    Object.assign(body,{editionKey:form.editionKey,scheduledAt:new Date(form.scheduledAt).toISOString(),items:form.items});
   }
   const sessionResult=await supabase.auth.getSession(),session=sessionResult.data?.session;
   if(sessionResult.error||!active.current||controller.signal.aborted||identity.current!==actorId||session?.user?.id!==actorId)
    throw new Error('A sessão mudou. Entre novamente antes de continuar.');
   const response=await fetch('/api/admin/newsletters',{method:'POST',cache:'no-store',signal:controller.signal,
    headers:{authorization:'Bearer '+session.access_token,'content-type':'application/json'},body:JSON.stringify(body)});
   const result=await response.json();if(!response.ok)throw new Error(result.error||'Não foi possível salvar a edição.');
   const {edition}=result;
   if(!active.current)return;
   setEditions(old=>[edition,...old.filter(row=>row.id!==edition.id)].sort((a,b)=>Date.parse(b.scheduled_at)-Date.parse(a.scheduled_at)));
   select(edition);
   setNotice(action==='approve'?'Edição aprovada. A entrega seguirá o agendamento e as preferências dos destinatários.':
    action==='retire'?'Edição arquivada. Mensagens que já estavam em processamento ainda podem ser entregues.':'Rascunho salvo. Revise os destaques antes de aprovar.');
  }catch(e){if(active.current)setError(e.message||'Não foi possível salvar a edição.');}
  finally{if(active.current)setBusy(false);}
 }
 const dirty=selected&&form&&(JSON.stringify(form.items)!==JSON.stringify(selected.items)||form.scheduledAt!==localInput(selected.scheduled_at));
 return <main className={styles.page}><div className={styles.container}>
  <Link href="/admin/emails">← Saúde dos e-mails</Link>
  <header className={styles.header}><div><span className={styles.kicker}>JENIOS · RELACIONAMENTO</span><h1>Radar de Mercado</h1>
   <p>Prepare a edição, confira as fontes e escolha quando ela será enviada.</p></div>
   <button type="button" disabled={busy} onClick={newEdition}>Nova edição</button></header>
  {error&&<p className={styles.error} role="alert">{error}</p>}
  {notice&&<p className={styles.notice} role="status">{notice}</p>}
  <div className={styles.layout}>
   <section className={styles.panel} aria-labelledby="editions-heading"><h2 id="editions-heading">Edições</h2>
    {editions.length===0?<p>Ainda não há edições salvas.</p>:<ul className={styles.editions}>{editions.map(edition=><li key={edition.id}>
     <button type="button" disabled={busy} aria-pressed={selected?.id===edition.id} onClick={()=>select(edition)}>
      <strong>{dateLabel(edition.scheduled_at)}</strong><span>{LABELS[edition.status]}</span><small>{edition.items.length} destaque(s)</small>
     </button></li>)}</ul>}
   </section>
   <section className={styles.panel} aria-labelledby="editor-heading">
    <h2 id="editor-heading">{selected?LABELS[selected.status]:'Nova edição'}</h2>
    {!form?<p>Selecione uma edição ou crie um rascunho para começar.</p>:<form onSubmit={event=>{event.preventDefault();void submit(selected?'save':'create');}}>
     <p><strong>Assunto:</strong> JENIOS | Radar de Mercado</p>
     <p className={styles.help}>O envio usa o modelo JENIOS com logo, assinatura e link de preferências já aprovados.</p>
     <label>Data e horário de envio<input type="datetime-local" value={form.scheduledAt} required disabled={busy||readonly}
      onChange={e=>setForm(old=>({...old,scheduledAt:e.target.value}))}/></label>
     <p className={styles.help}>Horário local do seu dispositivo. Somente pessoas com consentimento de marketing recebem o Radar, respeitando o intervalo entre edições.</p>
     {form.items.map((item,index)=><fieldset disabled={busy||readonly} key={index}>
      <legend>Destaque {index+1}</legend>
      <label>Título<input value={item.title} required minLength={3} maxLength={180} onChange={e=>updateItem(index,'title',e.target.value)}/></label>
      <label>Resumo<textarea value={item.summary} required minLength={10} maxLength={1400} rows={4} onChange={e=>updateItem(index,'summary',e.target.value)}/></label>
      <div className={styles.sources}><label>Nome da fonte<input value={item.sourceName} required minLength={2} maxLength={120} onChange={e=>updateItem(index,'sourceName',e.target.value)}/></label>
       <label>Link da fonte<input type="url" value={item.sourceUrl} required placeholder="https://" maxLength={2000} onChange={e=>updateItem(index,'sourceUrl',e.target.value)}/></label></div>
      {!readonly&&form.items.length>1&&<button type="button" className={styles.secondary} onClick={()=>setForm(old=>({...old,items:old.items.filter((_,i)=>i!==index)}))}>Remover destaque</button>}
     </fieldset>)}
     {!readonly&&<div className={styles.actions}>
      {form.items.length<5&&<button type="button" className={styles.secondary} disabled={busy} onClick={()=>setForm(old=>({...old,items:[...old.items,{...EMPTY_ITEM}]}))}>Adicionar destaque</button>}
      <button type="submit" disabled={busy||!accountReady}>{busy?'Salvando…':'Salvar rascunho'}</button>
      {selected&&<button type="button" disabled={busy||dirty||!accountReady} onClick={()=>void submit('approve')}>Aprovar e agendar</button>}
     </div>}
     {dirty&&<p className={styles.help}>Salve suas alterações antes de aprovar.</p>}
     {selected&&selected.status!=='retired'&&<div className={styles.archive}><button type="button" className={styles.secondary} disabled={busy||!accountReady} onClick={()=>void submit('retire')}>Arquivar edição</button>
      {selected.status==='approved'&&<p className={styles.help}>Edições aprovadas ficam preservadas. Arquivar impede novos agendamentos; mensagens já em processamento ainda podem ser entregues e continuam no histórico.</p>}</div>}
    </form>}
   </section>
  </div>
 </div></main>;
}
export default function RadarAdmin(){return <AdminAccess permission="permissions.manage" loginRedirect="/admin/login"><Radar/></AdminAccess>;}
