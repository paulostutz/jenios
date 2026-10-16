'use client';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';

export default function ReportAccountGate({ children }) {
  const [state, setState] = useState({ status: 'loading', userId: '' });
  const recheck = useRef(() => {});
  useEffect(() => {
    let active = true, revision = 0;
    async function check() {
      const ticket = ++revision;
      try {
        const result = await supabase?.auth.getUser();
        if (!active || ticket !== revision) return;
        const user = !result?.error && result?.data?.user;
        setState(user?.id && !user.is_anonymous ? { status: 'ready', userId: user.id } : { status: 'guest', userId: '' });
      } catch { if (active && ticket === revision) setState({ status: 'guest', userId: '' }); }
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
    {state.status === 'loading' ? <p role="status">Verificando sua conta…</p> : <>
      <p>No pré-lançamento, você pode consultar e baixar os laudos completos do BankScore e do validador de tokens sem pagar. Basta ter uma conta na JENIOS Social e estar conectado.</p>
      <a href="/login" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', padding: '12px 18px', borderRadius: 10, background: '#6d28d9', color: 'white', fontWeight: 700 }}>Entrar ou criar conta na Social</a>
      <p>O acesso abre em outra aba para preservar sua consulta. Depois de entrar ou confirmar seu cadastro, volte a esta aba; o relatório será liberado para emissão.</p>
      <button type="button" onClick={() => recheck.current()}>Já entrei · verificar acesso</button>
    </>}
  </section>;
}
