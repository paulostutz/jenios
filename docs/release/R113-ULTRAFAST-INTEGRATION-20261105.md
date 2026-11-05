# JENIOS R113 — Integração da pesquisa UltraFast V2 + V3

Data: 05/11/2026. Escopo autorizado: integrar o UltraFast existente e publicar uma interface administrativa **somente de leitura / simulação**, sem habilitar ordens reais ou Paper externo.

## Base imutável e preservação

- Origem de produção confirmada: `release/jenios-genios-g44-20261024` — `8f1b8e4827814d7efe42dc5b91226def2ea42ad5` (Vercel produção READY).
- R111 V2: `386063b1850734369a17f32d5a471fcc5834877d` (PR #26, pesquisa e testes aprovados).
- R112 V3: `80a1529f6dd045ac77b9175e9ab6e197b3da26ed` (PR #27, pesquisa e testes aprovados).
- Os 48 arquivos de módulos, testes, documentação e workflows R111/R112 não existiam na árvore de produção no instante da comparação. Copiá-los preservando o hash dos blobs; não fazer merge geral das branches R109/R110 não homologadas.
- Preservar `lib/release/environment-scope.mjs`, `scripts/check-s05-env-scope.mjs`, credenciais, bancos, políticas, cobrança, Social e três outros motores.

## Entrega R113

1. `lib/platform/research/ultrafast-r113-laboratory.mjs`: orquestra R111/R112 com os controles certificados, usando somente **três fixtures sintéticas**: favorável, risco de token e feed desatualizado. Usa R111 scanner/scalping/risk/execution/shadow; R112 integridade de book, preflight, riscos, comparativo de venues, alocação, maker/taker, estatística, auditoria e watchdog. Nenhuma ordem ou acesso de conta.
2. `/platform/admin/robos/ultrafast`: área de pesquisa da JENIOS Platform, acessível somente mediante sessão e permissão administrativa; mostra resultados hipotéticos e motivos de bloqueio.
3. `POST /api/platform/admin/robots/ultrafast`: avalia três cenários fixos, exige token da Platform dedicado, permissão `platform.admin`, origem autorizada e branch/projeto de produção esperados. Nada é persistido.
4. `GET /api/platform/admin/robots/ultrafast`: consulta apenas **ticker público REST** da Kraken (BTC, ETH, SOL) sem chave, sem ordens. Trata preços como observações amostrais e falha com indisponibilidade explícita. Não interpreta cotação como book sincronizado ou oportunidade para trading.
5. Acesso direto pelo endereço `/platform/admin/robos/ultrafast`. A página administrativa R106 existente foi mantida **byte-idêntica** para preservar o inventário de hashes; a rota nova usa o mesmo acesso administrativo dedicado da Platform.
6. Testes R113, regressões R111/R112 e build completo via GitHub Actions. Separação explícita entre CI e validação externa.

## Restrições essenciais

- `externalPaperEnabled=false`, `liveExecutionEnabled=false`, `ordersSent=0` em todos os resultados da integração.
- `accountTradeAllowed=true` nas regras da fixture significa **apenas simulação**, nunca aprovação real de conta.
- Dados públicos Kraken são ticker REST e NÃO WebSocket, livro L2 íntegro, feed de microestrutura ou ordens.
- `financialPerformanceCertified=false` e PnL do shadow *hipotético*.
- A área não oferece autorização financeira, assinatura, depósito, saque, permissões operacionais ou controle de ordens.
- O módulo de análise temporal, risco e ferramentas de pesquisa não é certificado para rentabilidade. Exige evidência prospectiva, amostra externa, governança e revisão regulatória antes de ativar operações reais.

## Critérios de aceite para publicação

- CI direcionado e full build aprovados em commit exato.
- Escopo do diff sem perda dos arquivos da produção e sem alterações das cercas financeiras.
- Publicação no projeto `jenios-ecossistem` e domínio `jenios.com.br` do commit de release, confirmando READY.
- Acesso administrativo e erro de permissão testados quando ambiente autenticado permitir; sem credenciais de cliente não declarar essa prova como concluída.
- O usuário pode verificar `/platform/admin/robos/ultrafast` com sua sessão exclusiva da JENIOS Platform.

## Fora desta entrega

Operação financeira e Paper externos, integração operacional da exchange por WebSocket, carteira dos clientes, cofre, reconciliação real e validação de estratégia em mercado real. Esses componentes permanecem NO_GO para negociação.