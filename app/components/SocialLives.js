'use client';

import { useEffect, useState } from 'react';

const CHAVE = 'jenios_social_lives_youtube_v1';
const CHAVE_DENUNCIAS = 'jenios_social_lives_denuncias_v1';

function videoIdYoutube(valor) {
  try {
    const url = new URL(valor.trim());
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

export default function SocialLives({ meuPerfil }) {
  const [lives, setLives] = useState([]);
  const [link, setLink] = useState('');
  const [titulo, setTitulo] = useState('');
  const [erro, setErro] = useState('');
  const [carregado, setCarregado] = useState(false);
  const [denunciadas, setDenunciadas] = useState([]);
  const [busca, setBusca] = useState('');
  const livesFiltradas = lives.filter(l => `${l.titulo} ${l.autor} ${l.handle}`.toLowerCase().includes(busca.toLowerCase().trim()));

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


  useEffect(() => {
    try {
      const dados = JSON.parse(localStorage.getItem(CHAVE) || '[]');
      if (Array.isArray(dados)) setLives(dados.filter(x => x && /^[A-Za-z0-9_-]{11}$/.test(x.videoId)));
    } catch { /* Dados antigos inválidos não impedem a página de abrir */ }
    try {
      const ids = JSON.parse(localStorage.getItem(CHAVE_DENUNCIAS) || '[]');
      if (Array.isArray(ids)) setDenunciadas(ids.filter(id => typeof id === 'string'));
    } catch {}
    setCarregado(true);
  }, []);

  useEffect(() => {
    if (!carregado) return;
    try { localStorage.setItem(CHAVE, JSON.stringify(lives)); }
    catch { setErro('Não foi possível salvar as Lives neste navegador.'); }
  }, [lives, carregado]);

  function denunciar(videoId) {
    if (!window.confirm('Registrar denúncia desta transmissão neste navegador? Isso ainda não envia uma denúncia à equipe JENIOS.')) return;
    const novos = Array.from(new Set([...denunciadas, videoId]));
    try {
      localStorage.setItem(CHAVE_DENUNCIAS, JSON.stringify(novos));
      setDenunciadas(novos);
    } catch { setErro('Não foi possível registrar a denúncia local.'); }
  }

  function adicionar(e) {
    e.preventDefault();
    const id = videoIdYoutube(link);
    if (!id) { setErro('Cole um link válido de vídeo ou Live do YouTube.'); return; }
    if (lives.some(x => x.videoId === id)) { setErro('Essa transmissão já foi adicionada.'); return; }
    setLives(atuais => [{videoId:id, titulo:titulo.trim().slice(0,120) || 'Transmissão do YouTube', autor:meuPerfil?.nome || 'Usuário', handle:meuPerfil?.handle || '', criadoEm:new Date().toISOString()}, ...atuais]);
    setTitulo(''); setLink(''); setErro('');
  }

  return <section style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:16,padding:20}}>
    <h2 style={{fontSize:19,margin:'0 0 6px',color:'#312e81'}}>🔴 JENIOS Live</h2>
    <p style={{fontSize:13,color:'#475569',margin:'0 0 16px'}}>Incorpore uma transmissão pública do YouTube. Nesta versão, os links e denúncias ficam salvos somente neste navegador: outras contas não verão essas Lives. A transmissão nativa e a moderação central ainda não estão disponíveis.</p>
    <form onSubmit={adicionar} style={{display:'grid',gap:9,maxWidth:640,marginBottom:20}}>
      <input aria-label="Título da transmissão" value={titulo} onChange={e=>setTitulo(e.target.value)} maxLength={120} placeholder="Título da transmissão" style={{padding:11,border:'1px solid #cbd5e1',borderRadius:9}} />
      <input aria-label="Link da Live do YouTube" type="url" required value={link} onChange={e=>setLink(e.target.value)} placeholder="https://www.youtube.com/live/..." style={{padding:11,border:'1px solid #cbd5e1',borderRadius:9}} />
      <button type="submit" style={{background:'#7c3aed',color:'#fff',border:0,borderRadius:9,padding:12,cursor:'pointer',fontWeight:700}}>Adicionar Live do YouTube</button>
      {erro && <p role="alert" style={{color:'#b91c1c',fontSize:13,margin:0}}>{erro}</p>}
    </form>
    {lives.length > 0 && <input aria-label="Buscar Lives" value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar por título ou criador..." style={{width:'100%',maxWidth:480,padding:11,border:'1px solid #cbd5e1',borderRadius:9,marginBottom:16}} />}
    {lives.length === 0 ? <p style={{color:'#64748b',fontSize:13}}>Nenhuma transmissão adicionada neste navegador.</p> :
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,300px),1fr))',gap:16}}>
        {livesFiltradas.map(live => <article key={live.videoId} style={{border:'1px solid #e2e8f0',borderRadius:12,overflow:'hidden'}}>
          <div style={{aspectRatio:'16/9',background:'#0f172a'}}><iframe title={live.titulo} src={`https://www.youtube-nocookie.com/embed/${live.videoId}`} loading="lazy" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen style={{width:'100%',height:'100%',border:0}} /></div>
          <div style={{padding:12}}><strong style={{fontSize:14}}>{live.titulo}</strong><p style={{fontSize:12,color:'#64748b'}}>Compartilhado por {live.autor} · Status ao vivo definido pelo YouTube</p>
            <a href={`https://www.youtube.com/watch?v=${live.videoId}`} target="_blank" rel="noopener noreferrer" style={{fontSize:12,color:'#6d28d9'}}>Abrir no YouTube ↗</a>
            <button type="button" onClick={() => compartilhar(live.videoId)} style={{marginLeft:12,background:'none',border:0,color:'#6d28d9',cursor:'pointer',fontSize:12}}>Compartilhar</button>
            {live.handle !== meuPerfil?.handle && <button type="button" disabled={denunciadas.includes(live.videoId)} onClick={() => denunciar(live.videoId)} style={{marginLeft:12,background:'none',border:0,color:'#b91c1c',cursor:'pointer',fontSize:12}}>{denunciadas.includes(live.videoId) ? 'Denúncia registrada localmente' : 'Denunciar'}</button>}
            {live.handle === meuPerfil?.handle && <button type="button" onClick={()=>{if(window.confirm('Remover esta Live da sua lista?')) setLives(atual=>atual.filter(x=>x.videoId!==live.videoId));}} style={{marginLeft:12,background:'none',border:0,color:'#b91c1c',cursor:'pointer',fontSize:12}}>Remover</button>}
          </div>
        </article>)}
      </div>}
  </section>;
}
