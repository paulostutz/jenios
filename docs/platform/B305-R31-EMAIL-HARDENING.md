# B305-R31 — Hardening do módulo de e-mails

Base: R30 `7ce231834d2f36c7a4e39effb7ee0287e6f0e2df`.

Advisor consultado após as migrações do módulo de e-mails.

Correção aplicada:
- FK `jenios_pay_email_outbox_b305.recipient_user_id` agora possui índice de cobertura parcial:
  `jenios_b305_finance_outbox_recipient_idx`.

Resultado:
- o advisor deixou de reportar esta FK como não indexada;
- os avisos B305 remanescentes de `unused_index` são esperados enquanto a homologação permanece sem tráfego real;
- os avisos `RLS enabled no policy` nas filas privadas B305 são intencionais: as tabelas são service-role only e não têm acesso de cliente;
- avisos históricos da Social não foram alterados neste bloco.

Nenhum gate foi aberto, nenhum e-mail foi enviado e produção não foi alterada.
