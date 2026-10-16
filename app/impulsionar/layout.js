'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';

// Covers both the campaign editor and direct visits to /impulsionar/campanhas.
// Campaign APIs independently validate the bearer token on the server.
export default function ImpulsionarLayout({ children }) {
  const [access, setAccess] = useState('checking');
  useEffect(() => {
    let active = true;
    let version = 0;
    async function verify() {
      const request = ++version;
      setAccess('checking');
      try {
        const result = supabase ? await supabase.auth.getUser() : null;
        if (active && request === version) setAccess(result?.data?.user && !result.error ? 'allowed' : 'guest');
      } catch {
        if (active && request === version) setAccess('guest');
      }
    }
    verify();
    const listener = supabase?.auth.onAuthStateChange((event) => {
      if (event === 'INITIAL_SESSION') return;
      // Do not call another auth method while the auth callback holds its lock.
      version++;
      setAccess('checking');
      queueMicrotask(() => { if (active) verify(); });
    });
    return () => { active = false; version++; listener?.data?.subscription?.unsubscribe(); };
  }, []);
  if (access === 'allowed') return children;
  return <main style={{ minHeight: '100vh', padding: 32, background: '#f3f2f9', color: '#172033', fontFamily: 'system-ui' }}>
    <Link href="/social">← Voltar à Social</Link>
    {access === 'checking' ? <p role="status">Verificando sua conta…</p> : <>
      <h1>Entre para impulsionar</h1>
      <p>O impulsionamento está disponível para usuários conectados.</p>
      <Link href="/login">Entrar na minha conta</Link>
    </>}
  </main>;
}
