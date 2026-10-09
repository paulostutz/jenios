'use client';
import { useState } from 'react';

export default function AfiliadosPage() {
  const [copiado, setCopiado] = useState(false);
  const linkAfiliado = "https://jenios.com.br/ref/paulostutz";

  const copiarLink = () => {
    navigator.clipboard.writeText(linkAfiliado);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  return (
    <main style={{ backgroundColor: '#0f172a', color: '#f8fafc', minHeight: '100vh', paddingBottom: '60px', fontFamily: 'Arial, sans-serif', boxSizing: 'border-box', width: '100%' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '30px 20px 0 20px' }}>
        
        {/* Cabeçalho */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', borderBottom: '1px solid #334155', paddingBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
          <div>
            <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#7c3aed', fontFamily: 'monospace', letterSpacing: '2px', textTransform: 'uppercase' }}>
              🤝 JENIOS AFFILIATES • REDE E COMISSÕES
            </span>
            <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#ffffff', margin: '4px 0 0 0' }}>Programa de Afiliados & Parcerias</h1>
          </div>
          <div>
            <a href="/social" style={{ backgroundColor: '#7c3aed', color: '#fff', textDecoration: 'none', fontWeight: 'bold', fontSize: '12px', padding: '10px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center' }}>
              ← Voltar para Social
            </a>
          </div>
        </div>

        {/* Link de Convite */}
        <div style={{ backgroundColor: '#131b2e', border: '1px solid #1e293b', borderRadius: '16px', padding: '25px', marginBottom: '25px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#fff', marginBottom: '10px' }}>O seu Link de Indicação Direta</h3>
          <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '20px' }}>Partilhe o seu link exclusivo e receba comissões recorrentes sobre as assinaturas e movimentações da sua rede.</p>
          
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <input 
              type="text" 
              readOnly 
              value={linkAfiliado} 
              style={{ flex: 1, minWidth: '260px', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '10px', padding: '12px', color: '#fff', fontFamily: 'monospace', fontSize: '13px', outline: 'none' }} 
            />
            <button 
              onClick={copiarLink}
              style={{ backgroundColor: '#7c3aed', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '10px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', transition: 'background 0.2s' }}
            >
              {copiado ? '✅ Copiado!' : '📋 Copiar Link'}
            </button>
          </div>
        </div>

        {/* Estatísticas da Rede */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
          <div style={{ backgroundColor: '#131b2e', border: '1px solid #1e293b', borderRadius: '16px', padding: '20px' }}>
            <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '8px' }}>Cliques no Link</span>
            <h2 style={{ fontSize: '26px', fontWeight: 'black', color: '#38bdf8', margin: 0 }}>1.428</h2>
          </div>
          <div style={{ backgroundColor: '#131b2e', border: '1px solid #1e293b', borderRadius: '16px', padding: '20px' }}>
            <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '8px' }}>Indicados Ativos</span>
            <h2 style={{ fontSize: '26px', fontWeight: 'black', color: '#34d399', margin: 0 }}>38</h2>
          </div>
          <div style={{ backgroundColor: '#131b2e', border: '1px solid #1e293b', borderRadius: '16px', padding: '20px' }}>
            <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '8px' }}>Comissões a Receber</span>
            <h2 style={{ fontSize: '26px', fontWeight: 'black', color: '#c084fc', margin: 0 }}>R$ 1.840,00</h2>
          </div>
        </div>

      </div>
    </main>
  );
}