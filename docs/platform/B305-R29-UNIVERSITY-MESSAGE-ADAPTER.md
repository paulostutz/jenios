# B305-R29 — Adaptador puro dos marcos da Universidade

Base: R28 `de763b733de3746089ec7348347a3826f6787bf3`.

Entregas:
- adaptador puro `buildUniversityMilestoneMessage`;
- exige evidência já validada contra `jenios_learning_state`;
- normaliza e valida destinatário;
- usa o template institucional JENIOS já aprovado;
- não mostra “0 dias” quando não há streak persistida no evento;
- não acessa banco;
- não chama Resend;
- não altera fila;
- não possui efeitos colaterais.

Assim, a integração futura no worker fica reduzida a:
1. carregar identidade e `jenios_learning_state`;
2. chamar o adaptador puro;
3. usar o mecanismo de envio/idempotência já existente.

`JENIOS_UNIVERSITY_MILESTONE_DELIVERY_CERTIFIED=false` permanece até essa ligação final ser aplicada e certificada.
