# JENIOS — checkpoint de pré-lançamento 02: publicado

## Versão e publicação

- Escopo exclusivo: JENIOS.
- Código publicado na branch `main`: `f5101669c93a239662d3c9a0d7c05ffb26c3a7c7`.
- A branch `main` avançou por fast-forward com conferência do SHA anterior, sem force push.
- SHA anterior preservado: `b2c09e4c54481a9310707f1b048cd23be839ffb5`.
- Contexto da integração: `Vercel – jenios-ecossistem`.
- Resultado enviado pela Vercel ao GitHub: `success` / `Deployment has completed` em `2026-10-16T03:18:51Z`.
- Identificador exibido no endereço de inspeção: `BFwk8EmY8peCLBhpqAXKhcHV9Z1E`.
- Domínio verificado: `jenios.com.br`, redirecionando para `www.jenios.com.br`.

## Regra publicada

A consulta básica permanece pública, sem login. Durante o pré-lançamento, a visualização e o PDF completos do BankScore e do Validador de Tokens são gratuitos, mas exigem conta cadastrada e autenticada. A validação ocorre também no servidor. Não há exigência de pedido ou pagamento para esses laudos nessa fase. Administradores continuam com o fluxo próprio autorizado. Especialistas, impulsionamento, integração Inter e assinaturas da Platform não receberam gratuidade.

## Testes antes da publicação

- 12 novos testes específicos da regra de pré-lançamento: aprovados.
- Suíte completa: 291 aprovados, zero falhas, zero ignorados.
- Build Next.js: concluído com código de saída 0.
- Geração dos dois PDFs verificada por testes com dados sintéticos, usando os geradores existentes.
- Comparação contra a base: consultas públicas, motores de análise, fontes, geradores de PDF, banco de dados e credenciais sem alterações.

## Verificações reais no domínio após o deploy

- `GET /bankscore/detalhado`: HTTP 200.
- `GET /social/consulta-detalhada`: HTTP 200; HTML contém “Relatório completo gratuito” e “Verificando sua conta”.
- `GET /api/bankscore/ranking`: HTTP 200 com lista de instituições e referência 202606; resposta não vazia.
- `POST /api/bankscore/detailed`, formato JSON, sem login: HTTP 401, “Entre na sua conta para continuar.”
- `POST /api/bankscore/detailed`, formato PDF, sem login: HTTP 401.
- `POST /api/crypto-validator/detailed`, formato PDF, sem login: HTTP 401.
- `POST /api/jenios-pay/checkout`, produto BankScore: HTTP 409, informando gratuidade e endereço do relatório; não inicia cobrança.
- `POST /api/jenios-pay/checkout`, produto Validador de Tokens: HTTP 409, informando gratuidade e endereço do relatório; não inicia cobrança.

Não foram criados pedidos, cobrados valores, inseridos usuários ou alterados registros bancários nos testes desta publicação.

## Limites da validação

O fluxo autenticado positivo e a emissão dos PDFs foram testados com identidades e respostas sintéticas, não com a conta real do proprietário em produção. O teste manual no celular, a criação de uma conta real e o download autenticado real permanecem para validação do usuário. A reprodução dos vídeos não foi alterada nem revalidada nesta etapa.

## Backups e continuidade

- Checkpoint 00: `checkpoints/jenios-prelaunch-00-producao-original` preserva o código anterior ao ajuste.
- Checkpoint 01: código testado `f5101669c93a239662d3c9a0d7c05ffb26c3a7c7`, com registro em `docs/checkpoints/JENIOS-PRELAUNCH-01.md` nesta branch de checkpoints.
- Checkpoint 02: este registro acrescenta a confirmação da publicação e os testes reais de proteção.
- Os commits individuais da implementação permanecem na branch `prelaunch/relatorios-social-20261015` e no histórico de `main`.
- Próximo escopo indicado pelo proprietário: tecnologia da JENIOS Platform. Nenhuma implementação da Platform foi iniciada nesta alteração.

A gratuidade não tem data automática de encerramento. Sua reversão exige mudança explícita de `REPORTS_PRELAUNCH` em `lib/reports/prelaunch.mjs`, testes e novo deploy aprovado. Antes de qualquer rollback, conferir alterações posteriores em produção.
