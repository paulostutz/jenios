'use client';
import { useState } from 'react';

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState(false);

  const handleAdminLogin = (e) => {
    e.preventDefault();
    
    // Credenciais de exemplo para demonstração (pode alterar conforme necessário)
    if (email === 'admin@jenios.com' && senha === 'admin123') {
      window.location.href = '/admin';
    } else {
      setErro(true);
    }
  };

  return (
    <main style={{ backgroundColor: '#0f172a', color: '#f8fafc', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', fontFamily: 'Arial, sans-serif', boxSizing: 'border-box', width: '100%' }}>
      <div style={{ maxWidth: '420px', width: '100%', backgroundColor: '#ffffff', color: '#0f172a', borderRadius: '24px', padding: '32px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', display: 'flex', flexDirection: 'column', gap: '24px', boxSizing: 'border-box' }}>
        
        {/* Cabeçalho / Logótipo Admin */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid #e2e8f0', paddingBottom: '20px' }}>
          <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: '#dc2626', color: '#fff', fontWeight: '900', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(220, 38, 38, 0.4)' }}>
            A
          </div>
          <div>
            <span style={{ fontSize: '13px', fontWeight: '900', letterSpacing: '1px', textTransform: 'uppercase', display: 'block' }}>JENIOS ADMIN</span>
            <span style={{ fontSize: '10px', color: '#dc2626', fontWeight: 'bold', fontFamily: 'monospace' }}>ACESSO RESTRITO DE SEGURANÇA</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <h1 style={{ fontSize: '20px', fontWeight: '900', color: '#0f172a', margin: 0 }}>Autenticação de Gestão</h1>
          <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>Insira as credenciais de administrador para aceder ao Backoffice.</p>
        </div>

        {erro && (
          <div style={{ backgroundColor: '#fee2e2', border: '1px solid #f87171', padding: '12px', borderRadius: '10px', color: '#991b1b', fontSize: '12px', fontWeight: 'bold', textAlign: 'center' }}>
            ⚠️ Credenciais inválidas. Tente admin@jenios.com / admin123
          </div>
        )}

        <form onSubmit={handleAdminLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px', boxSizing: 'border-box' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#334155', textTransform: 'uppercase' }}>E-mail de Administrador</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@jenios.com" 
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

          <button 
            type="submit" 
            style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#dc2626', color: '#fff', fontWeight: 'bold', fontSize: '12px', padding: '14px', borderRadius: '10px', border: 'none', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '1px', boxShadow: '0 4px 12px rgba(220, 38, 38, 0.3)', marginTop: '6px' }}
          >
            Entrar no Backoffice
          </button>

        </form>

        <div style={{ textAlign: 'center', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
          <a href="/login" style={{ fontSize: '11px', color: '#7c3aed', textDecoration: 'none', fontWeight: 'bold' }}>← Voltar ao Login de Clientes</a>
        </div>

      </div>
    </main>
  );
}