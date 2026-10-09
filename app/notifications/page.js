'use client';
import { useState } from 'react';

export default function NotificationsPage() {
  const [whatsappAtivo, setWhatsappAtivo] = useState(true);
  const [emailAtivo, setEmailAtivo] = useState(true);
  const [pushAtivo, setPushAtivo] = useState(false);
  const [telefone, setTelefone] = useState('+55 (11) 99999-9999');
  const [emailNotif, setEmailNotif] = useState('paulo@jenios.com');

  const [alertas, setAlertas] = useState([
    { 
      id: 1, 
      tipo: 'CRÍTICO', 
      cor: '#dc2626', 
      titulo: 'Botão Antifúria Acionado', 
      texto: 'O bloqueio de emergência foi ativado com sucesso. Novas ordens manuais foram suspensas por 24 horas para salvaguardar o capital.', 
      tempo: 'Há 15 minutos', 
      lido: false 
    },
    { 
      id: 2, 
      tipo: 'HFT', 
      cor: '#7c3aed', 
      titulo: 'Modo Reverso Executado', 
      texto: 'Falso rompimento detetado no Mini-Dólar. O motor HFT inverteu a ordem emocional e gerou um ganho protegido de +R$ 480,00.', 
      tempo: 'Há 2 horas', 
      lido: true 
    },
    { 
      id: 3, 
      tipo: 'SISTEMA', 
      cor: '#059669', 
      titulo: 'Período de Teste Gratuito', 
      tempo: 'Há 1 dia',
      texto: 'O seu acesso de 7 Dias Grátis na plataforma está ativo. Explore os recursos de automação e escolha o seu plano ideal.', 
      lido: true 
    }
  ]);

  const marcarComoLido = (id) => {
    setAlertas(alertas.map(a => a.id === id ? { ...a, lido: true } : a));
  };

  const guardarConfiguracoes = (e) => {
    e.preventDefault();
    alert("Preferências de notificação e canais multicanal atualizadas com sucesso!");
  };

  return (
    <main style={{ backgroundColor: '#0f172a', color: '#f8fafc', minHeight: '100vh', padding: '30px 20px', fontFamily: 'Arial, sans-serif', boxSizing: 'border-box', width: '100%' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '28px' }}>
        
        {/* CABEÇALHO */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', color: '#0f172a', padding: '16px 24px', borderRadius: '16px', border: '1px solid #cbd5e1', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: '#7c3aed', color: '#fff', fontWeight: '900', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(124, 58, 237, 0.4)' }}>
              J
            </div>
            <div>
              <span style={{ fontSize: '13px', fontWeight: '900', letterSpacing: '1px', textTransform: 'uppercase', display: 'block' }}>JENIOS NOTIFICATIONS</span>
              <span style={{ fontSize: '10px', color: '#7c3aed', fontWeight: 'bold', fontFamily: 'monospace' }}>● CENTRAL DE ALERTAS E WHATSAPP API</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <a href="/dashboard" style={{ backgroundColor: '#f1f5f9', color: '#334155', textDecoration: 'none', fontSize: '11px', fontWeight: 'bold', padding: '10px 16px', borderRadius: '10px', border: '1px solid #cbd5e1' }}>Ir para Dashboard</a>
            <a href="/" style={{ backgroundColor: '#7c3aed', color: '#fff', textDecoration: 'none', fontSize: '11px', fontWeight: 'bold', padding: '10px 16px', borderRadius: '10px', boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)' }}>Portal Principal</a>
          </div>
        </div>

        {/* SECÇÃO DE CONFIGURAÇÃO DE CANAIS */}
        <div style={{ backgroundColor: '#ffffff', color: '#0f172a', borderRadius: '24px', padding: '28px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <span style={{ fontSize: '10px', color: '#7c3aed', fontWeight: 'bold', fontFamily: 'monospace', letterSpacing: '2px', textTransform: 'uppercase' }}>CONFIGURAÇÃO MULTICANAL</span>
            <h2 style={{ fontSize: '18px', fontWeight: '900', margin: '4px 0 0 0' }}>Canais de Disparo e Alertas em Tempo Real</h2>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0 0' }}>Selecione onde deseja receber os relatórios do robô HFT e os avisos de segurança emocional.</p>
          </div>

          <form onSubmit={guardarConfiguracoes} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#334155', textTransform: 'uppercase' }}>WhatsApp para Alertas Críticos</label>
                <input 
                  type="text" 
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  style={{ padding: '12px', border: '1px solid #cbd5e1', borderRadius: '10px', fontSize: '12px', backgroundColor: '#f8fafc', outline: 'none' }} 
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#334155', textTransform: 'uppercase' }}>E-mail de Relatórios Diários</label>
                <input 
                  type="email" 
                  value={emailNotif}
                  onChange={(e) => setEmailNotif(e.target.value)}
                  style={{ padding: '12px', border: '1px solid #cbd5e1', borderRadius: '10px', fontSize: '12px', backgroundColor: '#f8fafc', outline: 'none' }} 
                />
              </div>

            </div>

            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', backgroundColor: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #cbd5e1', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="checkbox" checked={whatsappAtivo} onChange={(e) => setWhatsappAtivo(e.target.checked)} /> 📱 Enviar Alertas via WhatsApp API
              </label>
              <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="checkbox" checked={emailAtivo} onChange={(e) => setEmailAtivo(e.target.checked)} /> ✉️ Enviar Relatórios por E-mail
              </label>
              <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="checkbox" checked={pushAtivo} onChange={(e) => setPushAtivo(e.target.checked)} /> 🔔 Push Web Notifications
              </label>
            </div>

            <button type="submit" style={{ backgroundColor: '#7c3aed', color: '#fff', border: 'none', padding: '14px', borderRadius: '10px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Guardar Preferências de Alerta
            </button>
          </form>
        </div>

        {/* FEED DE ALERTAS RECENTES */}
        <div style={{ backgroundColor: '#ffffff', color: '#0f172a', borderRadius: '24px', padding: '28px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '900', margin: 0 }}>Histórico de Alertas & Ações do Motor HFT</h3>
            <span style={{ fontSize: '11px', color: '#64748b' }}>{alertas.filter(a => !a.lido).length} não lidos</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {alertas.map((a) => (
              <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', backgroundColor: a.lido ? '#f8fafc' : '#f3e8ff', padding: '16px', borderRadius: '14px', border: '1px solid #cbd5e1', gap: '14px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '10px', backgroundColor: a.cor, color: '#fff', padding: '2px 8px', borderRadius: '6px', fontWeight: 'bold', fontFamily: 'monospace' }}>
                      {a.tipo}
                    </span>
                    <span style={{ fontSize: '13px', fontWeight: 'bold' }}>{a.titulo}</span>
                    <span style={{ fontSize: '10px', color: '#64748b' }}>• {a.tempo}</span>
                  </div>
                  <p style={{ fontSize: '12px', color: '#334155', margin: '4px 0 0 0', lineHeight: '1.5' }}>
                    {a.texto}
                  </p>
                </div>
                {!a.lido && (
                  <button onClick={() => marcarComoLido(a.id)} style={{ backgroundColor: '#7c3aed', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '8px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    Marcar como Lido
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* RODAPÉ */}
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '4px', paddingTop: '10px' }}>
          <div style={{ fontSize: '11px', fontWeight: '900', color: '#a78bfa', letterSpacing: '2px', textTransform: 'uppercase' }}>JENIOS NOTIFICATIONS • INFRAESTRUTURA DE ALERTAS</div>
          <div style={{ fontSize: '10px', color: '#64748b' }}>Todos os direitos reservados.</div>
        </div>

      </div>
    </main>
  );
}