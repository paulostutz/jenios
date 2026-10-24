# B305-R27 — Matriz de prontidão de e-mails

Base: R26 `6a222215640ba3461ad2f75c9f032baa96cc64ce`.

O painel Master agora classifica cada requisito como:
- PRONTO;
- PENDENTE;
- BLOQUEADOR.

Bloqueadores automáticos:
- credencial principal do Resend ausente;
- domínio/remetente financeiro inválido;
- acesso server-side ao Supabase ou CRON secret ausente;
- linha em estado `uncertain`;
- falha terminal de marketing;
- qualquer gate de envio ligado durante a homologação isolada.

Pendências manuais rastreadas:
- `JENIOS_AUTH_TEMPLATES_APPLIED`;
- `JENIOS_RESEND_WEBHOOK_ENDPOINT_CERTIFIED`;
- `JENIOS_MARKETING_DELIVERY_WORKER_CERTIFIED`;
- `JENIOS_UNIVERSITY_MILESTONE_DELIVERY_CERTIFIED`.

Todas estão `false` no Preview neste checkpoint, refletindo o estado real.
A matriz não ativa nada e não possui controles de mutação.
