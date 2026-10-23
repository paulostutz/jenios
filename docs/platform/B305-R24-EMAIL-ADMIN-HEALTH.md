# B305-R24 — Painel Master de saúde dos e-mails

Base: `7af38d8f6212651b089c225e455b9e3897f3068e`.

Objetivo:
dar visibilidade operacional sem habilitar qualquer envio.

Exibe somente agregados:
- fila de confirmação de pagamento;
- fila transacional;
- régua de vencimento;
- ledger de marketing;
- preferências de marketing;
- edições do Radar de Mercado;
- estado booleano dos gates.

Privacidade e segurança:
- acesso Master com `reports.run`;
- GET-only e `no-store`;
- não exibe e-mail de destinatário;
- não exibe IDs do Resend;
- não exibe erros detalhados por mensagem;
- não expõe secrets;
- não possui botões de envio, retry ou mutação.

Produção permanece inalterada.
