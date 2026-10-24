# B305-R19 — E-mails do ciclo da assinatura

Base:
- R18: `0ce80e40f2c6cc27603f20bdd5c37c6ec8ac6a4d`;
- CI R18: `39879815542` SUCCESS;
- backup R18: artefato `12470196744`, digest `sha256:57786111bb6aa24cf873cff13dfac3999156954322cdd40994144cd69167aa1c`.

Eventos adicionados ao outbox privado:
- `plan_cancel_scheduled`;
- `plan_cancelled` para cancelamento solicitado/programado;
- `plan_reactivated` após retorno a ativo com pedido pago + entitlement ativo;
- `plan_changed` com produto anterior e novo produto preservados.

Separação importante:
- cancelamento automático por inadimplência em D+7 continua na régua `cancelled_7d`;
- o evento `plan_cancelled` deste bloco exige `cancel_at_period_end=true`, evitando e-mail duplicado da inadimplência.

Todos os templates usam o layout institucional aprovado, remetente Financeiro JENIOS e não contêm marcadores internos.

Estado operacional:
- `JENIOS_TRANSACTIONAL_EMAILS_ENABLED=false`;
- nenhuma cobrança, assinatura ou pagamento é criado por este bloco;
- nenhuma mensagem é enviada pelo banco;
- produção permanece inalterada.
