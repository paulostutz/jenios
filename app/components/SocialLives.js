'use client';

import { useEffect, useRef, useState } from 'react';

function videoIdYoutube(valor) {
  try {
    const url = new URL(valor.trim());
    if (!['http:','https:'].includes(url.protocol)) return null;
    const host = url.hostname.toLowerCase();
    let id = '';
    if (host === 'youtu.be' || host === 'www.youtu.be') id = url.pathname.split('/')[1] || '';
    else if (['youtube.com','www.youtube.com','m.youtube.com'].includes(host)) {
      if (url.pathname === '/watch') id = url.searchParams.get('v') || '';
      else if (url.pathname.startsWith('/live/') || url.pathname.startsWith('/embed/')) id = url.pathname.split('/')[2] || '';
    }
    return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  } catch { return null; }
}

export default function SocialLives({ meuPerfil, onLoad, onCreate, onRemove, onReport }) {
  const [lives, setLives] = useState([]);
  const [link, setLink] = useState('');
  const [titulo, setTitulo] = useState('');
  const [erro, setErro] = useState('');
  const [busy,setBusy]=useState(false),[next,setNext]=useState(null),[reportId,setReportId]=useState(null),[reason,setReason]=useState('other'),[details,setDetails]=useState('');
  const mounted=useRef(true);
  const [denunciadas, setDenunciadas] = useState([]);
  const [busca, setBusca] = useState('');
  const livesFiltradas = lives.filter(l => `${l.title} ${l.autor}`.toLowerCase().includes(busca.toLowerCase().trim()));

  async function compartilhar(videoId) {
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    try {
      if (navigator.share) await navigator.share({title:'JENIOS Live',url});
      else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        alert('Link da transmissão copiado.');
      } else window.prompt('Copie o link da transmissão:', url);
    } catch (e) {
      if (e?.name !== 'AbortError') window.prompt('Copie o link da transmissão:', url);
    }
  }


  async function load(offset=0){
    setBusy(true);setErro('');
    try{const data=await onLoad(offset);if(mounted.current){setLives(old=>offset?[...old,...data.lives.filter(x=>!old.some(y=>y.id===x.id))]:data.lives);setNext(data.nextOffset);}}
    catch{if(mounted.current)setErro('Não foi possível carregar as Lives. Tente atualizar.');}
    finally{if(mounted.current)setBusy(false);}
  }
  useEffect(()=>{mounted.current=true;void load();return()=>{mounted.current=false;};},[]);
  async function adicionar(e){
    e.preventDefault();const videoId=videoIdYoutube(link);
    if(!videoId){setErro('Cole um link válido de vídeo ou Live do YouTube.');return;}
    setBusy(true);setErro('');
    try{await onCreate({videoId,title:titulo.trim()||'Transmissão do YouTube'});if(mounted.current){setTitulo('');setLink('');await load();}}
    catch(e){if(mounted.current)setErro(e.code==='LIVE_ALREADY_EXISTS'?'Você já cadastrou esta transmissão.':'Não foi possível salvar a Live. Tente novamente.');}
    finally{if(mounted.current)setBusy(false);}
  }
  async function remover(id){
    if(!window.confirm('Remover esta Live da Social?'))return;setBusy(true);setErro('');
    try{await onRemove(id);if(mounted.current)await load();}catch{if(mounted.current)setErro('Não foi possível remover a Live.');}finally{if(mounted.current)setBusy(false);}
  }
  async function denunciar(e){
    e.preventDefault();setBusy(true);setErro('');
    try{await onReport(reportId,reason,details);if(mounted.current){setDenunciadas(old=>[...old,reportId]);setReportId(null);setDetails('');}}catch{if(mounted.current)setErro('Não foi possível enviar a denúncia. Tente novamente.');}finally{if(mounted.current)setBusy(false);}
  }

  return <section style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:16,padding:20}}>
    <h2 style={{fontSize:19,margin:'0 0 6px',color:'#312e81'}}>🔴 JENIOS Live</h2>
    <p style={{fontSize:13,color:'#475569',margin:'0 0 16px'}}>Incorpore uma transmissão pública do YouTube. As transmissões cadastradas são compartilhadas entre contas, e as denúncias são encaminhadas à moderação. O vídeo é transmitido pelo YouTube.</p>
    <form onSubmit={adicionar} style={{display:'grid',gap:9,maxWidth:640,marginBottom:20}}>
      <input aria-label="Título da transmissão" value={titulo} onChange={e=>setTitulo(e.target.value)} maxLength={120} placeholder="Título da transmissão" style={{padding:11,border:'1px solid #cbd5e1',borderRadius:9}} />
      <input aria-label="Link da Live do YouTube" type="url" required value={link} onChange={e=>setLink(e.target.value)} placeholder="https://www.youtube.com/live/..." style={{padding:11,border:'1px solid #cbd5e1',borderRadius:9}} />
      <button disabled={busy} type="submit" style={{background:'#7c3aed',color:'#fff',border:0,borderRadius:9,padding:12,cursor:'pointer',fontWeight:700}}>Adicionar Live do YouTube</button>
      {erro && <p role="alert" style={{color:'#b91c1c',fontSize:13,margin:0}}>{erro}</p>}
    </form>
    <button disabled={busy} onClick={()=>load()}>Atualizar Lives</button>
    {busy&&<p role="status">Carregando…</p>}
    {reportId&&<form onSubmit={denunciar} style={{padding:16,border:'1px solid #cbd5e1',margin:'16px 0'}}><h3>Denunciar transmissão</h3><label>Motivo <select aria-label="Motivo da denúncia da Live" value={reason} onChange={e=>setReason(e.target.value)}>{Object.entries({sexual:'Conteúdo sexual',hate:'Discurso de ódio',violence:'Violência',terrorism:'Terrorismo',fraud:'Fraude',harassment:'Assédio',other:'Outro'}).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label><textarea aria-label="Detalhes da denúncia da Live" value={details} maxLength={2000} onChange={e=>setDetails(e.target.value)} style={{display:'block',width:'100%'}}/><button disabled={busy} type="submit">Enviar denúncia da Live</button><button disabled={busy} type="button" onClick={()=>setReportId(null)}>Cancelar</button></form>}
    {lives.length > 0 && <input aria-label="Buscar Lives" value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar nas Lives carregadas..." style={{width:'100%',maxWidth:480,padding:11,border:'1px solid #cbd5e1',borderRadius:9,marginBottom:16}} />}
    {lives.length === 0 ? <p style={{color:'#64748b',fontSize:13}}>Nenhuma transmissão disponível.</p> :
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,300px),1fr))',gap:16}}>
        {livesFiltradas.map(live => <article key={live.id} style={{border:'1px solid #e2e8f0',borderRadius:12,overflow:'hidden'}}>
          <div style={{aspectRatio:'16/9',background:'#0f172a'}}><iframe title={live.title} src={`https://www.youtube-nocookie.com/embed/${live.youtube_video_id}`} loading="lazy" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen style={{width:'100%',height:'100%',border:0}} /></div>
          <div style={{padding:12}}><strong style={{fontSize:14}}>{live.title}</strong><p style={{fontSize:12,color:'#64748b'}}>Compartilhado por {live.autor} · Status ao vivo definido pelo YouTube</p>
            <a href={`https://www.youtube.com/watch?v=${live.youtube_video_id}`} target="_blank" rel="noopener noreferrer" style={{fontSize:12,color:'#6d28d9'}}>Abrir no YouTube ↗</a>
            <button type="button" onClick={() => compartilhar(live.youtube_video_id)} style={{marginLeft:12,background:'none',border:0,color:'#6d28d9',cursor:'pointer',fontSize:12}}>Compartilhar</button>
            {live.host_id !== meuPerfil?.id && <button type="button" disabled={busy||denunciadas.includes(live.id)} onClick={() => {setReportId(live.id);setReason('other');setDetails('');}} style={{marginLeft:12,background:'none',border:0,color:'#b91c1c',cursor:'pointer',fontSize:12}}>{denunciadas.includes(live.id) ? 'Denúncia enviada' : 'Denunciar'}</button>}
            {live.host_id === meuPerfil?.id && <button type="button" disabled={busy} onClick={()=>remover(live.id)} style={{marginLeft:12,background:'none',border:0,color:'#b91c1c',cursor:'pointer',fontSize:12}}>Remover</button>}
          </div>
        </article>)}
      </div>}
    {next!==null&&<button disabled={busy} onClick={()=>load(next)}>Carregar mais Lives</button>}
  </section>;
}
