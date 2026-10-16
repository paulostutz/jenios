'use client';
import { useEffect, useRef, useState } from 'react';
import { supabase as defaultClient } from '../../lib/supabase';
const enabled = process.env.NEXT_PUBLIC_SOCIAL_PROMOTIONS_ENABLED === 'true';
export default function PromotedPost({ client = defaultClient }) {
  const [country, setCountry] = useState('Brasil'), [region, setRegion] = useState(''), [city, setCity] = useState('');
  const [ad, setAd] = useState(null), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  const epoch = useRef(0), card = useRef(null);
  useEffect(() => {
    if (!enabled || !client) return;
    const listener = client.auth.onAuthStateChange(event => { if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') return; epoch.current++; setAd(null); setMessage('A conta mudou. Consulte novamente se desejar.'); setBusy(false); });
    return () => { epoch.current++; listener?.data?.subscription?.unsubscribe(); };
  }, [client]);
  async function token() { const { data } = await client.auth.getSession(); if (!data?.session) throw new Error('Entre na conta para consultar publicações patrocinadas.'); return data.session.access_token; }
  async function event(kind, current = ad) {
    if (!current || !client) return;
    try { await fetch('/api/social/promotions/events', { method: 'POST', keepalive: true, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + await token() }, body: JSON.stringify({ proof: current.proof, kind }) }); } catch { /* Metrics never control navigation or charge money. */ }
  }
  useEffect(() => {
    if (!ad || !card.current || typeof IntersectionObserver === 'undefined') return;
    let timer, sent = false, intersecting = false;
    function schedule() {
      clearTimeout(timer);
      if (!sent && intersecting && document.visibilityState === 'visible') timer = setTimeout(() => { sent = true; event('impression', ad); observer.disconnect(); }, 1000);
    }
    const observer = new IntersectionObserver(entries => {
      intersecting = entries[0]?.intersectionRatio >= .5; schedule();
    }, { threshold: [.5] });
    document.addEventListener('visibilitychange', schedule);
    observer.observe(card.current); return () => { clearTimeout(timer); observer.disconnect(); document.removeEventListener('visibilitychange', schedule); };
  }, [ad]);
  async function load(e) {
    e.preventDefault(); const version = ++epoch.current; setAd(null); setMessage(''); setBusy(true);
    try {
      if (!client) throw new Error('Conexão não configurada.');
      const response = await fetch('/api/social/promotions', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + await token() }, body: JSON.stringify({ country, region, city }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error);
      if (version === epoch.current) { setAd(result.ad); if (!result.ad) setMessage('Nenhuma publicação patrocinada elegível para esta região agora.'); }
    } catch (error) { if (version === epoch.current) setMessage(error.message); }
    finally { if (version === epoch.current) setBusy(false); }
  }
  if (!enabled) return null;
  return <section style={{ padding: 18, background: '#faf7ff', border: '1px solid #e9d5ff', borderRadius: 14, color: '#241c39' }}>
    <details><summary>Publicidade na comunidade</summary><p>Se desejar ver publicações patrocinadas, informe sua região. Localização autodeclarada, sem GPS ou inferência por IP. Não há alcance garantido.</p>
      <form onSubmit={load} style={{ display: 'grid', gap: 8 }}>{[['País', country, setCountry], ['Estado / região (opcional)', region, setRegion], ['Cidade (opcional)', city, setCity]].map(([label, value, setter]) => <label key={label}>{label}<input value={value} maxLength={80} required={label === 'País'} onChange={e => setter(e.target.value)} style={{ display: 'block', width: '100%', boxSizing: 'border-box', padding: 8 }} /></label>)}<button disabled={busy}>{busy ? 'Consultando…' : 'Ver publicações patrocinadas desta região'}</button></form>
    </details>{message && <p role="status">{message}</p>}
    {ad && <article ref={card} style={{ background: 'white', padding: 16, borderRadius: 12, marginTop: 14 }}><strong>Patrocinado · {ad.author.name}</strong><small style={{ display: 'block' }}>{ad.author.handle}</small><p style={{ whiteSpace: 'pre-wrap' }}>{ad.post.body}</p>{ad.post.media.map((item, index) => item.type === 'video' ? <video key={index} controls playsInline src={item.url} style={{ maxWidth: '100%', maxHeight: 400 }} /> : <img key={index} src={item.url} alt="Mídia patrocinada" style={{ maxWidth: '100%', maxHeight: 400 }} />)}<p><a href={ad.destination} target="_blank" rel="noopener noreferrer" onClick={() => event('click')}>{{ profile: 'Visitar perfil', website: 'Conhecer site', whatsapp: 'Conversar pelo WhatsApp', copy: 'Conhecer proposta do anunciante' }[ad.objective]} ↗</a></p><small>Conteúdo do anunciante, não é recomendação ou verificação da JENIOS. Exibições e cliques são registrados por conta/dia para métricas, não para débito financeiro.</small></article>}
  </section>;
}
