# R104 — operação privada de inspeção, recuperação e cancelamento Paper

## Entrega
O comando `scripts/platform/connections/r104-private-paper-operator.mjs` conecta os módulos existentes de Auth da Platform, diagnóstico persistido, conexão/cofre, B152, consulta oficial de conta, recuperação R93 e cancelamento R103. Processa uma requisição por execução e termina; não é servidor, fila nem rotina de negociação.

As ações disponíveis são:
- `inspect`: consulta conta, posições e ordens abertas em Alpaca Paper; informa diário local ausente, estados de segurança e número de ordens pendentes. Não concede autorização de negociação.
- `recover`: recupera a lista do diário existente e consulta a corretora para reconciliar. Funciona com kill switch engajado e não o desliga.
- `cancel`: aciona R103 para entrada não preenchida, com consentimento explícito, tentativa persistida antes de DELETE e confirmação posterior por GET.

O titular sempre vem de `auth.getUser`. O diagnóstico é lido de `jenios_platform_diagnostics` pelo módulo existente, validando metodologia e data; não é aceito como booleano fornecido pelo chamador. A validação recente do registro não altera a data original do diagnóstico nem constitui aprovação de risco.

## Contrato do host
Execução exclusivamente em Node privado. Vercel, runtime web e Lambda são recusados. A opção `JENIOS_R104_PRIVATE_OPERATOR_ENABLED` deve ser explicitamente true, o cofre demo precisa estar disponível e as opções de execução Live, envio de novas ordens, emissão de permissões e pagamentos devem ser false. O worker inerte R100 deve permanecer separado e também recusa a opção R104 ligada.

A CLI usa apenas a configuração dedicada da Platform (`PLATFORM_SUPABASE_URL` e `PLATFORM_SUPABASE_SERVICE_ROLE_KEY`), sem fallback para Social. A URL precisa coincidir com o projeto Platform que já está fixado no repositório. Não recebe URL, proprietário, chaves de corretora, evidência de diagnóstico, caminho do diário ou limites de risco no JSON.

O volume privado é definido por `JENIOS_R104_PRIVATE_VOLUME`. Diretório e arquivos devem ser privados e pertencer ao usuário do processo. O diário é derivado do UUID da conexão: `paper-<connectionId>.sqlite`. Recuperação e cancelamento exigem esse arquivo existente, inclusive sua conta já configurada com o mesmo vínculo. Arquivos simbólicos, hardlinks e permissões inseguras são recusados. Não se cria um diário substituto nem se inicializam limites automaticamente.

As opções por ação são:
| Opção | inspect | recover | cancel |
|---|---|---|---|
| JENIOS_R93_PRIVATE_NODE_WORKER | false | true | false |
| JENIOS_R93_READONLY_RECOVERY_ENABLED | false | true | false |
| JENIOS_PRIVATE_PAPER_RECOVERY_ENABLED | false | true | false |
| JENIOS_R103_PRIVATE_PAPER_CANCEL_ENABLED | false | false | true |

`JENIOS_DEMO_CONNECTORS_ENABLED` e `JENIOS_PRIVATE_PAPER_REHEARSAL` são true apenas nesse processo privado. O adaptador local entrega o marcador legado preview aos módulos Paper depois de recusar runtimes web; não modifica `process.env`, o projeto Vercel ou qualquer flag de produção.

## Entrada e saída
A entrada é JSON via stdin, com limite de 8 KiB e 10 segundos para leitura. Campos comuns: `action`, `accessToken`, `connectionId`. Cancelamento acrescenta `clientOrderId` e `confirmation` igual a `CANCEL_UNFILLED_PAPER_ENTRY_ONLY`. Argumentos na linha de comando são recusados para não expor tokens em argv. O token deve ser de sessão Platform autenticada do titular; credenciais de corretora continuam no cofre.

Em host privado previamente preparado, o formato de invocação é:

```sh
node scripts/platform/connections/r104-private-paper-operator.mjs < /run/secrets/jenios-operator-request.json
```

O arquivo de entrada deve vir do mecanismo privado de segredos, com acesso restrito, e não deve ser salvo no repositório, chat ou logs. A CLI não cria esse arquivo nem obtém credenciais do usuário. Não habilitar o comando no worker inerte como substituição do processo atual.

Há limite total de 60 segundos e timeout nas chamadas ao banco. A saída contém resumos limitados e códigos de erro fixos, sem token, chave, identificação externa da conta ou stack trace. Em timeout durante cancelamento, o registro R103 conserva a tentativa; não deve haver reenvio automático. Recuperação pode ser retomada por consulta explícita.

## Verificação
1.859 testes gerais e 94 Social/S05 aprovados localmente. Os 23 novos casos exercitam os módulos reais em conjunto com respostas externas simuladas: diagnóstico persistido, conta/owner incorretos, diário ausente, arquivo simbólico, permissão insegura, retomada, cancelamento único, consentimento revogado, proteção dos argumentos e entrada grande/malformada. Build Next.js local concluído com 81 páginas estáticas e verificação S05 local aprovada. A publicação desta etapa foi bloqueada pela revisão automática de aprovação, pois a autorização explícita anterior foi considerada restrita aos 11 arquivos da R103. CI remoto ainda não executado para R104.

## Limites
Sem conta externa autenticada nesta entrega, sem ordens reais ou simuladas enviadas e sem cancelamento externo executado. Nenhuma flag operacional foi ativada, nenhum banco Supabase foi alterado e nenhum serviço foi substituído. O comando ainda depende de conta Paper voluntária registrada no cofre, diagnóstico persistido, consentimento, diário íntegro e configuração privada do host. Não implementa envio Live, novas estratégias, as outras corretoras, restauração offsite ou certificação de rentabilidade. Homologação externa continua obrigatória.

