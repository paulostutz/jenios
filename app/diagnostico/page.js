'use client';
import { useState } from 'react';
import Link from 'next/link';

export default function DiagnosticoPage() {
  const [etapa, setEtapa] = useState(0);
  const [respostas, setRespostas] = useState({});
  const [concluido, setConcluido] = useState(false);

  // As 6 Perguntas de Perfil Comportamental
  const perguntas = [
    {
      id: 1,
      titulo: "1. Como reage habitualmente perante uma perda consecutiva de 3 ordens no intraday?",
      opcoes: [
        "A. Mantenho a serenidade e confio estritamente na regra matemática.",
        "B. Sinto frustração mas evito operar por impulso.",
        "C. Tento recuperar imediatamente o valor perdido (risco de viés emocional)."
      ]
    },
    {
      id: 2,
      titulo: "2. Qual é a sua principal expectativa ao utilizar um robô de Alta Frequência (HFT)?",
      opcoes: [
        "A. Blindar o capital contra os meus próprios erros emocionais.",
        "B. Automatizar estratégias de arbitragem multi-rede.",
        "C. Obter ganhos rápidos sem análise de risco."
      ]
    },
    {
      id: 3,
      titulo: "3. Como avalia o seu nível de tolerância ao risco em ativos de alta volatilidade?",
      opcoes: [
        "A. Moderado/Baixo, priorizo a preservação de capital com drawdown máximo restrito.",
        "B. Equilibrado, aceito volatilidade se houver margem de lucro calculada.",
        "C. Agressivo, busco alavancagem máxima sem blindagem."
      ]
    },
    {
      id: 4,
      titulo: "4. Compreende a função do 'Modo Reverso' na proteção de drawdown?",
      opcoes: [
        "A. Sim, compreendo que ele inverte cliques emocionais para proteger o meu património.",
        "B. Tenho dúvidas parciais sobre a execução algorítmica.",
        "C. Não estou familiarizado com a inversão de sinal."
      ]
    },
    {
      id: 5,
      titulo: "5. Qual o seu grau de familiaridade com o monitoramento adaptativo de 15 operações?",
      opcoes: [
        "A. Sei que o robô monitora padrões para evitar perdas em sequências de alta assertividade correta.",
        "B. Compreendo vagamente.",
        "C. Desconheço."
      ]
    },
    {
      id: 6,
      titulo: "6. Está pronto para seguir rigorosamente os parâmetros definidos na Sala de Controlo?",
      opcoes: [
        "A. Sim, comprometo-me a seguir a disciplina operacional.",
        "B. Depende das condições de mercado.",
        "C. Prefiro operar totalmente à parte das regras."
      ]
    }
  ];

  const selecionarOpcao = (perguntaId, opcao) => {
    const novasRespostas = { ...respostas, [perguntaId]: opcao };
    setRespostas(novasRespostas);

    if (etapa < perguntas.length - 1) {
      setEtapa(etapa + 1);
    } else {
      setConcluido(true);
    }
  };

  const concluirEEntrarNaMesa = () => {
    alert('🧠 Diagnóstico Concluído com Sucesso! Perfil validado pelo algoritmo HFT. A redirecionar para a Mesa de Operações...');
    window.location.href = '/mesa-operacao';
  };

  return (
    <main style={{ backgroundColor: '#f1f5f9', color: '#0f172a', minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      
      <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '20px', maxWidth: '650px', width: '100%', padding: '40px', boxShadow: '0 25px 50px rgba(0,0,0,0.1)' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', borderBottom: '1px solid #e2e8f0', paddingBottom: '15px' }}>
          <div>
            <span style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>PROTOCOLO DE ENGENHARIA REVERSA</span>
            <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#0f172a', margin: '4px 0 0 0' }}>Diagnóstico Comportamental (15 Operações / 6 Perguntas)</h1>
          </div>
          <Link href="/dashboard-logado" style={{ backgroundColor: '#f1f5f9', color: '#334155', textDecoration: 'none', fontSize: '12px', fontWeight: 'bold', padding: '8px 14px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
            ← Voltar
          </Link>
        </div>

        {!concluido ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', fontSize: '12px', fontWeight: 'bold', color: '#64748b' }}>
              <span>Pergunta {etapa + 1} de {perguntas.length}</span>
              <span>{Math.round(((etapa + 1) / perguntas.length) * 100)}% concluído</span>
            </div>

            <h3 style={{ fontSize: '16px', color: '#0f172a', marginBottom: '20px', lineHeight: '1.5', fontWeight: 'bold' }}>
              {perguntas[etapa].titulo}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {perguntas[etapa].opcoes.map((opcao, idx) => (
                <button
                  key={idx}
                  onClick={() => selecionarOpcao(perguntas[etapa].id, opcao)}
                  style={{ textAlign: 'left', backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '16px 20px', fontSize: '13px', color: '#0f172a', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s' }}
                >
                  {opcao}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: '#dcfce7', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', margin: '0 auto 20px auto' }}>
              ✓
            </div>
            <h2 style={{ fontSize: '22px', fontWeight: 'bold', color: '#0f172a', marginBottom: '10px' }}>Perfil Comportamental Validado!</h2>
            <p style={{ fontSize: '13px', color: '#475569', lineHeight: '1.6', marginBottom: '25px' }}>
              O seu perfil foi registado com sucesso no sistema de monitoramento adaptativo. O robô irá gerir as 15 operações e o Modo Reverso, garantindo proteção contra falsos sinais e assegurando que, caso acerte 3 tendências consecutivas corretamente, o sistema ajusta-se para não inverter o seu lucro.
            </p>
            <button
              onClick={concluirEEntrarNaMesa}
              style={{ backgroundColor: '#7c3aed', color: '#fff', border: 'none', padding: '14px 28px', borderRadius: '12px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 15px rgba(124, 58, 237, 0.3)' }}
            >
              🚀 Entrar na Mesa de Operações
            </button>
          </div>
        )}

      </div>
    </main>
  );
}