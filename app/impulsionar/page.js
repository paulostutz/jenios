'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import SocialChargeButton from '../components/SocialChargeButton';

const field = { padding: 12, border: '1px solid #cbd5e1', borderRadius: 10, width: '100%', boxSizing: 'border-box', color: '#172033', background: 'white' };
export default function ImpulsionarPostPage() {
  const [posts, setPosts] = useState([]), [message, setMessage] = useState(''), [postId, setPostId] = useState('');
  const [dailyBudget, setDailyBudget] = useState('25.00'), [days, setDays] = useState(7), [objective, setObjective] = useState('profile');
  const [country, setCountry] = useState('Brasil'), [region, setRegion] = useState(''), [city, setCity] = useState('');
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        if (!supabase) throw new Error('Supabase não configurado.');
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Entre na sua conta para escolher uma publicação.');
        const { data, error } = await supabase.from('posts').select('id,body,created_at').eq('author_id', user.id).order('created_at', { ascending: false }).limit(100);
        if (error) throw new Error('Não foi possível carregar suas publicações.');
        if (active) { setPosts(data || []); setPostId(new URLSearchParams(window.location.search).get('post') || data?.[0]?.id || ''); }
      } catch (error) { if (active) setMessage(error.message); }
    }
    load(); return () => { active = false; };
  }, []);
  const dailyCents = Math.round(Number(dailyBudget) * 100);
  const valid = posts.some(p => p.id === postId) && Number.isInteger(days) && days >= 1 && days <= 365 && dailyCents >= 1000 && dailyCents <= 1000000;
  const money = cents => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  return <main style={{ minHeight: '100vh', padding: '32px 16px', background: '#f3f2f9', color: '#172033', fontFamily: 'system-ui' }}><div style={{ maxWidth: 760, margin: 'auto' }}>
    <Link href="/social">← Voltar à Social</Link><p style={{ color: '#6d28d9', fontWeight: 800, letterSpacing: 2, marginTop: 30 }}>JENIOS ADS</p><h1>Impulsionar publicação</h1><p>Escolha sua publicação, o público e quanto deseja investir. A campanha só será liberada após confirmação do pagamento.</p>
    <section style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 20, padding: 24, display: 'grid', gap: 20 }}>
      {message && <p role="alert">{message}</p>}
      <label>Publicação<select value={postId} onChange={e => setPostId(e.target.value)} style={field}><option value="">Selecione sua publicação</option>{posts.map(p => <option key={p.id} value={p.id}>{p.body?.slice(0, 90) || 'Publicação com mídia'} · {new Date(p.created_at).toLocaleDateString('pt-BR')}</option>)}</select></label>
      {!posts.length && <p>Nenhuma publicação própria disponível para impulsionar.</p>}
      <label>Objetivo<select value={objective} onChange={e => setObjective(e.target.value)} style={field}><option value="profile">Visitas ao perfil / alcance</option><option value="website">Redirecionar para site</option><option value="whatsapp">Conversas no WhatsApp</option><option value="copy">Conhecer estratégia / copy</option></select></label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14 }}>{[['País',country,setCountry],['Estado / região',region,setRegion],['Cidade',city,setCity]].map(([label,value,set]) => <label key={label}>{label}<input value={value} onChange={e => set(e.target.value)} maxLength={80} style={field}/></label>)}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14 }}><label>Orçamento diário (R$)<input type="number" min="10" max="10000" step="0.01" value={dailyBudget} onChange={e => setDailyBudget(e.target.value)} style={field}/></label><label>Duração em dias<input type="number" min="1" max="365" step="1" value={days} onChange={e => setDays(Number(e.target.value))} style={field}/></label></div>
      <div style={{ background: '#f5f3ff', padding: 20, borderRadius: 12 }}><p style={{ margin: 0 }}>Investimento total</p><strong style={{ fontSize: 30, color: '#6d28d9' }}>{valid ? money(dailyCents * days) : 'Selecione os dados da campanha'}</strong>{valid && <p>{days} dias × {money(dailyCents)} por dia</p>}</div>
      {valid && <SocialChargeButton productCode="social-boost" label="Continuar para pagamento" target={{ postId, dailyBudget, days, objective, country, region, city }}/>}<small>O total é recalculado no servidor. Nenhuma campanha é marcada como paga pelo navegador.</small>
    </section></div></main>;
}
