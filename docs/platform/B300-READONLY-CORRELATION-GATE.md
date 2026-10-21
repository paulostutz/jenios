# JENIOS B300 — correlação de evidências assinadas, auditoria e Lossômetro

**21/10/2026 · Continuação exclusiva JENIOS Platform · Base certificada B299.**

B299: commit `53f127eb6118dd3a183ecdf3b52a5fd4e23e6419`, GitHub Actions [39684586218](https://github.com/paulostutz/jenios/actions/runs/39684586218) `SUCCESS` (75/75 contratos, 1.636/1.636 gerais, 94/94 S05, build Next.js). Produção preservada B177-R3 `caaffece04649a6dc1ca6c8012d7502887771529`.

## Mudança adicionada (sem reconstruir)

- `lib/platform/research/b300-evidence-reconciliation-gate.mjs`: **correlaciona somente leituras fornecidas pelo operador**. Exige consentimento B299 Ed25519, verifica cada envelope do coletor B298, valida nonce/digest único, mesmo escopo de titular/conta/consentimento, prazo vigente e espécie autorizada. Reutiliza B197 para observações pareadas de ordens Alpaca Paper, B298 para posições, recebimentos declarados de sinais e ciclo de vida de intenções, B297 para encadeamento da captura original em ambiente sintético e **a própria aritmética B152**, sem escrever no ledger.
- `scripts/platform/research/b300-review-private-cohort.mjs`: CLI **offline**, apenas leitura, com entradas privadas `.json` e chaves públicas `.pem` fora do repositório, ambas 0600 em diretório 0700; rejeita symlinks, flags de execução e caminhos dentro do repo. Não acessa broker, não importa credenciais, não posta ordens, não atualiza SQLite/risco. Só em laboratório sintético é permitido alterar o relógio de observação com a flag explícita de fixture.
- `tests/platformB300EvidenceReconciliationGate.test.mjs`: ataques à integridade de assinaturas, consentimento, escopos, troca de keys, timestamps, duplicação/replay dentro do lote, divergência de fills/posições, ciclo de cancelamento/fechamento, ausência de coberturas, tentativa de inserir P&L real em what-if, rejeição B152, CLI e isolamento de arquivos.
- `.github/workflows/jenios-b300-readonly-correlation.yml`: CI na nova branch protegida, dados sintéticos, dependências sem scripts, testes de contratos anteriores, regressão e build; artefato público sem motor ou segredos.

## Interpretação dos três modos

| Modo | Evidência correlacionada | O que **não** é inferido |
| --- | --- | --- |
| Manual | Intenções fornecidas, sinais sintéticos, cronologia declarada e números de cenários educativos | Que o operador teve prejuízo real, entrou em ordem, ou recebeu sinal externo |
| Híbrido | Intenções e contexto de leitura assinada; cancelamentos/fechamentos de referência | Inversão de ordem, entrada/saída autorizada ou operação automatizada |
| Reverso | Intenções com política B290 e exceção de megatendência tratada pelo contrato anterior | Que o motor iniciou execução real, cancelou ou fechou posição numa corretora |

O módulo B300 **não oferece conector de ordens**. Status da corretora exportado e assinado por um coletor configurado **não é recibo oficial assinado pela corretora**, nem reconciliação independente. Um campo `FILLED` ou uma posição `flat` exportada NÃO prova que aquela operação foi executada ou encerrada. Divergência/partial cancel geram revisão humana crítica. Nenhum resultado de papel é confundido com transação real.

## Lossômetro: três dimensões sem mistura

1. **Perdas hipotéticas evitadas** e R contrafactual vêm exclusivamente de `computeB298LossometerHypotheses` com origem `LAB_COUNTERFACTUAL_ONLY`.
2. **Ganhos hipotéticos descartados** são igualmente contados, impedindo divulgar somente a vantagem potencial.
3. **Perdas realmente evitadas / resultados efetivos / P&L realizado** continuam `null` — não `0` e nunca equiparados às hipóteses — até evidência de contas, fontes independentes, fills reconciliados, taxas/custos e método causal prospectivo.

`B299PrivateEvidenceJournal` e a revogação assinada **não são substituídos**: B300 é uma revisão pura de um lote fornecido, e ainda **não consegue verificar que cada envelope específico foi escrito no diário B299**, nem revalidar revogações externas, testemunhas independentes ou período pós-restauração do banco. O relatório marca `b299DurableReplayVerifiedByThisModule:false`. A classificação final é sempre **NO-GO externo**, mesmo com todos os testes internos aprovados.

## Execução local em ambiente isolado (sem corretora)

Preparar fora do repo um pacote `.json` protegido:

```json
{
  "schema": "JENIOS_B300_PRIVATE_COHORT_V1",
  "signedConsent": "<objeto de assinatura B299>",
  "b297Capture": "<captura local sintética B297 ou null>",
  "orderPairs": [],
  "positionPairs": [],
  "deliveryReceipts": [],
  "operatorIntents": [],
  "riskChecks": [],
  "lossometerWhatIf": []
}
```

**Os marcadores acima são apenas documentação, não um pacote aceito pelo validador.** A revisão precisa de pelo menos uma evidência. Configurar `JENIOS_B300_PRIVATE_READ_ONLY=true`, as variáveis `JENIOS_B300_PACKAGE_PATH`, `JENIOS_B300_COLLECTOR_PUBLIC_KEY_PATH`, `JENIOS_B300_CONSENT_PUBLIC_KEY_PATH`, os digests `JENIOS_B300_{OWNER,ACCOUNT,CONSENT}_DIGEST` e IDs `JENIOS_B300_{COLLECTOR,CONSENT}_KEY_ID`. Manter as três flags de execução real/Paper desligadas. Executar em host privado isolado Node 22:

```sh
node scripts/platform/research/b300-review-private-cohort.mjs
```

Nunca escrever credenciais em linha de comando, log ou artefato. O report só apresenta agregados, severidade, digests de audit, flags `false` de não comprovado; não imprime contas nem corpos dos eventos. A CI usa fixtures assinadas geradas no teste e **não** executa importação de contas reais.

## Critérios reais pendentes antes de lançar

- Consentimento e identidade civil verificados com provedor confiável, abrangência e revogação efetiva das permissões no broker.
- Atestado independente do host e do relógio do coletor, e assinatura do próprio provedor de dados onde disponível.
- Coleta oficial permitida **apenas de leitura**, com confirmação de origem e coesão dos eventos, proteção de segredos, idempotência auditável e isolamento entre clientes.
- Vincular decisões genuínas do núcleo privado a sinais comprovadamente recebidos e a ordens do **próprio cliente**, não proxies sintéticos.
- Reconciliar B152 (estado durável, fills, exposição, stops e metas), inclusive cancelamento parcial, latência, custos e encerramento de posição, sem chamar qualquer serviço de envio.
- Pesquisa prospectiva independente que distinga contrafactual, ganho descartado e P&L efetivo. Nunca alegar lucratividade garantida.

**Não fazer deploy, enviar ordem real ou Paper, cobrar, mudar núcleos, acionar despesas ou modificar CHEFE/LETTER.** Nenhuma CI verde substitui integração real nem autoriza lançamento.