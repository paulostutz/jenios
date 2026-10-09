'use client';

export default function MesaOperacaoPage() {
  return (
    <main style={{ backgroundColor: '#0f172a', color: '#f8fafc', minHeight: '100vh', padding: '30px 20px', fontFamily: 'Arial, sans-serif', boxSizing: 'border-box', width: '100%' }}>
      
      <div style={{ maxWidth: '750px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        <div style={{ backgroundColor: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: '16px', padding: '30px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)', boxSizing: 'border-box' }}>
          
          <span style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 'bold', fontFamily: 'monospace', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>
            JENIOS DESK • Motor de Execução
          </span>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 8px 0' }}>Escolha o seu Modo Operacional</h1>
          <p style={{ fontSize: '12px', color: '#64748b', lineHeight: '1.5', margin: '0 0 24px 0' }}>
            Selecione como o ecossistema JENIOS vai gerir as suas entradas e a proteção do seu capital nesta sessão.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
            
            {/* Opção 1: Modo Reversão Adaptativa */}
            <div style={{ border: '2px solid #7c3aed', backgroundColor: '#faf5ff', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxSizing: 'border-box' }}>
              <div>
                <span style={{ fontSize: '10px', fontWeight: 'bold', fontFamily: 'monospace', backgroundColor: '#f3e8ff', color: '#7c3aed', padding: '4px 8px', borderRadius: '6px', textTransform: 'uppercase', display: 'inline-block', marginBottom: '10px' }}>
                  Recomendado
                </span>
                <h3 style={{ fontSize: '15px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 6px 0' }}>Modo Reversão Adaptativa</h3>
                <p style={{ fontSize: '12px', color: '#64748b', lineHeight: '1.5', margin: '0 0 20px 0' }}>
                  O robô protege contra perdas e fúria. <b>Diferencial:</b> Ao detetar sequência de acertos consistentes, o sistema promove-o automaticamente para operar <i>sem reversão</i> (surfando a tendência livremente).
                </p>
              </div>
              <button 
                onClick={() => alert('Modo Reversão Adaptativa ativado com sucesso!')}
                style={{ width: '100%', backgroundColor: '#7c3aed', color: '#fff', border: 'none', padding: '12px', borderRadius: '10px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '1px', boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)' }}
              >
                Ativar Reversão Adaptativa
              </button>
            </div>

            {/* Opção 2: Modo Autónomo / Manual */}
            <div style={{ border: '1px solid #cbd5e1', backgroundColor: '#ffffff', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxSizing: 'border-box' }}>
              <div>
                <span style={{ fontSize: '10px', fontWeight: 'bold', fontFamily: 'monospace', backgroundColor: '#f1f5f9', color: '#334155', padding: '4px 8px', borderRadius: '6px', textTransform: 'uppercase', display: 'inline-block', marginBottom: '10px' }}>
                  Controlo Total
                </span>
                <h3 style={{ fontSize: '15px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 6px 0' }}>Modo Autónomo / Manual</h3>
                <p style={{ fontSize: '12px', color: '#64748b', lineHeight: '1.5', margin: '0 0 20px 0' }}>
                  Sem interferência do robô adaptativo. O operador define tudo: entradas, saídas, alvos e lotes de forma independente, discricionária ou puramente quantitativa.
                </p>
              </div>
              <button 
                onClick={() => alert('Modo Autónomo / Manual ativado com sucesso!')}
                style={{ width: '100%', backgroundColor: '#0f172a', color: '#fff', border: 'none', padding: '12px', borderRadius: '10px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '1px' }}
              >
                Ativar Modo Autónomo
              </button>
            </div>

          </div>

        </div>

      </div>
    </main>
  );
}