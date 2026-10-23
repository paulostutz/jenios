# B305-R28 — Validação de entrega dos marcos da Universidade

Base: R27 `333981341476a0f949c88d9af5be68f69f8a5cc6`.

Este checkpoint adiciona somente a validação pura que será usada pelo worker transacional:
- currículo atual obrigatório;
- IDs oficiais e distintos;
- marcos 5/10/15;
- chave idempotente conferida;
- payload não pode alegar progresso maior que o estado persistido;
- trilhas derivadas do conjunto real de aulas concluídas.

Nenhuma função deste checkpoint envia e-mail, chama Resend ou altera fila.

A ligação final desta validação ao worker transacional permanece pendente porque a ferramenta bloqueou a alteração que toca o caminho de envio.
`JENIOS_UNIVERSITY_MILESTONE_DELIVERY_CERTIFIED=false` permanece correto.
