# B289 — Operador perdedor sintético e Reverso com exceção de megatendência

O Reverso da JENIOS deve ser estudado como **inversor de decisões de um operador de referência**, e não como simples inversão do robô Manual. Este módulo é laboratório de pesquisa, não o motor proprietário.

Cinco perfis determinísticos: entrada atrasada em rompimento, reação após perda, tentativa de topo/fundo contra tendência, excesso de operações por ruído e saída precoce do ganhador. Eles não são pessoas reais, nem se pressupõe que sempre percam. O comportamento `REVENGE_AFTER_LOSS` é um proxy ilustrativo e não uma recomendação para escalar posição. Nenhuma ordem é enviada.

**Exceção:** quando uma megatendência for identificada com EMA12/EMA26, deslocamento direcional e sequência de candles **já fechados**, a inversão automática contrária à direção predominante é bloqueada. Se o operador de referência já acompanha a megatendência, o modelo a mantém em pesquisa; caso contrário, se abstém. Uma megatendência detectada por critérios técnicos não garante continuidade.

**Risco e assimetria:** stops de 1%, custo e slippage de estresse de 30/30 bps. O módulo não possui alvos assimétricos nem saídas multi-candle: portanto, ainda não valida “perder de colherinha e ganhar de balde”. Essa será uma hipótese futura separada, com payoff e risco de gap pré-registrados, sem aumentar exposição após perdas.

A investigação dos livros e vídeos anteriores gerou hipóteses pedagógicas de momento, estresse, Wyckoff, candle, médias e disciplina. Este B289 não declara que esses conteúdos foram todos operacionalizados, nem certifica os núcleos reais. Faltam coleta de sinais originais somente leitura, assinatura independente de dados, comparação prospectiva e custos de financiamento.

É proibido utilizar a CI ou o desempenho de fixtures sintéticas como rentabilidade para venda de assinaturas. Nenhum deploy, cobrança, execução real/Paper ou mudança no núcleo proprietário.
