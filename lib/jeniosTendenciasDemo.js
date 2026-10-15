// Fonte unica para dados DEMONSTRATIVOS; nao sao cotacoes, transacoes ou sinais reais.
export const DEMO_tokensTendencia = [
    { id: 1, nome: '$LTR-Prop', rede: 'Solana', volume: '+450%', preco: 'R$ 4,80', liquidez: 'R$ 14.2M', scoreWhale: '98/100', status: 'Alta Influxo Institucional', institucao: 'Solana Ventures & Private Pools' },
    { id: 2, nome: '$SOL-HFT', rede: 'Solana', volume: '+180%', preco: 'R$ 12,50', liquidez: 'R$ 8.9M', scoreWhale: '92/100', status: 'Acumulação de Smart Money', institucao: 'Jump Crypto Desk' },
    { id: 3, nome: '$USDT-Pool', rede: 'Multi-rede', volume: '+290%', preco: 'R$ 5,02', liquidez: 'R$ 45.0M', scoreWhale: '95/100', status: 'Arbitragem Cruzada Ativa', institucao: 'Wintermute Trading' }
  ];
export const DEMO_baleias = [
    { id: 1, ativo: 'Ethereum (ETH)', instituicao: 'BlackRock Crypto Trust', volumeMovimentado: '15.000 ETH (≈ US$ 38M)', rede: 'Ethereum', fluxo: 'Inflow Institucional Longo Prazo', hash: '0x8f9c...3b12' },
    { id: 2, ativo: 'USDT', instituicao: 'JP Morgan Digital Assets Desk', volumeMovimentado: 'US$ 85.000.000', rede: 'TRON / Solana', fluxo: 'Liquidez para DEX de Alta Frequência', hash: '0x4a11...9e88' },
    { id: 3, ativo: 'Bitcoin (BTC)', instituicao: 'Fidelity Wise Custody', volumeMovimentado: '1.250 BTC (≈ US$ 78M)', rede: 'Lightning / Mainnet', fluxo: 'Acumulação em Carteira Fria', hash: '0x1c2d...5f6a' },
    { id: 4, ativo: 'SOL', instituicao: 'Citadel Securities Alpha', volumeMovimentado: '320.000 SOL (≈ US$ 48M)', rede: 'Solana', fluxo: 'Posicionamento em Derivativos', hash: 'SolanaTx998...abc' }
  ];
export const DEMO_megapulse = [
    { id: 1, ativo: 'Ibovespa Futuro (WIN)', instituicao: 'B3 Market Maker Desk', direcao: '▲ Alta Institucional (+1.25%)', spread: '0.5 pontos', imbalance: '+78% Compras', detalhe: 'Forte absorção de venda no suporte de 128.200 pts.' },
    { id: 2, ativo: 'Mini-Dólar (WDO)', instituicao: 'Tesouraria Bancária Internacional', direcao: '▼ Pressão Vendedora (-0.85%)', spread: '0.5 pontos', imbalance: '+65% Vendas', detalhe: 'Desova de contratos cheios por exportadores.' },
    { id: 3, ativo: 'Petrobras (PETR4)', instituicao: 'Vanguard & BlackRock Emerging Markets', direcao: '▲ Fluxo Estrangeiro Intenso (+2.10%)', spread: 'R$ 0,02', imbalance: '+82% Compras', detalhe: 'Alocação por dividendos extraordinários.' }
  ];
