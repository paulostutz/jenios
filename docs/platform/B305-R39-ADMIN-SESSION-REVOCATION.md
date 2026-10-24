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

Não há mudança de autorização backend, endpoint financeiro, manifesto S05,
configuração Vercel, chave, usuário ou schema neste bloco.

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

O workflow B305 executa a suíte R39 em Node 22, mantém todos os gates de R38 e
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
fechados. Chamadas às APIs protegidas feitas pelo conector encontraram a
proteção de deployment; esse 401 não prova o comportamento de autorização
da aplicação.

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
