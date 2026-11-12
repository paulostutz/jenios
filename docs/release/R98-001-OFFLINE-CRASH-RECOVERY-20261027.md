# JENIOS R98.001 — crash/restart SQLite entre processos isolados, sem ordens externas
Data: 27/10/2026. Escopo JENIOS apenas.

## Fonte e preservação
- Base R97 `73334f450a6ee37ea915312e4d7eb77cf6a47cb7`, PR #22 DRAFT.
- GitHub Actions R97 `40562756363` SUCCESS, Preview principal `dpl_Aie1eeFviKrPKsJ3EXyCT4jvtQnJ` READY.
- Artefatos originais reutilizados: B152 SQLite ledger, B175 vínculo Alpaca Paper, R88 símbolo durável, R94 validação de volume, R95 reabertura local e R97 checklist. Backups B152, B165–B169, B171–B173 e núcleo R74 preservados.
- Produção R79 `a24922cc829dd1b45b87a719e9fd57ab45e6d79b` intocada.

## Entrega R98
- `private-journal-restart-r98.mjs` inspeciona exclusivamente o B152 local após falha, sem token de cliente, chamada de corretora, HTTP, segredos ou submissão de ordem.
- `tests/fixtures/r98-offline-crash-child.mjs` funciona SOMENTE como fixture synthetic, travada a diretório sob o repositório e várias flags fail-closed. Simula SIGKILL do processo Node após commit de estado SUBMITTING, SEM fechar SQLite.
- Suíte R98 inicia outro processo Node, reabre B152 após SIGKILL, trata ausência de recibo como UNKNOWN, mantém risco reservado e impede nova proposta; encerra e restaura uma cópia sintética fria para novo diretório, conferindo leitura persistente e isolamento de titular.
- Processo no CI roda somente com credenciais sintéticas e 0 chamadas externas. Não conecta usuário real nem fornece interface de trading.

## Interpretação correta
O teste de SIGKILL no mesmo host NÃO certifica volume persistente entre reinicializações de VM ou deployments, políticas de backup ou recuperação de dados reais. A cópia a frio da fixture NÃO substitui backup SQLite online correto. Também não certifica recuperação de evento real em corretora, pois nenhum POST/GET externo ocorreu.

## Pendências para operar com clientes
Aprovar infraestrutura privada e teto de gastos, volume real com backup/restauração, conta de demonstração autorizada, ensaio ponta a ponta contra API oficial com recibos, reconciliação e avaliação independente, e depois autorização Live por conta, mercado, estratégia, capital e perdas máximas. Zero pagamentos, ordens, saques, CHEFE/LETTER e mudanças em apps. Requer CI SHA exato antes de certificar.