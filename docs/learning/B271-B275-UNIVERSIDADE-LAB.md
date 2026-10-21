# JENIOS B271–B275 — Universidade e pesquisa isolada
Data: 21/10/2026. Base imutável: B270 `db51ea187b04aae1f90e1251f836ceed75cc7937`.

## B271 — Universidade
10 oficinas originais, duas para cada uma das cinco trilhas existentes: expectativa líquida, stop versus gap, geometria dos candles, filtros RSI/médias/ATR, estados de ordens, fricção de execução, rompimento e falso rompimento, hipótese SMA200/RSI2/SMA5, congelamento de validação e comparação de modos. Disponíveis em detalhes opcionais na sala de aula; não são aulas novas com nota ou pré-requisito. As 15 aulas, trilhas livres, acessos comerciais, tutor e histórico permanecem intactos.

## B272–B273 — Laboratório desconectado
Arquivo `lib/platform/research/b272-walkforward-lab.mjs` recebe dados OHLCV **fornecidos externamente e não autenticados**. Duas hipóteses autorais: contexto EMA12/EMA26 e ruptura fechada de máxima/mínima das 20 barras anteriores. Não são regras comprovadas de nenhum dos novos vídeos. Uma configuração imutável de teste exige: ativo BTC/ETH/SOL; tempo de candle válido; treino; momento de congelamento; embargo de pelo menos 24 horas; holdout; início prospectivo posterior; stop hipotético até 5%; cenários de custo round-trip 0/10/30 pontos-base.

A observação do sinal usa exclusivamente candle fechado anterior, e a avaliação de entrada utiliza a abertura seguinte. São geradas tabelas para modo direto, reverso e híbrido com orçamento nominal igual de risco, 3 cenários de custo, expectativa em unidades R, taxa de acertos e drawdown aritmético de R. Execução *single bar* simplificada: stop tocado tratado no preço-limite, sem garantia de fill, latência, gap ou profundidade. Sem financiamento ou taxas específicas de corretora e sem significância estatística estimada. Em nenhuma hipótese esses resultados habilitam robôs, papéis financeiros, pagamentos, execução Paper ou real.

## B274 — Proteções
Só podem diferir da base B270: oficinas, importação das oficinas na sala existente, laboratório isolado, teste automatizado, documentação, workflow, guarda de escopo. Preservar arquivos preexistentes do núcleo, PAY, Social, Universidade de acesso, Gênio/Gênia e integrações com corretoras. CI deve rejeitar URLs de ordens, caminhos protegidos alterados, novas rotas POST de execução ou regressão em testes.

## B275 — Critérios de conclusão
- CI: integridade do escopo, suíte de testes específica e regressão `npm run build` (que inclui `npm test` e `test:release-s05`), mais smoke tests de Universidade/Social.
- Se a CI falhar: não homologar, não publicar.
- O acervo 36/56 não recebe novos títulos, canais ou transcrições, pois o vidIQ conectado não tinha créditos na consulta. 13 legendas revisadas são registros preexistentes, não uma reinspeção nesta rodada.
- Testes com candles sintéticos verificam mecânica de software, **não comprovam retorno nem são backtests OOS sobre dados reais**.
- Para pesquisa estatística válida: coletar fonte independente e permissões de uso, carimbar SHA, congelar hipótese antes do holdout, registrar todas as tentativas, executar a janela OOS histórica não utilizada e depois evidência prospectiva com trilha temporal confiável. Somente após aprovação explícita considerar atualização operacional em outra branch, sem deploy automático.

Produção mantida em B177-R3. Nenhuma ordem, cobrança ou publicação autorizada neste conjunto.
