'use client';

export default function BillingPage() {
  return (
    <main style={{ backgroundColor: '#0f172a', color: '#f8fafc', minHeight: '100vh', padding: '30px 20px', fontFamily: 'Arial, sans-serif', boxSizing: 'border-box', width: '100%' }}>
      
      <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Cabeçalho */}
        <div style={{ backgroundColor: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: '16px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)', boxSizing: 'border-box' }}>
          <span style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 'bold', fontFamily: 'monospace', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>
            JENIOS BILLING • Gestão de Conta e Faturas
          </span>
          <h1 style={{ fontSize: '22px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 4px 0' }}>A sua Assinatura</h1>
          <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>Consulte o seu plano atual, altere dados de pagamento e descarregue faturas.</p>
        </div>

        {/* Estado do Plano Atual */}
        <div style={{ backgroundColor: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: '16px', padding: '24px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', boxSizing: 'border-box' }}>
          <div>
            <span style={{ fontSize: '10px', fontWeight: 'bold', fontFamily: 'monospace', backgroundColor: '#f3e8ff', color: '#7c3aed', padding: '4px 8px', borderRadius: '6px', textTransform: 'uppercase', display: 'inline-block', marginBottom: '8px' }}>
              Plano Ativo
            </span>
            <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 4px 0' }}>Global Crypto (B3 + Cripto Futuros)</h3>
            <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>Próxima renovação automática via Pix / Cartão em: <b>15 de Novembro de 2026</b></p>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button 
              onClick={() => alert('A abrir opções de alteração de plano...')} 
              style={{ backgroundColor: '#f1f5f9', color: '#334155', border: 'none', padding: '10px 16px', borderRadius: '10px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}
            >
              Mudar Plano
            </button>
            <button 
              onClick={() => alert('Cancelamento solicitado. A nossa equipa entrará em contacto.')} 
              style={{ backgroundColor: '#ffe4e6', color: '#be123c', border: 'none', padding: '10px 16px', borderRadius: '10px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}
            >
              Cancelar
            </button>
          </div>
        </div>

        {/* Histórico de Faturas */}
        <div style={{ backgroundColor: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: '16px', padding: '24px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.2)', boxSizing: 'border-box' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', color: '#0f172a', margin: '0 0 16px 0' }}>Histórico de Cobranças</h3>
          
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', textAlign: 'left', fontSize: '12px', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#64748b', fontFamily: 'monospace' }}>
                  <th style={{ paddingBottom: '10px' }}>Data</th>
                  <th style={{ paddingBottom: '10px' }}>Descrição</th>
                  <th style={{ paddingBottom: '10px' }}>Valor</th>
                  <th style={{ paddingBottom: '10px' }}>Estado</th>
                  <th style={{ paddingBottom: '10px', textAlign: 'right' }}>Recibo</th>
                </tr>
              </thead>
              <tbody style={{ color: '#334155' }}>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '12px 0', fontFamily: 'monospace' }}>15/10/2026</td>
                  <td style={{ padding: '12px 0', fontWeight: 'bold', color: '#0f172a' }}>Assinatura Mensal - Global Crypto</td>
                  <td style={{ padding: '12px 0' }}>R$ 149,90</td>
                  <td style={{ padding: '12px 0' }}><span style={{ backgroundColor: '#d1fae5', color: '#065f46', padding: '4px 8px', borderRadius: '6px', fontWeight: 'bold', fontSize: '10px' }}>Pago (Pix)</span></td>
                  <td style={{ padding: '12px 0', textAlign: 'right' }}>
                    <button onClick={() => alert('A descarregar recibo em PDF...')} style={{ background: 'none', border: 'none', color: '#7c3aed', fontWeight: 'bold', cursor: 'pointer', padding: 0, fontSize: '12px' }}>
                      PDF
                    </button>
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '12px 0', fontFamily: 'monospace' }}>15/09/2026</td>
                  <td style={{ padding: '12px 0', fontWeight: 'bold', color: '#0f172a' }}>Assinatura Mensal - Global Crypto</td>
                  <td style={{ padding: '12px 0' }}>R$ 149,90</td>
                  <td style={{ padding: '12px 0' }}><span style={{ backgroundColor: '#d1fae5', color: '#065f46', padding: '4px 8px', borderRadius: '6px', fontWeight: 'bold', fontSize: '10px' }}>Pago (Pix)</span></td>
                  <td style={{ padding: '12px 0', textAlign: 'right' }}>
                    <button onClick={() => alert('A descarregar recibo em PDF...')} style={{ background: 'none', border: 'none', color: '#7c3aed', fontWeight: 'bold', cursor: 'pointer', padding: 0, fontSize: '12px' }}>
                      PDF
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </main>
  );
}