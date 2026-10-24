# JENIOS B305 — E-mails corporativos e pagamento confirmado (preparação segura)

Data: 22/10/2026. Escopo: exclusivo JENIOS; sem deploy, sem ordens e sem cobrança.

## Inventário dos endereços
Remetente automático já informado pelo titular: `noreply@jenios.com.br`.
Endereços planejados, ainda sem comprovação de provisionamento:
`ceo@jenios.com.br`, `diretoria@jenios.com.br`, `administrativo@jenios.com.br`, `juridico@jenios.com.br`, `financeiro@jenios.com.br`, `compliance@jenios.com.br`, `paulostutz@jenios.com.br`, `fernandapimentel@jenios.com.br`, `marketing@jenios.com.br`, `sac@jenios.com.br`.
Resend com domínio verificado pode usar estes endereços como FROM sem criar mailbox com senha. Caixa postal, recebimento e credenciais por usuário exigem solução de inbox/hosting e confirmação do titular. Nunca guardar nem reutilizar senha informada em chat.

## Mensagem financeira
- Remetente: `Financeiro JENIOS <financeiro@jenios.com.br>`.
- Imagem: asset existente `public/brand/jenios-logo-horizontal.webp`, com URL absoluta de produção `https://www.jenios.com.br/brand/jenios-logo-horizontal.webp`.
- Assinatura HTML de Financeiro JENIOS, fallback de texto e escape HTML.
- Gatilho futuro: pedido **pago**, confirmação bancária validada, comprovante vinculado, destinatário confirmado; nunca cobrança emitida ou aguardando pagamento.
- Referência idempotente (hash SHA-256 da combinação orderId/receiptId), sem incluir segredo ou e-mail no identificador.

## Estado técnico B305
Arquivos novos: `lib/email/jenios-identity.mjs`, `lib/email/finance-payment-confirmation.mjs`, `tests/jeniosB305FinanceEmail.test.mjs`.
Apenas construção de template e verificação readiness; **nenhuma rota, webhook, worker, trigger SQL, cron ou cliente HTTP Resend foi habilitado ou modificado**. A função de readiness informa `ready=false` sem `JENIOS_PAYMENT_EMAILS_ENABLED=true` em Preview; mesmo com configuração, nenhum envio ocorre sem a integração de delivery.
Não inserir senha SMTP/API key em código, chat, artefatos ou variáveis públicas.
**Não declarar notificações automáticas em operação**.

## Próximo bloco de integração
1. Identificar provedor real de caixas de entrada (Resend envio vs recepção/hosting) e verificar domínio/DNS sem inventar provisionamento.
2. Criar ledger persistente no banco correto do JENIOS PAY para deduplicação de envio por (orderId, receiptId, emailType), reserva atômica, retries e histórico.
3. Integrar a confirmação `jenios_confirm_inter_pix` de maneira **pós-commit** com leitura verificada de pedido pago e destinatário autorizado. O endpoint de consulta GET não deve enviar duplicações; preferir fila/worker privado. Cobrir também futuros webhooks/recorrência sem disparos falsos.
4. Configurar segredo Resend só no backend e homologar destinatário de teste, SPF/DKIM/DMARC, imagens em clientes e segurança do redirecionamento.
5. Somente habilitar envio com aprovação expressa, após testes reais e revisão jurídica/fiscal. Nada de falsos recibos fiscais.

Produção Vercel `jenios-ecossistem` preservada; projeto QA B303 permanece separado.


## Atualização B305-R9 — Preview Finance-Locked

Em 22/10/2026, a branch `fix/jenios-b305-finance-email-20261022` foi preparada para Preview isolado no projeto `jenios-platform-homologacao`.

- `vercel.json`: removida somente a B305 das regras que cancelavam o próprio Preview; branches históricas permanecem bloqueadas.
- `lib/release/environment-scope.mjs`: B305 reconhecida apenas no modo `preview-b305-finance-locked`.
- O guard exige o projeto QA correto e todas as flags financeiras, Inter, execução real e envio de e-mail exatamente em `false`.
- Nenhuma credencial Resend, destinatário real ou segredo server-side foi ativado.
- Produção não foi modificada.


## B305-R13 — Régua de vencimento e inadimplência
- D-3: lembrete de vencimento.
- D0: aviso de vencimento no dia.
- D+1: atraso + aviso de cancelamento automático em 7 dias corridos.
- D+7: cancela somente a assinatura vencida e revoga o entitlement do mesmo produto; conta e outros produtos permanecem intactos.
- Pagamento confirmado antes de D+7 impede o cancelamento.
- Eventos idempotentes por assinatura + evento + vencimento.
- Scheduler preparado para 12:00 UTC (09:00 Bahia/Brasília), protegido por CRON_SECRET.
- Execução bloqueada enquanto JENIOS_SUBSCRIPTION_DUNNING_ENABLED != true.
