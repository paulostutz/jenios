'use client';
import { useState } from 'react';

export default function CheckoutPage() {
  const [planoSelecionado, setPlanoSelecionado] = useState('pro');
  const [metodoPagamento, setMetodoPagamento] = useState('pix');
  const [nomeCartao, setNomeCartao] = useState('');
  const [numeroCartao, setNumeroCartao] = useState('');

  const planos = {
    starter: { nome: 'Starter (B3)', valor: 'R$ 99,90', periodo: '/mês', desc: 'Ideal para traders que operam Mini-Índice e Mini-Dólar com automação básica.' },
    pro: { nome: 'Trader Pro (Cripto & Futuros)', valor: 'R$ 149,90', periodo: '/mês', desc: 'Acesso completo ao Robô HFT, Botão Antifúria e Modo Reverso.' },
    global: { nome: 'Institucional (Global)', valor: 'R$ 199,90', periodo: '/mês', desc: 'Múltiplas contas, conexões ilimitadas e relatórios avançados de baleias.' }
  };

  const processarPagamento = (e) => {
    e.preventDefault();
    alert(`🎉 Subscrição do plano [ ${planos[planoSelecionado].nome} ] efetuada com sucesso via ${metodoPagamento.toUpperCase()}! Acedendo à Sala de Controlo...`);
    window.location.href = '/dashboard';
  };

  return (
    <main style={{ backgroundColor: '#0f172a', color: '#334155', minHeight: '100vh', padding: '30px 20px', fontFamily: 'Arial, sans-serif', boxSizing: 'border-box', width: '100%', display: 'flex', justifyContent: 'center' }}>
      <div style={{ maxWidth: '900px', width: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* CABEÇALHO */}
        <div style={{ backgroundColor: '#ffffff', color: '#0f172a', padding: '20px 24px', borderRadius: '20px', border: '1px solid #cbd5e1', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: '#7c3aed', color: '#fff', fontWeight: '900', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(124, 58, 237, 0.4)' }}>
              J
            </div>
            <div>
              <span style={{ fontSize: '13px', fontWeight: '900', letterSpacing: '1px', textTransform: 'uppercase', display: 'block' }}>JENIOS CHECKOUT</span>
              <span style={{ fontSize: '10px', color: '#7c3aed', fontWeight: 'bold', fontFamily: 'monospace' }}>● GATEWAY DE PAGAMENTO SEGURO (MRR)</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <a href="/dashboard" style={{ backgroundColor: '#f1f5f9', color: '#334155', textDecoration: 'none', fontSize: '11px', fontWeight: 'bold', padding: '10px 16px', borderRadius: '10px', border: '1px solid #cbd5e1' }}>Ir para Dashboard</a>
            <a href="/broker" style={{ backgroundColor: '#7c3aed', color: '#fff', textDecoration: 'none', fontSize: '11px', fontWeight: 'bold', padding: '10px 16px', borderRadius: '10px' }}>Broker API</a>
          </div>
        </div>

        {/* SELEÇÃO DE PLANOS */}
        <div style={{ backgroundColor: '#ffffff', color: '#0f172a', borderRadius: '20px', padding: '30px', border: '1px solid #cbd5e1', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <span style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 'bold', fontFamily: 'monospace', letterSpacing: '2px', textTransform: 'uppercase' }}>PLANOS DE ASSINATURA</span>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#0f172a', margin: '4px 0 0 0' }}>Escolha o seu nível de automação e blindagem</h2>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0 0' }}>Renovação automática mensal. Cancele quando quiser diretamente no painel.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
            {Object.keys(planos).map((key) => {
              const p = planos[key];
              const selecionado = planoSelecionado === key;
              return (
                <div 
                  key={key}
                  onClick={() => setPlanoSelecionado(key)}
                  style={{ backgroundColor: selecionado ? '#f5f3ff' : '#f8fafc', border: selecionado ? '2px solid #7c3aed' : '1px solid #cbd5e1', borderRadius: '16px', padding: '20px', cursor: 'pointer', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '14px', transition: '0.2s' }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontSize: '10px', backgroundColor: selecionado ? '#7c3aed' : '#e2e8f0', color: selecionado ? '#ffffff' : '#475569', padding: '3px 8px', borderRadius: '6px', fontWeight: 'bold', width: 'fit-content', fontFamily: 'monospace' }}>
                      {selecionado ? 'PLANO SELECIONADO' : 'DISPONÍVEL'}
                    </span>
                    <h3 style={{ fontSize: '15px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>{p.nome}</h3>
                    <p style={{ fontSize: '12px', color: '#64748b', margin: 0, lineHeight: '1.4' }}>{p.desc}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
                    <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#0f172a' }}>{p.valor}</span>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>{p.periodo}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* FORMULÁRIO DE PAGAMENTO */}
        <div style={{ backgroundColor: '#ffffff', color: '#0f172a', borderRadius: '20px', padding: '30px', border: '1px solid #cbd5e1', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <span style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 'bold', fontFamily: 'monospace', letterSpacing: '2px', textTransform: 'uppercase' }}>MÉTODO DE PAGAMENTO</span>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: '4px 0 0 0', color: '#0f172a' }}>Efetuar Pagamento Seguro</h2>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button 
              type="button"
              onClick={() => setMetodoPagamento('pix')}
              style={{ flex: 1, backgroundColor: metodoPagamento === 'pix' ? '#7c3aed' : '#f1f5f9', color: metodoPagamento === 'pix' ? '#fff' : '#334155', border: '1px solid #cbd5e1', padding: '12px', borderRadius: '10px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}
            >
              ⚡ PIX Instantâneo
            </button>
            <button 
              type="button"
              onClick={() => setMetodoPagamento('cartao')}
              style={{ flex: 1, backgroundColor: metodoPagamento === 'cartao' ? '#7c3aed' : '#f1f5f9', color: metodoPagamento === 'cartao' ? '#fff' : '#334155', border: '1px solid #cbd5e1', padding: '12px', borderRadius: '10px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}
            >
              💳 Cartão de Crédito
            </button>
          </div>

          <form onSubmit={processarPagamento} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {metodoPagamento === 'pix' ? (
              <div style={{ backgroundColor: '#f8fafc', padding: '20px', borderRadius: '14px', border: '1px solid #cbd5e1', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', textAlign: 'center' }}>
                <div style={{ width: '110px', height: '110px', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0f172a', fontWeight: 'bold', fontSize: '11px' }}>
                  [ QR CODE PIX ]
                </div>
                <span style={{ fontSize: '12px', color: '#64748b' }}>Escaneie o QR Code com o aplicativo do seu banco ou utilize a chave PIX Copia e Cola.</span>
                <input 
                  type="text" 
                  readOnly 
                  value="00020126580014br.gov.bcb.pix0136jenios-hft-gateway-payment-9831..." 
                  style={{ width: '100%', padding: '10px', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', color: '#7c3aed', fontSize: '11px', textAlign: 'center' }} 
                />
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', backgroundColor: '#f8fafc', padding: '20px', borderRadius: '14px', border: '1px solid #cbd5e1' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#334155', textTransform: 'uppercase' }}>Nome no Cartão</label>
                  <input 
                    type="text" 
                    placeholder="Nome impresso no cartão"
                    value={nomeCartao}
                    onChange={(e) => setNomeCartao(e.target.value)}
                    style={{ padding: '12px', border: '1px solid #cbd5e1', borderRadius: '10px', fontSize: '12px', backgroundColor: '#ffffff', color: '#0f172a', outline: 'none' }} 
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#334155', textTransform: 'uppercase' }}>Número do Cartão</label>
                  <input 
                    type="text" 
                    placeholder="0000 0000 0000 0000"
                    value={numeroCartao}
                    onChange={(e) => setNumeroCartao(e.target.value)}
                    style={{ padding: '12px', border: '1px solid #cbd5e1', borderRadius: '10px', fontSize: '12px', backgroundColor: '#ffffff', color: '#0f172a', outline: 'none' }} 
                  />
                </div>
              </div>
            )}

            <button type="submit" style={{ backgroundColor: '#7c3aed', color: '#fff', border: 'none', padding: '14px', borderRadius: '12px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '1px', boxShadow: '0 4px 10px rgba(124, 58, 237, 0.3)' }}>
              Confirmar Assinatura • {planos[planoSelecionado].valor}
            </button>
          </form>
        </div>

        {/* RODAPÉ */}
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '4px', paddingTop: '10px' }}>
          <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#7c3aed', letterSpacing: '2px', textTransform: 'uppercase' }}>JENIOS CHECKOUT • AMBIENTE SEGURO</div>
          <div style={{ fontSize: '10px', color: '#64748b' }}>Transações processadas via infraestrutura certificada PCI-DSS.</div>
        </div>

      </div>
    </main>
  );
}