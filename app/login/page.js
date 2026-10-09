'use client';
import { useState } from 'react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [indicacao, setIndicacao] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    // Lógica de submissão de login/registo com suporte a afiliado opcional
    alert(`Acedendo à plataforma com: ${email} ${indicacao ? `(Indicação: ${indicacao})` : ''}`);
  };

  return (
    <main style={{ backgroundColor: '#0f172a', color: '#f8fafc', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', fontFamily: 'Arial, sans-serif', boxSizing: 'border-box', width: '100%' }}>
      <div style={{ maxWidth: '420px', width: '100%', backgroundColor: '#ffffff', color: '#0f172a', borderRadius: '24px', padding: '32px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', display: 'flex', flexDirection: 'column', gap: '24px', boxSizing: 'border-box' }}>
        
        {/* Cabeçalho / Logótipo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid #e2e8f0', paddingBottom: '20px' }}>
          <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: '#7c3aed', color: '#fff', fontWeight: '900', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(124, 58, 237, 0.4)' }}>
            J
          </div>
          <div>
            <span style={{ fontSize: '13px', fontWeight: '900', letterSpacing: '1px', textTransform: 'uppercase', display: 'block' }}>JENIOS</span>
            <span style={{ fontSize: '10px', color: '#7c3aed', fontWeight: 'bold', fontFamily: 'monospace' }}>ÁREA DE ACESSO & TESTE GRÁTIS</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <h1 style={{ fontSize: '20px', fontWeight: '900', color: '#0f172a', margin: 0 }}>Bem-vindo de volta</h1>
          <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>Insira os seus dados para aceder ou criar a sua conta na plataforma.</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', boxSizing: 'border-box' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
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

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
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

          {/* Campo de Indicação de Afiliado (Opcional) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#334155', textTransform: 'uppercase', display: 'flex', justifyContent: 'space-between' }}>
              <span>Código de Indicação (Afiliado)</span>
              <span style={{ color: '#64748b', fontWeight: 'normal', fontSize: '10px' }}>Opcional</span>
            </label>
            <input 
              type="text" 
              value={indicacao}
              onChange={(e) => setIndicacao(e.target.value)}
              placeholder="Ex: CODIGO123" 
              style={{ padding: '12px', border: '1px solid #cbd5e1', borderRadius: '10px', fontSize: '12px', backgroundColor: '#f8fafc', outline: 'none', boxSizing: 'border-box', width: '100%' }} 
            />
          </div>

          <button 
            type="submit" 
            style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#7c3aed', color: '#fff', fontWeight: 'bold', fontSize: '12px', padding: '14px', borderRadius: '10px', border: 'none', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '1px', boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)', marginTop: '6px' }}
          >
            Aceder / Iniciar Teste Grátis
          </button>

        </form>

        <div style={{ textAlign: 'center', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
          <a href="/lp" style={{ fontSize: '11px', color: '#7c3aed', textDecoration: 'none', fontWeight: 'bold' }}>← Voltar para a Landing Page</a>
        </div>

      </div>
    </main>
  );
}