'use client';

export default function CopyTradingPage() {
  return (
    <main style={{ backgroundColor: '#0f172a', color: '#f8fafc', minHeight: '100vh', padding: '30px 20px', fontFamily: 'Arial, sans-serif', boxSizing: 'border-box', width: '100%' }}>
      
      <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Cabeçalho da Mesa */}
        <div style={{ backgroundColor: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: '16px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <span style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 'bold', fontFamily: 'monospace', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>
              JENIOS SOCIAL • Copy-Trading Institucional
            </span>
            <h1 style={{ fontSize: '22px', fontWeight: 'bold', color: '#0f172a', margin: '0' }}>Mesa de Espelhamento de Estratégias</h1>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0 0' }}>Siga os melhores operadores da comunidade e copie ordens em tempo real com partilha de resultados.</p>
          </div>
          <button 
            onClick={() => alert('Inscrição como Mestre de Estratégia iniciada.')}
            style={{ backgroundColor: '#7c3aed', color: '#ffffff', border: 'none', padding: '12px 20px', borderRadius: '10px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '1px', boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)' }}
          >
            Tornar-me um Trader Mestre
          </button>
        </div>

        {/* Grade de Mestres */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
          
          {/* Trader Mestre 1 */}
          <div style={{ backgroundColor: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: '16px', padding: '24px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.2)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ fontSize: '10px', fontWeight: 'bold', fontFamily: 'monospace', backgroundColor: '#f3e8ff', color: '#7c3aed', padding: '4px 8px', borderRadius: '6px', textTransform: 'uppercase' }}>
                  Especialidade: B3 (WIN)
                </span>
                <span style={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: 'bold', color: '#059669' }}>
                  +340% (Ano)
                </span>
              </div>
              <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#0f172a', marginBottom: '4px' }}>Carlos Quant (@carlosq)</h3>
              <p style={{ fontSize: '12px', color: '#64748b', lineHeight: '1.5', margin: '0 0 20px 0' }}>
                Operador quantitativo com foco em reversão de fluxo na B3. 412 seguidores a copiar automaticamente.
              </p>
            </div>
            <button 
              onClick={() => alert('Conectado com sucesso ao espelhamento de Carlos Quant!')}
              style={{ width: '100%', backgroundColor: '#7c3aed', color: '#fff', border: 'none', padding: '12px', borderRadius: '10px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '1px', boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)' }}
            >
              Copiar Estratégia (Revenue Share)
            </button>
          </div>

          {/* Trader Mestre 2 */}
          <div style={{ backgroundColor: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: '16px', padding: '24px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.2)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ fontSize: '10px', fontWeight: 'bold', fontFamily: 'monospace', backgroundColor: '#d1fae5', color: '#065f46', padding: '4px 8px', borderRadius: '6px', textTransform: 'uppercase' }}>
                  Especialidade: Cripto 24/7
                </span>
                <span style={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: 'bold', color: '#059669' }}>
                  +512% (Ano)
                </span>
              </div>
              <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#0f172a', marginBottom: '4px' }}>Helena Crypto (@helenac)</h3>
              <p style={{ fontSize: '12px', color: '#64748b', lineHeight: '1.5', margin: '0 0 20px 0' }}>
                Especialista em futuros de criptoativos e alavancagem inteligente com proteção HFT. 890 seguidores ativos.
              </p>
            </div>
            <button 
              onClick={() => alert('Conectado com sucesso ao espelhamento de Helena Crypto!')}
              style={{ width: '100%', backgroundColor: '#0f172a', color: '#fff', border: 'none', padding: '12px', borderRadius: '10px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '1px' }}
            >
              Copiar Estratégia (Revenue Share)
            </button>
          </div>

        </div>

      </div>
    </main>
  );
}