'use client';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { resolveSocialReportGate } from '../../lib/reports/social-report-gate.mjs';

export default function ReportAccountGate({ children }) {
  const [state, setState] = useState({ status: 'loading', userId: '' });
  const recheck = useRef(() => {});
  useEffect(() => {
    let active = true, revision = 0;
    async function check() {
      const ticket = ++revision;
      try {
        const next = await resolveSocialReportGate(supabase);
        if (!active || ticket !== revision) return;
        setState(next);
      } catch { if (active && ticket === revision) setState({ status: 'unavailable', userId: '' }); }
    }
    recheck.current = check;
    void check();
    const subscription = supabase?.auth.onAuthStateChange(event => {
      if (event === 'INITIAL_SESSION') return;
      revision++;
      setState({ status: event === 'SIGNED_OUT' ? 'guest' : 'loading', userId: '' });
      setTimeout(() => { if (active) void check(); }, 0);
    });
    const focus = () => { if (!document.hidden) void check(); };
    window.addEventListener('focus', focus);
    document.addEventListener('visibilitychange', focus);
    return () => { active = false; revision++; recheck.current = () => {}; subscription?.data?.subscription?.unsubscribe(); window.removeEventListener('focus', focus); document.removeEventListener('visibilitychange', focus); };
  }, []);
  if (state.status === 'ready') return <div key={state.userId}>{children}</div>;
  return <section style={{ maxWidth: 650, margin: '40px auto', padding: 24, background: 'white', borderRadius: 16, color: '#172033', fontFamily: 'system-ui' }}>
    <a href="/social">← Voltar à Social</a>
    <h1>Relatório completo gratuito</h1>
    {state.status === 'loading' ? <p role="status">Verificando sua conta e seu perfil na Social…</p> : <>
      {state.status === 'unavailable' && <p role="alert">Não foi possível conferir seu perfil da Social neste momento. Nenhum relatório foi liberado; tente novamente.</p>}
      {state.status === 'profile-missing' && <p role="status">Sua sessão está válida, mas seu perfil na JENIOS Social ainda não foi localizado. Não crie outra conta para contornar esse problema; procure o suporte para regularizar o cadastro.</p>}
      {state.status === 'guest' && <>
        <p>No pré-lançamento, você pode consultar e baixar os laudos completos do BankScore e do validador de tokens sem pagar. É necessário ter uma conta e um perfil registrado na JENIOS Social.</p>
        <a href="/login" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', padding: '12px 18px', borderRadius: 10, background: '#6d28d9', color: 'white', fontWeight: 700 }}>Entrar ou criar conta na Social</a>
        <p>O acesso abre em outra aba. Depois de entrar ou confirmar o cadastro, volte a esta aba para verificar seu perfil.</p>
      </>}
      {state.status === 'profile-missing' && <a href="/suporte">Ir ao suporte da JENIOS</a>}
      <button type="button" onClick={() => recheck.current()}>Verificar novamente</button>
    </>}
  </section>;
}
