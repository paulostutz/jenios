# JENIOS R75.003 — Restauração R73, CI e preview controlado

Registro: 26/10/2026, horário de Brasília (CI observada em 27/10/2026 UTC). Escopo JENIOS somente.

## Entrega nesta branch

A branch `audit/jenios-r75-backups-reconciliation-20261026` começou da **release G49 exata** `2ee913339d01c7c20e4d837867f10d3258bc8dcc`. O backup original R73 em `backup/jenios-robot-r73-definitive-app-published-20261024` foi usado **por arquivo**, mantendo o mesmo SHA de blob nas peças originais de status, UI e contratos de validação. Não foi refeito o motor privado R74.

- Restaurados `/platform/admin/robos`, `/api/platform/admin/robots/status`, sonda read-only, UI cliente, contratos de validação e 16 relações R64–R71, sem dados de clientes expostos em páginas anônimas.
- Corrigido o link do painel e o login `?dedicated=1` sem apagar melhorias da G49.
- A configuração `R73_BRANCH` do status foi adaptada para a branch **ativa em produção**, `release/jenios-genios-g44-20261024`, preservando autenticação obrigatória, `platform.admin`, projeto Vercel e banco dedicados, além das quatro flags de execução e geração pagas igual a `false`.
- Restauração dos imports exatos do backup (incluindo R47, R61, R63, R64, R65, R67, R71 e B290/B297), sem incluir `engine.mjs` nem `service.mjs` proprietários no repositório público.
- A rota permanece GET somente; autorização administrativa da Social, usuário anônimo e métodos mutadores são recusados.

## Certificação observada

GitHub Actions: `40438735387`, SHA `f7584ff397e798cb732c1d5c8cae96b0169c1bb2`, resultado **SUCCESS**:
- 19 testes focalizados da recuperação, **19/19 PASS**.
- 1.628 testes gerais, **1.628/1.628 PASS**.
- 94 regressões S05, **94/94 PASS**.
- `next build` compilado.
- Smoke local: `/platform/admin/robos` 200 e API protegida 404 com flag não habilitada.
- Fonte do commit e hash SHA256 arquivados pelo workflow R75 conforme política de backup.
- O primeiro run `40437729502` falhou apenas porque faltavam dependências do backup. O run seguinte `40437956080` foi SUCCESS com 1.606 testes, 94 S05 e build; novos gates R75 também passaram no run `40438735387`. Preservar os logs históricos de falha e de correção.

**Preview isolado Vercel**: deployment `dpl_9rPk5tt6bWDgjTWgfn2yCTksEDQq`, READY, SHA `f7584ff397e798cb732c1d5c8cae96b0169c1bb2`.
- `https://jenios-ecossistem-eb55yy1l3-jenios.vercel.app/platform/admin/robos` HTTP **200**.
- `https://jenios-ecossistem-eb55yy1l3-jenios.vercel.app/api/platform/admin/robots/status` HTTP **404** em homologação, deliberado. Sem vazamento de base do admin ou de dados dos robôs.
- Preview branch permitida pelo guard S05 **somente** com projeto correto, Social QA e Platform dedicada, 20 external-action flags explícitas `false`.
- Vercel: 20 flags `false`, 4 URLs QA e 2 chaves públicas de Supabase da QA, todos **escopados à branch R75 e ambiente preview**, sem ler/escrever segredos da produção. Os deployments inicialmente falharam pelos gates `S05_UNVERIFIED_PREVIEW_BRANCH`, `R75_PREVIEW_EXTERNAL_ACTIONS_MUST_BE_DISABLED`, `S05_PREVIEW_MUST_USE_ISOLATED_SUPABASE` e `PLATFORM_PREVIEW_MUST_USE_DEDICATED_QA_SUPABASE`. Esses bloqueios foram resolvidos um a um, não contornados.

## Limites e próximo gate

A restauração da interface não habilita a execução. O R74 privado continua em análise sintética com `live_execution_enabled:false` e nenhuma conta de corretora/ordem externa homologada. A versão R73 do painel apresenta estado administrativo histórico e não deve afirmar que o R74 opera ordens Live.

**Importante: ainda não é publicação oficial da R75**. A release G49 tem verificador de inventário exato (`scripts/check-pro-image-g49.mjs`): antes do merge, introduzir manifesto aditivo R75 verificando cada arquivo alterado por SHA de Git e preservando os hashes do G49. Não enfraquecer os gates financeiros, publicar a branch de audit diretamente ou criar cobrança/ordem de teste.

Somente depois de CI integral com manifesto, integração da PR #16 e deploy READY do commit exato na Vercel será possível testar domínio oficial. App nativo/TestFlight é trilha separada; atualizar PWA/WebView não constitui upload Apple/Android.

**Rollback:** reverter somente o código/admin publicado ao deployment G49 `dpl_2XrnctiXtkSfXwWDxekfme95JMK2`. Nenhuma migração, dado, segredo ou identidade do R74 deve ser restaurado sobre outro registro.
