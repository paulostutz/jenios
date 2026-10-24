# B305-R34 — Worker privado de marketing

Base: R33 `900ee483b80fc7fe023b4f304554ec9225b2ca4d`.

O worker:
- só fica pronto no Preview exato da branch B305;
- exige `JENIOS_MARKETING_EMAILS_ENABLED=true`;
- exige credenciais server-side e domínio verificado;
- mantém os gates financeiros/reais desligados;
- faz claim via `jenios_claim_marketing_email_b305`;
- revalida identidade, consentimento, contexto e frequency cap;
- usa o adaptador puro `buildMarketingMessage`;
- envia usando o adaptador Resend já existente, com idempotência;
- conclui, suprime ou libera/retry no ledger por lease.

Certificação:
- testes usam transporte fake;
- nenhum envio real é necessário;
- o gate permanece `false` no Preview até ativação controlada futura.

`JENIOS_MARKETING_DELIVERY_WORKER_CERTIFIED` permanece `false` até CI/Preview deste bloco ficarem verdes.
