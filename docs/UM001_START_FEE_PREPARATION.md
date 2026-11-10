# UM001 — Start por ciclo e controle administrativo preparado

## Estado da entrega

Candidata local isolada, com núcleo sem imports e sem transporte externo. Nenhuma rota foi criada, nenhum componente foi montado e nenhum robô foi alterado. Não houve navegador, DOM, prévia nem validação visual: o bloqueio anterior permanece respeitado. Não há publicação, negociação, cobrança ou débito real.

`lib/platform/ultra/fees-um001.mjs` contém um laboratório em memória. `components/ultra/UltraStartFeeAdmin.js` é um componente controlado preparado para um ponto administrativo futuro no Flow. `tests/ultra-fees-um001.test.mjs` exercita somente cenários fictícios.

## Regra de ciclo e identidade

A taxa confirmada é **R$ 5 por ciclo explícito**, do Start até a pausa ou o encerramento, independentemente da quantidade de negociações. O identificador central da conta e o identificador do ciclo formam a chave global. A plataforma não faz parte dessa chave: observações do mesmo ciclo em JENIOS e Flow devem convergir para o mesmo registro central e a mesma reserva.

O produtor autorizado do evento terá de atribuir um identificador durável antes de registrar o Start. O laboratório exige `intent: explicit_new_cycle`. Reconexão recebe o ciclo existente; não gera um novo. Repetição do Start preserva o registro, inclusive se o ciclo já estiver pausado ou encerrado. Mudança no início registrado para a mesma identidade produz conflito. Reutilização de uma chave de requisição para outro comando também produz conflito.

O registro de uma negociação fictícia serve apenas à demonstração de cardinalidade. Não executa, cancela nem modifica negociação. Uma negociação adicional não altera a taxa nem o valor reservado.

## Estados e valores

Os valores são inteiros em centavos. O único saldo aceito é um saldo fictício BRL explicitamente identificado. `availableSimulatedCents` corresponde ao saldo fictício menos reservas fictícias. `actualPlatformWalletBalanceCents` permanece `null`; `walletDebitAuthorized` permanece `false`.

| Estado da reserva | Significado |
| --- | --- |
| `pending_plan_definition` | Plano ausente ou enquadramento ainda não confirmado. Não reserva e não considera isento. |
| `pending_activation_definition` | Plano sujeito confirmado no fixture, mas ativação ainda não definida. |
| `not_required_exempt` | Isenção explícita em cadastro fictício, com referência de decisão fictícia. |
| `not_required_policy_paused` | Tarifa pausada para um plano sujeito confirmado. |
| `pending_simulated_balance` | Saldo fictício desconhecido; não fabrica zero. |
| `insufficient_simulated_balance` | Saldo disponível fictício menor que R$ 5; nenhuma reserva. |
| `reserved_simulated` | Uma reserva fictícia de R$ 5 para a conta e o ciclo. |

O ciclo permanece em `start_recorded` até um registro terminal `paused` ou `ended`. Esses estados documentam os eventos simulados; não confirmam execução real do robô. Pausa ou encerramento não captura, libera, estorna ou altera a reserva. O destino da reserva fica em `pending_capture_or_release_policy`.

Retomada comercial, falha de Start, recusa, captura, liberação e estorno não foram definidos nem implementados. Um ciclo terminal não é reaberto. Uma nova intenção explícita com outra identidade pode ser simulada; a aplicação futura deve distinguir um novo ciclo autorizado de uma reconexão ou retomada ainda sem regra definida.

O enquadramento e a versão da tarifa são registrados no Start. Alterações posteriores do controle não alteram nem cobram retroativamente os ciclos já registrados. Ciclos pendentes não são cobrados por uma repetição da requisição. Uma política futura de resolução dessas pendências deverá ser explícita e preservar a mesma chave financeira.

## Planos e configuração

Nenhum nome de plano real foi escolhido para isenção. Os testes usam exclusivamente nomes e identificadores fictícios com prefixo `synthetic:`. Um cadastro fornecido pelo harness declara `chargeable`, `exempt` ou `pending`. Classificações definidas exigem uma referência de evidência fictícia; a falta de classificação deixa a apuração pendente.

O consumidor não informa saldo, isenção, identidade administrativa ou autorização de débito no comando de Start. Esses dados não são inferidos da conexão da Wallet. O laboratório não possui adaptador de leitura de Wallet nem método de débito.

## Controle administrativo e ponto de integração

O Admin Flow atual é acessado pela área externa Kivoryn. Como esta tarefa exclui Kivoryn, não foi criada rota alternativa nem aproveitado um acesso de cliente como acesso administrativo.

O componente é controlado e recebe uma visão emitida pelo handler. O adaptador futuro deverá verificar uma sessão administrativa existente e uma permissão específica a cada leitura ou alteração. Na candidata, `authorizeAdmin` é um adaptador injetado pelo harness, sem rede, que só aceita identidades administrativas fictícias. A permissão de gestão é `ultra.start_fee.manage`; a leitura usa `ultra.start_fee.read`. O botão desabilitado é apenas comportamento visual: a validação efetiva ocorre novamente no handler.

`admin.setPlanEnabled` só aceita planos confirmados como sujeitos. Cada alteração exige motivo, `expectedVersion` e `requestId` estável. A verificação de versão acontece depois da autorização, imediatamente antes da escrita. O histórico acrescenta ator verificado, instante, motivo, estado anterior, novo estado e versão. Repetição idêntica não duplica o histórico. Reutilização divergente da chave falha. Uma mudança concorrente com versão antiga falha.

O callback `onChange` do componente prepara a intenção com plano, ativação, motivo e versão. O futuro contêiner administrativo deve anexar um `requestId` estável para aquela intenção, reutilizando-o nas tentativas, e obter a identidade pelo servidor. A identidade não deve vir do corpo do navegador. `canManage` controla apenas a apresentação.

## Limites das provas

A deduplicação e a reserva são atômicas somente dentro de **uma instância JavaScript em memória compartilhada** pelas duas plataformas fictícias. Os testes concorrentes usam essa instância; não comprovam persistência, concorrência distribuída, recuperação após reinício, integração Letter ou disponibilidade financeira real. Criar uma instância independente por plataforma quebraria a garantia global.

Para uma carteira de taxas funcional ainda faltam: identidade canônica compartilhada com a Letter; armazenamento central durável com unicidade por conta/ciclo e transação de reserva; saldo BRL autoritativo e sua reconciliação; autorização apropriada de reserva/débito; regras de captura, liberação, falha e estorno; definição nominal dos planos isentos; tratamento da retomada; ponto administrativo autenticado; reconciliação de eventos atrasados; e validação de integração e visual quando o bloqueio for resolvido. Não foi criado outro sistema de recebimento.

## Verificação

O teste `tests/ultra-fees-um001.test.mjs` cobre múltiplas negociações por ciclo, replay, reconexão entre plataformas, concorrência de reservas, segregação de contas, saldo desconhecido e insuficiente, planos pendentes/isentos/pausados, término sem captura ou estorno, conflitos de identidade, permissão administrativa, conexão Wallet de leitura sem autorização, histórico de alterações, concorrência por versão e isolamento de cópias retornadas.

Os resultados exatos da execução são registrados no checkpoint geral UM001 pelo responsável pela conciliação. Nenhum teste simulado é evidência de uma integração financeira real.
