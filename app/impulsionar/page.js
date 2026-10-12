'use client';
import { useEffect, useMemo, useState } from 'react';

const field = {width:'100%',padding:12,border:'1px solid #cbd5e1',borderRadius:10,boxSizing:'border-box',background:'#fff',color:'#0f172a'};
const card = {background:'#fff',borderRadius:16,padding:24,color:'#0f172a',border:'1px solid #e2e8f0'};
const objetivos = ['Visitas ao perfil','Visitas ao site','Conversas no WhatsApp','Conhecer estratégia de cópia'];
export default function ImpulsionarPostPage(){
 const [posts,setPosts]=useState([]); const [postId,setPostId]=useState('');
 const [objetivo,setObjetivo]=useState(objetivos[0]); const [pais,setPais]=useState('Brasil');
 const [estado,setEstado]=useState(''); const [cidade,setCidade]=useState('');
 const [idadeMin,setIdadeMin]=useState(21); const [idadeMax,setIdadeMax]=useState(60);
 const [orcamento,setOrcamento]=useState(25); const [dias,setDias]=useState(7);
 const [destino,setDestino]=useState(''); const [aviso,setAviso]=useState('');
 useEffect(()=>{
   try {
     const encontrados=[];
     for(let i=0;i<localStorage.length;i++){
       const k=localStorage.key(i);
       if(!k || !/jenios.*post|post.*jenios/i.test(k)) continue;
       const data=JSON.parse(localStorage.getItem(k)||'null');
       if(Array.isArray(data)) encontrados.push(...data);
     }
     const validos=encontrados.filter(x=>x && x.id && (x.texto || x.youtubeUrl));
     const unicos=Array.from(new Map(validos.map(x=>[String(x.id),x])).values());
     setPosts(unicos); if(unicos.length)setPostId(String(unicos[0].id));
   }catch(e){setAviso('Não foi possível ler os posts deste navegador.');}
 },[]);
 const total=useMemo(()=>Number(orcamento)*Number(dias),[orcamento,dias]);
 const valido=Number(orcamento)>=10 && Number(dias)>=1 && Number.isInteger(Number(dias)) && Number(idadeMin)>=18 && Number(idadeMax)>=Number(idadeMin) && (objetivo==='Visitas ao perfil' || /^https:\/\//i.test(destino));
 const formatar=(v)=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
 function revisar(e){e.preventDefault(); if(!valido)return setAviso('Confira o orçamento, as idades e a URL HTTPS de destino.'); setAviso('Prévia validada. Campanha NÃO enviada e nenhum Pix gerado. Para ativar anúncios reais é necessário configurar pagamentos, moderação, entrega e métricas no servidor.');}
 return <main style={{background:'#0f172a',minHeight:'100vh',padding:'32px 16px',fontFamily:'Arial,sans-serif'}}><div style={{maxWidth:760,margin:'auto',display:'grid',gap:16}}>
 <a href="/social" style={{color:'#ddd6fe'}}>← Voltar à JENIOS Social</a>
 <form onSubmit={revisar} style={{...card,display:'grid',gap:20}}><div><small style={{color:'#7c3aed',fontWeight:800}}>JENIOS ADS • PRÉVIA DE CAMPANHA</small><h1>Impulsionar publicação</h1><p>Configure e revise uma campanha. A distribuição paga ainda não está habilitada.</p></div>
 <label>Publicação<select style={field} value={postId} onChange={e=>setPostId(e.target.value)}><option value="">Selecionar posteriormente</option>{posts.map(x=><option key={x.id} value={x.id}>{String(x.texto||x.youtubeUrl).slice(0,95)}</option>)}</select><small>Somente posts salvos neste navegador podem aparecer aqui; a seleção definitiva exigirá consulta autenticada ao banco de dados.</small></label>
 <fieldset style={{border:'1px solid #ddd6fe',borderRadius:12}}><legend>Objetivo</legend>{objetivos.map(x=><label key={x} style={{display:'block',padding:8}}><input type="radio" checked={objetivo===x} onChange={()=>setObjetivo(x)}/> {x}</label>)}</fieldset>
 {objetivo!=='Visitas ao perfil'&&<label>Destino HTTPS<input style={field} value={destino} onChange={e=>setDestino(e.target.value)} placeholder="https://..." required/></label>}
 <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:12}}><label>País<input style={field} value={pais} onChange={e=>setPais(e.target.value)}/></label><label>Estado<input style={field} value={estado} onChange={e=>setEstado(e.target.value)}/></label><label>Cidade<input style={field} value={cidade} onChange={e=>setCidade(e.target.value)}/></label></div>
 <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:12}}><label>Idade mínima<input style={field} type="number" min="18" max="80" value={idadeMin} onChange={e=>setIdadeMin(e.target.value)}/></label><label>Idade máxima<input style={field} type="number" min="18" max="80" value={idadeMax} onChange={e=>setIdadeMax(e.target.value)}/></label></div>
 <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:12}}><label>Orçamento diário (R$)<input style={field} type="number" min="10" step="0.01" value={orcamento} onChange={e=>setOrcamento(e.target.value)}/></label><label>Duração (dias)<input style={field} type="number" min="1" step="1" value={dias} onChange={e=>setDias(e.target.value)}/></label></div>
 <div style={{background:'#f5f3ff',padding:16,borderRadius:12}}><b>Investimento planejado: {formatar(total)}</b><p style={{fontSize:12}}>Sem cobrança. A estimativa de alcance só será exibida após haver dados de campanhas reais.</p></div>
 <button disabled={!valido} style={{...field,background:valido?'#7c3aed':'#94a3b8',color:'#fff',fontWeight:800,cursor:valido?'pointer':'not-allowed'}}>Revisar campanha (sem cobrança)</button>
 {aviso&&<p role="status" style={{padding:12,background:'#fef3c7',borderRadius:8}}>{aviso}</p>}
 <small>Campanhas relacionadas a investimentos exigem revisão de conformidade e não podem prometer lucros ou resultados garantidos.</small></form></div></main>;
}
