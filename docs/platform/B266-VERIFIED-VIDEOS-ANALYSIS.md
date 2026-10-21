# JENIOS B266 — análise verificada de vídeos de trading (21/10/2026)

## Proveniência e direitos

O usuário forneceu **17 vídeos individuais e três playlists** de YouTube. A integração autorizada vidIQ forneceu **metadados oficiais dos 17 vídeos**. Foram lidas **12 transcrições substantivas em português**; mais um Short teve legenda predominantemente musical. Quatro Shorts não disponibilizaram legendas. As três playlists ainda não tiveram seus episódios enumerados/revistos. Títulos/descrições não substituem imagens, intervalos intrabar ou provas estatísticas. Não são reproduzidas transcrições ou segmentos extensos protegidos por direitos autorais; o conteúdo abaixo consiste em sínteses e hipóteses independentes da JENIOS. O crédito vidIQ disponível foi esgotado no final da pesquisa (não será feita cobrança adicional).

## Análises com legendas revisadas

### 1. Método Connors — `IH5TuzAvFgk`

O vídeo descreve a hipótese histórica de reversão à média: contexto de preço acima da **SMA 200**, exagero de curto prazo **RSI(2) menor que 5**, entrada no fechamento na implementação apresentada e saída condicionada ao fechamento acima da **SMA 5**. O próprio material informa que não há stop de preço predefinido no modelo original e exemplifica perdas grandes com altas taxas de acerto. **Incompatibilidade de segurança:** a JENIOS exige perda máxima planejada e proteções B152; nunca aplicar a versão original sem stop. O B266 implementa apenas medição fechada das condições no laboratório, com classificação `NO_GO_MISSING_HARD_STOP`; uma hipótese com stop hipotético limitado é `RISK_BOUNDED_HYPOTHESIS_NEEDS_OOS`, nunca uma ordem. Medir drawdown, payoff, correlação com tendência, custos e critérios de não operação fora da amostra, sem calibrar no holdout.

### 2. Lateralização e falso rompimento — `MFnC-tsp90Q`

O vídeo apresenta consolidação em zonas de suporte e resistência, rompimentos que falham, entradas contextualizadas, invalidação e saídas. Hipótese para pesquisa: um filtro de largura de faixa, tempo mínimo em congestão, distância do rompimento, volume relativo e vela fechada pode reduzir operações de baixa qualidade. Não presumir que todo falso rompimento implica reversão; incluir spread, custos, horário e validação por mercado.

### 3. Primeiro Movimento — `uP8C5nasdUA`

O autor aborda disciplina, definição de setup, rompimento, alvo e stop, com foco em reduzir decisões impulsivas. Transformação de pesquisa: pré-definir janela de observação e de confirmação, stop e risco máximo antes de qualquer ordem, evitando hindsight de rompimentos. Exigir timestamps e spreads do ambiente de execução e comparação dos três modos originais com o mesmo orçamento de risco.

### 4. Candles como estrutura — `jXcIfXxdsN4`

O autor organiza a leitura em força/convicção, mudança de controle e dúvida, a partir de corpo, amplitude e sombras. Características originais mensuráveis: fração corpo/range, sombra superior/range, sombra inferior/range, direção e volume relativo. Uma vela isolada não identifica a intenção dos participantes nem oferece probabilidade de próximo movimento. Definir contexto (tendência, nível prévio, liquidez) e ablação de features redundantes.

### 5. Função dos indicadores — `mz2O6K6JF4k`

A transcrição diferencia medidas de tendência (SMA/EMA), momentum (RSI, MACD, estocástico), volatilidade (Bollinger/ATR) e participação (volume). Construir ensaios com cada família isolada antes de combinar; não confundir indicadores correlacionados com confirmações independentes. O laboratório já calcula uma seleção de features somente a partir de candles fechados.

### 6. Ciclos de Wyckoff — `Y5gk-wBkdRM`

A teoria de acumulação/distribuição fornece linguagem para interpretar comportamento, fase do ciclo e contexto macro. Risco: narrativas retrospectivas não são rótulos de fase confiáveis em tempo real; em pesquisa, congelar critérios mensuráveis de faixa, volume e volatilidade para classificar regimes sem vazamento futuro.

### 7. Psicologia e aderência — `_k2XN41-_f8`

Disciplina e pensamento probabilístico são centrais, sobretudo os perigos de revenge trading, preço médio emocional, mover stop e aumentar lote após perdas. Na JENIOS, a tradução adequada é proteção de conta, máximo de perdas, pausa de novas entradas e explicações educativas; não inferir automaticamente estados mentais nem substituir decisões do cliente.

### 8. Expectativa e assimetria — `CIm6HlYLzLU`

Síntese ligada a Larry Williams realça que uma taxa de acerto maior pode coexistir com resultado negativo se a perda média for excessiva. O critério de comparação dos robôs deve incluir retorno líquido, payoff, drawdown, caudas e robustez por regime, não apenas % de acerto. Alegações de desempenho entrevistadas não foram auditadas.

### 9. Profissional e leitura institucional — `gbo9Q2IsGHQ`

Entrevista com Lucas Costa (análise técnica, BTG), abordando médias, consolidação a favor de tendências, risco, e crítica a narrativas simplistas de “caça aos stops”. Hipótese: critérios objetivos de rompimento alinhado à tendência com relação risco-retorno conhecida; não inferir ordens de instituições sem dados de fluxo realmente licenciados.

### 10. Disciplina e stop — `T26RN9f9AMI`

Entrevista com André Moraes enfatiza stop planejado, disciplina e uso parcimonioso de setups. Relatos pessoais não equivalem a acurácia auditada. Aplicar ao ensino e reforçar fail-safe dos robôs.

### 11. Oito padrões de reversão — `4GONM3_jMNw`

O vídeo descreve padrões de candles e apresenta percentuais elevados; tais percentuais **não foram validados fora da amostra**. Categorizar padrões, testar condicionais de tendência/liquidez e incorporar custos e janelas prospectivas. Rejeitar seleção oportunista de ativos/padrões.

### 12. Caso histórico Cohen — `klYqVdHcTws`

Conteúdo narrativo sobre histórico financeiro e riscos reputacionais. Útil para estudar viés de sobrevivência, conflitos de interesse e compliance; não é fonte de uma estratégia reprodutível validada.

## Material com cobertura parcial

Metadados oficiais confirmados, mas sem legendas operacionais: `UcsI6Z8LfSE` (candles), `07qpAS6akb0` (leitura de gráfico), `SRsdBdGT6dE` (engolfo de baixa e Stoch RSI) e `HSrdYcETBmE` (operacional do iniciante). `kKbTFQxUrtY` produziu legenda de música; por isso não se extrai regra operacional do vídeo. Playlists `PLjp0U_VKdVKriZwroNLVtoehVCRnFa9J7`, `PLjp0U_VKdVKraDoIAHPHAv8a4pCFDFC5q`, `PLjp0U_VKdVKolNOxyhpkKzTVUnulyHOGE` não tiveram episódios verificados.

## Regras para promoção de pesquisa a robô

1. Núcleo original e versão-base congelados; pré-registro de critérios sem olhar desempenho de validação.
2. Candle fechado, relógio confiável, fonte externa independente e janela de treino/holdout embargada.
3. Risco máximo por operação e conta previamente reservado no ledger B152; **proibido remover stop por popularidade de estratégia**.
4. Mesma exposição e custos reais para comparações direto, reverso e híbrido, incluindo slips, spreads, fills parciais e liquidação quando aplicável.
5. Resultados negativos, estabilidade cross-asset e intervalos de confiança documentados; evitar mineração de regras entre dezenas de vídeos.
6. Aprovação técnica e comercial separada antes de qualquer alteração no núcleo privado ou piloto Paper; live money continua bloqueado.

A presente entrega disponibiliza pesquisa e material educativo, **não** melhora economicamente os robôs nem conclui backtests sobre o núcleo proprietário. Indicadores matemáticos em candles artificiais não representam rendimento.
