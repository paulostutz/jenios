'use client';
import { useState } from 'react';

export default function TorneiosPage() {
  const rankingDados = [
    { pos: 1, nome: 'Ricardo Mendes', handle: '@ricardom', perdas: 'R$ 12.450,00', eficiencia: '98.4%', premio: '1 Mês Grátis (Global Pro)', destaque: true },
    { pos: 2, nome: 'Beatriz Lima', handle: '@bealima', perdas: 'R$ 9.890,00', eficiencia: '96.1%', premio: '1 Mês Grátis (Global Pro)', destaque: false },
    { pos: 3, nome: 'Lucas Souza', handle: '@lucass', perdas: 'R$ 8.320,00', eficiencia: '94.8%', premio: '1 Mês Grátis (Global Pro)', destaque: false },
    { pos: 4, nome: 'Paulo Stutz (Você)', handle: '@paulostutz', perdas: 'R$ 7.100,00', eficiencia: '92.0%', premio: 'Posição Atual', user: true },
    { pos: 5, nome: 'Lucas Invest', handle: '@lucasinv', perdas: 'R$ 6.500,00', eficiencia: '88.0%', premio: '-', destaque: false },
    { pos: 6, nome: 'Renata Tech', handle: '@renatatech', perdas: 'R$ 5.900,00', eficiencia: '87.0%', premio: '-', destaque: false },
    { pos: 7, nome: 'Gabriel B3', handle: '@gabrielb3', perdas: 'R$ 5.200,00', eficiencia: '85.0%', premio: '-', destaque: false },
    { pos: 8, nome: 'Juliana Trade', handle: '@julianatrade', perdas: 'R$ 4.800,00', eficiencia: '84.0%', premio: '-', destaque: false },
    { pos: 9, nome: 'Thiago Alpha', handle: '@thiagoalpha', perdas: 'R$ 4.100,00', eficiencia: '82.0%', premio: '-', destaque: false },
    { pos: 10, nome: 'Patricia Momentum', handle: '@patimomentum', perdas: 'R$ 3.800,00', eficiencia: '80.0%', premio: '-', destaque: false },
  ];

  return (
    <main style={{ backgroundColor: '#0f172a', color: '#f8fafc', minHeight: '100vh', paddingBottom: '60px', fontFamily: 'Arial, sans-serif', boxSizing: 'border-box', width: '100%' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '30px 20px 0 20px' }}>
        
        {/* Cabeçalho do Torneio */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', borderBottom: '1px solid #334155', paddingBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
          <div>
            <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#7c3aed', fontFamily: 'monospace', letterSpacing: '2px', textTransform: 'uppercase' }}>
              JENIOS ARENA • Competição Semanal
            </span>
            <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#ffffff', margin: '4px 0 0 0' }}>Torneio de Blindagem & Eficiência</h1>
            <p style={{ fontSize: '13px', color: '#94a3b8', margin: '4px 0 0 0' }}>Os 3 melhores operadores da semana ganham 1 mês de bónus (assinatura gratuita).</p>
          </div>
          <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', padding: '12px 20px', borderRadius: '12px', textAlign: 'center' }}>
            <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase', display: 'block' }}>Encerramento em:</span>
            <span style={{ fontSize: '15px', fontWeight: 'black', fontFamily: 'monospace', color: '#c084fc' }}>03d 14h 22m</span>
          </div>
        </div>

        {/* Tabela de Ranking */}
        <div style={{ backgroundColor: '#131b2e', border: '1px solid #1e293b', borderRadius: '16px', padding: '25px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#fff', margin: 0, textTransform: 'uppercase', letterSpacing: '1px' }}>Ranking Oficial (Top 10)</h3>
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
                  <th style={{ paddingBottom: '12px' }}>LOSSES NEUTRALIZADOS</th>
                  <th style={{ paddingBottom: '12px' }}>EFICIÊNCIA HFT</th>
                  <th style={{ paddingBottom: '12px', textAlign: 'right' }}>PRÉMIO / ESTADO</th>
                </tr>
              </thead>
              <tbody style={{ color: '#cbd5e1' }}>
                {rankingDados.map((item) => {
                  let bgColor = 'transparent';
                  let borderColor = '#1e293b';
                  if (item.user) {
                    bgColor = 'rgba(56, 189, 248, 0.1)';
                    borderColor = '#38bdf8';
                  } else if (item.pos === 1) {
                    bgColor = 'rgba(124, 58, 237, 0.08)';
                  }

                  return (
                    <tr key={item.pos} style={{ borderBottom: `1px solid ${borderColor}`, backgroundColor: bgColor }}>
                      <td style={{ padding: '14px 0', fontWeight: 'black', color: item.pos === 1 ? '#c084fc' : item.user ? '#38bdf8' : '#e2e8f0' }}>
                        {item.pos === 1 ? '🥇 1º Lugar' : item.pos === 2 ? '🥈 2º Lugar' : item.pos === 3 ? '🥉 3º Lugar' : `${item.pos}º`}
                      </td>
                      <td style={{ padding: '14px 0', fontWeight: 'bold', color: '#fff' }}>
                        {item.nome} <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 'normal' }}>({item.handle})</span>
                      </td>
                      <td style={{ padding: '14px 0', fontFamily: 'monospace', fontWeight: 'bold', color: '#34d399' }}>{item.perdas}</td>
                      <td style={{ padding: '14px 0', fontFamily: 'monospace' }}>{item.eficiencia}</td>
                      <td style={{ padding: '14px 0', textAlign: 'right', fontWeight: item.user ? 'bold' : 'normal', color: item.user ? '#38bdf8' : item.pos <= 3 ? '#c084fc' : '#94a3b8' }}>
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