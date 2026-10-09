'use client';
import { useState } from 'react';
import Link from 'next/link';

export default function SocialPage() {
  const [abaAtiva, setAbaAtiva] = useState('feed');
  const [novoTexto, setNovoTexto] = useState('');
  const [imagemInput, setImagemInput] = useState('');
  const [perfilAtivo, setPerfilAtivo] = useState(null);
  const [seguindoPerfis, setSeguindoPerfis] = useState({});
  const [storyAtivo, setStoryAtivo] = useState(null);

  // Estados do Simulador / Diagnóstico Psicológico da LP
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
    { id: 1, titulo: "TRADE 1: O Teste do Pânico", msg: "O mercado virou contra si. O stop técnico era -R$ 100, mas já vai em -R$ 180. O que faz?", btn1: "Estopar curto", btn2: "Arrastar o Stop", path: "M5,10 Q50,15 100,25 T200,45 T300,55 T400,65", cor: "#ef4444", label: "QUEDA VERTICAL" },
    { id: 2, titulo: "TRADE 2: Mão de Alface", msg: "Alvo era R$ 400, mas está a ganhar R$ 100 com oscilação contrária. Vai arregar?", btn1: "Garantir trocados", btn2: "Manter até o Alvo", path: "M5,55 Q50,45 100,50 T200,30 T300,25 T400,15", cor: "#10b981", label: "OSCILAÇÃO TÁTICA" },
    { id: 3, titulo: "TRADE 3: Falso Rompimento", msg: "As instituições romperam o topo e despencaram o preço. Ação:", btn1: "Estopar imediato", btn2: "Vender o triplo na raiva", path: "M5,40 Q50,10 100,12 T200,35 T300,55 T400,60", cor: "#ef4444", label: "FALSO ROMPIMENTO" },
    { id: 4, titulo: "TRADE 4: Paralisia na Oportunidade", msg: "Setup perfeito HFT acendeu. Vai hesitar de novo?", btn1: "EXECUTAR ORDEM", btn2: "Ficar a ver navios", path: "M5,60 Q50,50 100,45 T200,30 T300,20 T400,10", cor: "#10b981", label: "TENDÊNCIA CLARA" },
    { id: 5, titulo: "TRADE 5: Dia de Fúria Definitivo", msg: "Conta a -R$ 300 após stops. O dedo treme no botão de compra. O que faz?", btn1: "Clicar furioso", btn2: "Ativar Modo Reverso", path: "M5,30 Q50,60 100,20 T200,55 T300,15 T400,50", cor: "#f59e0b", label: "ZONA DE PERIGO" }
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

  let percentual = Math.min(100, (scores.tecnico_positivo / 17) * 100);

  const [usuarioLogado, setUsuarioLogado] = useState(true);
  const [nomeUsuario] = useState('Paulo Stutz Netto');
  
  const meuPerfil = {
    nome: 'Paulo Stutz Netto',
    cargo: 'CEO & Fundador • Letter Franqueadora',
    rentabilidade: '+ R$ 18.400',
    assertividade: '95%',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
    bio: 'Desenvolvedor da infraestrutura de pagamentos AsaaS e operador de alta frequência com protocolos de engenharia reversa.',
    seguidores: '2.1k',
    postsCount: '48',
    visualizacoes30Dias: '45.2k',
    status: '🏆 Conta Master Verificada'
  };

  const irParaTendencias = () => {
    window.location.href = '/tendencias';
  };

  const tickerMacro = [
    { id: 1, rede: 'B3', tipo: '📊 MEGAPULSE', titulo: 'Ibovespa (IBOV): ▲ Alta Institucional (+1.2%)', detalhes: 'Fluxo de ordens institucionais.' },
    { id: 2, rede: 'SOLANA', tipo: '🚀 TOKEN HFT', titulo: '$LTR-Prop: Volume +450% | Influxo Institucional', detalhes: 'Pools de liquidez na Solana.' },
    { id: 3, rede: 'ETHEREUM', tipo: '🐋 BALEIA ETH', titulo: 'Acumulação de 15,000 ETH em carteira institucional', detalhes: 'Alocação de longo prazo.' },
    { id: 4, rede: 'TRON', tipo: '⚡ USDT FLOW', titulo: 'Transferência maciça de US$ 85M para DEX', detalhes: 'Liquidez cruzando redes.' }
  ];

  const tickerDuplicado = [...tickerMacro, ...tickerMacro];

  const [stories] = useState([
    { id: 1, autor: 'Paulo (CEO)', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150', midia: 'https://images.unsplash.com/photo-1642543492481-44e81e3914a7?w=800', texto: 'Transmissão ao vivo do Robô HFT na B3!' },
    { id: 2, autor: 'Carlos M.', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', midia: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800', texto: 'Análise de rompimento bem-sucedida.' },
    { id: 3, autor: 'Ana Paula S.', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150', midia: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=800', texto: 'Monitoramento de baleias na Solana.' }
  ]);

  const [noticiasMacro] = useState([
    { id: 1, hora: 'Há 5 mins', cat: 'GEOPOLÍTICA', titulo: 'Estreito de Ormuz: Ajuste no tráfego gera volatilidade', impacto: 'Alto Impacto', url: 'https://www.reuters.com' },
    { id: 2, hora: 'Há 25 mins', cat: 'COMMODITIES', titulo: 'Petróleo Brent registra alta com relatórios de oferta', impacto: 'Positivo', url: 'https://www.infomoney.com.br' },
    { id: 3, hora: 'Há 50 mins', cat: 'POLÍTICA', titulo: 'Novas diretrizes fiscais do Banco Central impactam juros', impacto: 'Ajuste', url: 'https://valor.globo.com' }
  ]);

  // LISTA COMPLETA DOS 10 OPERADORES COM ASSERTIVIDADE E RENTABILIDADE DETALHADAS
  const [rankingOperadores] = useState([
    { pos: 1, nome: 'Carlos M.', cargo: 'Trader Pro', rentabilidade: '+ R$ 14.850', assertividade: '94%', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', status: '🏆 1º Lugar', bio: 'Especialista em robôs HFT para Mini-Índice e Mini-Dólar com foco em proteção de drawdown.', seguidores: '1.4k', postsCount: '32', visualizacoes30Dias: '28.4k' },
    { pos: 2, nome: 'Ana Paula S.', cargo: 'Institucional', rentabilidade: '+ R$ 11.200', assertividade: '91%', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150', status: '🥈 2º Lugar', bio: 'Gestora de capital e arbitragem algorítmica em ativos multi-rede na Solana e B3.', seguidores: '1.2k', postsCount: '25', visualizacoes30Dias: '21.0k' },
    { pos: 3, nome: 'Roberto Dias', cargo: 'Swing Trader', rentabilidade: '+ R$ 9.400', assertividade: '88%', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150', status: '🥉 3º Lugar', bio: 'Focado em tendências de médio prazo e ações.', seguidores: '950', postsCount: '19', visualizacoes30Dias: '15.8k' },
    { pos: 4, nome: 'Beatriz Lima', cargo: 'Day Trader', rentabilidade: '+ R$ 8.100', assertividade: '90%', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150', status: 'Top 4', bio: 'Especialista em controle emocional e robôs de proteção.', seguidores: '820', postsCount: '14', visualizacoes30Dias: '12.1k' },
    { pos: 5, nome: 'Marcos Vinicius', cargo: 'Quant Analyst', rentabilidade: '+ R$ 7.600', assertividade: '87%', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150', status: 'Top 5', bio: 'Modelagem matemática para mercados futuros.', seguidores: '740', postsCount: '12', visualizacoes30Dias: '10.5k' },
    { pos: 6, nome: 'Juliana Mendes', cargo: 'Scalper', rentabilidade: '+ R$ 6.900', assertividade: '89%', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150', status: 'Top 6', bio: 'Operações de alta frequência no Dólar futuro.', seguidores: '680', postsCount: '18', visualizacoes30Dias: '9.8k' },
    { pos: 7, nome: 'Lucas Silveira', cargo: 'Arbitrageur', rentabilidade: '+ R$ 5.800', assertividade: '86%', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', status: 'Top 7', bio: 'Explorando distorções de preço entre exchanges.', seguidores: '590', postsCount: '10', visualizacoes30Dias: '8.2k' },
    { pos: 8, nome: 'Fernanda Costa', cargo: 'Position Trader', rentabilidade: '+ R$ 5.200', assertividade: '85%', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150', status: 'Top 8', bio: 'Alocação em ativos globais e commodities.', seguidores: '510', postsCount: '8', visualizacoes30Dias: '7.4k' },
    { pos: 9, nome: 'Gabriel Souza', cargo: 'Crypto Specialist', rentabilidade: '+ R$ 4.700', assertividade: '84%', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150', status: 'Top 9', bio: 'Foco em DeFi e ecossistema Solana.', seguidores: '460', postsCount: '9', visualizacoes30Dias: '6.9k' },
    { pos: 10, nome: 'Camila Rocha', cargo: 'Risk Manager', rentabilidade: '+ R$ 4.100', assertividade: '92%', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150', status: 'Top 10', bio: 'Gestão de drawdown e mitigação de risco.', seguidores: '420', postsCount: '7', visualizacoes30Dias: '6.1k' }
  ]);

  const [posts, setPosts] = useState([
    { id: 1, autor: 'Carlos M.', cargo: 'ESTRATEGISTA HFT', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', texto: 'O Modo Reverso salvou-me hoje no Mini-Índice! Falso rompimento detectado em 128.500.', imagem: 'https://images.unsplash.com/photo-1642543492481-44e81e3914a7?w=800', tempo: 'Há 15 mins', likes: 34, curtido: false, estrategiaCopiada: false, perfilAssociado: rankingOperadores[0] },
    { id: 2, autor: 'Ana Paula S.', cargo: 'INSTITUCIONAL', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150', texto: 'Arbitragem cruzada entre Solana e B3 operando com alta assertividade.', imagem: '', tempo: 'Há 1 hora', likes: 22, curtido: false, estrategiaCopiada: false, perfilAssociado: rankingOperadores[1] }
  ]);const publicarPost = (e) => {
    e.preventDefault();
    if (!novoTexto.trim() && !imagemInput.trim()) return;
    setPosts([{ 
      id: Date.now(), 
      autor: usuarioLogado ? nomeUsuario : 'Visitante Anônimo', 
      cargo: 'MEMBRO', 
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
      texto: novoTexto, 
      imagem: imagemInput,
      tempo: 'Agora mesmo', 
      likes: 1, 
      curtido: false,
      estrategiaCopiada: false,
      perfilAssociado: meuPerfil
    }, ...posts]);
    setNovoTexto('');
    setImagemInput('');
  };

  const curtirPost = (id) => {
    setPosts(posts.map(p => p.id === id ? { ...p, likes: p.curtido ? p.likes - 1 : p.likes + 1, curtido: !p.curtido } : p));
  };

  const copiarEstrategia = (id) => {
    setPosts(posts.map(p => p.id === id ? { ...p, estrategiaCopiada: true } : p));
    alert('⚡ Estratégia copiada com sucesso para o seu Robô HFT!');
  };

  return (
    <main style={{ backgroundColor: '#f1f5f9', color: '#0f172a', minHeight: '100vh', paddingBottom: '60px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes marquee { 0% { transform: translateX(0%); } 100% { transform: translateX(-50%); } }
        .ticker-container { overflow: hidden; white-space: nowrap; width: 100%; }
        .ticker-track { display: inline-flex; animation: marquee 30s linear infinite; }
        .ticker-track:hover { animation-play-state: paused; }
      ` }} />

      {/* Ticker Superior Rotativo */}
      <div style={{ position: 'sticky', top: 0, zIndex: 9999, backgroundColor: '#0f172a', borderBottom: '1px solid #334155', padding: '10px 0', width: '100%', boxSizing: 'border-box' }} className="ticker-container">
        <div className="ticker-track">
          {tickerDuplicado.map((item, index) => (
            <div key={index} onClick={irParaTendencias} style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', fontSize: '12px', cursor: 'pointer', padding: '0 30px', whiteSpace: 'nowrap' }} title="Clique para abrir no Hub de Tendências">
              <span style={{ backgroundColor: '#334155', color: '#34d399', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>{item.rede}</span>
              <span style={{ color: '#34d399', fontWeight: 'bold', fontFamily: 'monospace' }}>{item.tipo}:</span>
              <span style={{ color: '#f8fafc', fontWeight: 'bold' }}>{item.titulo}</span>
              <span style={{ fontSize: '11px', color: '#c084fc', marginLeft: '6px', fontWeight: 'bold' }}>[Ver no Hub 🚀]</span>
            </div>
          ))}
        </div>
      </div>

      {/* Visualizador de Stories */}
      {storyAtivo && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 20000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
          <div style={{ maxWidth: '420px', width: '100%', height: '80vh', backgroundColor: '#111827', borderRadius: '20px', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', border: '1px solid #334155' }}>
            <div style={{ padding: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 2, background: 'linear-gradient(to bottom, rgba(0,0,0,0.8), transparent)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <img src={storyAtivo.avatar} alt="Avatar" style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #7c3aed' }} />
                <b style={{ color: '#fff', fontSize: '14px' }}>{storyAtivo.autor}</b>
              </div>
              <button onClick={() => setStoryAtivo(null)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '20px', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
            </div>
            <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' }}>
              <img src={storyAtivo.midia} alt="Story Media" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <div style={{ position: 'absolute', bottom: '20px', left: '20px', right: '20px', backgroundColor: 'rgba(0,0,0,0.6)', padding: '12px', borderRadius: '10px', backdropFilter: 'blur(5px)' }}>
                <p style={{ color: '#fff', fontSize: '13px', margin: 0, textAlign: 'center' }}>{storyAtivo.texto}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE PERFIL COM RENTABILIDADE, ASSERTIVIDADE E SEGUIDORES RESTAURADOS */}
      {perfilAtivo && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.85)', zIndex: 15000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '20px', maxWidth: '650px', width: '100%', padding: '35px', boxShadow: '0 25px 50px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', gap: '20px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 'bold', fontFamily: 'monospace' }}>PERFIL OFICIAL DO ESTRATEGISTA</span>
              <button onClick={() => setPerfilAtivo(null)} style={{ backgroundColor: '#f1f5f9', color: '#0f172a', border: 'none', width: '36px', height: '36px', borderRadius: '50%', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
              <img src={perfilAtivo.avatar} alt="Avatar" style={{ width: '85px', height: '85px', borderRadius: '50%', objectFit: 'cover', border: '3px solid #7c3aed' }} />
              <div>
                <h2 style={{ fontSize: '22px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>{perfilAtivo.nome}</h2>
                <span style={{ fontSize: '13px', color: '#7c3aed', fontWeight: 'bold' }}>{perfilAtivo.cargo || perfilAtivo.status}</span>
                <p style={{ fontSize: '12px', color: '#64748b', marginTop: '6px', margin: 0 }}>{perfilAtivo.bio || 'Operador de alta performance na plataforma Jenios.'}</p>
              </div>
            </div>

            {/* CAIXA COM AS MÉTRICAS (Rentabilidade, Assertividade e Seguidores) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', backgroundColor: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
              <div>
                <span style={{ fontSize: '10px', color: '#64748b', display: 'block', fontWeight: 'bold' }}>RENTABILIDADE</span>
                <b style={{ fontSize: '15px', color: '#059669' }}>{perfilAtivo.rentabilidade || '+ R$ 10.000'}</b>
              </div>
              <div>
                <span style={{ fontSize: '10px', color: '#64748b', display: 'block', fontWeight: 'bold' }}>ASSERTIVIDADE</span>
                <b style={{ fontSize: '15px', color: '#7c3aed' }}>{perfilAtivo.assertividade || '90%'}</b>
              </div>
              <div>
                <span style={{ fontSize: '10px', color: '#64748b', display: 'block', fontWeight: 'bold' }}>SEGUIDORES</span>
                <b style={{ fontSize: '15px', color: '#0f172a' }}>{perfilAtivo.seguidores || '1.2k'}</b>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                onClick={() => setSeguindoPerfis(prev => ({ ...prev, [perfilAtivo.nome]: !prev[perfilAtivo.nome] }))}
                style={{ flex: 1, backgroundColor: seguindoPerfis[perfilAtivo.nome] ? '#64748b' : '#7c3aed', color: '#fff', border: 'none', padding: '14px', borderRadius: '10px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}
              >
                {seguindoPerfis[perfilAtivo.nome] ? 'Seguindo Estrategista ✓' : 'Seguir Estrategista'}
              </button>
              <button 
                onClick={() => {
                  alert(`Estratégia de ${perfilAtivo.nome} copiada para o seu Copy Trading automático!`);
                  setPerfilAtivo(null);
                }}
                style={{ flex: 1, backgroundColor: '#059669', color: '#fff', border: 'none', padding: '14px', borderRadius: '10px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}
              >
                ⚡ Copiar Estratégia (Copy)
              </button>
            </div>

            {/* Publicações deste perfil */}
            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '15px', marginTop: '5px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#0f172a', marginBottom: '12px' }}>Publicações de {perfilAtivo.nome}</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '250px', overflowY: 'auto' }}>
                {posts.filter(p => p.autor.includes(perfilAtivo.nome.split(' ')[0])).length > 0 ? (
                  posts.filter(p => p.autor.includes(perfilAtivo.nome.split(' ')[0])).map(p => (
                    <div key={p.id} style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px' }}>
                      <p style={{ fontSize: '12px', color: '#334155', margin: '0 0 6px 0' }}>{p.texto}</p>
                      {p.imagem && <img src={p.imagem} alt="Post img" style={{ width: '100%', maxHeight: '150px', objectFit: 'cover', borderRadius: '6px', marginBottom: '6px' }} />}
                      <span style={{ fontSize: '10px', color: '#64748b' }}>{p.tempo} • ❤️ {p.likes} curtidas</span>
                    </div>
                  ))
                ) : (
                  <p style={{ fontSize: '12px', color: '#64748b', fontStyle: 'italic' }}>Este estrategista ainda não publicou nenhum post no feed.</p>
                )}
              </div>
            </div>
            
            <button onClick={() => setPerfilAtivo(null)} style={{ backgroundColor: '#f1f5f9', color: '#0f172a', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}>
              ← Fechar Perfil
            </button>
          </div>
        </div>
      )}<div style={{ maxWidth: '1050px', margin: '0 auto', padding: '30px 20px 0 20px' }}>
        
        {/* CABEÇALHO DO PRÓPRIO PERFIL */}
        <div style={{ backgroundColor: '#ffffff', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0', marginBottom: '25px', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
            
            {usuarioLogado ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flex: 1, minWidth: '280px' }}>
                <img src={meuPerfil.avatar} alt="Avatar" style={{ width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #7c3aed' }} />
                <div>
                  <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 2px 0' }}>{nomeUsuario}</h2>
                  <span style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 'bold', display: 'block' }}>{meuPerfil.cargo}</span>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>{meuPerfil.status}</span>
                </div>
              </div>
            ) : (
              <div>
                <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#0f172a' }}>JENIOS SOCIAL • Visitante</span>
              </div>
            )}

            <div style={{ display: 'flex', gap: '16px', backgroundColor: '#f8fafc', padding: '12px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', alignItems: 'center' }}>
              <div style={{ textAlign: 'center' }}>
                <span style={{ fontSize: '10px', color: '#64748b', display: 'block', fontWeight: 'bold' }}>POSTS</span>
                <b style={{ fontSize: '15px', color: '#0f172a' }}>{meuPerfil.postsCount}</b>
              </div>
              <div style={{ width: '1px', height: '24px', backgroundColor: '#cbd5e1' }}></div>
              <div style={{ textAlign: 'center' }}>
                <span style={{ fontSize: '10px', color: '#64748b', display: 'block', fontWeight: 'bold' }}>SEGUIDORES</span>
                <b style={{ fontSize: '15px', color: '#7c3aed' }}>{meuPerfil.seguidores}</b>
              </div>
              <div style={{ width: '1px', height: '24px', backgroundColor: '#cbd5e1' }}></div>
              <div style={{ textAlign: 'center' }}>
                <span style={{ fontSize: '10px', color: '#64748b', display: 'block', fontWeight: 'bold' }}>VIEWS (30D)</span>
                <b style={{ fontSize: '15px', color: '#059669' }}>{meuPerfil.visualizacoes30Dias}</b>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button onClick={() => setAbaAtiva('feed')} style={{ backgroundColor: '#f1f5f9', color: '#334155', fontSize: '11px', fontWeight: 'bold', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', cursor: 'pointer' }}>
                🏠 Início
              </button>
              {usuarioLogado ? (
                <>
                  <button onClick={() => window.location.href = '/dashboard-logado'} style={{ backgroundColor: '#f1f5f9', color: '#0f172a', border: '1px solid #cbd5e1', fontSize: '11px', fontWeight: 'bold', padding: '10px 14px', borderRadius: '8px', cursor: 'pointer' }}>
                    Sala de Controle
                  </button>
                  <button onClick={() => setUsuarioLogado(false)} style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', fontSize: '11px', fontWeight: 'bold', padding: '10px 12px', borderRadius: '8px', cursor: 'pointer' }}>
                    Sair
                  </button>
                </>
              ) : (
                <>
                  <a href="/login" style={{ backgroundColor: '#f1f5f9', color: '#0f172a', textDecoration: 'none', fontSize: '11px', fontWeight: 'bold', padding: '10px 16px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>Entrar</a>
                  <a href="/onboarding" style={{ backgroundColor: '#7c3aed', color: '#fff', textDecoration: 'none', fontSize: '11px', fontWeight: 'bold', padding: '10px 16px', borderRadius: '8px' }}>Criar Conta 🚀</a>
                </>
              )}
            </div>

          </div>
        </div>

        {/* Abas */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '25px', flexWrap: 'wrap' }}>
          <button onClick={() => setAbaAtiva('feed')} style={{ padding: '10px 20px', borderRadius: '8px', border: abaAtiva === 'feed' ? '2px solid #7c3aed' : '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#0f172a', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}>
            📱 Feed Contínuo
          </button>
          <button onClick={() => setAbaAtiva('ranking')} style={{ padding: '10px 20px', borderRadius: '8px', border: abaAtiva === 'ranking' ? '2px solid #f59e0b' : '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#0f172a', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}>
            🏆 Ranking Top 10
          </button>
        </div>

        {/* ABA FEED */}
        {abaAtiva === 'feed' && (
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '25px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Stories */}
              <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '16px 20px', display: 'flex', gap: '15px', overflowX: 'auto' }}>
                {stories.map((st) => (
                  <div key={st.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', minWidth: '64px' }} onClick={() => setStoryAtivo(st)}>
                    <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'linear-gradient(135deg, #7c3aed 0%, #ec4899 100%)', padding: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <img src={st.avatar} alt="Story" style={{ width: '52px', height: '52px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #fff' }} />
                    </div>
                    <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#0f172a', marginTop: '4px' }}>{st.autor.split(' ')[0]}</span>
                  </div>
                ))}
              </div>

              {/* Caixa Post */}
              <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '24px' }}>
                <form onSubmit={publicarPost}>
                  <textarea value={novoTexto} onChange={(e) => setNovoTexto(e.target.value)} placeholder="Compartilhe uma análise, setup HFT ou visão de mercado..." style={{ width: '100%', height: '80px', backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '14px', fontSize: '13px', outline: 'none', boxSizing: 'border-box', marginBottom: '12px' }} />
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button type="submit" style={{ backgroundColor: '#7c3aed', color: '#fff', border: 'none', padding: '12px 20px', borderRadius: '8px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}>Publicar Análise 🚀</button>
                  </div>
                </form>
              </div>

              {/* Posts */}
              {posts.map((p) => (
                <div key={p.id} style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', overflow: 'hidden' }}>
                  <div onClick={() => setPerfilAtivo(p.perfilAssociado || rankingOperadores[0])} style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid #e2e8f0', cursor: 'pointer' }}>
                    <img src={p.avatar} alt="Avatar" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} />
                    <div>
                      <b style={{ color: '#0f172a', fontSize: '14px' }}>{p.autor}</b>
                      <span style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 'bold', display: 'block' }}>{p.tempo} • Visitar Perfil 🔍</span>
                    </div>
                  </div>
                  <div style={{ padding: '20px' }}><p style={{ fontSize: '13px', color: '#334155', margin: 0 }}>{p.texto}</p></div>
                  {p.imagem && (
                    <div style={{ width: '100%', maxHeight: '400px', backgroundColor: '#000', overflow: 'hidden' }}>
                      <img src={p.imagem} alt="Mídia" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    </div>
                  )}
                  <div style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0', fontSize: '12px' }}>
                    <button onClick={() => curtirPost(p.id)} style={{ background: 'none', border: 'none', color: p.curtido ? '#dc2626' : '#64748b', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>
                      {p.curtido ? '❤️' : '🤍'} {p.likes} Curtidas
                    </button>
                    <button onClick={() => copiarEstrategia(p.id)} style={{ backgroundColor: p.estrategiaCopiada ? '#059669' : '#7c3aed', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>
                      {p.estrategiaCopiada ? '⚡ Estratégia Copiada ✓' : '⚡ Copiar Estratégia'}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Coluna Direita */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Notícias */}
              <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 6px 0' }}>🌐 Canal Oficial de Notícias Macro</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
                  {noticiasMacro.map((n) => (
                    <a key={n.id} href={n.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px', display: 'block' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#7c3aed', backgroundColor: '#f3e8ff', padding: '2px 6px', borderRadius: '4px' }}>{n.cat}</span>
                        <span style={{ fontSize: '10px', color: '#64748b' }}>{n.hora} ↗️</span>
                      </div>
                      <h4 style={{ fontSize: '12px', color: '#0f172a', margin: '0 0 6px 0', fontWeight: 'bold' }}>{n.titulo}</h4>
                      <span style={{ fontSize: '10px', color: '#059669', fontWeight: 'bold' }}>Impacto: {n.impacto}</span>
                    </a>
                  ))}
                </div>
              </div>

              {/* Top Traders (Lateral) */}
              <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 6px 0' }}>🏆 Top Traders da Semana</h3>
                <p style={{ fontSize: '11px', color: '#64748b', margin: '0 0 14px 0' }}>Clique num operador para visitar o perfil.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {rankingOperadores.slice(0, 3).map((op) => (
                    <div key={op.pos} onClick={() => setPerfilAtivo(op)} style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <img src={op.avatar} alt="Avatar" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
                        <div>
                          <b style={{ fontSize: '12px', color: '#0f172a', display: 'block' }}>{op.pos}º - {op.nome}</b>
                          <span style={{ fontSize: '10px', color: '#059669', fontWeight: 'bold' }}>{op.rentabilidade} • Assertividade: {op.assertividade}</span>
                        </div>
                      </div>
                      <span style={{ fontSize: '10px', color: '#7c3aed', backgroundColor: '#ede9fe', padding: '4px 8px', borderRadius: '6px', fontWeight: 'bold' }}>Visitar 🔍</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ABA RANKING COMPLETO (EXIBE OS 10 OPERADORES COM RENTABILIDADE E ASSERTIVIDADE) */}
        {abaAtiva === 'ranking' && (
          <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '30px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#0f172a', marginBottom: '6px' }}>Ranking Completo Top 10</h2>
            <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '20px' }}>Clique em qualquer operador para inspecionar métricas e perfil completo.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {rankingOperadores.map((op) => (
                <div key={op.pos} onClick={() => setPerfilAtivo(op)} style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <img src={op.avatar} alt="Avatar" style={{ width: '42px', height: '42px', borderRadius: '50%', objectFit: 'cover' }} />
                    <div>
                      <b style={{ fontSize: '14px', color: '#0f172a', display: 'block' }}>#{op.pos} - {op.nome} ({op.cargo})</b>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>{op.bio}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '15px', fontWeight: 'bold', color: '#059669', display: 'block' }}>{op.rentabilidade}</span>
                    <span style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 'bold' }}>Assertividade: {op.assertividade}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </main>
  );
}