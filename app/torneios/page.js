'use client';

export default function TorneiosPage() {
  const rankingDados = Array.from({ length: 10 }, (_, index) => ({
    pos: index + 1,
    nome: `Perfil de exemplo ${index + 1}`,
    handle: 'fictício',
    perdas: 'Não apuradas',
    eficiencia: 'Não apurada',
    premio: 'Não definido',
    exemploDestaque: index === 3
  }));

  return (
    <main style={{ backgroundColor: '#0f172a', color: '#f8fafc', minHeight: '100vh', paddingBottom: '60px', fontFamily: 'Arial, sans-serif', boxSizing: 'border-box', width: '100%' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '30px 20px 0 20px' }}>
        
        {/* Cabeçalho do Torneio */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', borderBottom: '1px solid #334155', paddingBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
          <div>
            <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#7c3aed', fontFamily: 'monospace', letterSpacing: '2px', textTransform: 'uppercase' }}>
              JENIOS ARENA • DEMONSTRAÇÃO
            </span>
            <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#ffffff', margin: '4px 0 0 0' }}>Torneio de Blindagem & Eficiência</h1>
            <p style={{ fontSize: '13px', color: '#94a3b8', margin: '4px 0 0 0' }}>As posições e os perfis são fictícios. Esta página não apresenta ranking, perdas evitadas, eficiência, premiação ou prazo verificados.</p>
          </div>
          <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', padding: '12px 20px', borderRadius: '12px', textAlign: 'center' }}>
            <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase', display: 'block' }}>Prazo do torneio:</span>
            <span style={{ fontSize: '15px', fontWeight: 'black', fontFamily: 'monospace', color: '#c084fc' }}>Não informado</span>
          </div>
        </div>

        {/* Tabela de Ranking */}
        <div style={{ backgroundColor: '#131b2e', border: '1px solid #1e293b', borderRadius: '16px', padding: '25px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#fff', margin: 0, textTransform: 'uppercase', letterSpacing: '1px' }}>Ranking de demonstração</h3>
            <a href="/social" style={{ backgroundColor: '#7c3aed', color: '#fff', textDecoration: 'none', fontWeight: 'bold', fontSize: '12px', padding: '8px 16px', borderRadius: '8px' }}>
              ← Voltar para Social
            </a>
          </div>
          
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8', fontFamily: 'monospace', fontSize: '11px' }}>
                  <th style={{ paddingBottom: '12px' }}>POSIÇÃO</th>
                  <th style={{ paddingBottom: '12px' }}>OPERADOR</th>
                  <th style={{ paddingBottom: '12px' }}>PERDAS EVITADAS</th>
                  <th style={{ paddingBottom: '12px' }}>EFICIÊNCIA</th>
                  <th style={{ paddingBottom: '12px', textAlign: 'right' }}>PRÉMIO / ESTADO</th>
                </tr>
              </thead>
              <tbody style={{ color: '#cbd5e1' }}>
                {rankingDados.map((item) => {
                  let bgColor = 'transparent';
                  let borderColor = '#1e293b';
                  if (item.exemploDestaque) {
                    bgColor = 'rgba(56, 189, 248, 0.1)';
                    borderColor = '#38bdf8';
                  } else if (item.pos === 1) {
                    bgColor = 'rgba(124, 58, 237, 0.08)';
                  }

                  return (
                    <tr key={item.pos} style={{ borderBottom: `1px solid ${borderColor}`, backgroundColor: bgColor }}>
                      <td style={{ padding: '14px 0', fontWeight: 'black', color: item.pos === 1 ? '#c084fc' : item.exemploDestaque ? '#38bdf8' : '#e2e8f0' }}>
                        {item.pos === 1 ? '🥇 1º Lugar' : item.pos === 2 ? '🥈 2º Lugar' : item.pos === 3 ? '🥉 3º Lugar' : `${item.pos}º`}
                      </td>
                      <td style={{ padding: '14px 0', fontWeight: 'bold', color: '#fff' }}>
                        {item.nome} <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 'normal' }}>({item.handle})</span>
                      </td>
                      <td style={{ padding: '14px 0', fontFamily: 'monospace', fontWeight: 'bold', color: '#94a3b8' }}>{item.perdas}</td>
                      <td style={{ padding: '14px 0', fontFamily: 'monospace' }}>{item.eficiencia}</td>
                      <td style={{ padding: '14px 0', textAlign: 'right', fontWeight: item.exemploDestaque ? 'bold' : 'normal', color: item.exemploDestaque ? '#38bdf8' : item.pos <= 3 ? '#c084fc' : '#94a3b8' }}>
                        {item.premio}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </main>
  );
}