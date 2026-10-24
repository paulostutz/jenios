# B305-R39 — Revogação da sessão administrativa

## Base e problema confirmado

Base certificada: `6556215595dbc50949e85417319459ef6b8dda38` (R38).
Backup anterior ao bloco:
`backup/jenios-b305-r38-before-auth-journey-20261024-6556215`.

O guard `PlatformAdminAccess` já aceitava o Master da Social por meio de dois
endpoints de leitura verificados pelo backend, mas observava somente o Auth
dedicado da Platform. Uma saída ou troca da conta Social em outra aba podia
deixar permissões e indicadores anteriormente carregados montados na tela.
O transporte também não vinculava respostas atrasadas à revisão da sessão.

A autorização continuava sendo aplicada pelo servidor. O defeito confirmado
era a revogação da visualização e o isolamento de respostas no cliente.

## Correção delimitada

- O componente preserva sua assinatura e delega o ciclo de sessão a
  `lib/platform/admin-session.mjs`.
- O helper observa ambos os Auth e o retorno do foco à janela.
- Saída, troca, renovação e foco removem as permissões exibidas antes de
  agendar uma nova consulta. Os filhos administrativos são desmontados pelo guard.
- Cada requisição verifica origem, proprietário, token e revisão; cancela o
  transporte e rejeita resultados antigos, inclusive no caso A → B → A.
- A verificação acompanha o corpo completo da resposta, além dos cabeçalhos.
- Callbacks Auth permanecem síncronos. A consulta é agendada fora do callback,
  evitando aguardar `getSession` dentro do bloqueio do Auth.
- Cleanup cancela timers, aborta requisições e remove todas as inscrições.
- O fallback Social é limitado a GET nos dois caminhos exatos
  `/api/platform/admin/access` e `/api/platform/admin/overview`.
  O token Social segue apenas para `/api/admin/access` e
  `/api/admin/ecosystem`, que continuam verificando Master no servidor.

O código não muda a autorização backend, endpoints financeiros ou manifesto S05.
Não houve criação ou alteração de chaves, usuários ou schema. A correção de
escopo das variáveis de homologação está descrita abaixo.

## Verificação reproduzível

A suíte nova contém 26 testes comportamentais com Auth/HTTP simulados localmente.
Ela cobre logout e troca nos dois projetos, renovação, foco, corpo em streaming,
corridas, falhas de backend, metadados não confiáveis, destinos permitidos,
cancelamento e cleanup.

Regressão dirigida já executada localmente em Node 24.22.1: 47/47, sem falhas,
cancelamentos ou testes ignorados:

```bash
node --test --test-isolation=none \
  tests/platformAdminSessionR39.test.mjs \
  tests/platformCP65Sessions.test.mjs \
  tests/socialSessionSafety.test.mjs \
  tests/jeniosB305BlockAAdminContract.test.mjs
```

O primeiro CI R39, commit `7297d9eaf136df357d8be1b1eff99175b2937948`, passou
26/26 novos testes, mas parou na regressão geral: 1860/1861. O contrato B129
procurava os endpoints somente no componente anterior à extração do helper.
A falha foi reproduzida localmente (5/6 B129). O contrato foi atualizado para
ler o helper real, comprovar a ligação dos dois Auth no wrapper e manter a
comparação estrita de Master, a verificação backend e a proibição de troca de
sessão. Após o ajuste, B129 e R39 passaram 32/32 localmente.

O workflow B305 executa R39 e o contrato herdado B129 em Node 22, mantém todos os gates de R38 e
executa a regressão geral, integridade S05 e build Next. O resultado do run e o
SHA efetivamente certificados devem ser consultados no checkpoint final;
este documento de código não antecipa sucesso de um run futuro.

## Evidência e backup

O artefato técnico inclui o componente, helper, dependência inalterada,
teste e TAP de R39. Em caso de sucesso, um segundo artefato
`JENIOS_B305_R39_FULL_SOURCE` inclui o arquivo completo de código versionado
produzido por `git archive HEAD`, o commit e SHA-256.

A retenção dos artefatos Actions é de 30 dias. O backup de branch preserva
o commit no repositório. Esses backups de código não são backups dos bancos
nem incluem variáveis secretas.

## Limite da certificação de jornada

Os testes comportamentais não equivalem a login hospedado. A página de entrada
da Platform foi acessada no Preview R38 e informa que novos cadastros estão
fechados. O conector classificou respostas 401 como bloqueio de deployment.
A consulta HTTP direta, usando o cookie do link temporário autorizado pelo
Vercel, esclareceu o comportamento: `/api/platform/admin/access` e
`/api/platform/learning` retornaram 401 JSON da aplicação sem sessão; já
`/api/platform/diagnostico` retornou 503 por falta da configuração dedicada.

## Configuração de homologação e reversão

As cinco variáveis Platform existentes estavam limitadas à branch
`fix/jenios-b303-protected-readonly-preview-20261021`. Ambas as URLs foram
confirmadas como `https://xaicvhagftzjkqphnbgx.supabase.co`, e a abertura de
cadastros estava em `false`.

Foi atualizado somente o campo `gitBranch` dos registros abaixo para a branch
ativa `fix/jenios-b305-finance-email-20261022`, no projeto de homologação
`prj_9cRnjWFRsLkfTToF4U4xZQBa7Gq9`, mantendo o destino `preview`:

| Variável | ID existente |
|---|---|
| NEXT_PUBLIC_PLATFORM_SUPABASE_URL | LroSmMVGuCLTId4C |
| PLATFORM_SUPABASE_URL | cP8giLTkjWJuKEL0 |
| NEXT_PUBLIC_PLATFORM_SUPABASE_PUBLISHABLE_KEY | exVrN1brdaNouF9L |
| NEXT_PUBLIC_PLATFORM_SIGNUP_ENABLED | mkvjpEjxUoVqNg6b |
| PLATFORM_SUPABASE_SERVICE_ROLE_KEY | h4Gng4QfzoM0EYb7 |

Valores e tipos foram preservados; a credencial administrativa permaneceu
Secret/write-only. Não foi recuperada, copiada, rotacionada ou reclassificada.
A mudança será usada por novos deployments B305. Os deployments existentes
mantêm seu snapshot; um futuro rebuild da branch B303 exigirá reatribuir esses
mesmos registros à branch anterior. A reversão consiste em restaurar apenas
`gitBranch` nos cinco IDs, sem conhecer o valor secreto.

Fontes oficiais consultadas: [Config e Secret](https://vercel.com/docs/environment-variables/sensitive-environment-variables)
e [gestão de variáveis](https://vercel.com/docs/environment-variables/managing-environment-variables).
O resultado HTTP do novo Preview deve constar no checkpoint final.

## Aceite autenticado ainda necessário

O aceite autenticado em QA exige acesso legítimo às contas dos dois projetos:
Social `rebzztxlzofxpfwjvbee` e Platform `xaicvhagftzjkqphnbgx`.
O runner CP69 existente depende de credenciais administrativas protegidas,
cria contas temporárias e só aceita um servidor localhost específico; não
constitui prova deste Preview e não foi executado por este bloco.

Permanecem para a jornada autenticada: comparar Master e conta comum, sair e
trocar em outra aba, renovar e retomar foco, recarregar diagnóstico e verificar
o isolamento por usuário. A leitura autenticada da Universidade pode inicializar
progresso e reconciliar recibos já existentes, portanto deve usar contas de QA
controladas. Nenhum recibo pago ou entitlement será fabricado para obter acesso.
