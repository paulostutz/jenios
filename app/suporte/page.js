'use client';
import { useState } from 'react';

export default function SuportePage() {
  const [duvida, setDuvida] = useState('');
  const [enviado, setEnviado] = useState(false);

  const [faqs] = useState([
    {
      pergunta: 'Como funciona o Modo Reverso automático?',
      resposta: 'O motor HFT monitoriza os padrões de latência e cliques impulsivos. Caso detete um comportamento de risco pós-loss, inverte automaticamente a ordem para o sentido oposto institucional.'
    },
    {
      pergunta: 'Como recebo as comissões do programa de afiliados?',
      resposta: 'As comissões geradas através do seu link exclusivo são creditadas de forma automatizada na sua subconta BaaS e podem ser transferidas via Pix a qualquer momento.'
    },
    {
      pergunta: 'Posso operar em múltiplos ativos em simultâneo?',
      resposta: 'Sim. A infraestrutura suporta operações simultâneas no Mini-Índice (WIN), Dólar (WDO) e ativos digitais na rede Solana.'
    }
  ]);

  const enviarTicket = (e) => {
    e.preventDefault();
    if (!duvida.trim()) return;
    setEnviado(true);
    setDuvida('');
    setTimeout(() => setEnviado(false), 4000);
  };

  return (
    <main style={{ backgroundColor: '#0f172a', color: '#1e293b', minHeight: '100vh', padding: '30px 20px', fontFamily: 'Arial, sans-serif', boxSizing: 'border-box', width: '100%' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        
        {/* Cabeçalho */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', backgroundColor: '#ffffff', padding: '20px 25px', borderRadius: '16px', border: '1px solid #cbd5e1', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', boxSizing: 'border-box', flexWrap: 'wrap', gap: '15px' }}>
          <div>
            <span style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 'bold', fontFamily: 'monospace', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>
              JENIOS PLATFORM • ASSISTÊNCIA AO CLIENTE
            </span>
            <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>
              Central de Suporte e FAQ
            </h1>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <a href="/dashboard" style={{ backgroundColor: '#f1f5f9', color: '#475569', padding: '9px 14px', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold', fontSize: '12px', border: '1px solid #cbd5e1' }}>
              ← Mesa de Operações
            </a>
          </div>
        </div>

        {/* Caixa de Abertura de Ticket */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '16px', padding: '25px', marginBottom: '25px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
          <span style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 'bold', fontFamily: 'monospace', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>
            💬 ABRIR TICKET DE ATENDIMENTO
          </span>
          <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#0f172a', marginBottom: '10px' }}>
            Precisa de auxílio técnico com a sua conta?
          </h2>
          <p style={{ fontSize: '13px', color: '#334155', marginBottom: '15px' }}>
            A nossa equipa de engenharia e suporte responde habitualmente em menos de 15 minutos em horário de pregão.
          </p>

          <form onSubmit={enviarTicket}>
            <textarea
              value={duvida}
              onChange={(e) => setDuvida(e.target.value)}
              placeholder="Descreva detalhadamente a sua dúvida ou questão técnica..."
              rows="3"
              style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', color: '#0f172a', fontSize: '13px', boxSizing: 'border-box', outline: 'none', resize: 'none', marginBottom: '12px' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="submit"
                style={{ backgroundColor: '#7c3aed', color: '#fff', border: 'none', padding: '12px 20px', borderRadius: '10px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}
              >
                Enviar Ticket de Suporte
              </button>
            </div>

            {enviado && (
              <div style={{ backgroundColor: '#d1fae5', color: '#065f46', padding: '10px', borderRadius: '8px', fontSize: '12px', textAlign: 'center', fontWeight: 'bold', marginTop: '15px' }}>
                ✅ Ticket enviado com sucesso! A nossa equipa entrará em contacto brevemente.
              </div>
            )}
          </form>
        </div>

        {/* Secção de FAQ */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '16px', padding: '25px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
          <span style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 'bold', fontFamily: 'monospace', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>
            📚 PERGUNTAS FREQUENTES (FAQ)
          </span>
          <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#0f172a', marginBottom: '20px' }}>
            Respostas Rápidas sobre a Plataforma
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {faqs.map((faq, idx) => (
              <div key={idx} style={{ padding: '16px', borderRadius: '12px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#0f172a', marginBottom: '6px' }}>{faq.pergunta}</h3>
                <p style={{ fontSize: '12px', color: '#334155', lineHeight: '1.4', margin: 0 }}>
                  {faq.resposta}
                </p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </main>
  );
}
