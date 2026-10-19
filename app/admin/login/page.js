'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase';
import { adminFetch } from '../../components/AdminAccess';
import {BrandLockup,BrandFooter} from '../../components/brand/BrandSignature';

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    async function checkExisting() {
      if (!supabase?.auth) return;
      try {
        const response = await adminFetch('/api/admin/access');
        const result = await response.json();
        if (active && result.isMaster === true) {
          window.location.replace('/admin');
        }
      } catch { /* Usuário sem sessão ou sem autorização permanece no formulário */ }
    }
    void checkExisting();
    return () => { active = false; };
  }, []);

  const handleAdminLogin = async e => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErro('');
    try {
      if (!supabase?.auth) throw Error('Autenticação indisponível. Tente novamente mais tarde.');
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: senha
      });
      if (error) throw Error('Não foi possível autenticar com essas credenciais.');
      const response = await adminFetch('/api/admin/access');
      const result = await response.json();
      if (result.isMaster !== true) {
        throw Error('A Central Administrativa é exclusiva do usuário Master.');
      }
      setSenha('');
      window.location.replace('/admin');
    } catch (error) {
      setErro(error.message || 'Não foi possível confirmar o acesso administrativo.');
      setSenha('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main style={{minHeight:'100vh',display:'grid',placeItems:'center',padding:20,background:'radial-gradient(circle at 15% 10%, #312e81 0%, #10172e 48%, #080c18 100%)',fontFamily:'system-ui,sans-serif',color:'#0f172a'}}>
      <section style={{width:'100%',maxWidth:430,background:'#fff',borderRadius:22,padding:'clamp(22px,4vw,36px)',boxShadow:'0 24px 80px rgba(0,0,0,.3)'}}>
        <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:26}}>
          <div><BrandLockup tone="light" context="Admin"/><p style={{fontSize:11,color:'#64748b',margin:'3px 0 0'}}>Acesso administrativo autorizado</p></div>
        </div>
        <h1 style={{fontSize:24,margin:'0 0 8px'}}>Entrar no painel</h1>
        <p style={{fontSize:13,color:'#64748b',lineHeight:1.6,margin:'0 0 22px'}}>Use sua conta JENIOS. O acesso depende das permissões confirmadas no servidor.</p>
        {erro && <p role="alert" style={{background:'#fef2f2',border:'1px solid #fecaca',borderRadius:10,padding:12,color:'#991b1b',fontSize:12}}>{erro}</p>}
        <form onSubmit={handleAdminLogin} style={{display:'grid',gap:16}}>
          <label style={{display:'grid',gap:6,fontSize:12,fontWeight:700}}>E-mail
            <input type="email" autoComplete="username" required disabled={busy} value={email} onChange={e=>setEmail(e.target.value)} style={{width:'100%',boxSizing:'border-box',padding:13,border:'1px solid #cbd5e1',borderRadius:10,fontSize:14}}/>
          </label>
          <label style={{display:'grid',gap:6,fontSize:12,fontWeight:700}}>Senha
            <input type="password" autoComplete="current-password" required disabled={busy} value={senha} onChange={e=>setSenha(e.target.value)} style={{width:'100%',boxSizing:'border-box',padding:13,border:'1px solid #cbd5e1',borderRadius:10,fontSize:14}}/>
          </label>
          <button type="submit" disabled={busy} style={{background:busy?'#a78bfa':'#6d28d9',color:'#fff',padding:14,border:0,borderRadius:10,fontWeight:800,cursor:busy?'progress':'pointer'}}>{busy?'Validando credenciais…':'Acessar área administrativa'}</button>
        </form>
        <p style={{margin:'20px 0 0'}}><Link href="/login" style={{color:'#6d28d9',fontSize:12}}>← Voltar à entrada da JENIOS</Link></p>
        <BrandFooter tone="light" scope="Admin"/>
      </section>
    </main>
  );
}
