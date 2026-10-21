# JENIOS B297 — Auditoria somente leitura do serviço proprietário original

Base: B295, `cfc7bf7aeb90213580a7eda835c06b5f3f264d70`; B296 executado em ambiente privado conforme relatório da Biblioteca. Produção, motores e fluxos de ordens ficam intocados.

## Escopo e limites

- `lib/platform/research/b297-private-readonly-audit.mjs`: captura os resultados de um callback de análise *fornecido pelo runner*, registra um hash encadeado e rejeita retorno com execução habilitada, fonte não sintética, modos inconsistentes ou campos de cenários imprevistos. **Esse módulo público não autentica a procedência do callback.**
- `scripts/platform/research/b297-capture-private-readonly.mjs`: CLI opcional **local** que exige `JENIOS_B297_PRIVATE_CORE_DIR` com os arquivos originais `engine.mjs` e `service.mjs`. Lê os bytes e confere os dois hashes SHA-256 antes da importação. Bloqueia `fetch`, passa sempre a fonte sintética, testa `assertNoLiveExecution` e chama `analyzeRequest` e `chooseMode` originais; não contém nem copia o código proprietário.
- Matriz: 12 análises (2 horizontes × 3 modos × 2 intenções); 7 ensaios diretos `chooseMode`, pausa e posição existente; seis eventos **fictícios** de referência (abrir, cancelar, fechar, megatendência); aritmética B152, cinco entradas negativas e cadeia SHA.
- B290 valida a cronologia *declarada* de entrega, nunca o recebimento por um provedor. B152 valida risco aritmético e parâmetros; **não** transmite nem autoriza ordem, mesmo Paper.

## Interpretação comercial e risco

- **Manual:** operador decide e executa em sua conta por iniciativa própria; captura de `manual_preview` não é execução nem recomendação validada.
- **Híbrido:** orientação/contexto auxiliar. O `hybrid_preview` histórico pode apresentar um lado sugerido distinto do lado pretendido pelo operador, mas **não inverte nem altera ordem**. Não há integração com agentes generativos nem entrega externa comprovada.
- **Reverso:** decisão genuína `reverse_preview` só sob calibração do mecanismo original e filtros de tendência. `preserve_trend_aligned_intent` e `suggest_trend_aligned_preview` preservam exceção de megatendência; `reverse_not_calibrated` é bloqueio efetivo.
- Abrir/cancelar/fechar: a função original `chooseMode` não oferece uma API de ordens, cancela ou reconcilia posições. O B297 valida **apenas contratos de referência** B290 para ciclo de vida, sem afirmar que um broker processou comandos.
- **Lossômetro:** perdas evitadas, ganhos descartados e lucros efetivamente realizados **não verificados**; manter `null`, jamais converter resultados de cenários em reais.

## Execução privada opcional

Em máquina privada isolada com Node.js 22, fora de repositório público e sem nenhuma credencial externa:

```sh
JENIOS_REAL_EXECUTION_ENABLED=false \
JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED=false \
JENIOS_PRIVATE_PAPER_EXECUTOR=false \
JENIOS_B297_PRIVATE_CORE_DIR=/caminho/privado/nucleo-privado \
JENIOS_B297_EVIDENCE_JSON=/diretorio/privado/b297-evidence.json \
node scripts/platform/research/b297-capture-private-readonly.mjs
```

Usar caminho de saída que ainda não exista. O CLI cria arquivo local com modo `0600`, não publica o núcleo nem chama API de corretora. Verificar o relatório antes de colocar dados redigidos na Biblioteca. Código com execução externa e dados de conta deve permanecer fora do processo.

## Gate de CI e continuidade

`.github/workflows/jenios-b297-readonly-audit.yml` executa os testes B297/B290/B295, regressão geral e build com execução e transporte explicitamente desligados. A CI **não** recebe os dois arquivos proprietários e, portanto, não pode comprovar a execução genuína sem o relatório do runner local. Hash encadeado protege mutação local mas não é assinatura independente nem relógio de terceiro.

**Pendências externas:** confirmação auditável de entrega e leitura por destinatário; consentimento e origem de ordens de corretora; status de cancelamento/posição/fill; metadados independentes de mercado; risco de execução; calibração prospectiva e resultados observados; trilha de agente generativo. Sem essas evidências: **NO-GO para alegações de resultados e lançamento operacional**.