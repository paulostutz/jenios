# B305-R23 — Marcos duráveis da Universidade

Base: checkpoint integral `caf3a08dcd641f20afdf9d9ccf30eea526a3a925`.

Fonte de verdade: `public.jenios_learning_state`, currículo `r26.1`.

Marcos persistidos:
- 5 aulas concluídas;
- 10 aulas concluídas;
- 15 aulas concluídas.

Regras:
- somente os 15 IDs oficiais contam;
- IDs duplicados ou desconhecidos não aumentam o progresso;
- trilhas são derivadas das três aulas oficiais de cada trilha;
- nota, placement e prova não criam nem bloqueiam marcos;
- outbox é idempotente por usuário + marco;
- trigger apenas enfileira; não envia e-mail.

Estado:
- migração aplicada na Social QA;
- fila estava zerada após a aplicação;
- `JENIOS_TRANSACTIONAL_EMAILS_ENABLED=false`;
- worker de entrega do marco permanece pendente;
- produção não foi alterada.
