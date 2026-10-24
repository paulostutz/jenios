# B305-R38 — Correção do candidato e revisão de integridade

Data: 24/10/2026. Escopo: concluir a correção e certificação técnica do candidato R37 da plataforma, conforme continuidade autorizada; produção e operação financeira continuam fora desta liberação.

## Referências preservadas

- Último checkpoint aprovado R36: `f6cad0fc9f0ae85aed6e5b28e85a9e2a146315fd`.
- Ponta R37 antes da correção: `e9df570123d784d986fd0da47ca7f0cfa7ed96c3`.
- Backup anterior às alterações: `backup/jenios-b305-r37-before-r38-repair-20261024-e9df570`.
- Artefato R37 reprovado: `12561853627`; SHA-256 `2359587994ba151bc580958c6d27fecaf69fb296886f6c1ba5ffff8656c39f7f`, conferido no arquivo baixado antes da edição. Evidência restrita, sem backup de banco ou credenciais.

## Causas verificadas e correção

O run `40098654995` falhou na verificação de integridade S05 das APIs de checkout; o run `40099278295` falhou antes, porque o segundo R37 substituiu configurações de publicação protegidas. Nenhum desses dois runs chegou a executar o Next build. A justificativa anterior sobre `maxDuration` foi retificada no documento R37.

`vercel.json` foi restaurado byte a byte ao R36, cujo Git blob é `ea2e22dd792543f05428fccc051c31b42bd60890`. Isso recupera as seis exclusões de branches, `ignoreCommand` e o único cron de dunning existente. A rota Social recupera `export const maxDuration = 60`, já presente no R36 aprovado, sem introduzir configuração de duração global ou externa.

O teste de configuração introduzido no R37 foi corrigido: agora recusa a configuração regressiva R37 e protege as restrições e o cron R36. Não foi removida a regressão B303 nem desabilitada checagem de tipos.

## Decisão de revisão do manifesto S05

O manifesto S05 foi congelado em 18/10, no commit `532ec207ca87030a88630b51f636052e9f73add5`. O R37 passou a proteger a entrada HTTP das duas rotas de contratação, tornando seus hashes históricos incompatíveis com o novo comportamento autorizado. A revisão deste candidato mantém a verificação de integridade e versiona explicitamente somente esses dois conteúdos após inspeção do diff e dos contratos comportamentais. Essa revisão de código não autoriza pagamentos, publicação ou mudanças de credenciais.

| Arquivo revisado | SHA-256 anterior | SHA-256 R38 |
|---|---|---|
| `app/api/jenios-pay/checkout/route.js` | `934f605b6d1f72edda5e244225856bd4ac0317c100f6f76e947860936e2749c3` | `71d7e32a425919a0c4c0584b3089910a03292d89f593b7f293604640a18a927e` |
| `app/api/platform/checkout/route.js` | `29df4d91f0226133dfde117e8415664bea74463353a5824aece6ea3213f025ce` | `f8a377dce9dff0b3f248f230d9eb16dffed98a4f583407b8fca02465fdf8485c` |

O manifesto continua contendo exatamente dez entradas. Os outros oito hashes permanecem idênticos, e `tests/release-s05/integrity.test.mjs` permanece sem alteração. A referência histórica continua disponível no commit R36 e nas branches de backup.

### Comportamento revisado

- A Platform mantém `requirePayToken` e `requirePayUser`; a Social mantém `requireReportBuyer` e a regra de visitantes.
- Os gates explícitos bloqueiam a contratação antes de criar o cliente de banco ou chamar o serviço financeiro. A Platform exige adicionalmente a certificação de ciclo de assinatura.
- Identidade autenticada, idempotência, preço, escopo e titularidade permanecem nos serviços existentes.
- O leitor existente limita o corpo a 8 KiB e rejeita JSON/estrutura/UTF-8 inválidos.
- Os dois relatórios gratuitos mantêm o retorno 409 com destino para a Social antes do checkout; isso não concede acesso ao relatório, cuja autorização continua nas rotas existentes.
- Os handlers mantêm respostas `no-store`. A revisão não adiciona credenciais, pagamentos ou permissões artificiais.

Mover os gates apenas ao serviço compartilhado não conservaria o bloqueio antes do banco nem o limite de leitura HTTP. Por isso, foram mantidas as alterações pontuais dos handlers, em vez de ampliar a mudança para middleware ou dependências compartilhadas.

## Verificação e evidências

O teste corrigido de configuração foi exercitado contra o conteúdo regressivo R37 e falhou; com o conteúdo R36 restaurado, passou. Os testes comportamentais existentes exercitam handlers com dependências locais e não fazem chamadas externas.

A CI mantém as flags de pagamentos, Inter, ordens, Paper, e-mails e chamadas operacionais desligadas. Executa os cenários A/B e configuração, a regressão geral, a suíte S05 e o Next build. O artefato agora inclui também configuração, manifesto, teste de integridade, teste de configuração, workflow e este registro, além dos arquivos e contratos já arquivados. Continua sendo um pacote de evidências restrito, não backup integral.

A aprovação final deve ser lida no run e no Preview do SHA efetivamente publicado na branch B305. A existência deste documento não representa CI aprovada. O Preview QA deve usar o projeto `prj_9cRnjWFRsLkfTToF4U4xZQBa7Gq9`, mantendo a branch B305 para herdar suas variáveis específicas de homologação.

## Limites e próximo aceite

Este bloco não cria usuários Auth, assinaturas, pagamentos, cobranças, disparos, chamadas pagas ou ordens. Não altera banco, credenciais, preços, lógica dos robôs ou produção. A homologação autenticada hospedada e o ciclo comercial real continuam dependendo de evidências próprias; testes locais/CI e Preview READY não os substituem.
