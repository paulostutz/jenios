'use client';
import { useState } from 'react';

export default function PlanosPage() {
  const [planoSelecionado, setPlanoSelecionado] = useState(null);
  const [copiado, setCopiado] = useState(false);

  const planos = [
    {
      id: 'nacional',
      nome: 'Plano Nacional (B3)',
      valor: 'R$ 99,90',
      periodo: '/mês',
      destaque: false,
      descricao: 'Ideal para traders focados no mercado brasileiro de contratos futuros.',
      recursos: [
        'Acesso exclusivo à Bolsa Brasileira (B3)',
        'Contratos ilimitados (WIN e WDO)',
        'Tecnologia Adaptativa e Modo Reverso',
        'Suporte prioritário via chat in-app'
      ],
      pix: '00020101021126540014br.gov.bcb.pix0114572556070001300214Plano Nacional520400005303986540599.905802BR5913LETTER LETTER6007VITORIA62070503***63043B77'
    },
    {
      id: 'global',
      nome: 'Global Crypto (B3 + Cripto)',
      valor: 'R$ 149,90',
      periodo: '/mês',
      destaque: true,
      descricao: 'Para operadores que operam a B3 durante o dia e os mercados cripto 24/7.',
      recursos: [
        'Tudo incluído no Plano Nacional (B3)',
        'Mercado Futuros de Criptomoedas (24/7)',
        'Integração direta com Binance e Bybit',
        'Filtro Quantitativo de Megatendência'
      ],
      pix: '00020101021126590014br.gov.bcb.pix0114572556070001300219Plano Global Crypto5204000053039865406149.905802BR5913LETTER LETTER6007VITORIA62070503***6304C56A'
    },
    {
      id: 'internacional',
      nome: 'Internacional Pro (Global Total)',
      valor: 'R$ 199,90',
      periodo: '/mês',
      destaque: false,
      descricao: 'Acesso total e irrestrito a todos os mercados globais e ativos internacionais.',
      recursos: [
        'Acesso total B3, Cripto e Forex',
        'Ativos globais (Ouro, Petróleo e índices)',
        'Ações de Wall Street integradas',
        'Modo Espelho Direto e HFT avançado'
      ],
      pix: '00020101021126630014br.gov.bcb.pix0114572556070001300223Plano Internacional Pro5204000053039865406199.905802BR5913LETTER LETTER6007VITORIA62070503***6304157A'
    }
  ];

  const copiarPix = (pixCode) => {
    navigator.clipboard.writeText(pixCode).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 3000);
    });
  };

  return (
    <main style={{ backgroundColor: '#0f172a', color: '#1e293b', minHeight: '100vh', padding: '40px 20px', fontFamily: 'Arial, sans-serif', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ maxWidth: '1000px', width: '100%', margin: '0 auto' }}>
        
        {/* Cabeçalho */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <span style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 'bold', fontFamily: 'monospace', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '10px', display: 'block' }}>
            JENIOS PLATFORM • PLANOS E ASSINATURAS
          </span>
          <h1 style={{ fontSize: '26px', fontWeight: 'bold', color: '#ffffff', marginBottom: '10px' }}>
            Escolha seu Plano de Proteção e Retificação
          </h1>
          <p style={{ fontSize: '14px', color: '#94a3b8', maxWidth: '600px', margin: '0 auto', lineHeight: '1.5' }}>
            Selecione a fronteira de mercado ideal para ativar a nossa tecnologia adaptativa e transformar os seus erros em lucro.
          </p>
        </div>

        {/* Ecrã de Checkout Pix (Caso o plano seja selecionado) */}
        {planoSelecionado ? (
          <div style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '20px', padding: '30px', maxWidth: '600px', margin: '0 auto', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)' }}>
            <span style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 'bold', fontFamily: 'monospace', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px', display: 'block' }}>
              💳 PAGAMENTO VIA PIX • BANCO INTER
            </span>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '10px', color: '#0f172a' }}>
              {planoSelecionado.nome}
            </h2>
            <p style={{ fontSize: '13px', color: '#334155', marginBottom: '10px' }}>
              Valor Total: <b>{planoSelecionado.valor}{planoSelecionado.periodo}</b>
            </p>
            <p style={{ fontSize: '13px', color: '#334155', marginBottom: '15px' }}>
              Utilize o código Pix Copia e Cola abaixo para efetuar o pagamento imediato e liberar o acesso ao Onboarding:
            </p>
            
            <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', padding: '15px', borderRadius: '12px', margin: '15px 0', wordBreak: 'break-all', fontFamily: 'monospace', fontSize: '11px', color: '#334155', maxHeight: '90px', overflowY: 'auto' }}>
              {planoSelecionado.pix}
            </div>

            <button
              onClick={() => copiarPix(planoSelecionado.pix)}
              style={{ width: '100%', background: '#7c3aed', color: 'white', fontWeight: 'bold', fontSize: '13px', padding: '14px', borderRadius: '10px', border: 'none', cursor: 'pointer', textAlign: 'center', display: 'block' }}
            >
              📋 Copiar Código Pix Copia e Cola
            </button>

            {copiado && (
              <div style={{ backgroundColor: '#d1fae5', color: '#065f46', padding: '10px', borderRadius: '8px', fontSize: '12px', textAlign: 'center', fontWeight: 'bold', marginTop: '10px' }}>
                ✅ Código Pix copiado com sucesso! Cole no aplicativo do seu banco.
              </div>
            )}

            <button
              onClick={() => setPlanoSelecionado(null)}
              style={{ width: '100%', background: '#e2e8f0', color: '#475569', fontWeight: 'bold', fontSize: '12px', padding: '10px', borderRadius: '10px', border: 'none', cursor: 'pointer', marginTop: '15px', textAlign: 'center', display: 'block' }}
            >
              ← Escolher outro plano
            </button>
          </div>
        ) : (
          /* Grelha de Planos */
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
            {planos.map((plano) => (
              <div
                key={plano.id}
                style={{
                  backgroundColor: '#ffffff',
                  border: plano.destaque ? '2px solid #7c3aed' : '1px solid #cbd5e1',
                  borderRadius: '20px',
                  padding: '30px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.2)',
                  position: 'relative'
                }}
              >
                {plano.destaque && (
                  <span style={{ position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)', backgroundColor: '#7c3aed', color: '#fff', fontSize: '10px', fontWeight: 'bold', fontFamily: 'monospace', padding: '4px 12px', borderRadius: '20px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    Mais Popular
                  </span>
                )}

                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#0f172a', marginBottom: '8px' }}>
                    {plano.nome}
                  </h3>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#7c3aed', marginBottom: '12px' }}>
                    {plano.valor} <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 'normal' }}>{plano.periodo}</span>
                  </div>
                  <p style={{ fontSize: '12px', color: '#334155', lineHeight: '1.4', marginBottom: '20px' }}>
                    {plano.descricao}
                  </p>

                  <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 25px 0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {plano.recursos.map((rec, i) => (
                      <li key={i} style={{ fontSize: '12px', color: '#334155', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: '#10b981', fontWeight: 'bold' }}>✓</span> {rec}
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  onClick={() => setPlanoSelecionado(plano)}
                  style={{
                    width: '100%',
                    backgroundColor: plano.destaque ? '#7c3aed' : '#0f172a',
                    color: '#ffffff',
                    fontWeight: 'bold',
                    fontSize: '13px',
                    padding: '14px',
                    borderRadius: '10px',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'center',
                    display: 'block'
                  }}
                >
                  Selecionar {plano.nome} →
                </button>
              </div>
            ))}
          </div>
        )}

      </div>
    </main>
  );
}
