'use client';
import { useState } from 'react';

export default function PerfilPage() {
  const [nome, setNome] = useState('Paulo Stutz');
  const [bio, setBio] = useState('CEO de Letter Franqueadora Ltda e Trader Institucional. Focado em alta performance e tecnologia adaptativa.');
  const [salvo, setSalvo] = useState(false);

  const salvarPerfil = (e) => {
    e.preventDefault();
    setSalvo(true);
    setTimeout(() => setSalvo(false), 3000);
  };

  return (
    <main style={{ backgroundColor: '#0f172a', color: '#1e293b', minHeight: '100vh', padding: '30px 20px', fontFamily: 'Arial, sans-serif', boxSizing: 'border-box', width: '100%' }}>
      <div style={{ maxWidth: '700px', margin: '0 auto' }}>
        
        {/* Cabeçalho */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', backgroundColor: '#ffffff', padding: '20px 25px', borderRadius: '16px', border: '1px solid #cbd5e1', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', boxSizing: 'border-box' }}>
          <div>
            <span style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 'bold', fontFamily: 'monospace', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>
              JENIOS PLATFORM • GESTÃO DE PERFIL
            </span>
            <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>
              O seu Perfil e Afiliados
            </h1>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <a href="/social" style={{ backgroundColor: '#f1f5f9', color: '#475569', padding: '8px 14px', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold', fontSize: '12px', border: '1px solid #cbd5e1' }}>
              ← Voltar ao Social
            </a>
          </div>
        </div>

        {/* Formulário de Perfil */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '16px', padding: '30px', marginBottom: '25px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
          <form onSubmit={salvarPerfil}>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#334155', display: 'block', marginBottom: '8px' }}>Nome Completo</label>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', color: '#1e293b', fontSize: '13px', boxSizing: 'border-box', outline: 'none' }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#334155', display: 'block', marginBottom: '8px' }}>Biografia / Resumo Profissional</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows="3"
                style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', color: '#1e293b', fontSize: '13px', boxSizing: 'border-box', outline: 'none', resize: 'none' }}
              />
            </div>

            <div style={{ marginBottom: '25px', padding: '15px', borderRadius: '12px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 'bold', fontFamily: 'monospace', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>O seu Link de Afiliado Exclusivo</span>
              <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 10px 0' }}>Partilhe este link para convidar outros traders e rentabilizar com o ecossistema:</p>
              <div style={{ background: '#ffffff', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontFamily: 'monospace', fontSize: '12px', color: '#0f172a' }}>
                https://jenios.com.br/cadastro?ref=paulostutz
              </div>
            </div>

            <button
              type="submit"
              style={{ backgroundColor: '#7c3aed', color: '#fff', border: 'none', padding: '14px 20px', borderRadius: '10px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', width: '100%', textAlign: 'center' }}
            >
              Guardar Alterações do Perfil
            </button>

            {salvo && (
              <div style={{ backgroundColor: '#d1fae5', color: '#065f46', padding: '10px', borderRadius: '8px', fontSize: '12px', textAlign: 'center', fontWeight: 'bold', marginTop: '15px' }}>
                ✅ Alterações guardadas com sucesso!
              </div>
            )}

          </form>
        </div>

      </div>
    </main>
  );
}
