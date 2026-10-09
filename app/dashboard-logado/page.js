'use client';

export default function DashboardLogadoPage() {
  return (
    <main style={{ backgroundColor: '#0f172a', color: '#f8fafc', minHeight: '100vh', padding: '30px 20px', fontFamily: 'Arial, sans-serif', boxSizing: 'border-box', width: '100%' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Barra Superior / Header da Área Logada */}
        <div style={{ backgroundColor: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: '16px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '16px', backgroundColor: '#7c3aed', color: '#ffffff', fontWeight: '900', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
              PS
            </div>
            <div>
              <span style={{ fontSize: '10px', color: '#7c3aed', fontWeight: 'bold', fontFamily: 'monospace', letterSpacing: '2px', textTransform: 'uppercase', display: 'block' }}>
                JENIOS ID • Plano Pro Ativo
              </span>
              <h1 style={{ fontSize: '18px', fontWeight: '900', color: '#0f172a', margin: '2px 0 0 0' }}>Olá, Paulo Stutz Netto</h1>
            </div>
          </div>

          {/* Navegação Rápida Interna */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' }}>
            <a href="/feed" style={{ backgroundColor: '#f1f5f9', color: '#334155', textDecoration: 'none', fontWeight: 'bold', fontSize: '12px', padding: '10px 14px', borderRadius: '10px', border: '1px solid #cbd5e1' }}>🌐 Feed Social</a>
            <a href="/ranking" style={{ backgroundColor: '#f1f5f9', color: '#334155', textDecoration: 'none', fontWeight: 'bold', fontSize: '12px', padding: '10px 14px', borderRadius: '10px', border: '1px solid #cbd5e1' }}>🏆 Ranking</a>
            <a href="/impulsionar" style={{ backgroundColor: '#f1f5f9', color: '#334155', textDecoration: 'none', fontWeight: 'bold', fontSize: '12px', padding: '10px 14px', borderRadius: '10px', border: '1px solid #cbd5e1' }}>📢 Impulsionar</a>
            <button onClick={() => alert('A abrir a Mesa de Operações HFT...')} style={{ backgroundColor: '#7c3aed', color: '#ffffff', border: 'none', fontWeight: 'bold', fontSize: '12px', padding: '10px 16px', borderRadius: '10px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)' }}>⚡ Mesa de Operações</button>
          </div>
        </div>

        {/* Grelha de Métricas Principais (Cards) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
          
          {/* Capital Total / Protegido */}
          <div style={{ backgroundColor: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: '16px', padding: '20px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.2)', display: 'flex', flexDirection: 'column', gap: '8px', boxSizing: 'border-box' }}>
            <span style={{ fontSize: '10px', fontWeight: 'bold', fontFamily: 'monospace', color: '#64748b', textTransform: 'uppercase' }}>Capital Total / Protegido</span>
            <div style={{ fontSize: '20px', fontWeight: '900', color: '#0f172a' }}>R$ 45.820,00</div>
            <div style={{ fontSize: '10px', color: '#059669', fontWeight: 'bold' }}>🛡️ Proteção HFT Ativa (Drawdown Máx: 3%)</div>
          </div>

          {/* Índice de Frieza Emocional */}
          <div style={{ backgroundColor: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: '16px', padding: '20px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.2)', display: 'flex', flexDirection: 'column', gap: '8px', boxSizing: 'border-box' }}>
            <span style={{ fontSize: '10px', fontWeight: 'bold', fontFamily: 'monospace', color: '#64748b', textTransform: 'uppercase' }}>Índice de Frieza Emocional</span>
            <div style={{ fontSize: '20px', fontWeight: '900', color: '#7c3aed' }}>92 / 100</div>
            <div style={{ fontSize: '10px', color: '#64748b' }}>Excelente autocontrole mensal</div>
          </div>

          {/* Rentabilidade do Mês */}
          <div style={{ backgroundColor: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: '16px', padding: '20px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.2)', display: 'flex', flexDirection: 'column', gap: '8px', boxSizing: 'border-box' }}>
            <span style={{ fontSize: '10px', fontWeight: 'bold', fontFamily: 'monospace', color: '#64748b', textTransform: 'uppercase' }}>Rentabilidade (Outubro)</span>
            <div style={{ fontSize: '20px', fontWeight: '900', color: '#059669' }}>+14.2% (IPJ)</div>
            <div style={{ fontSize: '10px', color: '#64748b' }}>14º lugar no Ranking Geral</div>
          </div>

          {/* Status do Robô */}
          <div style={{ backgroundColor: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: '16px', padding: '20px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.2)', display: 'flex', flexDirection: 'column', gap: '8px', boxSizing: 'border-box' }}>
            <span style={{ fontSize: '10px', fontWeight: 'bold', fontFamily: 'monospace', color: '#64748b', textTransform: 'uppercase' }}>Robô de Proteção</span>
            <div style={{ fontSize: '20px', fontWeight: '900', color: '#059669', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '9999px', backgroundColor: '#10b981', display: 'inline-block' }}></span> Ligado
            </div>
            <div style={{ fontSize: '10px', color: '#64748b' }}>B3 • Mini-Índice (WIN)</div>
          </div>

        </div>

        {/* Secção Inferior: Mestres Copiados e Atividade Recente */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
          
          {/* Coluna Esquerda: Meus Mestres Copiados */}
          <div style={{ backgroundColor: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: '16px', padding: '24px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.2)', display: 'flex', flexDirection: 'column', gap: '16px', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
              <h2 style={{ fontSize: '12px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1px', color: '#0f172a', margin: 0 }}>Mestres Copiados (Ativos)</h2>
              <span style={{ fontSize: '10px', backgroundColor: '#f3e8ff', color: '#7c3aed', fontWeight: 'bold', padding: '4px 8px', borderRadius: '6px' }}>2 Mestres</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Mestre 1 */}
              <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <h4 style={{ fontSize: '12px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 2px 0' }}>Carlos Quant</h4>
                  <span style={{ fontSize: '10px', color: '#64748b' }}>R$ 49,90 / mês</span>
                </div>
                <button onClick={() => alert('Gerir ligação com Carlos Quant')} style={{ background: 'none', border: 'none', fontSize: '10px', color: '#e11d48', fontWeight: 'bold', cursor: 'pointer' }}>Pausar</button>
              </div>

              {/* Mestre 2 */}
              <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <h4 style={{ fontSize: '12px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 2px 0' }}>Ana Trader</h4>
                  <span style={{ fontSize: '10px', color: '#64748b' }}>R$ 49,90 / mês</span>
                </div>
                <button onClick={() => alert('Gerir ligação com Ana Trader')} style={{ background: 'none', border: 'none', fontSize: '10px', color: '#e11d48', fontWeight: 'bold', cursor: 'pointer' }}>Pausar</button>
              </div>
            </div>

            <button onClick={() => alert('A abrir diretório de mestres para novas cópias...')} style={{ backgroundColor: '#f1f5f9', color: '#334155', border: 'none', fontWeight: 'bold', fontSize: '12px', padding: '12px', borderRadius: '10px', cursor: 'pointer', width: '100%' }}>
              + Explorar Novos Mestres
            </button>
          </div>

          {/* Coluna Direita: Resumo do Feed / Atividade do Pódio */}
          <div style={{ backgroundColor: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: '16px', padding: '24px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.2)', display: 'flex', flexDirection: 'column', gap: '16px', gridColumn: 'span 2', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
              <h2 style={{ fontSize: '12px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1px', color: '#0f172a', margin: 0 }}>Últimas Ordens Espelhadas & Feed</h2>
              <span style={{ fontSize: '10px', color: '#94a3b8', fontFamily: 'monospace' }}>Atualizado em tempo real</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', color: '#64748b', fontFamily: 'monospace' }}>
                  <span>Carlos Quant • WINZ26</span>
                  <span style={{ color: '#059669', fontWeight: 'bold' }}>COMPRA EXECUTADA @ 131.550</span>
                </div>
                <p style={{ fontSize: '12px', color: '#334155', margin: 0 }}>Espelhamento automático concluído com sucesso na sua conta. Alvo configurado nos 132.800.</p>
              </div>

              <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', color: '#64748b', fontFamily: 'monospace' }}>
                  <span>Ana Trader • WDOF26</span>
                  <span style={{ color: '#d97706', fontWeight: 'bold' }}>VENDA EXECUTADA @ 5.420,5</span>
                </div>
                <p style={{ fontSize: '12px', color: '#334155', margin: 0 }}>Posição aberta com alocação de 2 contratos. Robô de proteção de ganho acoplado.</p>
              </div>
            </div>
          </div>

        </div>

      </div>
    </main>
  );
}