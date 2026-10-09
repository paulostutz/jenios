'use client';
import { useState } from 'react';

export default function LoginPage() {
  const [isCadastro, setIsCadastro] = useState(false);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isCadastro) {
      alert(`Conta criada com sucesso para ${nome} (${email})! A sua conta na Jenios Social foi gerada automaticamente.`);
      window.location.href = '/dashboard-logado';
    } else {
      alert(`Acedendo à plataforma com o e-mail: ${email}`);
      window.location.href = '/dashboard-logado';
    }
  };

  return (
    <main style={{ backgroundColor: '#0f172a', color: '#f8fafc', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', fontFamily: 'Arial, sans-serif', boxSizing: 'border-box', width: '100%' }}>
      <div style={{ maxWidth: '420px', width: '100%', backgroundColor: '#ffffff', color: '#0f172a', borderRadius: '24px', padding: '32px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', display: 'flex', flexDirection: 'column', gap: '20px', boxSizing: 'border-box' }}>
        
        {/* Cabeçalho / Logótipo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' }}>
          <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: '#7c3aed', color: '#fff', fontWeight: '900', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(124, 58, 237, 0.4)' }}>
            J
          </div>
          <div>
            <span style={{ fontSize: '13px', fontWeight: '900', letterSpacing: '1px', textTransform: 'uppercase', display: 'block' }}>JENIOS</span>
            <span style={{ fontSize: '10px', color: '#7c3aed', fontWeight: 'bold', fontFamily: 'monospace' }}>{isCadastro ? 'ÁREA DE CADASTRO' : 'ÁREA DE ACESSO'}</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <h1 style={{ fontSize: '20px', fontWeight: '900', color: '#0f172a', margin: 0 }}>
            {isCadastro ? 'Crie a sua conta' : 'Bem-vindo de volta'}
          </h1>
          <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>
            {isCadastro ? 'Registe-se para aceder ao motor HFT e à rede social.' : 'Insira os seus dados para aceder à plataforma.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px', boxSizing: 'border-box' }}>
          
          {isCadastro && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#334155', textTransform: 'uppercase' }}>Nome Completo</label>
              <input 
                type="text" 
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Seu nome" 
                required={isCadastro}
                style={{ padding: '12px', border: '1px solid #cbd5e1', borderRadius: '10px', fontSize: '12px', backgroundColor: '#f8fafc', outline: 'none', boxSizing: 'border-box', width: '100%' }} 
              />
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#334155', textTransform: 'uppercase' }}>E-mail</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com" 
              required
              style={{ padding: '12px', border: '1px solid #cbd5e1', borderRadius: '10px', fontSize: '12px', backgroundColor: '#f8fafc', outline: 'none', boxSizing: 'border-box', width: '100%' }} 
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#334155', textTransform: 'uppercase' }}>Palavra-passe</label>
            <input 
              type="password" 
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="••••••••" 
              required
              style={{ padding: '12px', border: '1px solid #cbd5e1', borderRadius: '10px', fontSize: '12px', backgroundColor: '#f8fafc', outline: 'none', boxSizing: 'border-box', width: '100%' }} 
            />
          </div>

          {isCadastro && (
            <div style={{ backgroundColor: '#f3e8ff', border: '1px solid #d8b4fe', padding: '10px 12px', borderRadius: '8px' }}>
              <p style={{ fontSize: '11px', color: '#6b21a8', margin: 0, lineHeight: '1.4' }}>
                ✨ <b>Aviso:</b> Ao criar a sua conta na plataforma, a sua conta na <b>Jenios Social</b> será gerada automaticamente de forma integrada.
              </p>
            </div>
          )}

          <button 
            type="submit" 
            style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#7c3aed', color: '#fff', fontWeight: 'bold', fontSize: '12px', padding: '14px', borderRadius: '10px', border: 'none', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '1px', boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)', marginTop: '4px' }}
          >
            {isCadastro ? 'Criar Conta e Ativar Social 🚀' : 'Aceder à Plataforma'}
          </button>

        </form>

        {/* Alternar entre Login e Cadastro */}
        <div style={{ textAlign: 'center', fontSize: '12px', color: '#475569' }}>
          {isCadastro ? (
            <span>Já tem conta? <button type="button" onClick={() => setIsCadastro(false)} style={{ background: 'none', border: 'none', color: '#7c3aed', fontWeight: 'bold', cursor: 'pointer', padding: 0, fontSize: '12px' }}>Fazer Login</button></span>
          ) : (
            <span>Não tem cadastro? <button type="button" onClick={() => setIsCadastro(true)} style={{ background: 'none', border: 'none', color: '#7c3aed', fontWeight: 'bold', cursor: 'pointer', padding: 0, fontSize: '12px' }}>Criar Conta Gratuita</button></span>
          )}
        </div>

        <div style={{ textAlign: 'center', borderTop: '1px solid #e2e8f0', paddingTop: '14px' }}>
          <a href="/lp" style={{ fontSize: '11px', color: '#7c3aed', textDecoration: 'none', fontWeight: 'bold' }}>← Voltar para a Landing Page</a>
        </div>

      </div>
    </main>
  );
}