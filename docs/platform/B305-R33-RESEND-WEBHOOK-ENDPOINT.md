# B305-R33 — Endpoint assinado do webhook Resend

Base: R32 `50e63d6d84b6d8c756bc598f5ee1a94006dd5947`.

Implementado:
- `POST /api/webhooks/resend`;
- leitura do corpo bruto;
- validação dos headers `svix-id`, `svix-timestamp` e `svix-signature`;
- HMAC SHA-256 compatível com Svix;
- janela anti-replay de 5 minutos;
- limite de payload de 64 KiB;
- somente `email.bounced` e `email.complained` são processados;
- apenas bounce `Permanent` vira hard bounce;
- evento não suportado é ignorado;
- gravação somente via `jenios_ingest_resend_suppression_b305`;
- nenhuma chamada ao endpoint de envio do Resend.

Segurança operacional:
- `JENIOS_RESEND_WEBHOOK_ENABLED=false` permanece;
- `RESEND_WEBHOOK_SECRET` não é armazenado no repositório;
- `JENIOS_RESEND_WEBHOOK_ENDPOINT_CERTIFIED=false` permanece até cadastro do signing secret real e teste controlado com o Resend;
- produção não foi alterada.
