# S05-B05 — Exclusão e retenção, documentação para compliance

Fluxo já homologado no banco isolado: pedido do proprietário, cancelamento de pedido pendente, reabertura mediante sessão recente, auditoria append-only. **Não existe exclusão definitiva automática.**

No banco ativo JENIOS, vínculos com `auth.users` identificados como `NO ACTION` incluem pedidos financeiros, assinaturas, direitos adquiridos, auditoria administrativa e mensagens. Exclusão automática poderia violar retenção contratual/financeira e referências cruzadas.

Implementação futura depende de parecer jurídico e política publicada de retenção, verificação de identidade do solicitante, validação de obrigações pendentes, revogação de sessões, remoção/anônimização de dados não sujeitos à retenção, auditoria irreversível e resposta ao usuário. Nenhum desses passos destrutivos foi executado pelo S05.

A função `evaluateAccountErasure` produz **somente decisões de bloqueio/revisão humana**, nunca SQL, chamadas a `auth.admin.deleteUser` ou exclusão em Storage. A presença ou ausência de FKs não é prova suficiente para apagar registros.
