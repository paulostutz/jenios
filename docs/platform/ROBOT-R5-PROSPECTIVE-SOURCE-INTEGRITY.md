# JENIOS ROBOT-R5 — Auditoria prospectiva de sinais e consistência de duas fontes

**Checkpoint local:** 21/10/2026, Bahia (execução em UTC em 22/10/2026).
**Escopo:** somente pesquisa dos robôs Manual, Híbrido e Reverso.

## 1. Continuidade e segurança

- Repositório: `paulostutz/jenios`.
- Base certificada ROBOT-R4: `2e18857ad1db58c4cb6a8b305c01476d304d992e`.
- CI-base: GitHub Actions `39704539220`, SUCCESS.
- Backup original da base: `backup/jenios-robot-r4-offline-feasibility-certified-20261021`.
- Branch planejada: `fix/jenios-robot-r5-dual-source-prospective-integrity-20261021`.
- **GitHub: gravação bloqueada pela integração de segurança. Nenhum commit R5 foi criado.** O pacote desta etapa é um overlay local auditável, que requer revisão e CI remota antes de certificação.
- `vercel.json` no pacote desliga deployment automático da futura branch R5, preservando as proteções R4 e anteriores.
- Produção preservada B177-R3, commit `caaffece04649a6dc1ca6c8012d7502887771529`.
- B303 do outro chat permanece intocado. Sem CHEFE, LETTER, PAY, Social comercial, Banco Inter ou IA paga.

## 2. Entregas

**Novo módulo:** `lib/platform/research/robot-r5-dual-source-prospective.mjs`.

A etapa de registro reutiliza o validador **B287** de sinais previamente congelados. Exige a tripla Manual/Híbrido/Reverso para cada ativo e hora, assinatura hash do lote, registro **declarado** ao menos 10 minutos antes da abertura e compatibilidade das direções. O hash local detecta alteração posterior dos bytes, mas um registro feito pelo próprio operador **não prova** carimbo de tempo independente ou decisão real do engine.

A etapa posterior aceita um par de observações declaradamente oriundas de `coinbase_exchange` e `kraken_spot`, sempre USD e com aliases de ativos pré-fixados. Exige o mesmo candle H1, OHLC válido, observação depois de fechamento + cinco minutos, captura em até quatro horas após o candle, sem suposta assinatura, fill ou ordem. Esses aliases são **hipóteses de mapeamento**, ainda não aferidas por APIs oficiais nesta etapa.

Limites congelados de **comparabilidade apenas descritiva**, sem função operacional: divergência máxima de 50 bps no fechamento, 150 bps nas demais métricas OHLC, 10 minutos na diferença de carimbos de coleta. Fontes conflitantes, timestamps distantes ou payloads idênticos e não testemunhados bloqueiam a comparação. O módulo não usa volume de exchanges diferentes como prova de igualdade.

Mesmo quando os candles concordam, as variáveis de atestação externa, assinatura oficial de preços, execução, P&L e lossômetro efetivo permanecem `false` ou `null`, respectivamente. Nenhum valor de rentabilidade é calculado.

## 3. Limites essenciais

- O laboratório utiliza fixtures. Os provedores são **rótulos fornecidos pelo chamador**, não comprovantes criptográficos oficiais do provedor.
- Registro de sinal e preço de resultado ainda **não possuem testemunha externa**, de modo que falsificação ex post não é eliminada por hash local.
- Nenhuma comparação com conta, posição, ledger B152, stop real, fill, empréstimo, funding, liquidez real ou dados de mercado assinados foi feita.
- R3/R4 continuam responsáveis por estudo estatístico e custos hipotéticos. O R5 não altera critérios, scores, parâmetros, estratégias nem o núcleo proprietário.
- `actualLossesAvoided` e `actualBrokerRealizedPnl` permanecem `null`. Status operacional `NO_GO_EXTERNAL_WITNESS_AND_BROKER_RECONCILIATION_REQUIRED`.

## 4. Testes e aceite

- 16 testes Node locais aprovados, incluindo 252 combinações adversariais e um cenário **inventado** de 30 dias / 300 horas / 900 sinais, sem evidência prospectiva externa.
- Testes: antecipação de sinal, adulteração, parâmetros extra declarando P&L, ausência/duplicidade de fornecedor, mudança de par, USD/USDT, preço divergente, timestamps, fonte duplicada e determinismo sob reordenação.
- A CI a executar **quando a gravação for permitida** está preparada em `.github/workflows/jenios-robot-r5-dual-source-offline.yml` e inclui regressões R1–R4, B280/B288/B289/B290/B301 e Next.js.
- Critério para chamar R5 de certificado: branch/commit GitHub SHA identificado, Actions `SUCCESS`, backup do exato SHA, artefato de evidência e confirmação de nenhum deployment de pesquisa.
- Nenhuma execução de corretora, Paper externo, dinheiro real, cobrança ou publicação ocorreu neste bloco.

**Decisão local:** `LOCAL_QA_PASS`, `REMOTE_CI_PENDING`, `PROVIDER_ATTESTATION_NO_GO`, `PERFORMANCE_NO_GO`.
