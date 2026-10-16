# JENIOS — checkpoint de pré-lançamento 01

Escopo exclusivo: JENIOS Social, BankScore e Validador de Tokens.
Solicitação aprovada pelo proprietário: manter consulta básica pública; liberar visualização e PDF completos gratuitamente para usuários cadastrados e autenticados na Social; publicar após validação.

## Recuperação

- Produção original: `b2c09e4c54481a9310707f1b048cd23be839ffb5`.
- Deployment original: `dpl_5nGU7mJQSHpGbJRMDijGxmFdd3sP`.
- Projeto existente: `prj_44ipBY3R9sHlQDAXY7NUn1zDguw4` / `jenios-ecossistem`.
- Domínios: `jenios.com.br` e `www.jenios.com.br`.
- Backup original: branch `checkpoints/jenios-prelaunch-00-producao-original`.
- Código testado: `f5101669c93a239662d3c9a0d7c05ffb26c3a7c7`.
- Branch de implementação: `prelaunch/relatorios-social-20261015`.
- Backup do código testado: branch `checkpoints/jenios-prelaunch-01-291-testes`.

## Regra implantada na branch

1. Consultas e PDFs básicos permanecem públicos e inalterados.
2. Os dois laudos completos requerem token validado no servidor com `requirePayUser` / `auth.getUser`; contas anônimas são rejeitadas.
3. Cadastro e login usam o fluxo já existente. O acesso abre em outra aba para preservar a consulta; ao voltar, a sessão é conferida novamente.
4. Não há pedido ou Pix para emitir os dois relatórios no pré-lançamento.
5. A API de checkout rejeita novas cobranças desses dois serviços, inclusive provenientes de páginas antigas.
6. Permissões administrativas e pagamentos dos demais serviços permanecem inalterados.
7. Nenhuma tabela, migração, credencial, integração bancária, motor de análise, fonte pública ou gerador de PDF foi alterado.
8. `lib/reports/prelaunch.mjs` concentra a chave `REPORTS_PRELAUNCH`. Uma futura volta à cobrança exige alteração dessa chave e novo deploy aprovado; não há expiração automática definida.

## Evidências executadas

- `node --test --test-reporter=spec tests/reportPrelaunch.test.mjs`: 12 testes aprovados, zero falhas.
- `npm test`: 291 testes aprovados, zero falhas, zero testes ignorados.
- `npm run build`: geração da aplicação Next.js concluída, incluindo as rotas de BankScore, validador e administração.
- Novos testes cobrem falta de login, token inválido, conta anônima, escopo dos produtos, preservação da consulta pública, geração de PDF, normalização de entrada e conservação das autorizações pagas padrão.
- As emissões autenticadas dos testes usam usuários e respostas de provedores sintéticos. Não comprovam uma consulta autenticada real em produção.
- Comparação de arquivos: somente 13 arquivos de controle de acesso, interface e testes alterados/adicionados; nenhuma mudança no motor de dados ou nas APIs públicas.

## Situação neste checkpoint

Código e testes prontos. Publicação em produção ainda não comprovada neste checkpoint.
A gestão da Vercel com escopo explícito da equipe retornou 403; não foram solicitadas ou expostas credenciais.
O build isolado usou as dependências já travadas do projeto, sem atualização de versões. O instalador avisou sobre a versão existente do Next.js; uma atualização de segurança deve ser tratada separadamente, com regressão, sem misturar esta mudança de acesso.

## Retorno seguro

O deployment original e a branch de backup preservam a versão anterior. Antes de reverter, conferir se houve mudanças posteriores na produção. Não usar force push nem substituir arquivos fora do escopo deste checkpoint.
