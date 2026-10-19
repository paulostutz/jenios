'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { classifyDiagnostic } from '../../lib/platform/diagnostic-routing.mjs';
import { loadAccountDiagnostic, submitAccountDiagnostic, writeSessionMode } from '../../lib/platform/diagnostic-client.mjs';
import { supabase } from '../../lib/supabase';

export default function DiagnosticoPlatformPage() {
  const [jaFezAntes, setJaFezAntes] = useState(false);
  const [verificando, setVerificando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState('');
  const [respostas, setRespostas] = useState([]);
  const [etapa, setEtapa] = useState(0);
  const [timelineSelecionada, setTimelineSelecionada] = useState('');

  useEffect(() => {
    let ativo=true;
    loadAccountDiagnostic(supabase).then(status=>{
      if (!ativo) return;
      setJaFezAntes(status.verified === true);
      setVerificando(false);
    });
    return ()=>{ativo=false;};
  }, []);

  const perguntas = [
    {
      q: "Passo 1: Como reage imediatamente após sofrer um Stop Loss inesperado em um ativo?",
      a: [
        { t: "Sinto raiva, abro outra operação na hora com o dobro do lote para recuperar rápido (Viés de Vingança).", p: "impulsivo", v: 2 },
        { t: "Fico arrasado e encerro o computador por hoje com receio de perder o capital restante.", p: "ansioso", v: 2 },
        { t: "Recuso-me a aceitar o erro. Arrasto o Stop Loss para baixo, afinal o mercado vai voltar.", p: "teimoso", v: 2 },
        { t: "Fico paralisado o resto do dia refazendo cálculos sem coragem de clicar novamente.", p: "hesitante", v: 2 },
        { t: "Respeito o stop, registro a razão da entrada e só volto a operar quando houver configuração válida.", p: "tecnico_positivo", v: 2 }
      ]
    },
    {
      q: "Passo 2: Gestão de Alvo — Quando uma operação atinge R$ 100 de lucro de um alvo de R$ 500, o que faz?",
      a: [
        { t: "Aumento a mão na operação para tentar arrancar R$ 1.000 de forma agressiva.", p: "impulsivo", v: 2 },
        { t: "Fecho o trade imediatamente e embolso os R$ 100 por medo de devolver (Mão de Alface).", p: "ansioso", v: 2 },
        { t: "Deixo o trade correr ignorando qualquer sinal técnico de reversão gráfica.", p: "teimoso", v: 2 },
        { t: "Fico monitorando segundo a segundo, mudando de ideia a cada oscilação.", p: "hesitante", v: 2 },
        { t: "Sigo o plano pré-definido de alvos e stops sem aumentar o lote por impulso.", p: "tecnico_positivo", v: 2 }
      ]
    },
    {
      q: "Passo 3: Megatendência — O mercado entra em queda livre violenta. Como se posiciona originalmente?",
      a: [
        { t: "Clico em comprar repetidamente de forma furiosa, tentando adivinhar o fundo exato.", p: "impulsivo", v: 2 },
        { t: "Fico olhando a tela com o coração acelerado e a mente congelada, sem coragem de executar.", p: "ansioso", v: 2 },
        { t: "Abro novas compras a cada queda (Preço Médio), convicto de que o ativo está barato demais.", p: "teimoso", v: 2 },
        { t: "Espero cair por horas. Quando decido entrar vendido, o mercado subitamente inverte.", p: "hesitante", v: 2 },
        { t: "Analiso a tendência e aguardo confirmação do meu setup, sem tentar adivinhar o fundo.", p: "tecnico_positivo", v: 2 }
      ]
    },
    {
      q: "Passo 4: Histórico Mensal — Como é o seu fechamento de faturamento de trade no final do mês?",
      a: [
        { t: "Passo semanas ganhando, mas perco absolutamente tudo e quebro a conta em um único dia de fúria.", p: "impulsivo", v: 2 },
        { t: "Minha conta sangra aos poucos porque meus ganhos são minúsculos e minhas perdas são longas.", p: "ansioso", v: 2 },
        { t: "Tenho dias de lucros estrondosos, seguidos por perdas catastróficas que zeram meu patrimônio.", p: "teimoso", v: 2 },
        { t: "Meus ganhos e perdas se equivalem, e meu saldo negativo real são apenas as taxas da corretora.", p: "hesitante", v: 2 },
        { t: "Consolido os resultados, respeito meus limites diários e reviso o diário de operações.", p: "tecnico_positivo", v: 2 }
      ]
    },
    {
      q: "Passo 5: Gargalo Operacional — O que mais te incomoda na sua rotina atual no mercado?",
      a: [
        { t: "A raiva incontrolável e o arrependimento devastador após fechar um dia de fúria.", p: "impulsivo", v: 2 },
        { t: "A ansiedade crônica e a dor no estômago toda vez que vejo o saldo oscilar na tela.", p: "ansioso", v: 2 },
        { t: "A sensação de que o mercado me persegue e que os grandes bancos sabem meu stop.", p: "teimoso", v: 2 },
        { t: "A frustração de estudar centenas de horas de teoria e não conseguir sair do lugar.", p: "hesitante", v: 2 },
        { t: "Quero ampliar a consistência no cumprimento do meu plano e da gestão de risco.", p: "tecnico_positivo", v: 2 }
      ]
    }
  ];

  // Recalcula do zero: voltar/alterar respostas não duplica pontos do laudo.
  const scores = perguntas.reduce((acc, question, index) => {
    const choice = Number.isInteger(respostas[index]) ? question.a[respostas[index]] : null;
    if (choice) acc[choice.p] += choice.v;
    return acc;
  }, { impulsivo: 0, ansioso: 0, teimoso: 0, hesitante: 0, tecnico_positivo: 0 });
  const recomendacao = classifyDiagnostic(scores);

  const responder = (index, choice) => {
    setRespostas(prev => [...prev.slice(0, index), choice]);
    setEtapa(index + 1);
  };
  const voltarEtapa = () => setEtapa(prev => Math.max(0, prev - 1));
  const finalizarTimeline = (tipo) => {
    setTimelineSelecionada(tipo);
    setEtapa(perguntas.length + 1);
  };
  const concluirEEntrarDiretoNaMesa = async () => {
    if (salvando || respostas.length !== perguntas.length || !timelineSelecionada) return;
    setSalvando(true);
    setAviso('');
    const status = await submitAccountDiagnostic(supabase, respostas, timelineSelecionada);
    // Na ausência de backend ou conta, somente uma preferência transitória da sessão.
    writeSessionMode(window.sessionStorage,status.userId,status.verified ? status.mode : recomendacao.mode);
    if (!status.verified) {
      setAviso('A avaliação não foi confirmada no servidor. Você pode estudar na simulação, mas não está habilitado para operações reais.');
    }
    window.location.assign('/mesa-operacoes');
  };

  return (
    <main style={{ backgroundColor: '#0f172a', color: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '20px', fontFamily: 'Arial, sans-serif', boxSizing: 'border-box', width: '100%' }}>
      <div style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '20px', padding: '30px', maxWidth: '600px', width: '100%', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)', boxSizing: 'border-box' }}>
        
        {verificando ? (<p role="status">Verificando diagnóstico da conta…</p>) : jaFezAntes ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: '#fef2f2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', margin: '0 auto 20px auto', fontWeight: 'bold' }}>
              ⚠️
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#0f172a', marginBottom: '12px' }}>Diagnóstico Já Realizado</h2>
            <p style={{ fontSize: '13px', color: '#475569', lineHeight: '1.6', marginBottom: '25px' }}>
              Seu laudo foi identificado no servidor da JENIOS. Você pode estudar e alterar o modo na mesa. Isso não autoriza ordens reais ou o uso de corretoras.
            </p>
            <Link href="/dashboard" style={{ backgroundColor: '#7c3aed', color: '#fff', textDecoration: 'none', padding: '12px 24px', borderRadius: '10px', fontSize: '13px', fontWeight: 'bold', display: 'inline-block' }}>
              ← Voltar para a Área de Negociação
            </Link>
          </div>
        ) : (
          <>
            {etapa < perguntas.length && (
              <div>
                <span style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 'bold', fontFamily: 'monospace', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px', display: 'block' }}>
                  Onboarding Platform • Etapa {etapa + 1} de {perguntas.length + 1}
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
              <section style={{ display:'flex',flexDirection:'column',gap:16 }}>
                <span style={{fontSize:11,fontWeight:800,color:'#7c3aed'}}>LAUDO INICIAL • ORIENTAÇÃO OPERACIONAL</span>
                <h2 style={{color:'#0f172a',fontSize:22,margin:0}}>Diagnóstico concluído</h2>
                <div style={{background:'#f5f3ff',padding:18,borderRadius:12,border:'1px solid #ddd6fe'}}>
                  <p style={{margin:'0 0 8px',fontSize:14,fontWeight:800,color:'#4c1d95'}}>
                    Modo inicial sugerido: {recomendacao.mode === 'reversa' ? 'Reversão Adaptativa' : 'Manual'}
                  </p>
                  <p style={{fontSize:12,margin:0,color:'#334155',lineHeight:1.6}}>{recomendacao.rationale}</p>
                </div>
                <p style={{fontSize:12,color:'#475569'}}>A JENIOS aplicará esse modo inicialmente na simulação. Você poderá alterar manualmente depois. O laudo é orientativo, não prevê lucros e, isoladamente, não libera operações reais.</p>
                <button onClick={concluirEEntrarDiretoNaMesa} disabled={salvando} style={{background:'#7c3aed',color:'#fff',border:0,borderRadius:10,padding:14,fontWeight:800,cursor:salvando?'progress':'pointer'}}>{salvando?'Validando laudo…':'Entrar na área de negociações'}</button>
                {aviso && <p role="status" style={{fontSize:12,color:'#92400e'}}>{aviso}</p>}
                <button onClick={() => setEtapa(perguntas.length)} style={{background:'#e2e8f0',color:'#334155',border:0,borderRadius:10,padding:10,cursor:'pointer'}}>Revisar respostas</button>
              </section>
            )}
          </>
        )}

      </div>
    </main>
  );
}