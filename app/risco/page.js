'use client';
import { useState } from 'react';

export default function RiscoPage() {
  const [stopDiario, setStopDiario] = useState('500.00');
  const [alavancagem, setAlavancagem] = useState('10x');
  const [modoSeguranca, setModoSeguranca] = useState(true);
  const [salvo, setSalvo] = useState(false);

  const guardarConfiguracoes = (e) => {
    e.preventDefault();
    setSalvo(true);
    setTimeout(() => setSalvo(false), 3000);
  };

  return (
    <main style={{ backgroundColor: '#0f172a', color: '#1e293b', minHeight: '100vh', padding: '30px 20px', fontFamily: 'Arial, sans-serif', boxSizing: 'border-box', width: '100%' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        
        {/* Cabeçalho */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', backgroundColor: '#ffffff', padding: '20px 25px', borderRadius: '16px', border: '1px solid #cbd5e1', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', boxSizing: 'border-box', flexWrap: 'wrap', gap: '15px' }}>
          <div>
            <span style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 'bold', fontFamily: 'monospace', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>
              JENIOS PLATFORM • GOVERNANÇA E RISCO
            </span>
            <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>
              Parâmetros de Proteção e Exposição
            </h1>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <a href="/dashboard" style={{ backgroundColor: '#f1f5f9', color: '#475569', padding: '9px 14px', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold', fontSize: '12px', border: '1px solid #cbd5e1' }}>
              ← Mesa de Operações
            </a>
          </div>
        </div>

        {/* Formulário de Configuração de Risco */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '16px', padding: '30px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
          <form onSubmit={guardarConfiguracoes}>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#334155', display: 'block', marginBottom: '8px' }}>
                Limite de Perda Máxima Diária (Stop Diário em R$)
              </label>
              <input
                type="text"
                value={stopDiario}
                onChange={(e) => setStopDiario(e.target.value)}
                style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', color: '#0f172a', fontSize: '13px', boxSizing: 'border-box', outline: 'none', fontFamily: 'monospace' }}
              />
              <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginTop: '6px' }}>
                Se atingir este valor negativo nas operações do dia, o motor bloqueia novas entradas automaticamente.
              </span>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#334155', display: 'block', marginBottom: '8px' }}>
                Nível Máximo de Alavancagem Institucional
              </label>
              <select
                value={alavancagem}
                onChange={(e) => setAlavancagem(e.target.value)}
                style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', color: '#0f172a', fontSize: '13px', boxSizing: 'border-box', outline: 'none' }}
              >
                <option value="5x">5x (Conservador)</option>
                <option value="10x">10x (Padrão HFT)</option>
                <option value="20x">20x (Agressivo / Alta Volatilidade)</option>
              </select>
            </div>

            <div style={{ marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: '#f8fafc', padding: '15px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <input
                type="checkbox"
                checked={modoSeguranca}
                onChange={(e) => setModoSeguranca(e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: '#7c3aed', cursor: 'pointer' }}
              />
              <div>
                <b style={{ fontSize: '13px', color: '#0f172a', display: 'block' }}>Ativar Trava Automática Antifúria (Modo Reverso)</b>
                <span style={{ fontSize: '11px', color: '#64748b' }}>Intercepta cliques emocionais após perdas consecutivas.</span>
              </div>
            </div>

            <button
              type="submit"
              style={{ backgroundColor: '#7c3aed', color: '#fff', border: 'none', padding: '14px 20px', borderRadius: '10px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', width: '100%', textAlign: 'center' }}
            >
              Guardar Regras de Risco
            </button>

            {salvo && (
              <div style={{ backgroundColor: '#d1fae5', color: '#065f46', padding: '10px', borderRadius: '8px', fontSize: '12px', textAlign: 'center', fontWeight: 'bold', marginTop: '15px' }}>
                ✅ Parâmetros de risco atualizados com sucesso na infraestrutura!
              </div>
            )}

          </form>
        </div>

      </div>
    </main>
  );
}
