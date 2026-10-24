'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import AdminAccess,{adminFetch} from '../../components/AdminAccess';

const rating=value=>value==='helpful'?'Ajudou':'Precisa melhorar';
const card={background:'#fff',border:'1px solid #dbe1ea',borderRadius:14,padding:20,marginTop:18};
function Review(){
 const [data,setData]=useState(null),[error,setError]=useState(''),[refresh,setRefresh]=useState(0);
 useEffect(()=>{
  let live=true;const controller=new AbortController();setData(null);setError('');
  adminFetch('/api/admin/assistant-feedback',{signal:controller.signal}).then(r=>r.json()).then(value=>{if(live)setData(value);})
   .catch(e=>{if(live&&e.name!=='AbortError')setError(e.message||'Não foi possível carregar as avaliações.');});
  return()=>{live=false;controller.abort();};
 },[refresh]);
 return <main style={{minHeight:'100vh',background:'#f4f3fa',color:'#172033',padding:'32px 16px',fontFamily:'system-ui'}}>
  <div style={{maxWidth:1000,margin:'auto'}}><Link href="/admin">← Administração</Link>
   <h1>Qualidade do Gênio e da Gênia</h1>
   <p>Avaliações compartilhadas com a equipe ajudam a identificar assuntos que precisam de revisão.</p>
   <button type="button" onClick={()=>setRefresh(n=>n+1)} disabled={!data&&!error}>Atualizar avaliações</button>
   {error&&<p role="alert">{error}</p>}
   {!data&&!error&&<p role="status">Carregando avaliações…</p>}
   {data?.available===false&&<section style={card}><h2>Revisão em preparação</h2><p>O histórico e as avaliações ainda aguardam ativação neste ambiente.</p></section>}
   {data?.available&&<>
    <section style={card}><h2>Últimos {data.windowDays} dias</h2>
     <p>{data.totalConsent||0} avaliações compartilhadas.</p>
     {(data.ratings||[]).map(item=><p key={item.rating}><strong>{rating(item.rating)}:</strong> {item.count}</p>)}
     <p>Comentários são sugestões de usuários. Uma melhoria só deve entrar no conteúdo oficial depois de conferir a fonte, revisar o texto e testar o comportamento.</p>
    </section>
    <section style={card}><h2>Assuntos para revisão</h2>
     {data.topics?.length?<table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr><th align="left">Assunto</th><th align="left">Avaliação</th><th align="right">Quantidade</th></tr></thead>
      <tbody>{data.topics.map(item=><tr key={item.topic+':'+item.rating}><td>{item.topic==='unspecified'?'Assunto geral':item.topic}</td><td>{rating(item.rating)}</td><td align="right">{item.count}</td></tr>)}</tbody></table>:<p>Ainda não há avaliações compartilhadas neste período.</p>}
    </section>
    <section style={card}><h2>Comentários autorizados</h2>
     <p>Esta tela recebe apenas a observação que a pessoa escolheu compartilhar. Não mostra a conversa completa. Identificadores comuns são removidos; evite reproduzir dados pessoais que ainda apareçam no texto.</p>
     {(data.items||[]).map(item=><article key={item.feedbackId} style={{borderTop:'1px solid #dbe1ea',padding:'14px 0'}}>
      <strong>{rating(item.rating)}</strong><p style={{whiteSpace:'pre-wrap'}}>{item.note||'Avaliação sem comentário.'}</p>
      <small>{new Date(item.createdAt).toLocaleString('pt-BR')}{item.topic?' · '+item.topic:''}</small>
     </article>)}
    </section>
   </>}
  </div>
 </main>;
}
export default function AssistantReview(){return <AdminAccess permission="permissions.manage" loginRedirect="/admin/login"><Review/></AdminAccess>;}
