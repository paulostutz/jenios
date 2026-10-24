# B305-R25 — Supressão de bounce/complaint: checkpoint seguro

Base certificada: R24 `60d4173ae604ceed04ecacd1d311deb7b61cb769`.

Aplicado na Social QA:
- tabela privada `jenios_resend_webhook_events_b305`;
- RPC `jenios_ingest_resend_suppression_b305`;
- idempotência por event ID;
- complaint desativa marketing;
- hard bounce desativa marketing;
- bounce transitório permanece apenas como evento ignorado;
- usuário desconhecido não cria preferência;
- o ledger não armazena endereço de e-mail.

Estado operacional:
- `JENIOS_RESEND_WEBHOOK_ENABLED=false`;
- signing secret ainda não foi cadastrado;
- endpoint HTTP assinado não está ativo neste checkpoint;
- nenhum webhook foi criado automaticamente no Resend;
- nenhum e-mail é enviado por esta infraestrutura;
- produção permanece intocada.

Próxima etapa futura:
validar e versionar o endpoint de assinatura sobre corpo bruto antes de qualquer ativação.
