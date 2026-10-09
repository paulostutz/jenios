'use client';
import { useState } from 'react';

export default function LandingPagePro() {
  const [scores, setScores] = useState({ impulsivo: 0, ansioso: 0, teimoso: 0, hesitante: 0, tecnico_positivo: 0 });
  const [etapaAtual, setEtapaAtual] = useState(0);
  const [tradeAtual, setTradeAtual] = useState(0);
  const [leadFeito, setLeadFeito] = useState(false);
  const [dadosLead, setDadosLead] = useState({ nome: '', email: '', whatsapp: '' });

  const perguntas = [
    { q: "Você passa horas estudando um ativo. Assim que clica em 'Comprar', o preço vira instantaneamente e esmaga o seu Stop Loss. Qual sua reação imediata?", a: [{ t: "Sinto o sangue ferver. Dobro o lote na operação seguinte para recuperar o prejuízo na marra (Trade de Vingança).", p: "impulsivo", v: 2 }, { t: "Fico em pânico total, fecho a corretora e encerro o dia com um nó no estômago.", p: "ansioso", v: 2 }, { t: "Recuso-me a aceitar o erro. Arrasto o Stop Loss para baixo, rezando para o mercado voltar.", p: "teimoso", v: 2 }, { t: "Fico paralisado, olhando para a tela por horas, refazendo contas sem coragem de clicar de novo.", p: "hesitante", v: 2 }] },
    { q: "Você está a ganhar R$ 100, mas o seu alvo técnico era R$ 500. O mercado dá uma oscilação rápida contra si. O que faz?", a: [{ t: "Entro em fúria, aumento a mão para tentar buscar o triplo e acabo devolvendo tudo o que ganhei.", p: "impulsivo", v: 2 }, { t: "Encerro imediatamente com medo de perder os R$ 100. Minha mão é de alface crônica.", p: "ansioso", v: 2 }, { t: "Deixo o trade correr cego, ignorando qualquer sinal claro de reversão institucional.", p: "teimoso", v: 2 }, { t: "Fico oscilando entre fechar e manter, mudando de ideia a cada segundo até perder o timing perfeito.", p: "hesitante", v: 2 }] },
    { q: "O mercado entra em queda livre (Megatendência de Baixa). Como você se posiciona originalmente?", a: [{ t: "Clico em comprar repetidamente de forma agressiva, tentando adivinhar o fundo à força.", p: "impulsivo", v: 2 }, { t: "Fico com o coração acelerado e a mente travada, sem conseguir executar uma única ordem de defesa.", p: "ansioso", v: 2 }, { t: "Faço preço médio contra a tendência, convicto de que o ativo está 'barato demais' para cair mais.", p: "teimoso", v: 2 }, { t: "Espero horas. Quando decido finalmente entrar vendido, o mercado faz o fundo exato e explode para cima.", p: "hesitante", v: 2 }] },
    { q: "Como termina o seu mês operando no mercado financeiro?", a: [{ t: "Passo semanas a lucrar com disciplina, mas bastam 10 minutos de fúria para quebrar a conta inteira.", p: "impulsivo", v: 2 }, { t: "Minha conta sangra lentamente dia após dia: meus ganhos são migalhas e minhas perdas são monstros.", p: "ansioso", v: 2 }, { t: "Tenho dias de lucros brilhantes seguidos por catástrofes financeiras que zeram o meu patrimônio.", p: "teimoso", v: 2 }, { t: "Empato o mês e o meu único saldo real negativo são as taxas brutas pagas à corretora e taxas operacionais.", p: "hesitante", v: 2 }] },
    { q: "O que mais te atormenta na sua rotina atual de trading?", a: [{ t: "O ódio e o arrependimento profundo de saber que eu mesmo destruí a minha conta por pura falta de controle emocional.", p: "impulsivo", v: 2 }, { t: "A ansiedade crónica e o pavor de abrir o Home Broker e ver o capital evaporar.", p: "ansioso", v: 2 }, { t: "A sensação nítida de que os grandes players (as baleias) monitoram o meu stop e me caçam de propósito.", p: "teimoso", v: 2 }, { t: "A frustração de já ter estudado dezenas de teorias e não conseguir sair do lugar de perdedor.", p: "hesitante", v: 2 }] }
  ];

  const cenariosTrades = [
    { id: 1, titulo: "TRADE 1: O Teste do Pânico (O Despencar do Ativo)", msg: "O mercado virou contra si de forma brutal. O stop técnico era -R$ 100, mas já vai em -R$ 180 e continua a derreter. O que o seu cérebro manda fazer?", btn1: "Aceitar a perda curta e estopar", btn2: "Arrastar o Stop para baixo (Acreditar na virada)", path: "M5,10 Q50,15 100,25 T200,45 T300,55 T400,65", cor: "#ef4444", label: "QUEDA VERTICAL • A CAÇA AO STOP" },
    { id: 2, titulo: "TRADE 2: A Tentação da Mão de Alface", msg: "O seu alvo programado é R$ 400, mas o preço balançou contra si. Vai arregar e fechar com trocados ou segurar o plano técnico?", btn1: "Garantir mixaria e fechar logo", btn2: "Manter robô travado até o Alvo", path: "M5,55 Q50,45 100,50 T200,30 T300,25 T400,15", cor: "#10b981", label: "OSCILAÇÃO TÁTICA • TESTE EMOCIONAL" },
    { id: 3, titulo: "TRADE 3: A Armadilha do Falso Rompimento", msg: "As instituições romperam o topo histórico para estopar os vendidos e despencaram o preço. Você foi pego na armadilha. Ação:", btn1: "Assumir o erro e estopar imediatamente", btn2: "Vender o triplo para tentar recuperar na raiva", path: "M5,40 Q50,10 100,12 T200,35 T300,55 T400,60", cor: "#ef4444", label: "FALSO ROMPIMENTO INSTITUCIONAL" },
    { id: 4, titulo: "TRADE 4: A Paralisia Diante da Oportunidade", msg: "O setup perfeito de Alta Frequência acendeu na tela. O preço está a caminhar barra a barra. Vai hesitar de novo?", btn1: "EXECUTAR ORDEM A MERCADO", btn2: "Ficar a ver navios por medo", path: "M5,60 Q50,50 100,45 T200,30 T300,20 T400,10", cor: "#10b981", label: "TENDÊNCIA CLARA • HFT ATIVO" },
    { id: 5, titulo: "TRADE 5: O Dia de Fúria Definitivo", msg: "Tomou 2 stops seguidos e a sua conta está a -R$ 300. O dedo está a tremer em cima do botão de compra impulsiva. O que faz?", btn1: "Clicar furioso para recuperar tudo", btn2: "Bloquear plataforma e ativar Modo Reverso", path: "M5,30 Q50,60 100,20 T200,55 T300,15 T400,50", cor: "#f59e0b", label: "ZONA DE PERIGO • FÚRIA CEGA" }
  ];

  const processarResposta = (idx) => {
    setScores(prev => {
      const p = perguntas[etapaAtual].a[idx].p;
      const v = perguntas[etapaAtual].a[idx].v;
      return { ...prev, [p]: prev[p] + v };
    });
    setEtapaAtual(prev => prev + 1);
  };

  const processarTrade = (id, opcao) => {
    setScores(prev => {
      let s = { ...prev };
      if (id === 1) { if(opcao===1) s.tecnico_positivo += 3; else s.teimoso += 5; }
      if (id === 2) { if(opcao===1) s.ansioso += 5; else s.tecnico_positivo += 4; }
      if (id === 3) { if(opcao===1) s.tecnico_positivo += 2; else s.impulsivo += 5; }
      if (id === 4) { if(opcao===1) s.tecnico_positivo += 3; else s.hesitante += 4; }
      if (id === 5) { if(opcao===1) s.impulsivo += 6; else s.tecnico_positivo += 5; }
      return s;
    });
    setTradeAtual(prev => prev + 1);
  };

  let maiorVicio = "impulsivo", maiorScore = scores.impulsivo;
  if (scores.ansioso > maiorScore) { maiorVicio = "ansioso"; maiorScore = scores.ansioso; }
  if (scores.teimoso > maiorScore) { maiorVicio = "teimoso"; maiorScore = scores.teimoso; }
  if (scores.hesitante > maiorScore) { maiorVicio = "hesitante"; maiorScore = scores.hesitante; }
  let percentual = Math.min(100, (scores.tecnico_positivo / 17) * 100);return (
    <main style={{ backgroundColor: '#0f172a', color: '#f8fafc', minHeight: '100vh', padding: '40px 20px', fontFamily: 'Arial, sans-serif', boxSizing: 'border-box', width: '100%' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>
        
        {/* CABEÇALHO */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', color: '#0f172a', padding: '16px 24px', borderRadius: '16px', border: '1px solid #cbd5e1', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '34px', height: '34px', borderRadius: '10px', backgroundColor: '#7c3aed', color: '#fff', fontWeight: '900', fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(124, 58, 237, 0.4)' }}>
              J
            </div>
            <div>
              <span style={{ fontSize: '12px', fontWeight: '900', letterSpacing: '1px', textTransform: 'uppercase', display: 'block' }}>JENIOS</span>
              <span style={{ fontSize: '9px', color: '#7c3aed', fontWeight: 'bold', fontFamily: 'monospace' }}>INVERTENDO A LÓGICA DO MERCADO</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <a href="/" style={{ backgroundColor: '#f1f5f9', color: '#334155', textDecoration: 'none', fontSize: '11px', fontWeight: 'bold', padding: '10px 18px', borderRadius: '10px', border: '1px solid #cbd5e1' }}>← Voltar ao Portal</a>
            <a href="/login" style={{ backgroundColor: '#7c3aed', color: '#fff', textDecoration: 'none', fontSize: '11px', fontWeight: 'bold', padding: '10px 18px', borderRadius: '10px', boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)' }}>Aceder à Plataforma</a>
          </div>
        </div>

        {/* HERO SECTION */}
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '16px', padding: '10px 0' }}>
          <h1 style={{ fontSize: '32px', fontWeight: '900', color: '#ffffff', margin: 0, lineHeight: '1.2' }}>
            O Mercado Foi Desenhado para Destruir o Seu Emocional. <span style={{ color: '#a78bfa' }}>A JENIOS Veio Para Inverter o Jogo.</span>
          </h1>
          <p style={{ fontSize: '14px', color: '#94a3b8', maxWidth: '780px', margin: '0 auto', lineHeight: '1.6' }}>
            Mais de 95% dos operadores perdem todo o patrimônio porque operam na base da impulsividade e da vingança. As baleias monitoram o varejo e caçam os stops. Descubra agora o seu perfil comportamental.
          </p>
        </div>

        {/* BANNER DE DESTAQUE: CHOQUE DE REALIDADE */}
        <div style={{ backgroundColor: '#1e1b4b', border: '3px solid #7c3aed', borderRadius: '24px', padding: '32px', boxShadow: '0 25px 50px -12px rgba(124, 58, 237, 0.4)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ backgroundColor: '#dc2626', color: '#fff', fontSize: '11px', fontWeight: '900', padding: '6px 12px', borderRadius: '6px', fontFamily: 'monospace', letterSpacing: '1px', textTransform: 'uppercase' }}>
              🚨 ALERTA VERMELHO
            </span>
            <span style={{ fontSize: '13px', color: '#c084fc', fontWeight: 'bold', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '2px' }}>
              CHOQUE DE REALIDADE
            </span>
          </div>
          <h2 style={{ fontSize: '22px', fontWeight: '900', color: '#ffffff', margin: 0, lineHeight: '1.4' }}>
            Se continuar a operar na força de vontade e sem automação, a falência da sua conta ocorrerá em menos de 90 dias.
          </h2>
          <p style={{ fontSize: '13px', color: '#cbd5e1', margin: 0, lineHeight: '1.6' }}>
            O seu maior inimigo não está no gráfico: está no espelho. Quando o Loss bate, o cérebro ativa o modo fúria, e os grandes bancos lucram exatamente com o seu desespero.
          </p>
        </div>

        {/* CAIXAS SEPARADAS (TAKES DE CONVENCIMENTO) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px', alignItems: 'stretch' }}>
          <div style={{ backgroundColor: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: '20px', padding: '24px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <span style={{ fontSize: '10px', backgroundColor: '#f3e8ff', color: '#7c3aed', padding: '4px 8px', borderRadius: '6px', fontWeight: 'bold', width: 'fit-content', fontFamily: 'monospace' }}>O VERDADEIRO INIMIGO</span>
              <h3 style={{ fontSize: '15px', fontWeight: '900', margin: 0 }}>O Problema não é o Gráfico, é o Cérebro</h3>
              <p style={{ fontSize: '12px', color: '#64748b', lineHeight: '1.5', margin: 0 }}>
                Sob estresse, o trader ativa o modo fúria, aumenta lotes indevidamente e devolve semanas de lucro em 10 minutos.
              </p>
            </div>
          </div>

          <div style={{ backgroundColor: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: '20px', padding: '24px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <span style={{ fontSize: '10px', backgroundColor: '#fee2e2', color: '#991b1b', padding: '4px 8px', borderRadius: '6px', fontWeight: 'bold', width: 'fit-content', fontFamily: 'monospace' }}>AS CONSEQUÊNCIAS</span>
              <h3 style={{ fontSize: '15px', fontWeight: '900', margin: 0 }}>A Falência em 90 Dias</h3>
              <p style={{ fontSize: '12px', color: '#64748b', lineHeight: '1.5', margin: 0 }}>
                Operar sem blindagem algorítmica significa servir de liquidez para as instituições. O seu capital evapora silenciosamente.
              </p>
            </div>
          </div>

          <div style={{ backgroundColor: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: '20px', padding: '24px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <span style={{ fontSize: '10px', backgroundColor: '#d1fae5', color: '#065f46', padding: '4px 8px', borderRadius: '6px', fontWeight: 'bold', width: 'fit-content', fontFamily: 'monospace' }}>A SOLUÇÃO JENIOS</span>
              <h3 style={{ fontSize: '15px', fontWeight: '900', margin: 0 }}>Engenharia Reversa HFT</h3>
              <p style={{ fontSize: '12px', color: '#64748b', lineHeight: '1.5', margin: 0 }}>
                O nosso motor intercepta o clique emocional e inverte a ordem na corretora: transformamos o seu erro em lucro automatizado.
              </p>
            </div>
          </div>
        </div>

        {/* SIMULADOR DE ESTRESSE & AUDITORIA DE VIÉS */}
        <div style={{ backgroundColor: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: '24px', padding: '32px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', display: 'flex', flexDirection: 'column', gap: '20px', boxSizing: 'border-box' }}>
          
          {etapaAtual < perguntas.length && (
            <div>
              <span style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 'bold', fontFamily: 'monospace', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>DIAGNÓSTICO PSICOLÓGICO DE RISCO: {etapaAtual + 1}/5</span>
              <h2 style={{ fontSize: '18px', fontWeight: '900', color: '#0f172a', marginBottom: '20px', lineHeight: '1.4' }}>{perguntas[etapaAtual].q}</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {perguntas[etapaAtual].a.map((alt, idx) => (
                  <button key={idx} onClick={() => processarResposta(idx)} style={{ width: '100%', textAlign: 'left', backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', color: '#334155', padding: '14px', borderRadius: '10px', fontSize: '12px', cursor: 'pointer', fontWeight: '500' }}>{alt.t}</button>
                ))}
              </div>
              {etapaAtual > 0 && (
                <button onClick={() => setEtapaAtual(etapaAtual - 1)} style={{ width: '100%', backgroundColor: '#e2e8f0', color: '#475569', fontWeight: 'bold', fontSize: '11px', padding: '10px', borderRadius: '10px', border: 'none', cursor: 'pointer', marginTop: '14px' }}>← Voltar à questão anterior</button>
              )}
            </div>
          )}

          {etapaAtual >= perguntas.length && tradeAtual < cenariosTrades.length && (
            <div>
              {(() => {
                const c = cenariosTrades[tradeAtual];
                return (
                  <div>
                    <span style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 'bold', fontFamily: 'monospace', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>TESTE DE ESTRESSE EM TEMPO REAL: TRADE ({c.id}/5)</span>
                    <p style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '10px' }}>{c.titulo}</p>
                    <div style={{ backgroundColor: '#060814', border: '1px solid #334155', borderRadius: '12px', height: '110px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', marginBottom: '15px', padding: '12px' }}>
                      <svg viewBox="0 0 400 70" preserveAspectRatio="none" style={{ width: '100%', height: '65px' }}>
                        <path d={c.path} fill="none" stroke={c.cor} strokeWidth="3" strokeLinecap="round" />
                      </svg>
                      <span style={{ color: '#94a3b8', fontSize: '10px', fontFamily: 'monospace', textTransform: 'uppercase' }}>● {c.label}</span>
                    </div>
                    <p style={{ fontSize: '13px', color: '#334155', lineHeight: '1.5', marginBottom: '16px' }}>{c.msg}</p>
                    <button onClick={() => processarTrade(c.id, 1)} style={{ width: '100%', backgroundColor: '#7c3aed', color: 'white', fontWeight: 'bold', fontSize: '12px', padding: '14px', borderRadius: '10px', border: 'none', cursor: 'pointer', marginBottom: '8px', textTransform: 'uppercase' }}>{c.btn1}</button>
                    <button onClick={() => processarTrade(c.id, 2)} style={{ width: '100%', backgroundColor: '#1e293b', color: 'white', fontWeight: 'bold', fontSize: '12px', padding: '14px', borderRadius: '10px', border: '1px solid #475569', cursor: 'pointer', marginBottom: '8px', textTransform: 'uppercase' }}>{c.btn2}</button>
                    <button onClick={() => setTradeAtual(tradeAtual > 0 ? tradeAtual - 1 : 0)} style={{ width: '100%', backgroundColor: '#e2e8f0', color: '#475569', fontWeight: 'bold', fontSize: '11px', padding: '10px', borderRadius: '10px', border: 'none', cursor: 'pointer' }}>← Voltar à etapa anterior</button>
                  </div>
                );
              })()}
            </div>
          )}

          {etapaAtual >= perguntas.length && tradeAtual >= cenariosTrades.length && !leadFeito && (
            <div>
              <span style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 'bold', fontFamily: 'monospace', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>🔒 ÚLTIMA ETAPA • GERAR LAUDO COMPORTAMENTAL</span>
              <h2 style={{ fontSize: '18px', fontWeight: '900', color: '#0f172a', marginBottom: '10px' }}>Onde devemos enviar o seu Diagnóstico Completo de Viés Operacional?</h2>
              <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>Insira os seus dados abaixo para visualizar o laudo e ativar o seu teste gratuito de 7 dias.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <input type="text" id="nomeLead" placeholder="Seu Nome Completo" style={{ padding: '12px', border: '1px solid #cbd5e1', borderRadius: '10px', fontSize: '12px', backgroundColor: '#f8fafc', outline: 'none' }} />
                <input type="email" id="emailLead" placeholder="Seu melhor E-mail" style={{ padding: '12px', border: '1px solid #cbd5e1', borderRadius: '10px', fontSize: '12px', backgroundColor: '#f8fafc', outline: 'none' }} />
                <input type="text" id="wppLead" placeholder="Seu WhatsApp (com DDD)" style={{ padding: '12px', border: '1px solid #cbd5e1', borderRadius: '10px', fontSize: '12px', backgroundColor: '#f8fafc', outline: 'none' }} />
                <button onClick={() => {
                  const nome = document.getElementById("nomeLead").value;
                  const email = document.getElementById("emailLead").value;
                  const whatsapp = document.getElementById("wppLead").value;
                  if (!nome || !email || !whatsapp) { alert("Por favor, preencha todos os campos."); return; }
                  setDadosLead({ nome, email, whatsapp });
                  setLeadFeito(true);
                }} style={{ width: '100%', background: '#7c3aed', color: 'white', fontWeight: 'bold', fontSize: '12px', padding: '14px', borderRadius: '10px', border: 'none', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '1px', boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)' }}>🔓 Revelar Meu Laudo & Testar Grátis</button>
              </div>
            </div>
          )}

          {leadFeito && (
            <div>
              <span style={{ fontSize: '11px', color: '#059669', fontWeight: 'bold', fontFamily: 'monospace', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>✅ AUDITORIA CONCLUÍDA • {dadosLead.nome.toUpperCase()}</span>
              <h2 style={{ fontSize: '18px', fontWeight: '900', color: '#0f172a', marginBottom: '10px' }}>O Veredito do Seu Comportamento no Mercado</h2>
              <p style={{ fontSize: '13px', fontWeight: 'bold', color: '#334155', marginBottom: '10px' }}>Score de Disciplina Técnica: {percentual.toFixed(0)}%</p>

              <p style={{ fontSize: '12px', color: '#dc2626', fontWeight: 'bold', marginBottom: '15px' }}>
                {percentual >= 65 ? "Perfil Moderado / Disciplinado. O robô atuará no Modo Espelho Direto para acelerar a sua escala profissional." : "⚠️ ALERTA VERMELHO: O seu perfil apresenta forte vulnerabilidade a rage trading e cliques emocionais. Sem blindagem HFT, o risco de zerar a sua conta é iminente."}
              </p>

              <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', padding: '16px', borderRadius: '12px', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: '900', color: '#166534', textTransform: 'uppercase' }}>O seu diagnóstico comportamental está pronto!</span>
                <p style={{ fontSize: '12px', color: '#15803d', margin: 0, lineHeight: '1.5' }}>
                  Cadastre-se agora e ganhe acesso imediato a <b>7 Dias Grátis</b> na plataforma para testar o nosso motor HFT e a engenharia reversa adaptativa sem compromisso.
                </p>
                <a 
                  href="/login" 
                  style={{ backgroundColor: '#7c3aed', color: '#fff', textDecoration: 'none', fontWeight: 'bold', fontSize: '12px', padding: '14px 20px', borderRadius: '12px', display: 'inline-block', textTransform: 'uppercase', letterSpacing: '1px', boxShadow: '0 4px 12px rgba(124, 58, 237, 0.4)' }}
                >
                  🚀 Cadastre-se e Faça um Teste Grátis por 7 Dias
                </a>
              </div>
            </div>
          )}

        </div>

        {/* SEÇÃO DOS PLANOS OFICIAIS NO FINAL DA PÁGINA (TECNOLOGIA EMBARCADA & ATIVOS DIFERENCIADOS) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 'bold', fontFamily: 'monospace', letterSpacing: '2px', textTransform: 'uppercase' }}>O SEU ARSENAL VENCEDOR</span>
            <h2 style={{ fontSize: '20px', fontWeight: '900', color: '#ffffff', margin: '4px 0 0 0' }}>Escolha o Nível de Blindagem Adequado ao Seu Perfil</h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px', alignItems: 'stretch' }}>
            
            {/* Starter - R$ 99,90 */}
            <div style={{ backgroundColor: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: '20px', padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%', boxSizing: 'border-box', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.2)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: '1' }}>
                <span style={{ fontSize: '10px', backgroundColor: '#e2e8f0', color: '#334155', padding: '2px 8px', borderRadius: '6px', fontWeight: 'bold', width: 'fit-content' }}>STARTER</span>
                <h3 style={{ fontSize: '18px', fontWeight: '900', color: '#0f172a', margin: 0 }}>R$ 99,90 <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 'normal' }}>/mês</span></h3>
                <p style={{ fontSize: '12px', color: '#64748b', lineHeight: '1.5', margin: 0 }}>Tecnologia JENIOS embarcada. Ativos: Mercado Nacional B3 (Mini-Índice & Mini-Dólar).</p>
              </div>
              <a href="/login" style={{ marginTop: '20px', width: '100%', boxSizing: 'border-box', background: '#7c3aed', color: '#fff', textDecoration: 'none', textAlign: 'center', padding: '12px', borderRadius: '10px', fontWeight: 'bold', fontSize: '11px', textTransform: 'uppercase', display: 'block' }}>Assinar Starter</a>
            </div>

            {/* Trader Pro - R$ 149,90 (Cripto) */}
            <div style={{ backgroundColor: '#ffffff', color: '#0f172a', border: '2px solid #7c3aed', borderRadius: '20px', padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%', boxSizing: 'border-box', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.2)', position: 'relative' }}>
              <span style={{ position: 'absolute', top: '-10px', right: '16px', backgroundColor: '#7c3aed', color: '#fff', fontSize: '9px', fontWeight: 'bold', padding: '2px 8px', borderRadius: '9999px', textTransform: 'uppercase' }}>Mais Popular</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: '1' }}>
                <span style={{ fontSize: '10px', backgroundColor: '#f3e8ff', color: '#7c3aed', padding: '2px 8px', borderRadius: '6px', fontWeight: 'bold', width: 'fit-content' }}>TRADER PRO (CRIPTO)</span>
                <h3 style={{ fontSize: '18px', fontWeight: '900', color: '#0f172a', margin: 0 }}>R$ 149,90 <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 'normal' }}>/mês</span></h3>
                <p style={{ fontSize: '12px', color: '#64748b', lineHeight: '1.5', margin: 0 }}>Tecnologia JENIOS embarcada. Ativos: Mercado de Criptoativos (Ativos Digitais).</p>
              </div>
              <a href="/login" style={{ marginTop: '20px', width: '100%', boxSizing: 'border-box', background: '#7c3aed', color: '#fff', textDecoration: 'none', textAlign: 'center', padding: '12px', borderRadius: '10px', fontWeight: 'bold', fontSize: '11px', textTransform: 'uppercase', display: 'block' }}>Assinar Trader Pro</a>
            </div>

            {/* Institucional HFT - R$ 199,90 (Global) */}
            <div style={{ backgroundColor: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: '20px', padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%', boxSizing: 'border-box', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.2)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: '1' }}>
                <span style={{ fontSize: '10px', backgroundColor: '#e2e8f0', color: '#334155', padding: '2px 8px', borderRadius: '6px', fontWeight: 'bold', width: 'fit-content' }}>INSTITUCIONAL (GLOBAL)</span>
                <h3 style={{ fontSize: '18px', fontWeight: '900', color: '#0f172a', margin: 0 }}>R$ 199,90 <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 'normal' }}>/mês</span></h3>
                <p style={{ fontSize: '12px', color: '#64748b', lineHeight: '1.5', margin: 0 }}>Tecnologia JENIOS embarcada. Ativos: Mercado Global Completo e Roteamento Avançado.</p>
              </div>
              <a href="/login" style={{ marginTop: '20px', width: '100%', boxSizing: 'border-box', background: '#334155', color: '#fff', textDecoration: 'none', textAlign: 'center', padding: '12px', borderRadius: '10px', fontWeight: 'bold', fontSize: '11px', textTransform: 'uppercase', display: 'block' }}>Assinar Institucional</a>
            </div>

          </div>
        </div>

        {/* RODAPÉ */}
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '6px', paddingBottom: '30px' }}>
          <div style={{ fontSize: '12px', fontWeight: '900', color: '#a78bfa', letterSpacing: '2px', textTransform: 'uppercase' }}>A PLATAFORMA QUE TRANSFORMA O SEU ERRO EM LUCRO</div>
          <div style={{ fontSize: '11px', color: '#64748b' }}>JENIOS • Todos os direitos reservados.</div>
        </div>

      </div>
    </main>
  );
}