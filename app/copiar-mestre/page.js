'use client';

export default function CopiarMestrePage() {
  return (
    <main style={{ backgroundColor: '#0f172a', color: '#f8fafc', minHeight: '100vh', padding: '30px 20px', fontFamily: 'Arial, sans-serif', boxSizing: 'border-box', width: '100%' }}>
      
      <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Cartão do Trader Mestre */}
        <div style={{ backgroundColor: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: '16px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)', display: 'flex', flexDirection: 'column', gap: '16px', boxSizing: 'border-box' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: '#7e22ce', color: '#ffffff', fontWeight: '900', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                CQ
              </div>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 2px 0' }}>Carlos Quant (@carlosq)</h3>
                <span style={{ fontSize: '10px', color: '#64748b', fontFamily: 'monospace' }}>Especialista B3 (WIN/WDO)</span>
              </div>
            </div>
            {/* Estado em Directo */}
            <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 10px', borderRadius: '9999px', fontSize: '10px', fontWeight: 'bold', backgroundColor: '#d1fae5', color: '#065f46' }}>
              🟢 Online e Operando
            </span>
          </div>

          {/* Horários Habituais */}
          <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px', fontSize: '12px', color: '#334155', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div><b>Horário Habitual de Operação:</b> 09:00 às 11:30 (Segunda a Sexta)</div>
            <div><b>Taxa de Acerto Recente:</b> <span style={{ color: '#059669', fontWeight: 'bold' }}>84.2%</span></div>
          </div>

          {/* Proposta de Assinatura */}
          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <span style={{ fontSize: '10px', fontWeight: 'bold', fontFamily: 'monospace', color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>Subscrição de Cópia Automática</span>
              <div style={{ fontSize: '18px', fontWeight: '900', color: '#7c3aed' }}>R$ 49,90 <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 'normal' }}>/ mês</span></div>
              <span style={{ fontSize: '9px', color: '#94a3b8' }}>70% repassado ao Mestre | 30% taxa JENIOS</span>
            </div>
            <button 
              onClick={() => alert('Subscrição de espelhamento iniciada! As ordens do mestre serão copiadas automaticamente na sua conta.')}
              style={{ width: '100%', maxWidth: '240px', backgroundColor: '#7c3aed', color: '#fff', border: 'none', padding: '14px 20px', borderRadius: '10px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '1px', boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)' }}
            >
              ⚡ Subscrever e Copiar
            </button>
          </div>

        </div>

      </div>
    </main>
  );
}