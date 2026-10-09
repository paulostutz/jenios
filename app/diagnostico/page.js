'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function DiagnosticoPlatformPage() {
  const [jaFezAntes, setJaFezAntes] = useState(false);
  const [scores, setScores] = useState({ impulsivo: 0, ansioso: 0, teimoso: 0, hesitante: 0, tecnico_positivo: 0 });
  const [etapa, setEtapa] = useState(0);
  const [timelineSelecionada, setTimelineSelecionada] = useState('');

  useEffect(() => {
    const status = localStorage.getItem('jenios_diagnostico_realizado');
    if (status === 'true') {
      setJaFezAntes(true);
    }
  }, []);

  const perguntas = [
    {
      q: "Passo 1: Como reage imediatamente após sofrer um Stop Loss inesperado em um ativo?",
      a: [
        { t: "Sinto raiva, abro outra operação na hora com o dobro do lote para recuperar rápido (Viés de Vingança).", p: "impulsivo", v: 2 },
        { t: "Fico arrasado e encerro o computador por hoje com receio de perder o capital restante.", p: "ansioso", v: 2 },
        { t: "Recuso-me a aceitar o erro. Arrasto o Stop Loss para baixo, afinal o mercado vai voltar.", p: "teimoso", v: 2 },
        { t: "Fico paralisado o resto do dia refazendo cálculos sem coragem de clicar novamente.", p: "hesitante", v: 2 }
      ]
    },
    {
      q: "Passo 2: Gestão de Alvo — Quando uma operação atinge R$ 100 de lucro de um alvo de R$ 500, o que faz?",
      a: [
        { t: "Aumento a mão na operação para tentar arrancar R$ 1.000 de forma agressiva.", p: "impulsivo", v: 2 },
        { t: "Fecho o trade imediatamente e embolso os R$ 100 por medo de devolver (Mão de Alface).", p: "ansioso", v: 2 },
        { t: "Deixo o trade correr ignorando qualquer sinal técnico de reversão gráfica.", p: "teimoso", v: 2 },
        { t: "Fico monitorando segundo a segundo, mudando de ideia a cada oscilação.", p: "hesitante", v: 2 }
      ]
    },
    {
      q: "Passo 3: Megatendência — O mercado entra em queda livre violenta. Como se posiciona originalmente?",
      a: [
        { t: "Clico em comprar repetidamente de forma furiosa, tentando adivinhar o fundo exato.", p: "impulsivo", v: 2 },
        { t: "Fico olhando a tela com o coração acelerado e a mente congelada, sem coragem de executar.", p: "ansioso", v: 2 },
        { t: "Abro novas compras a cada queda (Preço Médio), convicto de que o ativo está barato demais.", p: "teimoso", v: 2 },
        { t: "Espero cair por horas. Quando decido entrar vendido, o mercado subitamente inverte.", p: "hesitante", v: 2 }
      ]
    },
    {
      q: "Passo 4: Histórico Mensal — Como é o seu fechamento de faturamento de trade no final do mês?",
      a: [
        { t: "Passo semanas ganhando, mas perco absolutamente tudo e quebro a conta em um único dia de fúria.", p: "impulsivo", v: 2 },
        { t: "Minha conta sangra aos poucos porque meus ganhos são minúsculos e minhas perdas são longas.", p: "ansioso", v: 2 },
        { t: "Tenho dias de lucros estrondosos, seguidos por perdas catastróficas que zeram meu patrimônio.", p: "teimoso", v: 2 },
        { t: "Meus ganhos e perdas se equivalem, e meu saldo negativo real são apenas as taxas da corretora.", p: "hesitante", v: 2 }
      ]
    },
    {
      q: "Passo 5: Gargalo Operacional — O que mais te incomoda na sua rotina atual no mercado?",
      a: [
        { t: "A raiva incontrolável e o arrependimento devastador após fechar um dia de fúria.", p: "impulsivo", v: 2 },
        { t: "A ansiedade crônica e a dor no estômago toda vez que vejo o saldo oscilar na tela.", p: "ansioso", v: 2 },
        { t: "A sensação de que o mercado me persegue e que os grandes bancos sabem meu stop.", p: "teimoso", v: 2 },
        { t: "A frustração de estudar centenas de horas de teoria e não conseguir sair do lugar.", p: "hesitante", v: 2 }
      ]
    }
  ];

  const responder = (pIndex, aIndex) => {
    const alt = perguntas[pIndex].a[aIndex];
    setScores(prev => ({ ...prev, [alt.p]: prev[alt.p] + alt.v }));
    setEtapa(prev => prev + 1);
  };

  const voltarEtapa = () => {
    if (etapa > 0) setEtapa(prev => prev - 1);
  };

  const finalizarTimeline = (tipo) => {
    setTimelineSelecionada(tipo);
    setScores(prev => {
      const s = { ...prev };
      if (tipo === 'RAPIDO') { s.impulsivo += 3; s.ansioso += 3; }
      if (tipo === 'ESTRUTURADO') { s.hesitante += 3; s.ansioso += 1; }
      if (tipo === 'SWING') { s.teimoso += 4; s.tecnico_positivo += 2; }
      return s;
    });
    setEtapa(prev => prev + 1);
  };

  let aptidao = Math.min(100, (scores.tecnico_positivo / 10) * 100);

  const concluirEEntrarDiretoNaMesa = (modoDefinido) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('jenios_diagnostico_realizado', 'true');
      localStorage.setItem('jenios_diagnostico_data', new Date().toISOString());
      localStorage.setItem('jenios_modo_operacional', modoDefinido);
    }
    window.location.href = '/mesa-operacao';
  };

  return (
    <main style={{ backgroundColor: '#0f172a', color: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '20px', fontFamily: 'Arial, sans-serif', boxSizing: 'border-box', width: '100%' }}>
      <div style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '20px', padding: '30px', maxWidth: '600px', width: '100%', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)', boxSizing: 'border-box' }}>
        
        {jaFezAntes ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: '#fef2f2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', margin: '0 auto 20px auto', fontWeight: 'bold' }}>
              ⚠️
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#0f172a', marginBottom: '12px' }}>Diagnóstico Já Realizado</h2>
            <p style={{ fontSize: '13px', color: '#475569', lineHeight: '1.6', marginBottom: '25px' }}>
              Você já concluiu o seu Diagnóstico Comportamental anteriormente. Por questões de segurança algorítmica e compliance, <b>não é permitido realizar novos testes no momento</b>. O próximo diagnóstico estará disponível somente após 90 dias da última calibração.
            </p>
            <Link href="/dashboard-logado" style={{ backgroundColor: '#7c3aed', color: '#fff', textDecoration: 'none', padding: '12px 24px', borderRadius: '10px', fontSize: '13px', fontWeight: 'bold', display: 'inline-block' }}>
              ← Voltar para a Sala de Controle
            </Link>
          </div>
        ) : (
          <>
            {etapa < perguntas.length && (
              <div>
                <span style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 'bold', fontFamily: 'monospace', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px', display: 'block' }}>
                  Onboarding Platform • Etapa {etapa + 1} de 6
                </span>
                <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '20px', lineHeight: '1.4', color: '#0f172a' }}>
                  {perguntas[etapa].q}
                </h2>
                <div>
                  {perguntas[etapa].a.map((alt, idx) => (
                    <button
                      key={idx}
                      onClick={() => responder(etapa, idx)}
                      style={{ width: '100%', textAlign: 'left', backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', color: '#334155', padding: '14px', borderRadius: '10px', fontSize: '13px', marginBottom: '10px', cursor: 'pointer', display: 'block' }}
                    >
                      {alt.t}
                    </button>
                  ))}
                </div>
                {etapa > 0 && (
                  <button onClick={voltarEtapa} style={{ width: '100%', background: '#e2e8f0', color: '#475569', fontWeight: 'bold', fontSize: '12px', padding: '10px', borderRadius: '10px', border: 'none', cursor: 'pointer', marginTop: '12px' }}>
                    ← Voltar à questão anterior
                  </button>
                )}
              </div>
            )}

            {etapa === perguntas.length && (
              <div>
                <span style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 'bold', fontFamily: 'monospace', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px', display: 'block' }}>
                  Etapa Final • Frequência Operacional
                </span>
                <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '20px', lineHeight: '1.4', color: '#0f172a' }}>
                  Qual é a sua janela de tempo principal de exposição ao mercado?
                </h2>
                <div>
                  <button onClick={() => finalizarTimeline('RAPIDO')} style={{ width: '100%', textAlign: 'left', backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', color: '#334155', padding: '14px', borderRadius: '10px', fontSize: '13px', marginBottom: '10px', cursor: 'pointer' }}>
                    <b>Day Trade Rápido</b><br /><span style={{ fontSize: '11px', color: '#64748b' }}>Gráficos de 1 a 5 minutos (Alta frequência)</span>
                  </button>
                  <button onClick={() => finalizarTimeline('ESTRUTURADO')} style={{ width: '100%', textAlign: 'left', backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', color: '#334155', padding: '14px', borderRadius: '10px', fontSize: '13px', marginBottom: '10px', cursor: 'pointer' }}>
                    <b>Day Trade Estruturado</b><br /><span style={{ fontSize: '11px', color: '#64748b' }}>Gráficos de 15 min a 1h (Ciclos e regras)</span>
                  </button>
                  <button onClick={() => finalizarTimeline('SWING')} style={{ width: '100%', textAlign: 'left', backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', color: '#334155', padding: '14px', borderRadius: '10px', fontSize: '13px', marginBottom: '10px', cursor: 'pointer' }}>
                    <b>Swing Trade / Position</b><br /><span style={{ fontSize: '11px', color: '#64748b' }}>Gráficos Diários ou Semanais (Macro)</span>
                  </button>
                </div>
              </div>
            )}

            {etapa > perguntas.length && (
              <div>
                <span style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 'bold', fontFamily: 'monospace', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px', display: 'block' }}>
                  🎯 Calibração Adaptativa Concluída
                </span>
                <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '20px', lineHeight: '1.4', color: '#0f172a' }}>
                  Relatório de Configuração Inicial
                </h2>
                <p style={{ fontSize: '13px', color: '#334155', lineHeight: '1.5', marginBottom: '15px' }}>
                  Score de Disciplina Técnica: <b>{aptidao.toFixed(0)}%</b>
                </p>
                <button
                  onClick={() => concluirEEntrarDiretoNaMesa(aptidao >= 60 ? 'manual' : 'reversao')}
                  style={{ width: '100%', background: '#7c3aed', color: 'white', fontWeight: 'bold', fontSize: '13px', padding: '14px', borderRadius: '10px', border: 'none', cursor: 'pointer', marginTop: '15px', textAlign: 'center' }}
                >
                  Entrar Diretamente na Mesa de Operações →
                </button>
              </div>
            )}
          </>
        )}

      </div>
    </main>
  );
}