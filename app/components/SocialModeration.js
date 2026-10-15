'use client';
import {useEffect,useRef,useState} from 'react';
import {supabase} from '../../lib/supabase';
const labels={pending:'Pendentes',reviewing:'Em análise',resolved:'Resolvidas',dismissed:'Arquivadas'};
export default function SocialModeration(){
 const [rows,setRows]=useState([]),[status,setStatus]=useState('pending'),[next,setNext]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notes,setNotes]=useState({});
 const epoch=useRef(0),owner=useRef(null),sequence=useRef(0),mounted=useRef(true);
 async function request(path,options={}){
  const revision=epoch.current,r=await supabase?.auth.getSession(),session=r?.data?.session;
  if(!session?.user?.id||session.user.is_anonymous)throw Error('Entre com sua conta de moderador para continuar.');
  if(revision!==epoch.current)throw Error('A sessão mudou.');
  owner.current=session.user.id;
  const response=await fetch('/api/social/moderation'+path,{...options,headers:{authorization:'Bearer '+session.access_token,'content-type':'application/json'},cache:'no-store'}),data=await response.json();
  if(!mounted.current||revision!==epoch.current||owner.current!==session.user.id)throw Error('A sessão mudou.');
  if(!response.ok)throw Error(data.error||'Não foi possível carregar a moderação.');return data;
 }
 async function load(filter='pending',offset=0){
  const seq=++sequence.current;setBusy(true);setError('');if(!offset)setRows([]);
  try{const data=await request('?'+new URLSearchParams({status:filter,offset:String(offset)}));if(mounted.current&&seq===sequence.current){setRows(old=>offset?[...old,...data.reports]:data.reports);setNext(data.nextOffset);}}
  catch(e){if(mounted.current&&seq===sequence.current)setError(e.message);}
  finally{if(mounted.current&&seq===sequence.current)setBusy(false);}
 }
 useEffect(()=>{
  mounted.current=true;void load();
  const subscription=supabase?.auth.onAuthStateChange((event,session)=>{
   if(event==='INITIAL_SESSION'||session?.user?.id===owner.current&&['SIGNED_IN','TOKEN_REFRESHED','USER_UPDATED'].includes(event))return;
   epoch.current++;sequence.current++;owner.current=session?.user?.id||null;setRows([]);setNotes({});setNext(null);setStatus('pending');setError('');setBusy(false);
   setTimeout(()=>{if(mounted.current)void load();},0);
  });
  return()=>{mounted.current=false;epoch.current++;sequence.current++;subscription?.data?.subscription?.unsubscribe();};
 },[]);
 async function decide(report,decision){
  const note=(notes[report.id]||'').trim();if(note.length<3){setError('Informe uma justificativa com pelo menos três caracteres.');return;}
  if(decision==='hide'&&!window.confirm('Ocultar esta publicação da Social? A decisão ficará registrada e poderá ser revertida.'))return;
  const revision=epoch.current;setBusy(true);setError('');
  try{await request('',{method:'POST',body:JSON.stringify({id:report.id,decision,note,expectedStatus:report.status})});if(revision===epoch.current){setNotes({});await load(status);}}
  catch(e){if(mounted.current&&revision===epoch.current)setError(e.message);}
  finally{if(mounted.current&&revision===epoch.current)setBusy(false);}
 }
 return <section style={{background:'#fff',color:'#0f172a',padding:24,borderRadius:20,border:'1px solid #cbd5e1'}}><h2>Moderação da Jenios Social</h2><p>Analise as denúncias e registre a justificativa de cada decisão. Ocultar uma publicação permite restaurá-la depois.</p><label>Estado da denúncia <select aria-label="Estado da denúncia" disabled={busy} value={status} onChange={e=>{setStatus(e.target.value);setNext(null);void load(e.target.value);}}>{Object.entries(labels).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label> <button disabled={busy} onClick={()=>load(status)}>Atualizar denúncias</button>{error&&<p role="alert">{error}</p>}{busy&&<p role="status">Carregando…</p>}{!busy&&!error&&!rows.length&&<p>Nenhuma denúncia neste estado.</p>}{rows.map(report=><article key={report.id} style={{marginTop:20,padding:16,border:'1px solid #ddd6fe',borderRadius:12}}><strong>{report.reason} · {labels[report.status]}</strong><p>{report.details||'Sem detalhes adicionais.'}</p>{report.target_type==='post'?<><blockquote>{report.post_body||'Publicação indisponível ou sem texto.'}</blockquote><a href={'/social?post='+encodeURIComponent(report.target_id)} target="_blank" rel="noreferrer">Abrir publicação</a><p>{report.hidden?'Publicação oculta':'Publicação não oculta'}</p></>:<p>Tipo de conteúdo: {report.target_type}{report.target_type==='live'&&<><br/>{report.live_title||'Transmissão indisponível'}<br/>{/^[A-Za-z0-9_-]{11}$/.test(report.live_video_id||'')&&<a href={'https://www.youtube.com/watch?v='+report.live_video_id} target="_blank" rel="noreferrer">Abrir no YouTube</a>}</>}</p>}<label>Justificativa<textarea aria-label={'Justificativa '+report.id} value={notes[report.id]||''} onChange={e=>setNotes(old=>({...old,[report.id]:e.target.value}))} maxLength={2000} style={{display:'block',width:'100%',minHeight:70}}/></label><div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:12}}><button disabled={busy} onClick={()=>decide(report,'reviewing')}>Marcar em análise</button><button disabled={busy} onClick={()=>decide(report,'dismissed')}>Arquivar denúncia</button>{['post','live'].includes(report.target_type)&&<button disabled={busy} onClick={()=>decide(report,report.hidden?'restore':'hide')}>{report.target_type==='live'?(report.hidden?'Restaurar transmissão':'Ocultar transmissão'):(report.hidden?'Restaurar publicação':'Ocultar publicação')}</button>}</div></article>)}{next!==null&&<button disabled={busy} onClick={()=>load(status,next)}>Carregar mais denúncias</button>}</section>;
}
