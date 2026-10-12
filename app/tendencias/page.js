'use client';
import { useState } from 'react';
import Link from 'next/link';
import { DEMO_tokensTendencia, DEMO_baleias, DEMO_megapulse } from '../../lib/jeniosTendenciasDemo';

export default function TendenciasPage() {
  const [abaAtiva, setAbaAtiva] = useState('tokens');

  const tokensTendencia = DEMO_tokensTendencia;

  const baleias = DEMO_baleias;

  const megapulse = DEMO_megapulse;

  const abrirPainelOperacional = (nomeAtivo) => {
    alert('Este sinal é demonstrativo e não possui confirmação de mercado. Operação desabilitada até a integração de fontes verificáveis.');
  };

  return (
    <main style={{ backgroundColor: '#f1f5f9', color: '#0f172a', minHeight: '100vh', padding: '30px 20px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}><div role='status' style={{padding:16,marginBottom:18,borderRadius:12,background:'#fff8e8',border:'1px solid #ebcf96',color:'#684a19',fontWeight:700,fontSize:13}}>ATENÇÃO: os nomes, fluxos, volumes, scores e transações apresentados nesta página são exemplos estáticos do protótipo, não movimentações verificadas em tempo real. Não utilize estes sinais para operações financeiras.</div>
        
        {/* Cabeçalho do Terminal (Padrão Sala de Controle) */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', padding: '24px 30px', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', boxShadow: '0 4px 12px rgba(0,0,0,0.03)', flexWrap: 'wrap', gap: '15px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{ width: '8px', height: '8px', backgroundColor: '#10b981', borderRadius: '50%', display: 'inline-block' }}></span>
              <span style={{ fontSize: '11px', color: '#059669', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>AMBIENTE DEMONSTRATIVO · SEM DADOS AO VIVO</span>
            </div>
            <h1 style={{ fontSize: '22px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>Hub de Tendências & Inteligência Institucional</h1>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <Link href="/dashboard-logado" style={{ backgroundColor: '#f1f5f9', color: '#0f172a', padding: '10px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', textDecoration: 'none', border: '1px solid #cbd5e1' }}>
              ← Sala de Controle
            </Link>
            <Link href="/social" style={{ backgroundColor: '#7c3aed', color: '#fff', padding: '10px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', textDecoration: 'none', boxShadow: '0 4px 15px rgba(124,58,237,0.3)' }}>
              Jenios Social
            </Link>
          </div>
        </div>

        {/* Indicadores Globais */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '25px' }}>
          <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '18px 20px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
            <span style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>Volume Institucional (24h)</span>
            <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#059669' }}>US$ 4.2 Bilhões</span>
            <span style={{ fontSize: '11px', color: '#059669', display: 'block', marginTop: '4px' }}>▲ +18.4% vs média diária</span>
          </div>
          <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '18px 20px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
            <span style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>Sentimento de Mercado</span>
            <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#0284c7' }}>Ganância Extrema (84/100)</span>
            <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginTop: '4px' }}>Filtro de Reversão Ativo</span>
          </div>
          <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '18px 20px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
            <span style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>Smart Money Inflow</span>
            <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#7c3aed' }}>R$ 840 Milhões</span>
            <span style={{ fontSize: '11px', color: '#059669', display: 'block', marginTop: '4px' }}>Foco em Solana e Mini-Índice</span>
          </div>
        </div>

        {/* Abas */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <button onClick={() => setAbaAtiva('tokens')} style={{ padding: '12px 22px', borderRadius: '10px', backgroundColor: abaAtiva === 'tokens' ? '#7c3aed' : '#ffffff', color: abaAtiva === 'tokens' ? '#fff' : '#0f172a', border: '1px solid #cbd5e1', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}>
            🚀 Tokens em Alta (Solana / HFT)
          </button>
          <button onClick={() => setAbaAtiva('baleias')} style={{ padding: '12px 22px', borderRadius: '10px', backgroundColor: abaAtiva === 'baleias' ? '#7c3aed' : '#ffffff', color: abaAtiva === 'baleias' ? '#fff' : '#0f172a', border: '1px solid #cbd5e1', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}>
            🐋 Movimentação de Baleias & Fundos
          </button>
          <button onClick={() => setAbaAtiva('megapulse')} style={{ padding: '12px 22px', borderRadius: '10px', backgroundColor: abaAtiva === 'megapulse' ? '#7c3aed' : '#ffffff', color: abaAtiva === 'megapulse' ? '#fff' : '#0f172a', border: '1px solid #cbd5e1', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}>
            📊 Megapulse B3 & Futuros
          </button>
        </div>

        {/* Conteúdo */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '25px', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
          
          {abaAtiva === 'tokens' && (
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 6px 0' }}>Tokens Destacados com Influxo HFT</h2>
              <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '20px' }}>Ativos detetados pelos nossos algoritmos com alta liquidez em pools descentralizados.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {tokensTendencia.map(t => (
                  <div key={t.id} style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '18px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#0f172a' }}>{t.nome}</span>
                        <span style={{ fontSize: '10px', backgroundColor: '#e2e8f0', color: '#0284c7', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>{t.rede}</span>
                        <span style={{ fontSize: '10px', backgroundColor: '#dcfce7', color: '#16a34a', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>{t.status}</span>
                      </div>
                      <span style={{ fontSize: '12px', color: '#475569' }}>Instituição Patrocinadora / Pool: <b style={{ color: '#0f172a' }}>{t.institucao}</b></span>
                      <div style={{ display: 'flex', gap: '15px', marginTop: '6px', fontSize: '11px', color: '#64748b' }}>
                        <span>Preço: <strong style={{ color: '#0f172a' }}>{t.preco}</strong></span>
                        <span>Volume 24h: <strong style={{ color: '#16a34a' }}>{t.volume}</strong></span>
                        <span>Liquidez: <strong style={{ color: '#0f172a' }}>{t.liquidez}</strong></span>
                        <span>Score Whale: <strong style={{ color: '#7c3aed' }}>{t.scoreWhale}</strong></span>
                      </div>
                    </div>
                    <button onClick={() => abrirPainelOperacional(t.nome)} style={{ backgroundColor: '#10b981', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
                      ⚡ Exemplo · sem operação
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {abaAtiva === 'baleias' && (
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 6px 0' }}>Monitoramento de Baleias & Grandes Fundos</h2>
              <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '20px' }}>Transações institucionais de alto volume monitoradas em tempo real na blockchain e balcões OTC.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {baleias.map(b => (
                  <div key={b.id} style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '18px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#0f172a' }}>{b.instituicao}</span>
                        <span style={{ fontSize: '10px', backgroundColor: '#e2e8f0', color: '#7c3aed', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>{b.ativo}</span>
                      </div>
                      <span style={{ fontSize: '12px', color: '#16a34a', fontWeight: 'bold' }}>Volume: {b.volumeMovimentado} • {b.fluxo}</span>
                      <span style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>Rede: {b.rede} | Hash ID: {b.hash}</span>
                    </div>
                    <button onClick={() => abrirPainelOperacional(b.instituicao)} style={{ backgroundColor: '#7c3aed', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
                      ⚡ Exemplo · sem operação
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {abaAtiva === 'megapulse' && (
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 6px 0' }}>Megapulse Institucional (B3 & Futuros Globais)</h2>
              <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '20px' }}>Análise de livro de ofertas e desequilíbrio de fluxo (Order Book Imbalance) para o Mini-Índice, Mini-Dólar e Ações.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {megapulse.map(m => (
                  <div key={m.id} style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '18px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#0f172a' }}>{m.ativo}</span>
                        <span style={{ fontSize: '10px', backgroundColor: '#e2e8f0', color: '#0284c7', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>{m.instituicao}</span>
                      </div>
                      <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#16a34a' }}>{m.direcao}</span>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>{m.detalhe} • <strong style={{ color: '#7c3aed' }}>{m.imbalance}</strong></span>
                    </div>
                    <button onClick={() => abrirPainelOperacional(m.ativo)} style={{ backgroundColor: '#10b981', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
                      ⚡ Exemplo · sem operação
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

      </div>
    </main>
  );
}