'use client';

export default function RankingMensalPage() {
  const tentarCopiarMestre = (nomeMestre, valorCopia) => {
    let temPlanoAtivo = false;

    if (!temPlanoAtivo) {
      let escolhaPlano = window.prompt(
        "Para ativar a cópia de " + nomeMestre + " (R$ " + valorCopia.toFixed(2) + "), precisa de um plano base ativo na JENIOS.\n\nEscolha o seu plano:\n1 - Essencial (R$ 99,90)\n2 - Pro (R$ 149,90)\n3 - Elite (R$ 199,90)\n\nDigite 1, 2 ou 3:"
      );
      
      let valorPlano = 0;
      let nomePlano = "";

      if (escolhaPlano === "1") { valorPlano = 99.90; nomePlano = "Essencial (R$ 99,90)"; }
      else if (escolhaPlano === "2") { valorPlano = 149.90; nomePlano = "Pro (R$ 149,90)"; }
      else if (escolhaPlano === "3") { valorPlano = 199.90; nomePlano = "Elite (R$ 199,90)"; }
      else {
        alert("Operação cancelada. É necessário selecionar um plano base para ativar a cópia.");
        return;
      }

      let totalAgregado = valorPlano + valorCopia;
      alert("Plano selecionado: " + nomePlano + "\nMestre: " + nomeMestre + " (R$ " + valorCopia.toFixed(2) + ")\n\nTotal Mensal Agregado: R$ " + totalAgregado.toFixed(2) + "\n\nA redirecionar para o checkout com split automático...");
    } else {
      alert("Plano ativo detetado! A ativar cópia de " + nomeMestre + " por R$ " + valorCopia.toFixed(2) + "/mês...");
    }
  };

  return (
    <main style={{ backgroundColor: '#0f172a', color: '#f8fafc', minHeight: '100vh', padding: '30px 20px', fontFamily: 'Arial, sans-serif', boxSizing: 'border-box', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      
      <div style={{ maxWidth: '750px', width: '100%', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Cartão do Ranking Mensal Top 10 */}
        <div style={{ backgroundColor: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: '16px', padding: '30px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', display: 'flex', flexDirection: 'column', gap: '24px', boxSizing: 'border-box' }}>
          
          {/* Cabeçalho */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' }}>
            <div>
              <span style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 'bold', fontFamily: 'monospace', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>
                JENIOS GAMIFICATION • Competição Mensal
              </span>
              <h1 style={{ fontSize: '20px', fontWeight: '900', color: '#0f172a', margin: 0 }}>Top 10 Traders de Elite (Outubro)</h1>
            </div>
            <span style={{ backgroundColor: '#d1fae5', color: '#065f46', fontSize: '10px', fontWeight: 'bold', padding: '6px 12px', borderRadius: '9999px', textTransform: 'uppercase' }}>
              🎁 Prémio Top 3: Mensalidade Abonada
            </span>
          </div>

          {/* Explicação da Métrica */}
          <div style={{ backgroundColor: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: '12px', padding: '12px', fontSize: '12px', color: '#334155', lineHeight: '1.5' }}>
            <b>Regra do Ecossistema:</b> O ranking premia a eficiência e o <i>Índice de Frieza</i>. Para copiar qualquer Mestre, é obrigatório possuir um plano base ativo na plataforma.
          </div>

          {/* Tabela Top 10 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '500px', overflowY: 'auto', paddingRight: '4px' }}>
            
            {/* 1º Lugar */}
            <div style={{ background: 'linear-gradient(to right, #fffbeb, #ffffff)', border: '2px solid #facc15', borderRadius: '12px', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#f59e0b', color: '#ffffff', fontWeight: '900', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                  🥇 1º
                </div>
                <div>
                  <h4 style={{ fontSize: '13px', fontWeight: '900', color: '#0f172a', margin: '0 0 2px 0' }}>Carlos Quant (@carlosq)</h4>
                  <span style={{ fontSize: '10px', color: '#b45309', fontWeight: 'bold' }}>Frieza: 98/100 • Rentabilidade: +42.5%</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '10px', backgroundColor: '#fef3c7', color: '#92400e', fontWeight: 'bold', padding: '6px 10px', borderRadius: '6px', display: 'inline-block' }}>Mensalidade Abonada 🛡️</span>
                <button onClick={() => alert('Seguindo Carlos Quant!')} style={{ backgroundColor: '#f1f5f9', color: '#334155', border: 'none', fontWeight: 'bold', fontSize: '11px', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer' }}>+ Seguir</button>
                <button onClick={() => tentarCopiarMestre('Carlos Quant', 49.90)} style={{ backgroundColor: '#7c3aed', color: '#fff', border: 'none', fontWeight: 'bold', fontSize: '11px', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)' }}>⚡ Copiar (R$ 49,90)</button>
              </div>
            </div>

            {/* 2º Lugar */}
            <div style={{ background: 'linear-gradient(to right, #f8fafc, #ffffff)', border: '2px solid #cbd5e1', borderRadius: '12px', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#94a3b8', color: '#ffffff', fontWeight: '900', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  🥈 2º
                </div>
                <div>
                  <h4 style={{ fontSize: '13px', fontWeight: '900', color: '#0f172a', margin: '0 0 2px 0' }}>Ana Trader (@anatrader)</h4>
                  <span style={{ fontSize: '10px', color: '#475569', fontWeight: 'bold' }}>Frieza: 95/100 • Rentabilidade: +38.1%</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '10px', backgroundColor: '#f1f5f9', color: '#1e293b', fontWeight: 'bold', padding: '6px 10px', borderRadius: '6px', display: 'inline-block' }}>Mensalidade Abonada 🛡️</span>
                <button onClick={() => alert('Seguindo Ana Trader!')} style={{ backgroundColor: '#f1f5f9', color: '#334155', border: 'none', fontWeight: 'bold', fontSize: '11px', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer' }}>+ Seguir</button>
                <button onClick={() => tentarCopiarMestre('Ana Trader', 49.90)} style={{ backgroundColor: '#7c3aed', color: '#fff', border: 'none', fontWeight: 'bold', fontSize: '11px', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)' }}>⚡ Copiar (R$ 49,90)</button>
              </div>
            </div>

            {/* 3º Lugar */}
            <div style={{ background: 'linear-gradient(to right, #fffbeb, #ffffff)', border: '2px solid rgba(180, 83, 9, 0.4)', borderRadius: '12px', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#b45309', color: '#ffffff', fontWeight: '900', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  🥉 3º
                </div>
                <div>
                  <h4 style={{ fontSize: '13px', fontWeight: '900', color: '#0f172a', margin: '0 0 2px 0' }}>Marcos FX (@marcosfx)</h4>
                  <span style={{ fontSize: '10px', color: '#b45309', fontWeight: 'bold' }}>Frieza: 92/100 • Rentabilidade: +31.4%</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '10px', backgroundColor: '#fef3c7', color: '#78350f', fontWeight: 'bold', padding: '6px 10px', borderRadius: '6px', display: 'inline-block' }}>Mensalidade Abonada 🛡️</span>
                <button onClick={() => alert('Seguindo Marcos FX!')} style={{ backgroundColor: '#f1f5f9', color: '#334155', border: 'none', fontWeight: 'bold', fontSize: '11px', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer' }}>+ Seguir</button>
                <button onClick={() => tentarCopiarMestre('Marcos FX', 49.90)} style={{ backgroundColor: '#7c3aed', color: '#fff', border: 'none', fontWeight: 'bold', fontSize: '11px', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)' }}>⚡ Copiar (R$ 49,90)</button>
              </div>
            </div>

            {/* Demais posições (4º ao 10º) */}
            {[
              { pos: '4º', nome: 'Beatriz Lima (@bialima)', frieza: '90/100', rent: '+28.9%' },
              { pos: '5º', nome: 'Lucas Invest (@lucasinv)', frieza: '88/100', rent: '+26.2%' },
              { pos: '6º', nome: 'Renata Tech (@renatatech)', frieza: '87/100', rent: '+24.0%' },
              { pos: '7º', nome: 'Gabriel B3 (@gabrielb3)', frieza: '85/100', rent: '+21.8%' },
              { pos: '8º', nome: 'Juliana Trade (@julianatrade)', frieza: '84/100', rent: '+19.5%' },
              { pos: '9º', nome: 'Thiago Alpha (@thiagoalpha)', frieza: '82/100', rent: '+18.0%' },
              { pos: '10º', nome: 'Patricia Momentum (@patimomentum)', frieza: '80/100', rent: '+16.4%' },
            ].map((trader, idx) => (
              <div key={idx} style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#e2e8f0', color: '#334155', fontWeight: 'bold', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {trader.pos}
                  </div>
                  <div>
                    <h4 style={{ fontSize: '12px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 2px 0' }}>{trader.nome}</h4>
                    <span style={{ fontSize: '10px', color: '#64748b' }}>Frieza: {trader.frieza} • Rentabilidade: {trader.rent}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button onClick={() => alert('Seguindo ' + trader.nome)} style={{ backgroundColor: '#f1f5f9', color: '#334155', border: 'none', fontWeight: 'bold', fontSize: '11px', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer' }}>+ Seguir</button>
                  <button onClick={() => tentarCopiarMestre(trader.nome, 49.90)} style={{ backgroundColor: '#7c3aed', color: '#fff', border: 'none', fontWeight: 'bold', fontSize: '11px', padding: '6px 14px', borderRadius: '8px', cursor: 'pointer' }}>⚡ Copiar</button>
                </div>
              </div>
            ))}

          </div>

        </div>

      </div>
    </main>
  );
}