'use client';
import { useState } from 'react';

export default function ComunidadesPage() {
  const [comunidadeAtiva, setComunidadeAtiva] = useState('b3');

  return (
    <main style={{ backgroundColor: '#0f172a', color: '#f8fafc', minHeight: '100vh', paddingBottom: '60px', fontFamily: 'Arial, sans-serif', boxSizing: 'border-box', width: '100%' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '30px 20px 0 20px' }}>
        
        {/* Cabeçalho */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', borderBottom: '1px solid #334155', paddingBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
          <div>
            <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#7c3aed', fontFamily: 'monospace', letterSpacing: '2px', textTransform: 'uppercase' }}>
              💬 JENIOS NETWORKING • COMUNIDADES EXCLUSIVAS
            </span>
            <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#ffffff', margin: '4px 0 0 0' }}>Salas de Discussão & Mesas de Operação</h1>
          </div>
          <div>
            <a href="/social" style={{ backgroundColor: '#7c3aed', color: '#fff', textDecoration: 'none', fontWeight: 'bold', fontSize: '12px', padding: '10px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center' }}>
              ← Voltar para Social
            </a>
          </div>
        </div>

        {/* Seletor de Comunidades */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '25px', flexWrap: 'wrap' }}>
          <button onClick={() => setComunidadeAtiva('b3')} style={{ backgroundColor: comunidadeAtiva === 'b3' ? '#7c3aed' : '#131b2e', color: '#fff', border: '1px solid #334155', padding: '10px 18px', borderRadius: '10px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
            📊 B3 & Mini-Índice Elite
          </button>
          <button onClick={() => setComunidadeAtiva('cripto')} style={{ backgroundColor: comunidadeAtiva === 'cripto' ? '#7c3aed' : '#131b2e', color: '#fff', border: '1px solid #334155', padding: '10px 18px', borderRadius: '10px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
            ⚡ Cripto Futuros & HFT
          </button>
          <button onClick={() => setComunidadeAtiva('mindset')} style={{ backgroundColor: comunidadeAtiva === 'mindset' ? '#7c3aed' : '#131b2e', color: '#fff', border: '1px solid #334155', padding: '10px 18px', borderRadius: '10px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
            🧠 Psicologia & Anti-Tilt
          </button>
        </div>

        {/* Conteúdo da Comunidade */}
        <div style={{ backgroundColor: '#131b2e', border: '1px solid #1e293b', borderRadius: '16px', padding: '25px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155', paddingBottom: '15px' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#fff', margin: '0 0 4px 0' }}>
                {comunidadeAtiva === 'b3' && 'Sala Oficial: B3 & Mini-Índice Elite'}
                {comunidadeAtiva === 'cripto' && 'Sala Oficial: Cripto Futuros & HFT'}
                {comunidadeAtiva === 'mindset' && 'Sala Oficial: Controle Emocional & Anti-Tilt'}
              </h3>
              <span style={{ fontSize: '12px', color: '#34d399' }}>🟢 418 operadores online nesta mesa</span>
            </div>
            <span style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'monospace' }}>Acesso nível Global Pro</span>
          </div>

          {/* Feed de mensagens simuladas */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', maxHeight: '350px', overflowY: 'auto', paddingRight: '5px' }}>
            <div style={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px', padding: '15px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <b style={{ fontSize: '13px', color: '#38bdf8' }}>Carlos Quant (@carlosq)</b>
                <span style={{ fontSize: '11px', color: '#64748b' }}>Há 8 minutos</span>
              </div>
              <p style={{ fontSize: '13px', color: '#cbd5e1', margin: 0, lineHeight: '1.5' }}>
                Pessoal, o fluxo institucional no índice virou forte após a marca dos 128k. O motor de proteção já travou minhas ordens contra rompimentos falsos.
              </p>
            </div>

            <div style={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px', padding: '15px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <b style={{ fontSize: '13px', color: '#c084fc' }}>Ana Trader (@anatrader)</b>
                <span style={{ fontSize: '11px', color: '#64748b' }}>Há 3 minutos</span>
              </div>
              <p style={{ fontSize: '13px', color: '#cbd5e1', margin: 0, lineHeight: '1.5' }}>
                Excelente setup! A sincronização de cópia com o mestre funcionou perfeitamente aqui. Frieza mantida no gráfico.
              </p>
            </div>
          </div>

          {/* Caixa de Envio */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
            <input 
              type="text" 
              placeholder="Escreva a sua análise ou comentário para a comunidade..." 
              style={{ flex: 1, backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '10px', padding: '12px', color: '#fff', fontSize: '13px', outline: 'none' }} 
            />
            <button onClick={() => alert('Mensagem transmitida para a comunidade!')} style={{ backgroundColor: '#7c3aed', color: '#fff', border: 'none', padding: '12px 22px', borderRadius: '10px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}>
              Enviar 🚀
            </button>
          </div>
        </div>

      </div>
    </main>
  );
}