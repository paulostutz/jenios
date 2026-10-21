# Universidade JENIOS — acesso direto, sem prova obrigatória (B261)

Data: 21/10/2026. Base preservada: B260, commit `8e64d16bd050962cb7b2a13088dc3f17193f4bfa`.

## Comportamento efetivamente implementado

- Qualquer aluno **com acesso de assinatura válido** pode abrir todas as cinco trilhas e suas quinze aulas, em qualquer ordem, sem concluir formulário inicial, nivelamento, prova ou atingir nota mínima.
- Todas as aulas permanecem disponíveis mesmo quando um registro histórico contém prova pendente de versões anteriores. Não há interface de criação, resposta, repetição ou correção de prova.
- Sala de estudos: seleção direta por **cinco cards simples**, aulas da trilha em um único menu, retomada sugerida, marcação de leitura e revisão opcional. Versão mobile adaptada.
- O tutor gratuito T.Jenio pode explicar aulas diretamente, sem exigir testes; mantém limite diário, antispam, proibição de credenciais e permissões financeiras.
- O banco continua guardando progresso, notas históricas, revisões antigas e registros de nivelamento **sem apagá-los nem usá-los para liberar conteúdo**. As APIs antigas de avaliação permanecem por compatibilidade, mas não são expostas ao aluno nem funcionam como pré-requisito.
- Não há mudanças em preço/checkout, condições de assinatura, banco de dados, pagamento, autenticação, permissões de corretora ou motor proprietário dos robôs.

## Biblioteca de vídeos encaminhados e fonte das notas

Foram preservados **17 URLs de vídeos/Shorts e 3 playlists** pelo identificador oficial de YouTube. Em consulta de metadados, os títulos e a autoria dos 17 foram identificados. **Treze vídeos tiveram transcrições disponíveis para estudo de conceitos.** Três Shorts não tinham legendas e um retornou apenas legenda musical; para esses, não são atribuídas regras técnicas precisas. As três playlists estão catalogadas sem inventariar os vídeos internos.

Os textos são sínteses autorais da JENIOS, não transcrições nem cópias de vídeos. Retornos, percentuais e previsões citados pelos criadores não foram auditados e não foram aplicados diretamente aos robôs.

## Materiais complementares novos

- **Fundamentos:** relação entre acerto e resultado líquido, dimensionamento, perdas e controle de exposição.
- **Gráficos:** papel e limitações de EMAs, IFR/RSI, MACD, estocástico, bandas, ATR e volume.
- **Execução:** execução parcial, stop, ordens desconhecidas, slippage e reconciliação.
- **Estratégias:** reversão, suporte/resistência, divergência e falsa ruptura como hipóteses condicionais.
- **Laboratório:** pré-registro, holdout fora da amostra, embargo temporal, avaliações prospectivas e documentação de resultados negativos.

### Referências externas de metodologia (independentes dos vídeos)

- CME Group — Análise Técnica: https://www.cmegroup.com/education/courses/technical-analysis
- CME Group — Médias móveis: https://www.cmegroup.com/education/courses/technical-analysis/understanding-moving-averages
- CME Group — Osciladores: https://www.cmegroup.com/education/courses/technical-analysis/oscillators-macd-rsi-stochastics
- CFA Institute — Backtesting & Simulation (2026): https://www.cfainstitute.org/insights/professional-learning/refresher-readings/2026/backtesting-and-simulation
- Investor.gov/SEC — Stop, stop-limit e trailing stop: https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-bulletins-15

## Teste de aceite do aluno

1. Entrar com uma assinatura válida (continua obrigatória a autenticação comercial).
2. Escolher **Laboratório de robôs** como primeira trilha, sem registrar nivelamento.
3. Abrir qualquer aula, marcar como lida e perguntar ao T.Jenio; conferir ausência de nota mínima e histórico preservado.
4. Trocar de trilha no mobile sem etapa adicional; usar link do material complementar de forma voluntária.
5. Conferir com assinatura inválida que a API ainda responde com a negativa de acesso, não se tornando uma Universidade gratuita por acidente.

**Não há deploy em produção sem CI e aceite de release.**
