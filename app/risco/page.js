'use client';
import { useState } from 'react';

export default function RiscoPage() {
  const [stopDiario, setStopDiario] = useState('500.00');
  const [alavancagem, setAlavancagem] = useState('10x');
  const [modoSeguranca, setModoSeguranca] = useState(true);
  const [revisado, setRevisado] = useState(false);

  const revisarParametros = (e) => {
    e.preventDefault();
    setRevisado(true);
  };

  return (
    <main style={{ backgroundColor: '#0f172a', color: '#1e293b', minHeight: '100vh', padding: '30px 20px', fontFamily: 'Arial, sans-serif', boxSizing: 'border-box', width: '100%' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        
        {/* Cabeçalho */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', backgroundColor: '#ffffff', padding: '20px 25px', borderRadius: '16px', border: '1px solid #cbd5e1', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', boxSizing: 'border-box', flexWrap: 'wrap', gap: '15px' }}>
          <div>
            <span style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 'bold', fontFamily: 'monospace', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>
              JENIOS PLATFORM • RASCUNHO LOCAL DE RISCO
            </span>
            <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>
              Revisão de Parâmetros de Risco
            </h1>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <a href="/dashboard" style={{ backgroundColor: '#f1f5f9', color: '#475569', padding: '9px 14px', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold', fontSize: '12px', border: '1px solid #cbd5e1' }}>
              ← Mesa de Operações
            </a>
          </div>
        </div>

        {/* Rascunho local sem persistência ou ativação */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '16px', padding: '30px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
          <p style={{ fontSize: '13px', color: '#334155', lineHeight: '1.5', marginBottom: '20px' }}>
            Demonstração local, sem conexão com corretora. Estes campos servem para revisar um rascunho e serão descartados ao recarregar. Nenhuma regra é salva em servidor ou aplicada ao motor de negociação.
          </p>
          <form onSubmit={revisarParametros}>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#334155', display: 'block', marginBottom: '8px' }}>
                Stop diário de referência para o rascunho (R$)
              </label>
              <input
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                required
                value={stopDiario}
                onChange={(e) => { setStopDiario(e.target.value); setRevisado(false); }}
                style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', color: '#0f172a', fontSize: '13px', boxSizing: 'border-box', outline: 'none', fontFamily: 'monospace' }}
              />
              <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginTop: '6px' }}>
                Valor apenas para revisão visual. Este campo não acompanha perdas nem bloqueia entradas.
              </span>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#334155', display: 'block', marginBottom: '8px' }}>
                Alavancagem de referência para o rascunho
              </label>
              <select
                value={alavancagem}
                onChange={(e) => { setAlavancagem(e.target.value); setRevisado(false); }}
                style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', color: '#0f172a', fontSize: '13px', boxSizing: 'border-box', outline: 'none' }}
              >
                <option value="5x">5x (Exemplo)</option>
                <option value="10x">10x (Exemplo)</option>
                <option value="20x">20x (Exemplo)</option>
              </select>
            </div>

            <div style={{ marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: '#f8fafc', padding: '15px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <input
                type="checkbox"
                checked={modoSeguranca}
                onChange={(e) => { setModoSeguranca(e.target.checked); setRevisado(false); }}
                style={{ width: '18px', height: '18px', accentColor: '#7c3aed', cursor: 'pointer' }}
              />
              <div>
                <b style={{ fontSize: '13px', color: '#0f172a', display: 'block' }}>Incluir lembrete de pausa no rascunho</b>
                <span style={{ fontSize: '11px', color: '#64748b' }}>Preferência ilustrativa; não intercepta cliques nem ativa o modo reverso.</span>
              </div>
            </div>

            <button
              type="submit"
              style={{ backgroundColor: '#7c3aed', color: '#fff', border: 'none', padding: '14px 20px', borderRadius: '10px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', width: '100%', textAlign: 'center' }}
            >
              Revisar parâmetros nesta tela
            </button>

            {revisado && (
              <div role="status" style={{ backgroundColor: '#ede9fe', color: '#5b21b6', padding: '10px', borderRadius: '8px', fontSize: '12px', textAlign: 'center', fontWeight: 'bold', marginTop: '15px' }}>
                Rascunho revisado apenas nesta tela. Nenhuma proteção foi ativada e nenhum parâmetro foi enviado à corretora.
              </div>
            )}

          </form>
        </div>

      </div>
    </main>
  );
}
