'use client';
import { useState } from 'react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');

  const realizarLogin = (event) => {
    event.preventDefault();
    alert(`Login efetuado com sucesso para ${email}!`);
  };

  return (
    <main style={{ backgroundColor: '#0f172a', color: '#f8fafc', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', fontFamily: 'Arial, sans-serif', boxSizing: 'border-box', width: '100%' }}>
      
      {/* Card de Login */}
      <div style={{ backgroundColor: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: '16px', padding: '35px', maxWidth: '440px', width: '100%', boxSizing: 'border-box', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
        
        {/* Identificação da Marca */}
        <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#7c3aed', fontFamily: 'monospace', letterSpacing: '2px', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
          JENIOS ID • Acesso ao Ecossistema
        </span>
        
        <h1 style={{ fontSize: '22px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 6px 0' }}>Entrar na Plataforma</h1>
        <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '24px', lineHeight: '1.5', margin: '0 0 24px 0' }}>
          Introduza as suas credenciais para aceder ao seu painel, diagnósticos e ferramentas de automação.
        </p>

        {/* Formulário */}
        <form onSubmit={realizarLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#334155', textTransform: 'uppercase', fontFamily: 'monospace', marginBottom: '6px' }}>
              E-mail Profissional
            </label>
            <input 
              type="email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com" 
              style={{ width: '100%', backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '12px', color: '#0f172a', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#334155', textTransform: 'uppercase', fontFamily: 'monospace', marginBottom: '6px' }}>
              Palavra-passe (Senha)
            </label>
            <input 
              type="password" 
              required
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Sua senha de acesso" 
              style={{ width: '100%', backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '12px', color: '#0f172a', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', marginTop: '4px', marginBottom: '4px' }}>
            <label style={{ display: 'flex', alignItems: 'center', color: '#475569', cursor: 'pointer' }}>
              <input type="checkbox" style={{ marginRight: '6px' }} />
              Lembrar de mim
            </label>
            <button 
              type="button" 
              onClick={() => alert('Funcionalidade de recuperação de senha acionada.')}
              style={{ background: 'none', border: 'none', color: '#7c3aed', fontWeight: 'bold', cursor: 'pointer', padding: 0, fontSize: '12px' }}
            >
              Esqueceu a senha?
            </button>
          </div>

          <button 
            type="submit" 
            style={{ width: '100%', backgroundColor: '#7c3aed', color: '#fff', border: 'none', padding: '14px', borderRadius: '10px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '1px', boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)' }}
          >
            Aceder à Plataforma 🚀
          </button>
        </form>

        {/* Rodapé */}
        <div style={{ textAlign: 'center', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #e2e8f0' }}>
          <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>
            Ainda não tem conta?{' '}
            <button 
              type="button" 
              onClick={() => alert('Redirecionando para a tela de cadastro...')}
              style={{ background: 'none', border: 'none', color: '#7c3aed', fontWeight: 'bold', cursor: 'pointer', padding: 0, fontSize: '12px' }}
            >
              Registar-se
            </button>
          </p>
        </div>

      </div>
    </main>
  );
}